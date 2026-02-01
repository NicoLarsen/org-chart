import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Box, Spinner, Text, useColorModeValue, VStack, HStack, useToast, AlertDialog, AlertDialogBody, AlertDialogFooter, AlertDialogHeader, AlertDialogContent, AlertDialogOverlay, Button, Input, IconButton, Icon, Badge } from '@chakra-ui/react';
import Tree, { RawNodeDatum, CustomNodeElementProps, Point } from 'react-d3-tree';
import { Activity } from '@hailer/app-sdk';
import useHailer from '../hailer/use-hailer';
import { Employee, TreeNode, SkeletonNode, SkeletonConfig, TeamInfo } from '../types';
import { buildTreeWithValidation, DataIntegrityError, OrganizationOption } from '../utils/buildTree';
import { WORKFLOW_ID, PHASE_IDS, FIELD_KEYS, TEAMS, VACANCIES, CHANGE_MANAGEMENT, DISCIPLINARY_ACTIONS, ALL_WORKFLOW_IDS } from '../constants/fields';
import { useFieldSchema } from '../hooks/useFieldSchema';
import EmployeeCard from './EmployeeCard';
import TeamPickerPopup from './TeamPickerPopup';
import FindResourcePopup from './FindResourcePopup';
import TeamSeparatorPill from './TeamSeparatorPill';
import TeamActionButtons from './TeamActionButtons';
import TeamDashboardPopup from './TeamDashboardPopup';
import { FACrosshairs } from '../hailerTheme/hailerIcons/FACrosshairs';
import { FAAnglesDown } from '../hailerTheme/hailerIcons/FAAnglesDown';
import { FAAnglesUp } from '../hailerTheme/hailerIcons/FAAnglesUp';
import { FABuilding } from '../hailerTheme/hailerIcons/FABuilding';
import { FAPlus } from '../hailerTheme/hailerIcons/FAPlus';
import { HailerShare } from '../hailerTheme/hailerIcons/HailerShare';
import { FATableCells } from '../hailerTheme/hailerIcons/FATableCells';
import PermissionsMatrix from './PermissionsMatrix';

// App ID and workspace ID for public URL generation
const APP_ID = '697d1e735d7aa85c928e5a44';
const WORKSPACE_ID = '697d1e665d7aa85c928e59f8';

// Public insight key for fetching data without authentication
// TODO: Create a public insight in this workspace and update this key
const PUBLIC_INSIGHT_KEY = 'ae36c4657d695b61e95a17747a84220b';

// Public API URLs for both app.hailer.com and next.hailer.com
const PUBLIC_API_URL = 'https://api.hailer.com/api/v3/insight/public';

interface OrgChartProps {
  isPublic?: boolean;
}

// Type for public insight data response
interface PublicInsightResponse {
  data: {
    headers: string[];
    rows: (string | null)[][];
    time: number;
  };
  insight: {
    name: string;
    presets: unknown[];
  };
}

// Workflow IDs to watch for changes
const WATCHED_WORKFLOWS = [WORKFLOW_ID, TEAMS.WORKFLOW_ID, DISCIPLINARY_ACTIONS.WORKFLOW_ID, VACANCIES.WORKFLOW_ID];

// Team colors for visual distinction in multi-team view
const TEAM_COLORS = [
  '#3182CE', // blue.500
  '#38A169', // green.500
  '#D69E2E', // yellow.500
  '#E53E3E', // red.500
  '#805AD5', // purple.500
  '#DD6B20', // orange.500
  '#00B5D8', // cyan.500
  '#D53F8C', // pink.500
];

// Extended node type that includes our employee data
interface OrgNodeDatum extends RawNodeDatum {
  employee: Employee;
  childrenTeams: TeamInfo[]; // Array of teams for multi-team support
  isHeadOfTeam?: boolean;
  totalDescendantsCount?: number;
  actualChildrenCount?: number; // Actual number of children (even when collapsed)
  isCollapsed?: boolean; // Whether this node is collapsed
  depth?: number; // Node depth in tree (for centering calculations)
  // Multi-team child info (set on children when parent has multiple teams)
  teamInfo?: TeamInfo; // This child's team (with color)
  isFirstOfTeam?: boolean; // True if this is the first child in its team group
  parentHasMultipleTeams?: boolean; // True if parent has >1 team
  children?: OrgNodeDatum[];
  __rd3t?: {
    collapsed?: boolean;
    id?: string;
  };
}

// Find all descendant IDs of a node (for collapsing when parent expands)
function findAllDescendantIds(
  parentId: string,
  employees: Employee[],
  skeletons: SkeletonNode[]
): string[] {
  const descendants: string[] = [];
  const directChildren = [
    ...employees.filter(e => e.supervisor?._id === parentId),
    ...skeletons.filter(s => s.parentId === parentId)
  ];

  for (const child of directChildren) {
    const childId = 'tempId' in child ? child.tempId : child._id;
    descendants.push(childId);
    descendants.push(...findAllDescendantIds(childId, employees, skeletons));
  }

  return descendants;
}

// Count total descendants in a tree node (all children, grandchildren, etc.)
function countTotalDescendants(node: TreeNode): number {
  let count = node.children.length;
  for (const child of node.children) {
    count += countTotalDescendants(child);
  }
  return count;
}

// Convert our TreeNode to react-d3-tree format
// depth: current depth in tree (0 = root/CEO, 1 = direct reports, etc.)
// defaultExpandDepth: nodes at depth > this will be collapsed by default
// expandedNodes: nodes user has explicitly expanded (override auto-collapse)
// collapsedNodes: nodes user has explicitly collapsed (override auto-expand)
function convertToD3Tree(
  node: TreeNode,
  expandedNodes: Set<string>,
  collapsedNodes: Set<string>,
  depth: number = 0,
  defaultExpandDepth: number = 1
): OrgNodeDatum {
  // Group children by team - use team NAME as the canonical key for grouping
  // This handles the case where employees have team="Management team" (string) and
  // skeletons have team={ _id: "mgmt-id", name: "" } (object with ID but no name)
  const teamMap = new Map<string, { id: string | null; name: string; count: number; descendants: number }>();

  // Build a mapping from team ID to team name using parent's headOfTeam info
  // This lets us resolve skeleton team IDs to proper team names
  const teamIdToName = new Map<string, string>();
  if (node.employee.headOfTeam) {
    teamIdToName.set(node.employee.headOfTeam._id, node.employee.headOfTeam.name);
  }
  // Also collect from children that have both ID and name
  node.children.forEach(child => {
    const team = child.employee.team;
    if (team && typeof team === 'object' && team._id && team.name) {
      teamIdToName.set(team._id, team.name);
    }
  });

  node.children.forEach(child => {
    const team = child.employee.team;
    const teamId = team && typeof team === 'object' ? team._id : null;
    let teamName = team ? (typeof team === 'object' ? team.name : team) : '';

    // If skeleton has ID but no name, look up the name from our mapping
    if (teamId && !teamName) {
      teamName = teamIdToName.get(teamId) || '';
    }

    // Use team NAME as the canonical key (or 'unassigned' if no team)
    const mapKey = teamName || 'unassigned';

    if (!teamMap.has(mapKey)) {
      teamMap.set(mapKey, { id: teamId, name: teamName || 'Unassigned', count: 0, descendants: 0 });
    }
    const entry = teamMap.get(mapKey)!;
    // Update team ID if we find one (from skeleton or employee with object team)
    if (teamId && !entry.id) {
      entry.id = teamId;
    }
    entry.count++;
    entry.descendants += 1 + countTotalDescendants(child);
  });

  // Convert to array, sorted by team name (Unassigned last)
  const childrenTeams: TeamInfo[] = Array.from(teamMap.entries())
    .map(([_key, data], index) => ({
      id: data.id,
      name: data.name,
      memberCount: data.count,
      totalDescendants: data.descendants,
      color: TEAM_COLORS[index % TEAM_COLORS.length], // Assign color
    }))
    .sort((a, b) => {
      if (a.name === 'Unassigned') return 1;
      if (b.name === 'Unassigned') return -1;
      return a.name.localeCompare(b.name);
    });

  // Re-assign colors after sorting to maintain consistent order
  childrenTeams.forEach((team, index) => {
    team.color = TEAM_COLORS[index % TEAM_COLORS.length];
  });

  // Add headOfTeam if employee is head of a team not already represented
  const isHeadOfTeam = !!node.employee.headOfTeam;
  if (node.employee.headOfTeam) {
    const hotName = node.employee.headOfTeam.name;
    const hotId = node.employee.headOfTeam._id;
    const exists = childrenTeams.some(t => t.id === hotId || t.name === hotName);
    if (!exists) {
      // Insert at position 0 with first color
      childrenTeams.unshift({
        id: hotId,
        name: hotName,
        memberCount: 0,
        totalDescendants: 0,
        color: TEAM_COLORS[0],
      });
      // Re-assign colors to maintain order
      childrenTeams.forEach((team, index) => {
        team.color = TEAM_COLORS[index % TEAM_COLORS.length];
      });
    }
  }

  // Create maps for child lookup - by ID (preferred) and by name (fallback)
  const teamInfoByIdMap = new Map<string, TeamInfo>();
  const teamInfoByNameMap = new Map<string, TeamInfo>();
  childrenTeams.forEach(t => {
    if (t.id) {
      teamInfoByIdMap.set(t.id, t);
    }
    teamInfoByNameMap.set(t.name, t);
  });

  // Calculate total descendants count for this branch
  const totalDescendantsCount = countTotalDescendants(node);

  // Determine collapse state:
  // 1. If user explicitly expanded this node -> not collapsed
  // 2. If user explicitly collapsed this node -> collapsed
  // 3. Otherwise, use default: collapsed if depth >= defaultExpandDepth
  const isExplicitlyExpanded = expandedNodes.has(node.employee._id);
  const isExplicitlyCollapsed = collapsedNodes.has(node.employee._id);
  const shouldAutoCollapse = depth >= defaultExpandDepth && node.children.length > 0;

  let isCollapsed = false;
  if (isExplicitlyExpanded) {
    isCollapsed = false;
  } else if (isExplicitlyCollapsed) {
    isCollapsed = true;
  } else {
    isCollapsed = shouldAutoCollapse;
  }

  // Track which teams we've seen to mark first child of each team
  const seenTeams = new Set<string>();
  const hasMultipleTeams = childrenTeams.length > 1;

  // Only include children if this node is expanded
  // react-d3-tree overwrites __rd3t.collapsed, so we control collapse by omitting children
  const convertedChildren = isCollapsed
    ? []
    : node.children.map(child => {
        const converted = convertToD3Tree(child, expandedNodes, collapsedNodes, depth + 1, defaultExpandDepth);

        // If parent has multiple teams, add team info to child
        if (hasMultipleTeams) {
          const childTeam = child.employee.team;
          const childTeamId = childTeam && typeof childTeam === 'object' ? childTeam._id : null;
          let childTeamName = childTeam
            ? (typeof childTeam === 'object' ? childTeam.name : childTeam)
            : '';

          // If skeleton has ID but no name, resolve using our mapping
          if (childTeamId && !childTeamName) {
            childTeamName = teamIdToName.get(childTeamId) || '';
          }

          // Use resolved name for lookup, or 'Unassigned' for display
          const lookupName = childTeamName || 'Unassigned';

          // Look up by name (canonical key), fall back to ID if available
          converted.teamInfo = teamInfoByNameMap.get(lookupName)
            || (childTeamId ? teamInfoByIdMap.get(childTeamId) : undefined);

          // Track seen teams by NAME (canonical key) to ensure proper grouping
          const teamKey = childTeamName || 'Unassigned';
          converted.isFirstOfTeam = !seenTeams.has(teamKey);
          converted.parentHasMultipleTeams = true;
          seenTeams.add(teamKey);
        }

        return converted;
      });

  const result: OrgNodeDatum = {
    name: node.employee.name,
    employee: node.employee,
    childrenTeams,
    isHeadOfTeam,
    totalDescendantsCount,
    actualChildrenCount: node.children.length, // Store actual count for display
    isCollapsed, // Store collapsed state for UI
    depth, // Store depth for centering calculations
    children: convertedChildren,
  };

  return result;
}

export default function OrgChart({ isPublic = false }: OrgChartProps) {
  const { hailer, config, lastSignal, isActivitySignal } = useHailer();
  const { getFieldId, isLoading: schemaLoading, error: schemaError } = useFieldSchema({
    workflowIds: [...ALL_WORKFLOW_IDS],
    hailer,
  });
  const toast = useToast();

  // Memoized field IDs resolved from keys - recalculates when schema is loaded
  const fieldIds = useMemo(() => ({
    // Employee Directory fields
    position: getFieldId(WORKFLOW_ID, FIELD_KEYS.POSITION),
    team: getFieldId(WORKFLOW_ID, FIELD_KEYS.TEAM),
    supervisor: getFieldId(WORKFLOW_ID, FIELD_KEYS.SUPERVISOR),
    nationality: getFieldId(WORKFLOW_ID, FIELD_KEYS.NATIONALITY),
    dateOfBirth: getFieldId(WORKFLOW_ID, FIELD_KEYS.DATE_OF_BIRTH),
    salary: getFieldId(WORKFLOW_ID, FIELD_KEYS.SALARY),
    totalCost: getFieldId(WORKFLOW_ID, FIELD_KEYS.TOTAL_COST),
    status: getFieldId(WORKFLOW_ID, FIELD_KEYS.STATUS),
    // Teams fields
    headOfTeam: getFieldId(TEAMS.WORKFLOW_ID, TEAMS.FIELD_KEYS.HEAD_OF_TEAM),
    parentTeam: getFieldId(TEAMS.WORKFLOW_ID, TEAMS.FIELD_KEYS.PARENT_TEAM),
    isTopTeam: getFieldId(TEAMS.WORKFLOW_ID, TEAMS.FIELD_KEYS.IS_TOP_TEAM),
    // Change Management fields
    cmPerson: getFieldId(CHANGE_MANAGEMENT.WORKFLOW_ID, CHANGE_MANAGEMENT.FIELD_KEYS.PERSON),
    cmPreviousPosition: getFieldId(CHANGE_MANAGEMENT.WORKFLOW_ID, CHANGE_MANAGEMENT.FIELD_KEYS.PREVIOUS_POSITION),
    // Vacancies fields
    vacancyTeam: getFieldId(VACANCIES.WORKFLOW_ID, VACANCIES.FIELD_KEYS.TEAM),
    vacancyPosition: getFieldId(VACANCIES.WORKFLOW_ID, VACANCIES.FIELD_KEYS.POSITION),
    vacancyApplicationPeriod: getFieldId(VACANCIES.WORKFLOW_ID, VACANCIES.FIELD_KEYS.APPLICATION_PERIOD),
  }), [getFieldId]);

  // Track if schema is ready (required fields are resolved)
  const schemaReady = !!(fieldIds.team && fieldIds.supervisor);

  // Core state
  const [treeData, setTreeData] = useState<OrgNodeDatum | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<DataIntegrityError | null>(null);
  // Multi-organization support
  const [availableOrgs, setAvailableOrgs] = useState<OrganizationOption[] | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [showOrgPicker, setShowOrgPicker] = useState(false);
  const [orgCustomNames, setOrgCustomNames] = useState<Record<string, string>>({});
  const [defaultOrgId, setDefaultOrgId] = useState<string | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false); // Track if config has been loaded
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [editingOrgName, setEditingOrgName] = useState<string>('');
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [translate, setTranslate] = useState<Point>({ x: 487, y: 197 });
  const [reloadTrigger, setReloadTrigger] = useState(0);
  // Key to force Tree component re-mount when we need to reset collapse state
  const [treeKey, setTreeKey] = useState(0);
  // Draggable center markers for calibration
  const [centerMarkerY, setCenterMarkerY] = useState(197);
  const [centerMarkerX, setCenterMarkerX] = useState(487);
  const [isDraggingMarkerY, setIsDraggingMarkerY] = useState(false);
  const [isDraggingMarkerX, setIsDraggingMarkerX] = useState(false);
  const [showHelperLines, setShowHelperLines] = useState(false);
  // Track if all nodes are expanded (for toggle button)
  const [isAllExpanded, setIsAllExpanded] = useState(false);
  // Track zoom level to preserve user's zoom when recentering
  const [zoom, setZoom] = useState(0.8);

  // Refs
  const lastProcessedSignal = useRef<string | null>(null);
  // Track nodes user has explicitly expanded (beyond default depth)
  const expandedNodesRef = useRef<Set<string>>(new Set());
  // Track nodes user has explicitly collapsed (within default depth)
  const collapsedNodesRef = useRef<Set<string>>(new Set());
  const employeesRef = useRef<Employee[]>([]);
  const selectedOrgIdRef = useRef<string | null>(null);
  const userHasSelectedOrgRef = useRef(false); // Track if user has manually selected an org
  const loadOrgChartRef = useRef<(() => Promise<void>) | null>(null); // Ref to latest loadOrgChart to avoid effect dep
  const treeRef = useRef<any>(null);
  const skeletonsLoadedRef = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Default expand depth: 1 means show root (depth 0) and first level (depth 1) expanded
  const DEFAULT_EXPAND_DEPTH = 1;

  // Skeleton state (persisted)
  const [skeletons, setSkeletons] = useState<SkeletonNode[]>([]);

  // Popup states
  const [selectedSkeletonId, setSelectedSkeletonId] = useState<string | null>(null);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [showFindResource, setShowFindResource] = useState(false);
  const [pendingTeamParentId, setPendingTeamParentId] = useState<string | null>(null);
  const [deleteConfirmSkeletonId, setDeleteConfirmSkeletonId] = useState<string | null>(null);
  // Team dashboard popup state
  const [dashboardTeamId, setDashboardTeamId] = useState<string | null>(null);

  // Permissions matrix popup state
  const [showPermissionsMatrix, setShowPermissionsMatrix] = useState(false);

  // Orphan tracking state
  const [orphanedEmployees, setOrphanedEmployees] = useState<Employee[]>([]);
  const [placedEmployeeIds, setPlacedEmployeeIds] = useState<Set<string>>(new Set());
  const [orphanReasons, setOrphanReasons] = useState<Map<string, string>>(new Map());

  // Track employee IDs that have pending team creation (showing Knight Rider skeleton)
  const [pendingTeamCreations, setPendingTeamCreations] = useState<Set<string>>(new Set());

  // Teams data for picker and dashboard (includes parentTeam for hierarchy)
  const [teamsData, setTeamsData] = useState<Array<{ _id: string; name: string; parentTeamId: string | null }>>([]);

  const bgColor = useColorModeValue('gray.50', 'gray.800');

  // ============== Skeleton Persistence ==============
  // localStorage keys for fallback persistence (namespaced by workflow)
  const LS_KEY_SKELETONS = `orgchart_skeletons_${WORKFLOW_ID}`;
  const LS_KEY_ORG_NAMES = `orgchart_orgCustomNames_${WORKFLOW_ID}`;
  const LS_KEY_DEFAULT_ORG = `orgchart_defaultOrgId_${WORKFLOW_ID}`;

  // Save version counter to prevent stale saves from overwriting newer ones
  const saveVersionRef = useRef(0);

  // Load from localStorage (fallback)
  const loadFromLocalStorage = useCallback(() => {
    try {
      const skeletonsStr = localStorage.getItem(LS_KEY_SKELETONS);
      if (skeletonsStr) {
        const parsed = JSON.parse(skeletonsStr) as SkeletonConfig;
        setSkeletons(parsed.skeletons || []);
        console.log('Loaded skeletons from localStorage:', parsed.skeletons?.length || 0);
      }

      const orgNamesStr = localStorage.getItem(LS_KEY_ORG_NAMES);
      if (orgNamesStr) {
        const parsed = JSON.parse(orgNamesStr) as Record<string, string>;
        setOrgCustomNames(parsed);
        console.log('Loaded org names from localStorage:', parsed);
      }

      const defaultOrgStr = localStorage.getItem(LS_KEY_DEFAULT_ORG);
      if (defaultOrgStr) {
        setDefaultOrgId(defaultOrgStr);
        console.log('Loaded default org from localStorage:', defaultOrgStr);
      }
    } catch (err) {
      console.error('Error loading from localStorage:', err);
    }
  }, []);

  // Load skeletons and org names from app config (with localStorage fallback)
  const loadSkeletonsFromConfig = useCallback(() => {
    if (skeletonsLoadedRef.current) return;

    // If no config yet, try localStorage first
    if (!config) {
      loadFromLocalStorage();
      skeletonsLoadedRef.current = true;
      setConfigLoaded(true);
      return;
    }

    console.log('Loading config, fields:', config.fields ? Object.keys(config.fields) : 'none');

    // Check if config has any data
    const hasConfigData = config.fields && Object.keys(config.fields).length > 0;

    if (!hasConfigData) {
      // Config is empty, use localStorage
      console.log('Config empty, falling back to localStorage');
      loadFromLocalStorage();
      skeletonsLoadedRef.current = true;
      setConfigLoaded(true);
      return;
    }

    try {
      const storedValue = config.fields?.skeletons?.value;
      if (storedValue && typeof storedValue === 'string') {
        const parsed = JSON.parse(storedValue) as SkeletonConfig;
        setSkeletons(parsed.skeletons || []);
        console.log('Loaded skeletons from config:', parsed.skeletons?.length || 0);
      }

      // Load custom org names (handle both json object and string formats)
      const orgNamesValue = config.fields?.orgCustomNames?.value;
      if (orgNamesValue) {
        const parsed = typeof orgNamesValue === 'string'
          ? JSON.parse(orgNamesValue) as Record<string, string>
          : orgNamesValue as unknown as Record<string, string>;
        setOrgCustomNames(parsed);
        console.log('Loaded custom org names from config:', parsed);
      }

      // Load default org
      const defaultOrgValue = config.fields?.defaultOrgId?.value;
      if (defaultOrgValue) {
        setDefaultOrgId(String(defaultOrgValue));
        console.log('Loaded default org from config:', defaultOrgValue);
      }
    } catch (err) {
      console.error('Error loading config:', err);
      // Fall back to localStorage on error
      loadFromLocalStorage();
    }
    skeletonsLoadedRef.current = true;
    setConfigLoaded(true);
  }, [config, loadFromLocalStorage]);

  // Save skeletons to app config (and localStorage fallback)
  const saveSkeletonsToConfig = useCallback(async (newSkeletons: SkeletonNode[]) => {
    // Increment save version to track this save request
    saveVersionRef.current += 1;
    const thisSaveVersion = saveVersionRef.current;

    // Update local state immediately for responsiveness
    setSkeletons(newSkeletons);
    // Also update ref to ensure handlers see latest data
    skeletonsRef.current = newSkeletons;

    const configData: SkeletonConfig = {
      skeletons: newSkeletons,
      version: 1,
    };

    // Always save to localStorage as fallback
    try {
      localStorage.setItem(LS_KEY_SKELETONS, JSON.stringify(configData));
      console.log('Saved skeletons to localStorage, count:', newSkeletons.length);
    } catch (err) {
      console.error('Error saving skeletons to localStorage:', err);
    }

    if (!hailer) {
      console.log('No hailer instance, saved to localStorage only');
      return;
    }

    // Check if this save is still the latest before async operation
    if (saveVersionRef.current !== thisSaveVersion) {
      console.log('Skipping stale save, version:', thisSaveVersion, 'current:', saveVersionRef.current);
      return;
    }

    try {
      // Use undefined to update current app's config
      console.log('Saving skeletons to config, count:', newSkeletons.length, 'version:', thisSaveVersion);

      await hailer.app.config.update(undefined, {
        fields: {
          skeletons: {
            type: 'string',
            value: JSON.stringify(configData),
          },
        },
      });

      // Only log success if this was still the latest save
      if (saveVersionRef.current === thisSaveVersion) {
        console.log('Saved skeletons to config successfully, version:', thisSaveVersion);
      } else {
        console.log('Save completed but newer save exists, version:', thisSaveVersion, 'current:', saveVersionRef.current);
      }
    } catch (err: any) {
      console.error('Error saving skeletons to config:', err);
      // Already saved to localStorage, so data is preserved
    }
  }, [hailer, LS_KEY_SKELETONS]);

  // Load skeletons when config is available
  useEffect(() => {
    console.log('Config effect triggered, config:', config, 'skeletonsLoadedRef:', skeletonsLoadedRef.current);
    loadSkeletonsFromConfig();
  }, [loadSkeletonsFromConfig]);

  // When config loads with a default org, switch to it (if we auto-selected first org earlier)
  // But NEVER override a manual user selection
  const hasAppliedDefaultRef = useRef(false);
  useEffect(() => {
    // Skip if user has manually selected an org - their choice takes priority
    if (userHasSelectedOrgRef.current) {
      hasAppliedDefaultRef.current = true; // Mark as handled so we don't try again
      return;
    }
    if (configLoaded && defaultOrgId && availableOrgs && !hasAppliedDefaultRef.current) {
      const isValidDefault = availableOrgs.some(o => o.teamId === defaultOrgId);
      if (isValidDefault && selectedOrgId !== defaultOrgId) {
        // Update ref before state so loadOrgChart sees correct value
        selectedOrgIdRef.current = defaultOrgId;
        setSelectedOrgId(defaultOrgId);
        hasAppliedDefaultRef.current = true;
      }
    }
  }, [configLoaded, defaultOrgId, availableOrgs, selectedOrgId]);

  // Save custom org names to app config (and localStorage fallback)
  const saveOrgNamesToConfig = useCallback(async (newOrgNames: Record<string, string>) => {
    setOrgCustomNames(newOrgNames);

    // Always save to localStorage as fallback
    try {
      localStorage.setItem(LS_KEY_ORG_NAMES, JSON.stringify(newOrgNames));
      console.log('Saved org names to localStorage:', newOrgNames);
    } catch (err) {
      console.error('Error saving org names to localStorage:', err);
    }

    if (!hailer) {
      console.log('No hailer instance, saved to localStorage only');
      return;
    }

    try {
      await hailer.app.config.update(undefined, {
        fields: {
          orgCustomNames: {
            type: 'string',
            value: JSON.stringify(newOrgNames),
          },
        },
      });
      console.log('Saved custom org names to config:', newOrgNames);
    } catch (err: any) {
      console.error('Error saving org names to config:', err);
      // Already saved to localStorage
    }
  }, [hailer, LS_KEY_ORG_NAMES]);

  // Save default org to app config (and localStorage fallback)
  const saveDefaultOrgToConfig = useCallback(async (orgId: string) => {
    setDefaultOrgId(orgId);

    // Always save to localStorage as fallback
    try {
      localStorage.setItem(LS_KEY_DEFAULT_ORG, orgId);
      console.log('Saved default org to localStorage:', orgId);
    } catch (err) {
      console.error('Error saving default org to localStorage:', err);
    }

    if (!hailer) {
      console.log('No hailer instance, saved to localStorage only');
      return;
    }

    try {
      await hailer.app.config.update(undefined, {
        fields: {
          defaultOrgId: {
            type: 'string',
            value: orgId,
          },
        },
      });
      console.log('Saved default org to config:', orgId);
    } catch (err: any) {
      console.error('Error saving default org to config:', err);
      // Already saved to localStorage
    }
  }, [hailer, LS_KEY_DEFAULT_ORG]);

  // ============== Tree Building with Skeletons ==============

  // Check if a skeleton has subordinates
  const hasSkeletonSubordinates = useCallback((skeletonId: string): boolean => {
    // Check if any skeleton or real employee has this skeleton as parent
    const hasSkeletonChildren = skeletons.some(s => s.parentId === skeletonId);
    const hasEmployeeChildren = employeesRef.current.some(e => e.supervisor?._id === skeletonId);
    return hasSkeletonChildren || hasEmployeeChildren;
  }, [skeletons]);

  // Rebuild tree with skeletons - uses ref to avoid dependency on skeletons state
  const skeletonsRef = useRef<SkeletonNode[]>([]);
  skeletonsRef.current = skeletons;

  // Store teamToHeadMap for use in fetchAndMergeActivity and rebuildTree
  // This maps teamId → { headId, headName, isVacancy } for computing visualSupervisor
  const teamToHeadMapRef = useRef<Map<string, { headId: string; headName: string; isVacancy: boolean }>>(new Map());

  const rebuildTree = useCallback(() => {
    // Filter out skeletons with 'has_vacancy' state that have corresponding vacancy nodes
    // This prevents duplicate rendering of vacancy positions
    // Vacancies are now stored as separate Employee objects with isVacancy: true
    const vacancyIds = new Set(
      employeesRef.current
        .filter(emp => emp.isVacancy)
        .map(emp => emp._id)
    );
    const skeletonEmployees = skeletonsRef.current
      .filter(skeleton => {
        // Skip skeletons whose vacancy is represented by a real vacancy node
        if (skeleton.state === 'has_vacancy' && skeleton.vacancy) {
          return !vacancyIds.has(skeleton.vacancy._id);
        }
        return true;
      })
      .map(skeleton => {
        // Compute visualSupervisor from team's head (like loadOrgChart does)
        let visualSupervisor: { _id: string; name: string } | null = null;
        if (skeleton.parentTeamId) {
          const teamHead = teamToHeadMapRef.current.get(skeleton.parentTeamId);
          if (teamHead) {
            visualSupervisor = { _id: teamHead.headId, name: teamHead.headName };
          }
        }
        return {
          _id: skeleton.tempId,
          name: skeleton.employeeName || '',
          pending: true,
          skeletonData: skeleton,
          supervisor: skeleton.parentId
            ? { _id: skeleton.parentId, name: '' }
            : null,
          visualSupervisor,
          team: skeleton.parentTeamId
            ? { _id: skeleton.parentTeamId, name: '' }
            : null,
          position: skeleton.title ? { _id: '', name: skeleton.title } : null,
        };
      });
    const allEmployees = [...employeesRef.current, ...skeletonEmployees];
    // Use buildTreeWithValidation with selectedOrgId for multi-org support
    // Use ref to avoid stale closure issues
    const { tree: root } = buildTreeWithValidation(allEmployees, selectedOrgIdRef.current);
    if (root) {
      const newTreeData = convertToD3Tree(root, expandedNodesRef.current, collapsedNodesRef.current, 0, DEFAULT_EXPAND_DEPTH);
      setTreeData(newTreeData);
      // Force Tree component to re-mount with new data
      setTreeKey(prev => prev + 1);
    }
  }, [DEFAULT_EXPAND_DEPTH]);

  // Update tree data without forcing re-mount (for smooth expand/collapse)
  const updateTreeData = useCallback(() => {
    // Filter out skeletons with 'has_vacancy' state that have corresponding vacancy nodes
    // Vacancies are now stored as separate Employee objects with isVacancy: true
    const vacancyIds = new Set(
      employeesRef.current
        .filter(emp => emp.isVacancy)
        .map(emp => emp._id)
    );
    const skeletonEmployees = skeletonsRef.current
      .filter(skeleton => {
        if (skeleton.state === 'has_vacancy' && skeleton.vacancy) {
          return !vacancyIds.has(skeleton.vacancy._id);
        }
        return true;
      })
      .map(skeleton => ({
        _id: skeleton.tempId,
        name: skeleton.employeeName || '',
        pending: true,
        skeletonData: skeleton,
        supervisor: skeleton.parentId
          ? { _id: skeleton.parentId, name: '' }
          : null,
        team: skeleton.parentTeamId
          ? { _id: skeleton.parentTeamId, name: '' }
          : null,
        position: skeleton.title ? { _id: '', name: skeleton.title } : null,
      }));
    const allEmployees = [...employeesRef.current, ...skeletonEmployees];
    // Use buildTreeWithValidation with selectedOrgId for multi-org support
    // Use ref to avoid stale closure issues
    const { tree: root } = buildTreeWithValidation(allEmployees, selectedOrgIdRef.current);
    if (root) {
      const newTreeData = convertToD3Tree(root, expandedNodesRef.current, collapsedNodesRef.current, 0, DEFAULT_EXPAND_DEPTH);
      setTreeData(newTreeData);
      // Don't increment treeKey - allow smooth update without re-mount
    }
  }, [DEFAULT_EXPAND_DEPTH]);

  // Rebuild tree when skeletons change - but only update the specific skeleton nodes
  const prevSkeletonsLengthRef = useRef(0);
  useEffect(() => {
    // Only rebuild if employees are loaded and skeleton count changed
    if (employeesRef.current.length > 0 && skeletons.length !== prevSkeletonsLengthRef.current) {
      prevSkeletonsLengthRef.current = skeletons.length;
      rebuildTree();
    }
  }, [skeletons.length, rebuildTree]);

  // ============== Skeleton CRUD Operations ==============

  // Add skeleton (called when clicking "Add member" button)
  // optionalTeamId: When provided (from multi-team separator pill), use this team ID
  const handleAddMember = useCallback((parentId: string, optionalTeamId?: string) => {
    const tempId = `skeleton-${Date.now()}`;
    const parentEmployee = employeesRef.current.find(e => e._id === parentId);
    const parentSkeleton = skeletons.find(s => s.tempId === parentId);

    // Check if parent is a vacancy head
    const isParentVacancyHead = parentId.startsWith('vacancy-head-');

    // Use provided team ID, or detect from parent
    let teamId = optionalTeamId
      || parentEmployee?.headOfTeam?._id
      || (typeof parentEmployee?.team === 'object' ? parentEmployee?.team?._id : null)
      || parentSkeleton?.parentTeamId
      || null;

    // If parent is a vacancy head, use its team
    if (isParentVacancyHead && parentEmployee && parentEmployee.team && typeof parentEmployee.team === 'object') {
      teamId = parentEmployee.team._id;
    }

    const newSkeleton: SkeletonNode = {
      tempId,
      parentId,
      parentTeamId: teamId,
      state: 'empty',
      createdAt: Date.now(),
    };

    // Expand parent if collapsed (mark as explicitly expanded)
    expandedNodesRef.current.add(parentId);
    collapsedNodesRef.current.delete(parentId);

    // Save and update state
    const newSkeletons = [...skeletons, newSkeleton];
    saveSkeletonsToConfig(newSkeletons);

    // Don't pan - keep the view stable when adding skeletons
    console.log('Added skeleton:', tempId, 'parent:', parentId, 'team:', teamId);
  }, [skeletons, saveSkeletonsToConfig]);

  // Add team under employee - shows Knight Rider skeleton while creating
  const handleAddTeam = useCallback((parentId: string) => {
    const parentEmployee = employeesRef.current.find(e => e._id === parentId);
    const parentSkeleton = skeletons.find(s => s.tempId === parentId);

    // If parent is a skeleton (no real parent team), show team picker
    if (parentSkeleton && !parentSkeleton.parentTeamId) {
      setPendingTeamParentId(parentId);
      setShowTeamPicker(true);
      return;
    }

    // Otherwise, open Hailer card directly
    if (!hailer) return;

    const parentTeamId = typeof parentEmployee?.team === 'object'
      ? parentEmployee?.team?._id
      : parentSkeleton?.parentTeamId || null;

    // Determine the actual activity ID to use for headOfTeam field
    let headOfTeamActivityId = parentId;

    // If parent is a vacancy head (synthetic ID), extract the real vacancy ID
    if (parentEmployee?.vacancyHead) {
      headOfTeamActivityId = parentEmployee.vacancyHead._id;
    }

    const fields: { [fieldId: string]: string } = {};
    if (fieldIds.headOfTeam) {
      fields[fieldIds.headOfTeam] = headOfTeamActivityId;
    }
    if (parentTeamId && fieldIds.parentTeam) {
      fields[fieldIds.parentTeam] = parentTeamId;
    }

    // Show Knight Rider skeleton while creating
    setPendingTeamCreations(prev => new Set(prev).add(parentId));

    hailer.ui.activity.create(TEAMS.WORKFLOW_ID, { fields }).then(result => {
      // Remove pending state regardless of outcome
      setPendingTeamCreations(prev => {
        const next = new Set(prev);
        next.delete(parentId);
        return next;
      });

      if (result) {
        // Team was created successfully - signal handler will update the tree
        console.log('Team created:', result._id);
      } else {
        // User cancelled - skeleton disappears (already handled above)
        console.log('Team creation cancelled for parent:', parentId);
      }
    });
  }, [hailer, skeletons, fieldIds.headOfTeam, fieldIds.parentTeam]);

  // Cancel pending team creation (when user clicks on the skeleton)
  const handleCancelPendingTeam = useCallback((parentId: string) => {
    setPendingTeamCreations(prev => {
      const next = new Set(prev);
      next.delete(parentId);
      return next;
    });
    console.log('Pending team creation cancelled for parent:', parentId);
  }, []);

  // Open team dashboard popup
  const handleOpenDashboard = useCallback((teamId: string) => {
    setDashboardTeamId(teamId);
  }, []);

  // Create a new organization (team without head of team)
  const handleCreateOrganization = useCallback(() => {
    if (!hailer) return;

    // Create a team with no head of team - this creates a new org root
    // The signal handler will detect the new team and reload the chart
    hailer.ui.activity.create(TEAMS.WORKFLOW_ID, { fields: {} }).then(result => {
      if (result) {
        console.log('New organization created:', result);
        setShowOrgPicker(false);
        // The signal handler will update availableOrgs automatically
      }
    });
  }, [hailer]);

  // Handle team selection from picker
  const handleTeamSelected = useCallback((teamId: string) => {
    if (!hailer || !pendingTeamParentId) return;

    const fields: { [fieldId: string]: string } = {};
    if (fieldIds.headOfTeam) {
      fields[fieldIds.headOfTeam] = pendingTeamParentId;
    }
    if (fieldIds.parentTeam) {
      fields[fieldIds.parentTeam] = teamId;
    }

    hailer.ui.activity.create(TEAMS.WORKFLOW_ID, { fields }).then(_result => {
      // Let signal handler do incremental update - no manual reload needed
    });

    setPendingTeamParentId(null);
    setShowTeamPicker(false);
  }, [hailer, pendingTeamParentId, fieldIds.headOfTeam, fieldIds.parentTeam]);

  // Delete skeleton
  const handleDeleteSkeleton = useCallback((skeletonId: string) => {
    if (hasSkeletonSubordinates(skeletonId)) {
      setDeleteConfirmSkeletonId(skeletonId);
      return;
    }

    // Use ref to get latest skeletons, avoiding stale closure issues
    const newSkeletons = skeletonsRef.current.filter(s => s.tempId !== skeletonId);
    console.log('Deleting skeleton:', skeletonId, 'remaining:', newSkeletons.length);
    saveSkeletonsToConfig(newSkeletons);
  }, [saveSkeletonsToConfig, hasSkeletonSubordinates]);

  // Confirm delete skeleton with subordinates
  const handleConfirmDelete = useCallback(() => {
    if (!deleteConfirmSkeletonId) return;

    // Delete the skeleton and all its subordinate skeletons
    const toDelete = new Set<string>([deleteConfirmSkeletonId]);

    // Use ref to get latest skeletons, avoiding stale closure issues
    const currentSkeletons = skeletonsRef.current;

    // Find all descendant skeletons
    let changed = true;
    while (changed) {
      changed = false;
      for (const skeleton of currentSkeletons) {
        if (skeleton.parentId && toDelete.has(skeleton.parentId) && !toDelete.has(skeleton.tempId)) {
          toDelete.add(skeleton.tempId);
          changed = true;
        }
      }
    }

    const newSkeletons = currentSkeletons.filter(s => !toDelete.has(s.tempId));
    console.log('Deleting skeleton and subordinates:', Array.from(toDelete), 'remaining:', newSkeletons.length);
    saveSkeletonsToConfig(newSkeletons);
    setDeleteConfirmSkeletonId(null);
  }, [deleteConfirmSkeletonId, saveSkeletonsToConfig]);

  // ============== Skeleton Action Handlers ==============

  // Add employee to fill skeleton position or vacancy head
  const handleAddEmployee = useCallback((skeletonId: string) => {
    if (!hailer) return;

    // Check if this is a vacancy head node
    const isVacancyHead = skeletonId.startsWith('vacancy-head-');
    let fields: { [fieldId: string]: string } = {};
    let teamId: string | null = null;

    if (isVacancyHead) {
      // Find the team this vacancy heads
      let teamIdForVacancy: string | null = null;
      employeesRef.current.forEach(emp => {
        if (emp._id === skeletonId && emp.team && typeof emp.team === 'object') {
          teamIdForVacancy = emp.team._id;
        }
      });

      if (teamIdForVacancy && fieldIds.team) {
        fields[fieldIds.team] = teamIdForVacancy;
        teamId = teamIdForVacancy;
      }
    } else {
      const skeleton = skeletons.find(s => s.tempId === skeletonId);
      if (!skeleton) return;

      if (skeleton.parentId && fieldIds.supervisor) {
        fields[fieldIds.supervisor] = skeleton.parentId;
      }
      if (skeleton.parentTeamId && fieldIds.team) {
        fields[fieldIds.team] = skeleton.parentTeamId;
        teamId = skeleton.parentTeamId;
      }
    }

    hailer.ui.activity.create(WORKFLOW_ID, { fields }).then(async (result) => {
      if (result) {
        // Remove the skeleton since position is now filled (if not a vacancy head)
        if (!isVacancyHead) {
          const newSkeletons = skeletonsRef.current.filter(s => s.tempId !== skeletonId);
          saveSkeletonsToConfig(newSkeletons);
        }

        // Directly fetch and add the new employee
        // Result can be activity ID string or object with _id
        const activityId = typeof result === 'string' ? result : (result as any)?._id || (result as any)?.activityId;
        if (activityId && hailer) {
          try {
            const activity = await hailer.activity.get(activityId);
            if (activity) {
              const actFields = activity.fields || {};
              const position = fieldIds.position ? actFields[fieldIds.position]?.value as { _id: string; name: string } | string | null : null;
              const team = fieldIds.team ? actFields[fieldIds.team]?.value as { _id: string; name: string } | string | null : null;
              const supervisor = fieldIds.supervisor ? actFields[fieldIds.supervisor]?.value as { _id: string; name: string } | null : null;
              const nationality = fieldIds.nationality ? actFields[fieldIds.nationality]?.value as string | null : null;

              // Compute visualSupervisor from team's head (like loadOrgChart does)
              const empTeamId = team && typeof team === 'object' ? team._id : null;
              let visualSupervisor: { _id: string; name: string } | null = null;
              if (empTeamId) {
                const teamHead = teamToHeadMapRef.current.get(empTeamId);
                if (teamHead && teamHead.headId !== activity._id) {
                  visualSupervisor = { _id: teamHead.headId, name: teamHead.headName };
                }
              }

              const newEmployee: Employee = {
                _id: activity._id,
                name: activity.name,
                position: position || null,
                team: team || null,
                supervisor,
                visualSupervisor,
                nationality: nationality || null,
                created: activity.created || 0,
              };

              // If this was filling a vacancy head, update the team to point to the new employee
              if (isVacancyHead && teamId && fieldIds.headOfTeam) {
                try {
                  // Update the team's head_of_team field to the new employee
                  await hailer.activity.update([{
                    _id: teamId,
                    fields: {
                      [fieldIds.headOfTeam]: activityId,
                    },
                  }], {});

                  // Optionally archive the vacancy
                  const vacancyIdToArchive = skeletonId.replace('vacancy-head-', '');
                  await hailer.activity.update([{
                    _id: vacancyIdToArchive,
                    phaseId: VACANCIES.PHASE_IDS.ARCHIVE,
                  }], {});

                  toast({
                    title: 'Vacancy filled',
                    description: 'Team head updated and vacancy archived',
                    status: 'success',
                    duration: 3000,
                  });
                } catch (err) {
                  console.error('Error updating team or archiving vacancy:', err);
                  toast({
                    title: 'Warning',
                    description: 'Employee created but team update failed',
                    status: 'warning',
                    duration: 3000,
                  });
                }
              }

              // Add to employees and rebuild tree
              // Keep vacancies and leaderless-head placeholders (they have pending: true but are legitimate)
              const filtered = employeesRef.current.filter(e => {
                if (e._id === activity._id) return false;
                if (e.isVacancy || e._id.startsWith('leaderless-head-')) return true;
                return !e.pending;
              });
              employeesRef.current = [...filtered, newEmployee];
              rebuildTree();
            }
          } catch (err) {
            console.error('Error fetching new employee:', err);
          }
        }
      }
    });
  }, [hailer, skeletons, saveSkeletonsToConfig, rebuildTree, fieldIds.headOfTeam, fieldIds.team, toast]);

  // Open vacancy for skeleton position
  const handleOpenVacancy = useCallback(async (skeletonId: string) => {
    if (!hailer) return;

    const skeleton = skeletons.find(s => s.tempId === skeletonId);
    if (!skeleton) return;

    const fields: { [fieldId: string]: string } = {};
    if (skeleton.parentTeamId && fieldIds.vacancyTeam) {
      fields[fieldIds.vacancyTeam] = skeleton.parentTeamId;
    }

    try {
      const result = await hailer.ui.activity.create(VACANCIES.WORKFLOW_ID, { fields });
      if (result) {
        toast({
          title: 'Vacancy created',
          status: 'success',
          duration: 2000,
        });

        // Fetch the created vacancy to get its details
        const vacancyActivity = await hailer.activity.get(result._id);
        if (vacancyActivity) {
          // Extract vacancy data
          const positionField = vacancyActivity.fields?.[fieldIds.vacancyPosition || ''];
          const applicationPeriodField = vacancyActivity.fields?.[fieldIds.vacancyApplicationPeriod || ''];

          // Update skeleton state to has_vacancy
          const updatedSkeletons = skeletons.map(s => {
            if (s.tempId === skeletonId) {
              return {
                ...s,
                state: 'has_vacancy' as const,
                vacancy: {
                  _id: vacancyActivity._id,
                  name: positionField?.value ? (typeof positionField.value === 'object' && positionField.value !== null && 'name' in positionField.value ? positionField.value.name : String(positionField.value)) : vacancyActivity.name,
                  applicationPeriod: applicationPeriodField?.value ? {
                    start: (applicationPeriodField.value as { start: number; end: number }).start,
                    end: (applicationPeriodField.value as { start: number; end: number }).end,
                  } : undefined,
                },
              };
            }
            return s;
          });

          // Save updated skeletons to config
          await saveSkeletonsToConfig(updatedSkeletons);

          // Force tree update to reflect the vacancy changes
          updateTreeData();
        }
      }
    } catch (err) {
      console.error('Error creating vacancy:', err);
      toast({
        title: 'Error creating vacancy',
        status: 'error',
        duration: 2000,
      });
    }
  }, [hailer, skeletons, toast, fieldIds.vacancyTeam, fieldIds.vacancyPosition, fieldIds.vacancyApplicationPeriod, saveSkeletonsToConfig, updateTreeData]);

  // Open find resource popup
  const handleFindResource = useCallback((skeletonId: string) => {
    setSelectedSkeletonId(skeletonId);
    setShowFindResource(true);
  }, []);

  // Open orphan viewer (repurpose FindResourcePopup in view_orphans mode)
  const handleViewOrphans = useCallback(() => {
    setSelectedSkeletonId(null); // Clear skeleton context
    setShowFindResource(true);
  }, []);

  // Move employee immediately
  const handleMoveImmediately = useCallback(async (employeeId: string) => {
    if (!hailer || !selectedSkeletonId) return;

    const skeleton = skeletons.find(s => s.tempId === selectedSkeletonId);
    if (!skeleton) return;

    try {
      // Update the employee's supervisor and team
      const updateFields: { [fieldId: string]: string | null } = {};
      if (skeleton.parentId && fieldIds.supervisor) {
        updateFields[fieldIds.supervisor] = skeleton.parentId;
      }
      if (skeleton.parentTeamId && fieldIds.team) {
        updateFields[fieldIds.team] = skeleton.parentTeamId;
      }

      await hailer.activity.update([{ _id: employeeId, fields: updateFields }], {});

      // Remove the skeleton since position is now filled
      const newSkeletons = skeletons.filter(s => s.tempId !== selectedSkeletonId);
      await saveSkeletonsToConfig(newSkeletons);

      toast({
        title: 'Employee moved',
        status: 'success',
        duration: 2000,
      });

      setReloadTrigger(prev => prev + 1);
    } catch (err) {
      console.error('Error moving employee:', err);
      toast({
        title: 'Error moving employee',
        status: 'error',
        duration: 3000,
      });
    }

    setShowFindResource(false);
    setSelectedSkeletonId(null);
  }, [hailer, selectedSkeletonId, skeletons, saveSkeletonsToConfig, toast]);

  // Initiate change request
  const handleInitiateChange = useCallback((employeeId: string) => {
    if (!hailer || !selectedSkeletonId) return;

    const skeleton = skeletons.find(s => s.tempId === selectedSkeletonId);
    const employee = employeesRef.current.find(e => e._id === employeeId);
    if (!skeleton || !employee) return;

    // Get the employee's current position
    const currentPosition = typeof employee.position === 'object'
      ? employee.position?._id
      : null;

    const fields: { [fieldId: string]: string } = {};
    if (fieldIds.cmPerson) {
      fields[fieldIds.cmPerson] = employeeId;
    }
    if (currentPosition && fieldIds.cmPreviousPosition) {
      fields[fieldIds.cmPreviousPosition] = currentPosition;
    }

    hailer.ui.activity.create(CHANGE_MANAGEMENT.WORKFLOW_ID, { fields }).then(result => {
      if (result) {
        toast({
          title: 'Change request created',
          status: 'success',
          duration: 2000,
        });
      }
    });

    setShowFindResource(false);
    setSelectedSkeletonId(null);
  }, [hailer, selectedSkeletonId, skeletons, toast]);

  // ============== Core Functions ==============

  // Handle node expand/collapse toggle
  // isCollapsed: the NEW state after toggle (true = user is collapsing, false = user is expanding)
  const handleNodeToggle = useCallback((nodeId: string, isCollapsed: boolean) => {
    if (isCollapsed) {
      // User is collapsing this node
      collapsedNodesRef.current.add(nodeId);
      expandedNodesRef.current.delete(nodeId);
    } else {
      // User is expanding this node
      expandedNodesRef.current.add(nodeId);
      collapsedNodesRef.current.delete(nodeId);

      // Collapse all descendants so only direct children are visible
      const descendants = findAllDescendantIds(nodeId, employeesRef.current, skeletonsRef.current);
      descendants.forEach(id => {
        collapsedNodesRef.current.add(id);
        expandedNodesRef.current.delete(id);
      });
    }
  }, []);

  // Toggle expand/collapse all nodes
  const handleToggleExpandAll = useCallback(() => {
    if (isAllExpanded) {
      // Collapse all - clear expanded, add all node IDs to collapsed
      expandedNodesRef.current.clear();
      collapsedNodesRef.current.clear();
      // Add all employee IDs to collapsed (they'll use default collapse behavior)
      employeesRef.current.forEach(emp => {
        collapsedNodesRef.current.add(emp._id);
      });
      setIsAllExpanded(false);
    } else {
      // Expand all - add all node IDs to expanded, clear collapsed
      collapsedNodesRef.current.clear();
      expandedNodesRef.current.clear();
      employeesRef.current.forEach(emp => {
        expandedNodesRef.current.add(emp._id);
      });
      setIsAllExpanded(true);
    }
    updateTreeData();
  }, [isAllExpanded, updateTreeData]);

  // Copy public link to clipboard
  const handleCopyPublicLink = useCallback(() => {
    // Published apps URL format: https://apps.hailer.com/{workspaceId}/{appId}/index.html
    const publicUrl = `https://apps.hailer.com/${WORKSPACE_ID}/${APP_ID}/index.html?public=true`;
    navigator.clipboard.writeText(publicUrl).then(() => {
      toast({
        title: 'Link copied!',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    }).catch(() => {
      toast({
        title: 'Failed to copy link',
        status: 'error',
        duration: 2000,
        isClosable: true,
      });
    });
  }, [toast]);

  // Smoothly pan to center the clicked node on screen (both X and Y)
  // nodeScreenX/Y: current screen position of the clicked node
  const centerOnNode = useCallback((nodeScreenX: number, nodeScreenY: number) => {
    // Calculate how much we need to move the tree so the node ends up at the marker position
    // Current node is at nodeScreenX/Y, we want it at centerMarkerX/Y
    // So we need to add (centerMarkerX - nodeScreenX) to translate.x

    const targetX = translate.x + (centerMarkerX - nodeScreenX);
    const targetY = translate.y + (centerMarkerY - nodeScreenY);

    // Animate the translate change
    const startY = translate.y;
    const startX = translate.x;
    const deltaY = targetY - startY;
    const deltaX = targetX - startX;

    // Skip animation if already at target position
    if (Math.abs(deltaY) < 5 && Math.abs(deltaX) < 5) return;

    const duration = 300; // ms
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out curve for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);

      setTranslate({
        x: startX + (deltaX * eased),
        y: startY + (deltaY * eased)
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [translate.x, translate.y, centerMarkerX, centerMarkerY]);

  // Get container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight - 100,
      });
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Note: selectedOrgIdRef is intentionally NOT synced from state via useEffect.
  // All code paths that call setSelectedOrgId() must set the ref FIRST to avoid race conditions.
  // This pattern avoids issues with React concurrent mode where effects might see stale state.

  // Set initial translate only once when dimensions are first available
  // Position CEO at the helper line center (centerMarkerX, centerMarkerY)
  const initialTranslateSetRef = useRef(false);
  useEffect(() => {
    if (!initialTranslateSetRef.current && dimensions.width > 0) {
      setTranslate({ x: centerMarkerX, y: centerMarkerY });
      initialTranslateSetRef.current = true;
    }
  }, [dimensions, centerMarkerX, centerMarkerY]);

  // Load org chart data from public insight (for public mode)
  const loadPublicOrgChart = useCallback(async () => {
    try {
      console.log('[loadPublicOrgChart] Starting public data load');
      setLoading(true);
      setError(null);

      const response = await fetch(PUBLIC_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([PUBLIC_INSIGHT_KEY]),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch public data: ${response.status}`);
      }

      const result: PublicInsightResponse = await response.json();
      const { headers, rows } = result.data;

      // Parse the insight data into employees and teams
      // Headers: _id, name, position, team, supervisor
      const idIdx = headers.indexOf('_id');
      const nameIdx = headers.indexOf('name');
      const positionIdx = headers.indexOf('position');
      const teamIdx = headers.indexOf('team');
      const supervisorIdx = headers.indexOf('supervisor');

      const employees: Employee[] = [];
      const teamMap = new Map<string, { _id: string; name: string }>();

      rows.forEach(row => {
        const id = row[idIdx];
        const name = row[nameIdx];
        const position = row[positionIdx];
        const team = row[teamIdx];
        const supervisor = row[supervisorIdx];

        if (!id || !name) return;

        // Teams have null position and team (they're in the UNION ALL part of the query)
        // and their "supervisor" field is actually headOfTeam
        const isTeam = position === null && team === null;

        if (isTeam) {
          // This is a team record
          teamMap.set(id, { _id: id, name });
        } else {
          // This is an employee record
          employees.push({
            _id: id,
            name,
            position: position ? { _id: position, name: '' } : null,
            team: team ? { _id: team, name: '' } : null,
            supervisor: supervisor ? { _id: supervisor, name: '' } : null,
            headOfTeam: null, // Will be determined from teams
          });
        }
      });

      // Build headOfTeam mapping from teams data
      // Teams in the insight have their headOfTeam in the supervisor column
      rows.forEach(row => {
        const id = row[idIdx];
        const position = row[positionIdx];
        const team = row[teamIdx];
        const headOfTeam = row[supervisorIdx]; // For teams, supervisor = headOfTeam

        const isTeam = position === null && team === null;
        if (isTeam && headOfTeam && id) {
          // Find the employee who is head of this team
          const employee = employees.find(e => e._id === headOfTeam);
          if (employee) {
            const teamInfo = teamMap.get(id);
            if (teamInfo) {
              employee.headOfTeam = teamInfo;
            }
          }
        }
      });

      // Resolve team names for employees
      employees.forEach(emp => {
        if (emp.team && typeof emp.team === 'object' && emp.team._id) {
          const teamInfo = teamMap.get(emp.team._id);
          if (teamInfo) {
            emp.team = teamInfo;
          }
        }
      });

      employeesRef.current = employees;

      // Build tree (no skeletons in public mode)
      const { tree: root, availableOrganizations } = buildTreeWithValidation(employees, selectedOrgIdRef.current);

      if (availableOrganizations && availableOrganizations.length > 0) {
        setAvailableOrgs(availableOrganizations);
        // Auto-select first org if none selected
        if (!selectedOrgIdRef.current) {
          const orgToSelect = availableOrganizations[0].teamId;
          selectedOrgIdRef.current = orgToSelect;
          setSelectedOrgId(orgToSelect);
        }
      }

      if (root) {
        const d3Data = convertToD3Tree(root, expandedNodesRef.current, collapsedNodesRef.current, 0, 1);
        setTreeData(d3Data);
      }

      setLoading(false);
      console.log('[loadPublicOrgChart] Public data loaded successfully');
    } catch (err) {
      console.error('[loadPublicOrgChart] Error loading public data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load org chart data');
      setLoading(false);
    }
  }, []);

  // Load org chart data
  const loadOrgChart = useCallback(async () => {
    // In public mode, use the public insight API
    if (isPublic) {
      await loadPublicOrgChart();
      return;
    }

    if (!hailer) return;

    // Wait for schema to be loaded before attempting to load data
    // This ensures fieldIds are properly resolved
    if (!fieldIds.team || !fieldIds.supervisor) {
      console.log('[OrgChart] Waiting for schema to load...');
      return;
    }

    try {
      console.log('[loadOrgChart] Starting load, selectedOrgIdRef.current:', selectedOrgIdRef.current);
      setLoading(true);
      setError(null);

      const [employeesResult, contractorsResult, teamsResult, disciplinaryResult, vacanciesResult] = await Promise.all([
        hailer.activity.list(WORKFLOW_ID, PHASE_IDS.ACTIVE_EMPLOYEES, { limit: 100 }),
        hailer.activity.list(WORKFLOW_ID, PHASE_IDS.ACTIVE_CONTRACTORS, { limit: 100 }),
        hailer.activity.list(TEAMS.WORKFLOW_ID, TEAMS.PHASE_ID, { limit: 100 }),
        hailer.activity.list(DISCIPLINARY_ACTIONS.WORKFLOW_ID, DISCIPLINARY_ACTIONS.PHASE_ID, { limit: 100 }),
        hailer.activity.list(VACANCIES.WORKFLOW_ID, VACANCIES.PHASE_IDS.PUBLISHED, { limit: 100 }),
      ]);

      const employeesList = (employeesResult as any).items || employeesResult;
      const contractorsList = (contractorsResult as any).items || contractorsResult;
      const teamsList = (teamsResult as any).items || teamsResult;
      const disciplinaryList = (disciplinaryResult as any).items || disciplinaryResult;
      const vacanciesList = (vacanciesResult as any).items || vacanciesResult;

      const allActivities: Activity[] = [
        ...(Array.isArray(employeesList) ? employeesList : []),
        ...(Array.isArray(contractorsList) ? contractorsList : []),
      ];

      const teamsActivities: Activity[] = Array.isArray(teamsList) ? teamsList : [];
      const disciplinaryActivities: Activity[] = Array.isArray(disciplinaryList) ? disciplinaryList : [];
      const vacanciesActivities: Activity[] = Array.isArray(vacanciesList) ? vacanciesList : [];
      console.log('[loadOrgChart] Vacancies fetched:', vacanciesActivities.length);

      // Build set of employee IDs that have disciplinary actions linked
      const employeesWithDisciplinary = new Set<string>();
      disciplinaryActivities.forEach(da => {
        // The "Name" field links to an Employee - using field ID directly (no key set in workflow)
        const linkedEmployee = da.fields?.[DISCIPLINARY_ACTIONS.FIELD_IDS.NAME]?.value as { _id: string; name: string } | null;
        if (linkedEmployee?._id) {
          employeesWithDisciplinary.add(linkedEmployee._id);
        }
      });

      // Store teams for picker and dashboard (includes parentTeam for hierarchy)
      setTeamsData(teamsActivities.map(t => {
        const parentTeamValue = fieldIds.parentTeam ? t.fields?.[fieldIds.parentTeam]?.value as { _id: string; name: string } | null : null;
        return {
          _id: t._id,
          name: t.name,
          parentTeamId: parentTeamValue?._id || null,
        };
      }));

      // Build set of employee IDs for quick lookup
      const employeeIds = new Set(allActivities.map(a => a._id));
      const vacancyIds = new Set(vacanciesActivities.map(v => v._id));
      const teamIds = new Set(teamsActivities.map(t => t._id));
      console.log('[loadOrgChart] Employee IDs:', Array.from(employeeIds));
      console.log('[loadOrgChart] Vacancy IDs:', Array.from(vacancyIds));

      // Build unified team-to-head map: teamId → head info (can be employee or vacancy)
      // This is used to compute visualSupervisor for all nodes
      const teamToHeadMap = new Map<string, { headId: string; headName: string; isVacancy: boolean }>();

      // Also keep headOfTeamMap for backward compatibility (maps employeeId → team they head)
      const headOfTeamMap = new Map<string, { _id: string; name: string }>();

      teamsActivities.forEach(team => {
        const headOfTeamValue = fieldIds.headOfTeam ? team.fields?.[fieldIds.headOfTeam]?.value as { _id: string; name: string; process?: string } | null : null;
        console.log('[loadOrgChart] Team:', team.name, 'headOfTeam:', headOfTeamValue);
        if (headOfTeamValue?._id) {
          // Check if this is a vacancy:
          // 1. Explicit process field = VACANCIES.WORKFLOW_ID, OR
          // 2. The head ID is in our vacancy list, OR
          // 3. The head ID is NOT in our employee list (so it must be a vacancy)
          const isInEmployeeList = employeeIds.has(headOfTeamValue._id);
          const isInVacancyList = vacancyIds.has(headOfTeamValue._id);
          const hasVacancyProcess = headOfTeamValue.process === VACANCIES.WORKFLOW_ID;
          const isVacancy = hasVacancyProcess || isInVacancyList || !isInEmployeeList;

          // Store in unified map
          teamToHeadMap.set(team._id, {
            headId: headOfTeamValue._id,
            headName: headOfTeamValue.name,
            isVacancy,
          });

          // Also populate headOfTeamMap for employees (backward compat)
          if (!isVacancy) {
            headOfTeamMap.set(headOfTeamValue._id, {
              _id: team._id,
              name: team.name,
            });
          }
        }
      });
      console.log('[loadOrgChart] teamToHeadMap size:', teamToHeadMap.size, 'entries:', Array.from(teamToHeadMap.entries()));

      // Clean up skeletons with stale vacancy references (vacancies that no longer exist)
      const skeletonsWithVacancies = skeletonsRef.current.filter(
        s => s.state === 'has_vacancy' && s.vacancy
      );
      if (skeletonsWithVacancies.length > 0) {
        // Check which vacancies still exist using our already-fetched vacanciesActivities
        const vacancyExistsPromises = skeletonsWithVacancies.map(async skeleton => {
          // Check if vacancy exists in our fetched list
          if (vacancyIds.has(skeleton.vacancy!._id)) {
            return { skeletonId: skeleton.tempId, exists: true };
          }
          // Try to fetch the vacancy to verify it exists (might be in different phase)
          try {
            const vacancy = await hailer.activity.get(skeleton.vacancy!._id);
            return { skeletonId: skeleton.tempId, exists: !!vacancy };
          } catch {
            return { skeletonId: skeleton.tempId, exists: false };
          }
        });

        const vacancyExistsResults = await Promise.all(vacancyExistsPromises);
        const staleSkeletonIds = new Set(
          vacancyExistsResults
            .filter(r => !r.exists)
            .map(r => r.skeletonId)
        );

        if (staleSkeletonIds.size > 0) {
          console.log('[loadOrgChart] Cleaning up skeletons with deleted vacancies:', Array.from(staleSkeletonIds));
          // Remove skeletons with deleted vacancies
          const cleanedSkeletons = skeletonsRef.current.filter(
            s => !staleSkeletonIds.has(s.tempId)
          );
          // Update ref and persist
          skeletonsRef.current = cleanedSkeletons;
          saveSkeletonsToConfig(cleanedSkeletons);
        }
      }

      // Debug: Log field ID resolution
      console.log('[OrgChart] Field IDs resolved:', {
        team: fieldIds.team,
        supervisor: fieldIds.supervisor,
        position: fieldIds.position,
      });

      const employees: Employee[] = allActivities.map(activity => {
        const fields = activity.fields || {};
        const position = fieldIds.position ? fields[fieldIds.position]?.value as { _id: string; name: string } | string | null : null;
        const team = fieldIds.team ? fields[fieldIds.team]?.value as { _id: string; name: string } | string | null : null;
        const supervisor = fieldIds.supervisor ? fields[fieldIds.supervisor]?.value as { _id: string; name: string } | null : null;
        const nationality = fieldIds.nationality ? fields[fieldIds.nationality]?.value as string | null : null;
        const headOfTeam = headOfTeamMap.get(activity._id) || null;

        // Compute visualSupervisor from team's head_of_team (for org chart tree building)
        // This differs from Hailer's supervisor field which skips vacancies
        const teamId = team && typeof team === 'object' ? team._id : null;
        const teamHead = teamId ? teamToHeadMap.get(teamId) : null;
        let visualSupervisor: { _id: string; name: string } | null = null;
        if (teamHead && teamHead.headId !== activity._id) {
          // Don't set visualSupervisor to self
          visualSupervisor = { _id: teamHead.headId, name: teamHead.headName };
        }

        // Date of birth comes as timestamp or ISO string
        const dateOfBirthRaw = fieldIds.dateOfBirth ? fields[fieldIds.dateOfBirth]?.value : null;
        const dateOfBirth = dateOfBirthRaw
          ? (typeof dateOfBirthRaw === 'number' ? dateOfBirthRaw : new Date(dateOfBirthRaw as string).getTime())
          : null;
        // Salary can be number or numericunit object { value, unit }
        const salaryRaw = fieldIds.salary ? fields[fieldIds.salary]?.value : null;
        const salary = salaryRaw
          ? (typeof salaryRaw === 'number' ? salaryRaw : (salaryRaw as { value?: number })?.value || null)
          : null;
        // Total Cost (calculated field: salary + side costs for employees, consultancy fee for contractors)
        const totalCostRaw = fieldIds.totalCost ? fields[fieldIds.totalCost]?.value : null;
        const totalCost = totalCostRaw
          ? (typeof totalCostRaw === 'number' ? totalCostRaw : (totalCostRaw as { value?: number })?.value || null)
          : null;
        // Status field (Active, Long sick leave, Parental leave, Study leave)
        const status = fieldIds.status ? fields[fieldIds.status]?.value as string | null : null;
        // Check if employee has any disciplinary action linked
        const hasDisciplinaryAction = employeesWithDisciplinary.has(activity._id);

        return {
          _id: activity._id,
          name: activity.name,
          position: position || null,
          team: team || null,
          supervisor,
          visualSupervisor,
          headOfTeam,
          nationality: nationality || null,
          dateOfBirth,
          salary,
          totalCost,
          status: status || null,
          hasDisciplinaryAction,
          isVacancy: false,
          created: activity.created || 0,
        };
      });

      employeesRef.current = employees;
      prevSkeletonsLengthRef.current = skeletonsRef.current.length;

      // Create vacancy nodes as first-class citizens (not synthetic nodes)
      // Each vacancy gets a real node with its real ID
      const vacancyNodes: Employee[] = vacanciesActivities.map(vacancyActivity => {
        const vacFields = vacancyActivity.fields || {};
        const vacPosition = fieldIds.vacancyPosition ? vacFields[fieldIds.vacancyPosition]?.value as { _id: string; name: string } | null : null;
        const vacTeam = fieldIds.vacancyTeam ? vacFields[fieldIds.vacancyTeam]?.value as { _id: string; name: string } | null : null;
        const applicationPeriod = fieldIds.vacancyApplicationPeriod
          ? vacFields[fieldIds.vacancyApplicationPeriod]?.value as { start: number; end: number } | null
          : null;

        // Compute visualSupervisor from vacancy's team's head_of_team
        const vacTeamId = vacTeam && typeof vacTeam === 'object' ? vacTeam._id : null;
        const vacTeamHead = vacTeamId ? teamToHeadMap.get(vacTeamId) : null;
        let vacVisualSupervisor: { _id: string; name: string } | null = null;
        if (vacTeamHead && vacTeamHead.headId !== vacancyActivity._id) {
          vacVisualSupervisor = { _id: vacTeamHead.headId, name: vacTeamHead.headName };
        }

        // Find which team(s) this vacancy heads (if any)
        let vacHeadOfTeam: { _id: string; name: string } | null = null;
        teamToHeadMap.forEach((head, teamId) => {
          if (head.headId === vacancyActivity._id) {
            const teamActivity = teamsActivities.find(t => t._id === teamId);
            if (teamActivity) {
              vacHeadOfTeam = { _id: teamId, name: teamActivity.name };
            }
          }
        });

        return {
          _id: vacancyActivity._id, // Use real ID, not synthetic vacancy-head-{id}
          name: vacancyActivity.name,
          position: vacPosition || null,
          team: vacTeam || null,
          supervisor: vacVisualSupervisor, // For backward compat
          visualSupervisor: vacVisualSupervisor,
          headOfTeam: vacHeadOfTeam,
          pending: true,
          isVacancy: true,
          vacancyData: {
            _id: vacancyActivity._id,
            name: vacancyActivity.name,
            applicationPeriod: applicationPeriod || undefined,
            process: VACANCIES.WORKFLOW_ID,
            team: vacTeam || undefined,
          },
          created: vacancyActivity.created || 0,
        };
      });
      console.log('[loadOrgChart] Created vacancyNodes:', vacancyNodes.length, vacancyNodes.map(v => ({ id: v._id, name: v.name, headOfTeam: v.headOfTeam })));

      // CREATE AUTO-VACANCY NODES FOR LEADERLESS TEAMS
      // Detect teams that have employees but no head assigned
      const leaderlessHeadNodes: Employee[] = [];

      teamsActivities.forEach(team => {
        const teamId = team._id;
        const teamName = team.name;

        // Check if team has a head assigned
        const hasHead = teamToHeadMap.has(teamId);

        // Check if team is marked as a top-level team (should not have Vacant Head placeholder)
        const isTopTeamValue = fieldIds.isTopTeam ? team.fields?.[fieldIds.isTopTeam]?.value as string | null : null;
        const isTopTeam = isTopTeamValue === 'Yes';

        if (!hasHead && !isTopTeam) {
          // Check if this team has any employees assigned to it
          const hasEmployees = employees.some(emp => {
            const empTeam = emp.team;
            const empTeamId = empTeam && typeof empTeam === 'object' ? empTeam._id : null;
            return empTeamId === teamId;
          });

          if (hasEmployees) {
            // Team has employees but no head - create synthetic "Vacant Head" node
            const leaderlessHeadId = `leaderless-head-${teamId}`;

            // Compute visualSupervisor from parent team's head (if parent team exists)
            let leaderlessVisualSupervisor: { _id: string; name: string } | null = null;
            const parentTeamValue = fieldIds.parentTeam ? team.fields?.[fieldIds.parentTeam]?.value as { _id: string; name: string } | null : null;
            if (parentTeamValue?._id) {
              const parentTeamHead = teamToHeadMap.get(parentTeamValue._id);
              if (parentTeamHead) {
                leaderlessVisualSupervisor = { _id: parentTeamHead.headId, name: parentTeamHead.headName };
              }
            }

            const leaderlessNode: Employee = {
              _id: leaderlessHeadId,
              name: 'Vacant Head',
              pending: true,
              isVacancy: false,
              team: { _id: teamId, name: teamName },
              headOfTeam: { _id: teamId, name: teamName },
              visualSupervisor: leaderlessVisualSupervisor,
              position: null,
              supervisor: leaderlessVisualSupervisor,
              created: Date.now(),
              // Add a custom flag to identify leaderless placeholder nodes
              skeletonData: {
                tempId: leaderlessHeadId,
                parentId: leaderlessVisualSupervisor?._id || null,
                parentTeamId: parentTeamValue?._id || null,
                state: 'title_only',
                title: `Head of ${teamName}`,
                createdAt: Date.now(),
              },
            };

            leaderlessHeadNodes.push(leaderlessNode);

            // Add to teamToHeadMap so employees in this team get correct visualSupervisor
            teamToHeadMap.set(teamId, {
              headId: leaderlessHeadId,
              headName: 'Vacant Head',
              isVacancy: false,
            });

            console.log('[loadOrgChart] Created leaderless head node for team:', teamName, 'with ID:', leaderlessHeadId, 'visualSupervisor:', leaderlessVisualSupervisor);
          }
        }
      });

      console.log('[loadOrgChart] Created leaderlessHeadNodes:', leaderlessHeadNodes.length, leaderlessHeadNodes.map(v => ({ id: v._id, name: v.name, team: v.team, headOfTeam: v.headOfTeam })));

      // Update visualSupervisor for employees in leaderless teams
      // This ensures they connect to the synthetic leaderless-head node
      employees.forEach(emp => {
        const empTeam = emp.team;
        const empTeamId = empTeam && typeof empTeam === 'object' ? empTeam._id : null;
        if (empTeamId) {
          const teamHead = teamToHeadMap.get(empTeamId);
          if (teamHead && teamHead.headId !== emp._id) {
            // Update visualSupervisor to point to the team head (could be leaderless-head node)
            emp.visualSupervisor = { _id: teamHead.headId, name: teamHead.headName };
          }
        }
      });

      // Store teamToHeadMap in ref for use by fetchAndMergeActivity and rebuildTree
      teamToHeadMapRef.current = teamToHeadMap;

      // Build tree with skeletons using ref to avoid dependency
      // Filter out skeletons with 'has_vacancy' state - these are now represented by real vacancy nodes
      // Also filter out skeletons with invalid team references (team was deleted)
      const skeletonEmployees = skeletonsRef.current
        .filter(skeleton => {
          // Validate parentTeamId exists (for all skeleton states)
          if (skeleton.parentTeamId && !teamIds.has(skeleton.parentTeamId)) {
            console.log('[loadOrgChart] Filtering out skeleton with deleted team:', skeleton.tempId, skeleton.parentTeamId);
            return false;
          }
          // Validate parentId exists if set (can be employee, vacancy, or another skeleton)
          if (skeleton.parentId) {
            const parentIsEmployee = employeeIds.has(skeleton.parentId);
            const parentIsVacancy = vacancyIds.has(skeleton.parentId);
            const parentIsSkeleton = skeleton.parentId.startsWith('skeleton-');
            if (!parentIsEmployee && !parentIsVacancy && !parentIsSkeleton) {
              console.log('[loadOrgChart] Filtering out skeleton with deleted parent:', skeleton.tempId, skeleton.parentId);
              return false;
            }
          }
          // Filter orphan skeletons - no parent AND no team (can't be placed in hierarchy)
          if (!skeleton.parentId && !skeleton.parentTeamId) {
            console.log('[loadOrgChart] Filtering out orphan skeleton (no parent, no team):', skeleton.tempId);
            return false;
          }
          if (skeleton.state === 'has_vacancy') {
            // If skeleton has vacancy info and it matches a real vacancy, skip it
            if (skeleton.vacancy && vacancyIds.has(skeleton.vacancy._id)) {
              console.log('[loadOrgChart] Filtering out skeleton with matching vacancy:', skeleton.tempId, skeleton.vacancy._id);
              return false;
            }
            // If skeleton has vacancy info but vacancy doesn't exist (was deleted), skip it
            if (skeleton.vacancy && !vacancyIds.has(skeleton.vacancy._id)) {
              console.log('[loadOrgChart] Filtering out skeleton with deleted vacancy:', skeleton.tempId, skeleton.vacancy._id);
              return false;
            }
            // If skeleton is has_vacancy but has no vacancy data (shouldn't happen), skip it
            if (!skeleton.vacancy) {
              console.log('[loadOrgChart] Filtering out skeleton with has_vacancy but no data:', skeleton.tempId);
              return false;
            }
          }
          return true;
        })
        .map(skeleton => {
          // Compute visualSupervisor for skeletons
          let skelVisualSupervisor: { _id: string; name: string } | null = null;
          if (skeleton.parentTeamId) {
            const skelTeamHead = teamToHeadMap.get(skeleton.parentTeamId);
            if (skelTeamHead) {
              skelVisualSupervisor = { _id: skelTeamHead.headId, name: skelTeamHead.headName };
            }
          }
          return {
            _id: skeleton.tempId,
            name: skeleton.employeeName || '',
            pending: true,
            skeletonData: skeleton,
            supervisor: skelVisualSupervisor,
            visualSupervisor: skelVisualSupervisor,
            team: skeleton.parentTeamId
              ? { _id: skeleton.parentTeamId, name: '' }
              : null,
            position: skeleton.title ? { _id: '', name: skeleton.title } : null,
          };
        });

      // Debug: Log skeleton filtering
      console.log('[loadOrgChart] Skeleton filtering debug:', {
        totalSkeletons: skeletonsRef.current.length,
        hasVacancySkeletons: skeletonsRef.current.filter(s => s.state === 'has_vacancy').length,
        skeletonEmployeesAfterFilter: skeletonEmployees.length,
        vacancyNodeIds: vacancyNodes.map(v => v._id),
        skeletonVacancyIds: skeletonsRef.current
          .filter(s => s.state === 'has_vacancy' && s.vacancy)
          .map(s => ({ tempId: s.tempId, vacancyId: s.vacancy?._id })),
      });

      // Deduplicate: Remove skeletons whose vacancy ID matches a real vacancy node
      // This is a safety net in case the filter above didn't catch all cases
      const vacancyNodeIdSet = new Set(vacancyNodes.map(v => v._id));
      const deduplicatedSkeletonEmployees = skeletonEmployees.filter(emp => {
        const skeleton = emp.skeletonData;
        if (skeleton?.state === 'has_vacancy' && skeleton?.vacancy?._id) {
          const isDuplicate = vacancyNodeIdSet.has(skeleton.vacancy._id);
          if (isDuplicate) {
            console.log('[loadOrgChart] Removing duplicate skeleton:', skeleton.tempId, 'for vacancy:', skeleton.vacancy._id);
          }
          return !isDuplicate;
        }
        return true;
      });

      const allEmployeesWithSkeletons = [...employees, ...vacancyNodes, ...leaderlessHeadNodes, ...deduplicatedSkeletonEmployees];
      console.log('[loadOrgChart] Total allEmployeesWithSkeletons:', allEmployeesWithSkeletons.length, '(employees:', employees.length, 'vacancies:', vacancyNodes.length, 'leaderless:', leaderlessHeadNodes.length, 'skeletons:', deduplicatedSkeletonEmployees.length, ')');

      // Update employeesRef
      employeesRef.current = allEmployeesWithSkeletons;

      // Use validation to detect data integrity issues and multi-org support
      // Use ref to get current selectedOrgId to avoid stale closure issues
      const currentSelectedOrgId = selectedOrgIdRef.current;
      console.log('[loadOrgChart] After API calls, currentSelectedOrgId:', currentSelectedOrgId);
      const { tree: root, error: integrityError, availableOrganizations, orphans } = buildTreeWithValidation(allEmployeesWithSkeletons, currentSelectedOrgId);
      console.log('[loadOrgChart] buildTreeWithValidation result - root:', !!root, 'availableOrgs:', availableOrganizations?.length, 'orphans:', orphans.length);

      // Track orphaned employees and build orphan reasons map
      setOrphanedEmployees(orphans);
      const reasonsMap = new Map<string, string>();
      orphans.forEach(orphan => {
        const team = orphan.team;
        const teamName = team ? (typeof team === 'object' ? team.name : String(team)) : null;
        const supervisor = orphan.supervisor || orphan.visualSupervisor;

        let reason: string;
        if (!supervisor && !teamName) {
          reason = 'No supervisor and no team assigned';
        } else if (!supervisor && teamName) {
          reason = `No supervisor set (in team "${teamName}")`;
        } else if (supervisor) {
          const supervisorName = supervisor.name || supervisor._id;
          reason = `Supervisor "${supervisorName}" not in org chart`;
        } else {
          reason = 'Cannot connect to organization root';
        }
        reasonsMap.set(orphan._id, reason);
      });
      setOrphanReasons(reasonsMap);

      // Build set of placed employee IDs (all non-orphans)
      const placedIds = new Set<string>();
      allEmployeesWithSkeletons.forEach(emp => {
        if (!orphans.find(o => o._id === emp._id)) {
          placedIds.add(emp._id);
        }
      });
      setPlacedEmployeeIds(placedIds);

      // Find teams without a Head of Team (potential org roots that have no members yet)
      const teamsWithoutHead = teamsActivities.filter(team => {
        const headOfTeamValue = fieldIds.headOfTeam ? team.fields?.[fieldIds.headOfTeam]?.value : null;
        return !headOfTeamValue; // No head of team assigned
      });

      // Merge available organizations with empty teams (teams without head)
      // This ensures new orgs show up even before they have members
      const mergedOrgs: OrganizationOption[] = [];

      // Add orgs from buildTreeWithValidation (have employees)
      if (availableOrganizations) {
        availableOrganizations.forEach(org => mergedOrgs.push(org));
      }

      // Add teams without head that aren't already in the list
      teamsWithoutHead.forEach(team => {
        const alreadyInList = mergedOrgs.some(org => org.teamId === team._id);
        if (!alreadyInList) {
          mergedOrgs.push({
            teamId: team._id,
            teamName: team.name,
            employeeCount: 0
          });
        }
      });

      // Store available organizations for the switcher (use merged list if we have any)
      setAvailableOrgs(mergedOrgs.length > 0 ? mergedOrgs : null);

      if (integrityError) {
        setDataError(integrityError);
        setTreeData(null);
      } else if (root) {
        setDataError(null);
        const newTreeData = convertToD3Tree(root, expandedNodesRef.current, collapsedNodesRef.current, 0, DEFAULT_EXPAND_DEPTH);
        setTreeData(newTreeData);
      } else if (availableOrganizations && availableOrganizations.length > 0 && !currentSelectedOrgId && !userHasSelectedOrgRef.current) {
        // Multiple orgs available but none selected, and user hasn't manually selected yet
        // Use default from config if loaded, otherwise use first org
        const orgToSelect = (configLoaded && defaultOrgId && availableOrganizations.some(o => o.teamId === defaultOrgId))
          ? defaultOrgId
          : availableOrganizations[0].teamId;
        // Update ref before state so subsequent calls see correct value
        selectedOrgIdRef.current = orgToSelect;
        setSelectedOrgId(orgToSelect);
      } else if (currentSelectedOrgId && !root) {
        // User selected an org but tree building returned null (e.g., empty org with no employees)
        // Clear tree data to show empty state rather than stale data from previous org
        setDataError(null);
        setTreeData(null);
      }
    } catch (err) {
      console.error('Error loading org chart:', err);
      setError(err instanceof Error ? err.message : 'Failed to load org chart');
    } finally {
      setLoading(false);
    }
  // Note: selectedOrgId not in deps - ref is read after async calls to get latest value
  // fieldIds.team and fieldIds.supervisor added to re-run when schema loads
  // isPublic and loadPublicOrgChart added for public mode support
  }, [hailer, DEFAULT_EXPAND_DEPTH, defaultOrgId, configLoaded, fieldIds.team, fieldIds.supervisor, isPublic, loadPublicOrgChart]);

  // Keep ref updated with latest loadOrgChart function
  loadOrgChartRef.current = loadOrgChart;

  // Fetch a single activity and merge into existing data
  const fetchAndMergeActivity = useCallback(async (activityId: string, workflowId: string) => {
    if (!hailer) return;

    try {
      const activity = await hailer.activity.get(activityId);
      if (!activity) return;

      const isTeam = workflowId === TEAMS.WORKFLOW_ID;
      const isDisciplinaryAction = workflowId === DISCIPLINARY_ACTIONS.WORKFLOW_ID;
      const isVacancy = workflowId === VACANCIES.WORKFLOW_ID;

      // Only process known workflows
      const isEmployee = workflowId === WORKFLOW_ID;
      if (!isTeam && !isEmployee && !isDisciplinaryAction && !isVacancy) {
        // Unknown workflow - ignore to prevent adding non-employees to the tree
        console.log('Ignoring activity from unknown workflow:', workflowId);
        return;
      }

      // Handle vacancy updates - reload chart since vacancies have complex relationships
      // (can be vacancy heads, linked to skeletons, etc.)
      if (isVacancy) {
        console.log('Vacancy changed, reloading chart');
        await loadOrgChart();
        return;
      }

      // Handle disciplinary action updates - just update the linked employee's flag
      if (isDisciplinaryAction) {
        const daFields = activity.fields || {};
        const linkedEmployee = daFields[DISCIPLINARY_ACTIONS.FIELD_IDS.NAME]?.value as { _id: string; name: string } | null;
        if (linkedEmployee?._id) {
          // Update the employee's hasDisciplinaryAction flag
          employeesRef.current = employeesRef.current.map(emp => {
            if (emp._id === linkedEmployee._id) {
              return { ...emp, hasDisciplinaryAction: true };
            }
            return emp;
          });
          // Rebuild tree from local data to show the updated icon
          rebuildTree();
        }
        return;
      }

      if (isTeam) {
        // Handle team updates - especially head of team changes
        const teamFields = activity.fields || {};
        const headOfTeamRaw = fieldIds.headOfTeam ? teamFields[fieldIds.headOfTeam]?.value : null;
        // Handle both object { _id, name } and string ID formats
        const newHeadOfTeamId = typeof headOfTeamRaw === 'string'
          ? headOfTeamRaw
          : (headOfTeamRaw as { _id: string; name: string } | null)?._id || null;

        // Find current head of this team (before changes)
        const previousHead = employeesRef.current.find(emp => emp.headOfTeam?._id === activity._id);
        const previousHeadId = previousHead?._id || null;

        // Detect if head of team changed - requires full chart re-render
        const headOfTeamChanged = previousHeadId !== newHeadOfTeamId;

        // Update teamsData for picker and dashboard (add or update)
        const parentTeamRaw = fieldIds.parentTeam ? teamFields[fieldIds.parentTeam]?.value : null;
        const newParentTeamId = typeof parentTeamRaw === 'string'
          ? parentTeamRaw
          : (parentTeamRaw as { _id: string; name: string } | null)?._id || null;

        setTeamsData(prev => {
          const filtered = prev.filter(t => t._id !== activity._id);
          return [...filtered, { _id: activity._id, name: activity.name, parentTeamId: newParentTeamId }];
        });

        // Always clear headOfTeam from any employee who previously led this team
        employeesRef.current = employeesRef.current.map(emp => {
          if (emp.headOfTeam?._id === activity._id) {
            return { ...emp, headOfTeam: null };
          }
          return emp;
        });

        // Set headOfTeam on the new head (if there is one)
        if (newHeadOfTeamId) {
          employeesRef.current = employeesRef.current.map(emp => {
            if (emp._id === newHeadOfTeamId) {
              return {
                ...emp,
                headOfTeam: { _id: activity._id, name: activity.name },
              };
            }
            // Also check if this is a vacancy head - compare real vacancy ID to newHeadOfTeamId
            // (vacancy heads have synthetic IDs but teams store the real vacancy ID)
            if (emp.vacancyHead && emp.vacancyHead._id === newHeadOfTeamId) {
              return {
                ...emp,
                headOfTeam: { _id: activity._id, name: activity.name },
              };
            }
            return emp;
          });
        }

        // If head of team changed, do a full reload to properly reposition the team
        if (headOfTeamChanged) {
          await loadOrgChart();
        } else {
          rebuildTree();
        }
        return;
      }

      const fields = activity.fields || {};
      const position = fieldIds.position ? fields[fieldIds.position]?.value as { _id: string; name: string } | string | null : null;
      const team = fieldIds.team ? fields[fieldIds.team]?.value as { _id: string; name: string } | string | null : null;
      const supervisor = fieldIds.supervisor ? fields[fieldIds.supervisor]?.value as { _id: string; name: string } | null : null;
      const nationality = fieldIds.nationality ? fields[fieldIds.nationality]?.value as string | null : null;
      // Date of birth comes as timestamp or ISO string
      const dateOfBirthRaw = fieldIds.dateOfBirth ? fields[fieldIds.dateOfBirth]?.value : null;
      const dateOfBirth = dateOfBirthRaw
        ? (typeof dateOfBirthRaw === 'number' ? dateOfBirthRaw : new Date(dateOfBirthRaw as string).getTime())
        : null;
      // Salary can be number or numericunit object { value, unit }
      const salaryRaw = fieldIds.salary ? fields[fieldIds.salary]?.value : null;
      const salary = salaryRaw
        ? (typeof salaryRaw === 'number' ? salaryRaw : (salaryRaw as { value?: number })?.value || null)
        : null;
      // Total Cost (calculated field: salary + side costs for employees, consultancy fee for contractors)
      const totalCostRaw = fieldIds.totalCost ? fields[fieldIds.totalCost]?.value : null;
      const totalCost = totalCostRaw
        ? (typeof totalCostRaw === 'number' ? totalCostRaw : (totalCostRaw as { value?: number })?.value || null)
        : null;
      // Status field (Active, Long sick leave, Parental leave, Study leave)
      const status = fieldIds.status ? fields[fieldIds.status]?.value as string | null : null;

      // Check if this employee's supervisor or team changed (for tree restructuring detection)
      const existingEmployee = employeesRef.current.find(e => e._id === activity._id);
      const previousSupervisorId = existingEmployee?.supervisor?._id || null;
      const newSupervisorId = supervisor?._id || null;
      const supervisorChanged = previousSupervisorId !== newSupervisorId;

      // Check if team changed
      const previousTeamId = typeof existingEmployee?.team === 'object' ? existingEmployee?.team?._id : null;
      const newTeamId = typeof team === 'object' ? team?._id : null;
      const teamChanged = previousTeamId !== newTeamId;

      // Check if this employee is a head of team (their move affects entire team)
      const isHeadOfTeam = existingEmployee?.headOfTeam != null;

      // Compute visualSupervisor from team's head (like loadOrgChart does)
      // This ensures employees placed under vacancies are positioned correctly
      let visualSupervisor: { _id: string; name: string } | null = null;
      if (newTeamId) {
        const teamHead = teamToHeadMapRef.current.get(newTeamId);
        if (teamHead && teamHead.headId !== activity._id) {
          visualSupervisor = { _id: teamHead.headId, name: teamHead.headName };
        }
      }

      const newEmployee: Employee = {
        _id: activity._id,
        name: activity.name,
        position: position || null,
        team: team || null,
        supervisor,
        visualSupervisor,
        nationality: nationality || null,
        dateOfBirth,
        salary,
        totalCost,
        status: status || null,
        created: activity.created || 0,
        // Preserve headOfTeam and hasDisciplinaryAction from existing employee data
        headOfTeam: existingEmployee?.headOfTeam,
        hasDisciplinaryAction: existingEmployee?.hasDisciplinaryAction,
      };

      // Check if this employee fills a skeleton position (same supervisor)
      // If so, remove that skeleton
      const supervisorId = supervisor?._id;
      if (supervisorId) {
        const matchingSkeleton = skeletonsRef.current.find(s => s.parentId === supervisorId);
        if (matchingSkeleton) {
          const newSkeletons = skeletonsRef.current.filter(s => s.tempId !== matchingSkeleton.tempId);
          // Update skeletons without triggering a separate rebuild
          skeletonsRef.current = newSkeletons;
          setSkeletons(newSkeletons);
          // Save to config in background
          saveSkeletonsToConfig(newSkeletons);
        }
      }

      // Keep vacancies and leaderless-head placeholders (they have pending: true but are legitimate)
      const filtered = employeesRef.current.filter(e => {
        if (e._id === activity._id) return false;
        if (e.isVacancy || e._id.startsWith('leaderless-head-')) return true;
        return !e.pending;
      });
      employeesRef.current = [...filtered, newEmployee];

      // If a head of team's supervisor changed, do full reload to reposition the entire team
      // Also rebuild if team changed (employee moved to different team)
      if (supervisorChanged && isHeadOfTeam) {
        await loadOrgChart();
      } else if (supervisorChanged || teamChanged) {
        // Supervisor or team changed - need to rebuild tree structure
        rebuildTree();
      } else {
        // Non-structural change (status, name, position, etc.) or new employee
        // Rebuild tree from local data (no server fetch needed)
        rebuildTree();
      }
    } catch (err) {
      console.error('Error fetching activity:', err);
      await loadOrgChart();
    }
  }, [hailer, loadOrgChart, rebuildTree, saveSkeletonsToConfig]);

  useEffect(() => {
    console.log('[Effect] loadOrgChart effect triggered. selectedOrgId:', selectedOrgId, 'ref:', selectedOrgIdRef.current, 'schemaReady:', schemaReady, 'isPublic:', isPublic);
    // Use ref to always call latest loadOrgChart without it being a dependency
    // This prevents the effect from re-running when loadOrgChart is recreated due to its deps changing
    // In public mode, load immediately without waiting for schema (we use public insight API)
    if (isPublic || schemaReady) {
      loadOrgChartRef.current?.();
    }
  // selectedOrgId triggers this effect; ref is set by caller BEFORE setSelectedOrgId()
  // so loadOrgChart() always reads correct value from selectedOrgIdRef.current
  // schemaReady triggers reload when schema becomes available (not needed for public mode)
  // isPublic triggers immediate load via public insight API
  // Note: loadOrgChart removed from deps - use ref to avoid double-triggering when function is recreated
  }, [reloadTrigger, selectedOrgId, schemaReady, isPublic]);

  // Watch for signals and handle incremental updates
  useEffect(() => {
    if (!lastSignal) return;

    const signalKey = `${lastSignal.sig}-${JSON.stringify(lastSignal.meta)}`;
    if (lastProcessedSignal.current === signalKey) return;

    if (isActivitySignal(lastSignal, WATCHED_WORKFLOWS)) {
      console.log('Org chart handling signal:', lastSignal.sig);
      lastProcessedSignal.current = signalKey;

      const meta = lastSignal.meta || {};
      // Handle various signal formats - activity_id can be an array
      const rawActivityId = meta._id || meta.activityId || meta.id || meta.activity_id;
      const activityId = Array.isArray(rawActivityId) ? rawActivityId[0] : rawActivityId;
      const workflowId = meta.process || meta.processId || meta.workflowId || meta.pid;

      if (lastSignal.sig === 'activity.delete') {
        // Handle disciplinary action deletion - need to reload to recalculate hasDisciplinaryAction flags
        if (workflowId === DISCIPLINARY_ACTIONS.WORKFLOW_ID) {
          loadOrgChart();
        } else if (workflowId === TEAMS.WORKFLOW_ID) {
          // Team deleted - full reload to detect orphaned employees
          // Employees whose team was deleted will become orphans
          console.log('Team deleted, reloading to detect orphans');
          loadOrgChart();
        } else if (workflowId === VACANCIES.WORKFLOW_ID) {
          // Vacancy deleted - full reload since vacancies can be team heads
          console.log('Vacancy deleted, reloading chart');
          loadOrgChart();
        } else {
          // Employee deleted
          employeesRef.current = employeesRef.current.filter(e => e._id !== activityId);
          rebuildTree();
        }
      } else if (activityId && workflowId) {
        fetchAndMergeActivity(activityId, workflowId);
      } else {
        loadOrgChart();
      }
    }
  }, [lastSignal, isActivitySignal, loadOrgChart, fetchAndMergeActivity, rebuildTree]);

  // ============== Render ==============

  // Custom node renderer
  const renderCustomNode = useCallback(({ nodeDatum }: CustomNodeElementProps) => {
    const orgNode = nodeDatum as unknown as OrgNodeDatum;
    const employee = orgNode.employee;
    const childrenTeams = orgNode.childrenTeams;
    const isHeadOfTeam = orgNode.isHeadOfTeam;
    const isCollapsed = orgNode.isCollapsed || false;
    // Multi-team child properties
    const teamInfo = orgNode.teamInfo;
    const isFirstOfTeam = orgNode.isFirstOfTeam;
    const parentHasMultipleTeams = orgNode.parentHasMultipleTeams;

    const handleToggle = () => {
      handleNodeToggle(employee._id, !isCollapsed);
      // Update tree data without re-mounting for smooth expand/collapse
      updateTreeData();

      // Center the clicked node on screen after the tree has updated
      setTimeout(() => {
        const cardElement = document.querySelector(`[data-employee-id="${employee._id}"]`);
        if (cardElement) {
          const rect = cardElement.getBoundingClientRect();
          const nodeScreenX = rect.left + rect.width / 2;
          const nodeScreenY = rect.top + rect.height / 2;
          centerOnNode(nodeScreenX, nodeScreenY);
        }
      }, 50);
    };

    // Show team separator pill above this node if it's the first child of a team in multi-team parent
    const showTeamSeparator = parentHasMultipleTeams && isFirstOfTeam && teamInfo;

    return (
      <g>
        {/* Team separator pill - positioned on the horizontal line above children */}
        {showTeamSeparator && (
          <foreignObject width={140} height={30} x={-70} y={-85} style={{ overflow: 'visible', pointerEvents: 'auto' }}>
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              height="100%"
              position="relative"
              zIndex={10}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <TeamSeparatorPill
                team={teamInfo}
                parentEmployeeId={employee.supervisor?._id || employee._id}
                onAddMember={handleAddMember}
                onOpenTeam={(teamId) => hailer?.ui.activity.open(teamId)}
                onOpenDashboard={handleOpenDashboard}
                isPublic={isPublic}
              />
            </Box>
          </foreignObject>
        )}

        {/* Single team action buttons - positioned on the horizontal line connecting children */}
        {/* Hidden in public mode */}
        {!isPublic && childrenTeams.length === 1 && !isCollapsed && (
          <foreignObject width={80} height={24} x={-40} y={56} style={{ overflow: 'visible', pointerEvents: 'auto' }}>
            <Box display="flex" justifyContent="center" alignItems="center" height="100%">
              <TeamActionButtons
                team={childrenTeams[0]}
                employeeId={employee._id}
                onAddMember={handleAddMember}
                onOpenTeam={(teamId) => hailer?.ui.activity.open(teamId)}
                onOpenDashboard={handleOpenDashboard}
                size="md"
              />
            </Box>
          </foreignObject>
        )}

        <foreignObject width={120} height={104} x={-60} y={-37} style={{ overflow: 'visible' }}>
          <EmployeeCard
            employee={employee}
            childrenTeams={childrenTeams}
            isCollapsed={isCollapsed}
            isHeadOfTeam={isHeadOfTeam}
            onToggle={handleToggle}
            onAddMember={handleAddMember}
            onAddTeam={handleAddTeam}
            onOpenTeam={(teamId) => hailer?.ui.activity.open(teamId)}
            onSkeletonDelete={handleDeleteSkeleton}
            onSkeletonAddEmployee={handleAddEmployee}
            onSkeletonOpenVacancy={handleOpenVacancy}
            onSkeletonFindResource={handleFindResource}
            hasSkeletonSubordinates={employee.pending ? hasSkeletonSubordinates(employee._id) : false}
            isPendingTeamCreation={pendingTeamCreations.has(employee._id)}
            onCancelPendingTeam={handleCancelPendingTeam}
            teamBorderColor={parentHasMultipleTeams ? teamInfo?.color : undefined}
            isPublic={isPublic}
          />
        </foreignObject>
      </g>
    );
  }, [handleNodeToggle, updateTreeData, centerOnNode, handleAddMember, handleAddTeam, handleDeleteSkeleton, handleAddEmployee, handleOpenVacancy, handleFindResource, hasSkeletonSubordinates, pendingTeamCreations, handleCancelPendingTeam, handleOpenDashboard, hailer, isPublic]);

  // Get selected skeleton for popups
  const selectedSkeleton = skeletons.find(s => s.tempId === selectedSkeletonId);

  // Dark mode colors (must be called before conditional returns)
  const alertBg = useColorModeValue('orange.50', 'orange.900');
  const alertTextColor = useColorModeValue('gray.600', 'gray.300');
  const listBorderColor = useColorModeValue('gray.200', 'gray.600');
  const listRowEven = useColorModeValue('white', 'gray.700');
  const listRowOdd = useColorModeValue('gray.50', 'gray.750');
  const listHoverBg = useColorModeValue('blue.50', 'blue.900');
  const mutedTextColor = useColorModeValue('gray.500', 'gray.400');

  // Schema loading state - skip in public mode since data comes from public insight
  if (!isPublic && schemaLoading) {
    return (
      <VStack spacing={4} py={8}>
        <Spinner size="xl" />
        <Text>Loading field schema...</Text>
      </VStack>
    );
  }

  if (!isPublic && schemaError) {
    return (
      <VStack spacing={4} py={8}>
        <Text color="red.500">Error loading schema: {schemaError.message}</Text>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </VStack>
    );
  }

  if (loading) {
    return (
      <Box bg={bgColor} w="100%" h="100vh" position="relative">
        <Box
          position="absolute"
          left={`${centerMarkerX}px`}
          top={`${centerMarkerY}px`}
          transform="translate(-50%, -50%)"
        >
          <Spinner size="xl" color="blue.500" />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <VStack spacing={4} py={8}>
        <Text color="red.500">Error: {error}</Text>
      </VStack>
    );
  }

  if (dataError) {
    return (
      <Box bg={bgColor} w="100%" minH="100vh" p={8}>
        <VStack spacing={6} maxW="800px" mx="auto" align="stretch">
          <HStack spacing={3} color="orange.500">
            <Text fontSize="2xl">⚠️</Text>
            <Text fontSize="xl" fontWeight="bold">Data Issue Detected</Text>
          </HStack>

          <Box bg={alertBg} borderRadius="md" p={4} borderLeft="4px solid" borderLeftColor="orange.400">
            <Text fontWeight="medium" mb={2}>{dataError.message}</Text>
            <Text fontSize="sm" color={alertTextColor} whiteSpace="pre-line">{dataError.hint}</Text>
          </Box>

          <Box>
            <Text fontWeight="bold" mb={3}>Affected Employees ({dataError.affectedEmployees.length}):</Text>
            <Box maxH="400px" overflowY="auto" borderRadius="md" border="1px solid" borderColor={listBorderColor}>
              {dataError.affectedEmployees.map((emp, idx) => (
                <HStack
                  key={emp._id}
                  p={3}
                  bg={idx % 2 === 0 ? listRowEven : listRowOdd}
                  justify="space-between"
                  _hover={{ bg: listHoverBg, cursor: 'pointer' }}
                  onClick={() => hailer?.ui.activity.open(emp._id)}
                >
                  <Text fontWeight="medium">{emp.name || '(unnamed)'}</Text>
                  <Text fontSize="sm" color={mutedTextColor}>{emp.issue}</Text>
                </HStack>
              ))}
            </Box>
          </Box>

          <Text fontSize="sm" color={mutedTextColor}>
            Click on an employee to open their profile and fix the supervisor assignment.
          </Text>
        </VStack>
      </Box>
    );
  }

  if (!treeData) {
    return (
      <VStack spacing={4} py={8}>
        <Text>No employees found</Text>
      </VStack>
    );
  }

  // Handle marker drag
  const handleMarkerYMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingMarkerY(true);
  };

  const handleMarkerXMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingMarkerX(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingMarkerY) {
      setCenterMarkerY(e.clientY);
    }
    if (isDraggingMarkerX) {
      setCenterMarkerX(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDraggingMarkerY(false);
    setIsDraggingMarkerX(false);
  };

  return (
    <Box
      bg={bgColor}
      w="100%"
      h="100vh"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <Tree
        key={treeKey}
        ref={treeRef}
        data={treeData}
        orientation="vertical"
        pathFunc="step"
        translate={translate}
        nodeSize={{ x: 130, y: 138 }}
        separation={{ siblings: 0.85, nonSiblings: 1.2 }}
        renderCustomNodeElement={renderCustomNode}
        pathClassFunc={() => 'org-chart-link'}
        zoom={zoom}
        scaleExtent={{ min: 0.3, max: 2 }}
        collapsible={true}
        initialDepth={undefined}
        shouldCollapseNeighborNodes={false}
        enableLegacyTransitions={false}
        transitionDuration={0}
        onUpdate={(update) => {
          // Capture user's zoom/pan changes to preserve them
          if (update.zoom !== zoom) {
            setZoom(update.zoom);
          }
          // Also capture translate changes during zoom/pan to prevent jumping
          if (update.translate.x !== translate.x || update.translate.y !== translate.y) {
            setTranslate(update.translate);
          }
        }}
      />

      {/* Helper lines for calibration - toggled via settings */}
      {showHelperLines && (
        <>
          {/* Draggable Y Center Marker - horizontal line */}
          <Box
            position="fixed"
            left="0"
            right="0"
            top={`${centerMarkerY}px`}
            height="2px"
            bg="red.500"
            zIndex={9999}
            pointerEvents="none"
          />
          <Box
            position="fixed"
            left="10px"
            top={`${centerMarkerY - 15}px`}
            bg="red.500"
            color="white"
            px={3}
            py={1}
            borderRadius="md"
            fontSize="sm"
            fontWeight="bold"
            cursor="grab"
            zIndex={9999}
            onMouseDown={handleMarkerYMouseDown}
            userSelect="none"
            _active={{ cursor: 'grabbing' }}
          >
            Y: {centerMarkerY}px (drag)
          </Box>

          {/* Draggable X Center Marker - vertical line */}
          <Box
            position="fixed"
            top="0"
            bottom="0"
            left={`${centerMarkerX}px`}
            width="2px"
            bg="blue.500"
            zIndex={9999}
            pointerEvents="none"
          />
          <Box
            position="fixed"
            top="10px"
            left={`${centerMarkerX - 15}px`}
            bg="blue.500"
            color="white"
            px={3}
            py={1}
            borderRadius="md"
            fontSize="sm"
            fontWeight="bold"
            cursor="grab"
            zIndex={9999}
            onMouseDown={handleMarkerXMouseDown}
            userSelect="none"
            _active={{ cursor: 'grabbing' }}
          >
            X: {centerMarkerX}px (drag)
          </Box>
        </>
      )}

      {/* Bottom left FAB buttons - hidden in public mode */}
      {!isPublic && (
      <HStack position="fixed" bottom="20px" left="20px" spacing={2} zIndex={9998}>
        {/* Settings FAB - helper lines toggle */}
        <Box
          bg={showHelperLines ? 'blue.500' : 'gray.600'}
          color="white"
          borderRadius="full"
          w="40px"
          h="40px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          boxShadow="lg"
          onClick={() => setShowHelperLines(!showHelperLines)}
          _hover={{ bg: showHelperLines ? 'blue.600' : 'gray.700', transform: 'scale(1.05)' }}
          transition="all 0.15s"
          title={showHelperLines ? 'Hide helper lines' : 'Show helper lines'}
        >
          <Icon as={FACrosshairs} boxSize="18px" />
        </Box>

        {/* Expand/Collapse All FAB */}
        <Box
          bg="gray.600"
          color="white"
          borderRadius="full"
          w="40px"
          h="40px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          boxShadow="lg"
          onClick={handleToggleExpandAll}
          _hover={{ bg: 'gray.700', transform: 'scale(1.05)' }}
          transition="all 0.15s"
          title={isAllExpanded ? 'Collapse all' : 'Expand all'}
        >
          <Icon as={isAllExpanded ? FAAnglesUp : FAAnglesDown} boxSize="14px" />
        </Box>

        {/* Orphaned Employees FAB */}
        {orphanedEmployees.length > 0 && (
          <Box position="relative">
            <Box
              bg="orange.500"
              color="white"
              borderRadius="full"
              w="40px"
              h="40px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              cursor="pointer"
              boxShadow="lg"
              onClick={handleViewOrphans}
              _hover={{ bg: 'orange.600', transform: 'scale(1.05)' }}
              transition="all 0.15s"
              title={`View ${orphanedEmployees.length} orphaned employee${orphanedEmployees.length !== 1 ? 's' : ''}`}
            >
              <Icon as={HailerShare} boxSize="16px" />
            </Box>
            <Badge
              position="absolute"
              top="-4px"
              right="-4px"
              borderRadius="full"
              bg="red.500"
              color="white"
              fontSize="10px"
              px="6px"
              py="2px"
              fontWeight="bold"
            >
              {orphanedEmployees.length}
            </Badge>
          </Box>
        )}

        {/* Organization Switcher FAB - always show to allow creating new orgs */}
        {availableOrgs && (
          <Box position="relative">
            {/* Invisible overlay to catch clicks outside the picker */}
            {showOrgPicker && (
              <Box
                position="fixed"
                top={0}
                left={0}
                right={0}
                bottom={0}
                zIndex={9999}
                onClick={() => setShowOrgPicker(false)}
              />
            )}
            <Box
              bg={showOrgPicker ? 'blue.500' : 'purple.500'}
              color="white"
              borderRadius="full"
              w="40px"
              h="40px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              cursor="pointer"
              boxShadow="lg"
              onClick={() => setShowOrgPicker(!showOrgPicker)}
              _hover={{ bg: showOrgPicker ? 'blue.600' : 'purple.600', transform: 'scale(1.05)' }}
              transition="all 0.15s"
              title="Switch organization"
              zIndex={10001}
            >
              <Icon as={FABuilding} boxSize="16px" />
            </Box>

            {/* Organization picker dropdown */}
            {showOrgPicker && (
              <Box
                position="absolute"
                bottom="50px"
                left="0"
                bg={listRowEven}
                borderRadius="md"
                boxShadow="xl"
                border="1px solid"
                borderColor={listBorderColor}
                minW="250px"
                zIndex={10000}
                overflow="hidden"
              >
                <Text fontSize="xs" fontWeight="bold" color={mutedTextColor} px={3} py={2} borderBottom="1px solid" borderColor={listBorderColor}>
                  Switch Organization
                </Text>
                {availableOrgs.map((org) => {
                  const displayName = orgCustomNames[org.teamId] || org.teamName;
                  const isEditing = editingOrgId === org.teamId;

                  return (
                    <Box
                      key={org.teamId}
                      px={3}
                      py={2}
                      bg={selectedOrgId === org.teamId ? listHoverBg : 'transparent'}
                      _hover={{ bg: listHoverBg }}
                    >
                      {isEditing ? (
                        <HStack spacing={2}>
                          <Input
                            size="sm"
                            value={editingOrgName}
                            onChange={(e) => setEditingOrgName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveOrgNamesToConfig({ ...orgCustomNames, [org.teamId]: editingOrgName });
                                setEditingOrgId(null);
                              } else if (e.key === 'Escape') {
                                setEditingOrgId(null);
                              }
                            }}
                            autoFocus
                            borderColor={listBorderColor}
                          />
                          <IconButton
                            aria-label="Save"
                            icon={<Text fontSize="xs">✓</Text>}
                            size="xs"
                            colorScheme="green"
                            onClick={() => {
                              saveOrgNamesToConfig({ ...orgCustomNames, [org.teamId]: editingOrgName });
                              setEditingOrgId(null);
                            }}
                          />
                          <IconButton
                            aria-label="Cancel"
                            icon={<Text fontSize="xs">✕</Text>}
                            size="xs"
                            onClick={() => setEditingOrgId(null)}
                          />
                        </HStack>
                      ) : (
                        <HStack justify="space-between">
                          <HStack
                            spacing={2}
                            flex={1}
                            cursor="pointer"
                            onClick={() => {
                              console.log('[OrgPicker] Click! org.teamId:', org.teamId, 'current selectedOrgId:', selectedOrgId);
                              // Mark that user has manually selected an org (prevents auto-selection race conditions)
                              userHasSelectedOrgRef.current = true;
                              // Update ref BEFORE state so loadOrgChart sees correct value immediately
                              selectedOrgIdRef.current = org.teamId;
                              console.log('[OrgPicker] Set ref to:', selectedOrgIdRef.current);
                              setSelectedOrgId(org.teamId);
                              setShowOrgPicker(false);
                            }}
                          >
                            <Text
                              fontSize="sm"
                              fontWeight={selectedOrgId === org.teamId ? 'bold' : 'normal'}
                            >
                              {displayName}
                            </Text>
                            <Text
                              fontSize="xs"
                              color={mutedTextColor}
                              fontWeight="normal"
                            >
                              ({org.employeeCount})
                            </Text>
                          </HStack>
                          <HStack spacing={2}>
                            {selectedOrgId === org.teamId && <Text fontSize="xs">✓</Text>}
                            <Text
                              fontSize="xs"
                              cursor="pointer"
                              color={defaultOrgId === org.teamId ? 'purple.500' : mutedTextColor}
                              _hover={{ color: 'purple.500' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                saveDefaultOrgToConfig(org.teamId);
                              }}
                              title="Set as default"
                            >
                              {defaultOrgId === org.teamId ? '★' : '☆'}
                            </Text>
                            <Text
                              fontSize="xs"
                              cursor="pointer"
                              color={mutedTextColor}
                              _hover={{ color: 'blue.500' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingOrgId(org.teamId);
                                setEditingOrgName(displayName);
                              }}
                              title="Rename organization"
                            >
                              ✎
                            </Text>
                          </HStack>
                        </HStack>
                      )}
                    </Box>
                  );
                })}

                {/* Add Organization button */}
                <Box
                  px={3}
                  py={2}
                  borderTop="1px solid"
                  borderColor={listBorderColor}
                  cursor="pointer"
                  _hover={{ bg: listHoverBg }}
                  onClick={handleCreateOrganization}
                >
                  <HStack spacing={2}>
                    <Icon as={FAPlus} boxSize="12px" color="green.500" />
                    <Text fontSize="sm" color="green.600" fontWeight="medium">
                      Add Organization
                    </Text>
                  </HStack>
                  <Text fontSize="xs" color={mutedTextColor} mt={1}>
                    Create a team without a Head of Team to start a new org chart
                  </Text>
                </Box>
              </Box>
            )}
          </Box>
        )}

        {/* Share FAB - copy public link */}
        <Box
          bg="teal.500"
          color="white"
          borderRadius="full"
          w="40px"
          h="40px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          boxShadow="lg"
          onClick={handleCopyPublicLink}
          _hover={{ bg: 'teal.600', transform: 'scale(1.05)' }}
          transition="all 0.15s"
          title="Copy public link"
        >
          <Icon as={HailerShare} boxSize="16px" />
        </Box>

        {/* Permissions Matrix FAB */}
        <Box
          bg="orange.500"
          color="white"
          borderRadius="full"
          w="40px"
          h="40px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          boxShadow="lg"
          onClick={() => setShowPermissionsMatrix(true)}
          _hover={{ bg: 'orange.600', transform: 'scale(1.05)' }}
          transition="all 0.15s"
          title="Permissions Matrix"
        >
          <Icon as={FATableCells} boxSize="16px" />
        </Box>
      </HStack>
      )}

      {/* Team Picker Popup */}
      <TeamPickerPopup
        isOpen={showTeamPicker}
        onClose={() => {
          setShowTeamPicker(false);
          setPendingTeamParentId(null);
        }}
        teams={teamsData}
        onSelectTeam={handleTeamSelected}
      />

      {/* Find Resource Popup / Orphan Viewer */}
      <FindResourcePopup
        isOpen={showFindResource}
        onClose={() => {
          setShowFindResource(false);
          setSelectedSkeletonId(null);
        }}
        employees={employeesRef.current}
        skeletonId={selectedSkeletonId || ''}
        teamId={selectedSkeleton?.parentTeamId || null}
        onMoveImmediately={handleMoveImmediately}
        onInitiateChange={handleInitiateChange}
        mode={selectedSkeletonId ? 'find_resource' : 'view_orphans'}
        placedEmployeeIds={placedEmployeeIds}
        orphanReasons={orphanReasons}
      />

      {/* Team Dashboard Popup */}
      <TeamDashboardPopup
        isOpen={!!dashboardTeamId}
        onClose={() => setDashboardTeamId(null)}
        teamId={dashboardTeamId}
        teamName={teamsData.find(t => t._id === dashboardTeamId)?.name}
        employees={employeesRef.current}
        teams={teamsData}
        onOpenEmployee={(employeeId) => hailer?.ui.activity.open(employeeId)}
      />

      {/* Permissions Matrix Popup */}
      <PermissionsMatrix
        isOpen={showPermissionsMatrix}
        onClose={() => setShowPermissionsMatrix(false)}
        onOpenTeam={(teamId) => hailer?.ui.activity.open(teamId)}
        teams={teamsData}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={!!deleteConfirmSkeletonId}
        leastDestructiveRef={cancelRef}
        onClose={() => setDeleteConfirmSkeletonId(null)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Position
            </AlertDialogHeader>

            <AlertDialogBody>
              This position has subordinates. Deleting it will also remove all subordinate skeleton positions. Are you sure?
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setDeleteConfirmSkeletonId(null)}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleConfirmDelete} ml={3}>
                Delete All
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}
