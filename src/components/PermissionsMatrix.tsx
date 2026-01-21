import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Text,
  HStack,
  VStack,
  Icon,
  useColorModeValue,
  Switch,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Tooltip,
} from '@chakra-ui/react';
import { FAXmark } from '../hailerTheme/hailerIcons/FAXmark';
import { FAChevronRight } from '../hailerTheme/hailerIcons/FAChevronRight';
import { FAChevronDown } from '../hailerTheme/hailerIcons/FAChevronDown';
import { FAUpRightFromSquare } from '../hailerTheme/hailerIcons/FAUpRightFromSquare';

// Access level type and configuration
export type AccessLevel = 'none' | 'own' | 'team' | 'all' | 'admin';

interface AccessLevelConfig {
  value: AccessLevel;
  label: string;
  description: string;
  bg: string;
  hoverBg: string;
}

const ACCESS_LEVELS: AccessLevelConfig[] = [
  {
    value: 'none',
    label: 'No access',
    description: 'Cannot view or access any activities in this workflow',
    bg: 'red.500',
    hoverBg: 'red.600'
  },
  {
    value: 'own',
    label: 'Own',
    description: 'Can only access activities they created or are assigned to',
    bg: 'yellow.500',
    hoverBg: 'yellow.600'
  },
  {
    value: 'team',
    label: 'Team',
    description: 'Can access activities created by anyone in their team',
    bg: 'blue.500',
    hoverBg: 'blue.600'
  },
  {
    value: 'all',
    label: 'All',
    description: 'Full access to all activities in this workflow',
    bg: 'green.500',
    hoverBg: 'green.600'
  },
  {
    value: 'admin',
    label: 'Admin',
    description: 'Full admin access with ability to manage workflow settings and permissions',
    bg: 'purple.500',
    hoverBg: 'purple.600'
  },
];

interface WorkflowInfo {
  name: string;
  type: 'workflow' | 'dataset';
}

interface PermissionsMatrixProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTeam?: (teamId: string) => void;
  teams?: Array<{ _id: string; name: string }>;
}

// Mock data (will be replaced with real data in future)
const MOCK_TEAMS = [
  { id: 'mock-team-1', name: 'Management' },
  { id: 'mock-team-2', name: 'Engineering' },
  { id: 'mock-team-3', name: 'Sales' },
  { id: 'mock-team-4', name: 'HR' },
  { id: 'mock-team-5', name: 'Marketing' },
  { id: 'mock-team-6', name: 'Finance' },
];
const MOCK_WORKFLOWS: WorkflowInfo[] = [
  { name: 'Employees', type: 'workflow' },
  { name: 'Teams', type: 'dataset' },
  { name: 'Positions', type: 'dataset' },
  { name: 'Change Management', type: 'workflow' },
  { name: 'Vacancies', type: 'workflow' },
  { name: 'Disciplinary Actions', type: 'workflow' },
];

// Mock phases data for workflows
const MOCK_PHASES: Record<string, string[]> = {
  'Employees': ['Active Employees', 'Active Contractors'],
  'Teams': ['Active Teams'],
  'Positions': ['Active Positions'],
  'Change Management': ['Pending Changes', 'Completed Changes'],
  'Vacancies': ['Planning', 'Published', 'Archive'],
  'Disciplinary Actions': ['Active Cases', 'Resolved'],
};

export default function PermissionsMatrix({ isOpen, onClose, onOpenTeam, teams }: PermissionsMatrixProps) {
  // Use real teams data if provided, otherwise fall back to mock teams
  // Convert real teams to match the MOCK_TEAMS structure for compatibility
  // Memoize to prevent re-computation on every render (which would reset state)
  const teamsToUse = useMemo(
    () => teams ? teams.map(t => ({ id: t._id, name: t.name })) : MOCK_TEAMS,
    [teams]
  );

  // Store permissions as Record<workflowName, Record<teamName, AccessLevel>>
  const [permissions, setPermissions] = useState<Record<string, Record<string, AccessLevel>>>({});

  // Track expanded workflows
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());

  // Track phase permissions: Record<workflowName, Record<phaseName, Record<teamName, boolean>>>
  // true = Edit, false = Read
  const [phasePermissions, setPhasePermissions] = useState<Record<string, Record<string, Record<string, boolean>>>>({});

  const overlayRef = useRef<HTMLDivElement>(null);

  // Theme colors
  const overlayBg = useColorModeValue('rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.8)');
  const modalBg = useColorModeValue('white', 'gray.800');
  const headerBg = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const stickyHeaderBg = useColorModeValue('gray.100', 'gray.700');
  const cellBg = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.800', 'white');
  const mutedTextColor = useColorModeValue('gray.500', 'gray.400');
  const phaseRowBg = useColorModeValue('gray.50', 'gray.750');
  const phaseRowHoverBg = useColorModeValue('gray.100', 'gray.650');
  const editColor = useColorModeValue('green.500', 'green.400');
  const readColor = useColorModeValue('gray.500', 'gray.400');

  // Initialize permissions with default values
  useEffect(() => {
    if (isOpen) {
      const initialPermissions: Record<string, Record<string, AccessLevel>> = {};
      const initialPhasePermissions: Record<string, Record<string, Record<string, boolean>>> = {};

      MOCK_WORKFLOWS.forEach(workflow => {
        initialPermissions[workflow.name] = {};
        initialPhasePermissions[workflow.name] = {};

        teamsToUse.forEach(team => {
          // Default to 'all' access for all teams
          initialPermissions[workflow.name][team.name] = 'all';
        });

        // Initialize phase permissions (default to Edit = true)
        const phases = MOCK_PHASES[workflow.name] || [];
        phases.forEach(phase => {
          initialPhasePermissions[workflow.name][phase] = {};
          teamsToUse.forEach(team => {
            initialPhasePermissions[workflow.name][phase][team.name] = true; // Edit by default
          });
        });
      });

      setPermissions(initialPermissions);
      setPhasePermissions(initialPhasePermissions);
    }
  }, [isOpen, teamsToUse]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Handle click outside
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  // Toggle workflow expanded state
  const toggleWorkflowExpanded = (workflowName: string) => {
    setExpandedWorkflows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(workflowName)) {
        newSet.delete(workflowName);
      } else {
        newSet.add(workflowName);
      }
      return newSet;
    });
  };

  // Update permission for a specific cell
  const updatePermission = (workflowName: string, teamName: string, level: AccessLevel) => {
    setPermissions(prev => ({
      ...prev,
      [workflowName]: {
        ...prev[workflowName],
        [teamName]: level,
      },
    }));
  };

  // Update phase permission (toggle between Edit and Read)
  const updatePhasePermission = (workflowName: string, phaseName: string, teamName: string, isEdit: boolean) => {
    setPhasePermissions(prev => ({
      ...prev,
      [workflowName]: {
        ...prev[workflowName],
        [phaseName]: {
          ...prev[workflowName]?.[phaseName],
          [teamName]: isEdit,
        },
      },
    }));
  };

  // Get access level config by value
  const getAccessConfig = (level: AccessLevel): AccessLevelConfig => {
    return ACCESS_LEVELS.find(a => a.value === level) || ACCESS_LEVELS[0];
  };

  if (!isOpen) return null;

  return (
    <Box
      ref={overlayRef}
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg={overlayBg}
      zIndex={10000}
      display="flex"
      alignItems="center"
      justifyContent="center"
      onClick={handleOverlayClick}
    >
      <Box
        bg={modalBg}
        borderRadius="lg"
        boxShadow="2xl"
        maxW="95vw"
        maxH="90vh"
        w="1200px"
        display="flex"
        flexDirection="column"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <HStack
          px={6}
          py={4}
          bg={headerBg}
          borderTopRadius="lg"
          borderBottom="1px"
          borderColor={borderColor}
          justifyContent="space-between"
        >
          <Text fontSize="xl" fontWeight="bold" color={textColor}>
            Permissions Matrix
          </Text>
          <Box
            cursor="pointer"
            onClick={onClose}
            _hover={{ transform: 'scale(1.1)' }}
            transition="all 0.15s"
          >
            <Icon as={FAXmark} boxSize="20px" color={mutedTextColor} />
          </Box>
        </HStack>

        {/* Scrollable matrix container */}
        <Box
          flex={1}
          overflowX="auto"
          overflowY="auto"
          position="relative"
        >
          <Box minW="max-content">
            {/* Table */}
            <Box as="table" w="100%" sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              {/* Header row with team names */}
              <Box as="thead">
                <Box as="tr">
                  {/* Top-left corner cell (sticky) */}
                  <Box
                    as="th"
                    position="sticky"
                    left={0}
                    top={0}
                    bg={stickyHeaderBg}
                    borderRight="1px"
                    borderBottom="2px"
                    borderColor={borderColor}
                    px={4}
                    py={3}
                    textAlign="left"
                    zIndex={3}
                    minW="250px"
                  >
                    <Text fontSize="sm" fontWeight="bold" color={textColor}>
                      Workflow / Dataset
                    </Text>
                  </Box>

                  {/* Team column headers */}
                  {teamsToUse.map((team, idx) => (
                    <Box
                      key={team.id}
                      as="th"
                      position="sticky"
                      top={0}
                      bg={stickyHeaderBg}
                      borderRight={idx < teamsToUse.length - 1 ? '1px' : 'none'}
                      borderBottom="2px"
                      borderColor={borderColor}
                      px={4}
                      py={3}
                      textAlign="center"
                      zIndex={2}
                      minW="180px"
                    >
                      <HStack spacing={2} justifyContent="center">
                        <Text fontSize="sm" fontWeight="bold" color={textColor}>
                          {team.name}
                        </Text>
                        {onOpenTeam && (
                          <Tooltip label={`Open ${team.name}`} fontSize="xs" placement="bottom" hasArrow>
                            <Box
                              as="button"
                              w="16px"
                              h="16px"
                              borderRadius="full"
                              bg={useColorModeValue('teal.500', 'teal.400')}
                              color="white"
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                              cursor="pointer"
                              boxShadow="sm"
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onOpenTeam(team.id);
                              }}
                              _hover={{
                                bg: useColorModeValue('teal.600', 'teal.300'),
                                transform: 'scale(1.15)'
                              }}
                              transition="all 0.15s"
                            >
                              <Icon as={FAUpRightFromSquare} boxSize="9px" />
                            </Box>
                          </Tooltip>
                        )}
                      </HStack>
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Body rows */}
              <Box as="tbody">
                {MOCK_WORKFLOWS.map((workflow, rowIdx) => {
                  const isExpanded = expandedWorkflows.has(workflow.name);
                  const phases = MOCK_PHASES[workflow.name] || [];
                  const hasPhases = phases.length > 0;

                  return (
                    <>
                      {/* Workflow row */}
                      <Box as="tr" key={workflow.name}>
                        {/* Workflow name cell (sticky left column) */}
                        <Box
                          as="td"
                          position="sticky"
                          left={0}
                          bg={cellBg}
                          borderRight="1px"
                          borderBottom={!isExpanded && rowIdx < MOCK_WORKFLOWS.length - 1 ? '1px' : isExpanded ? 'none' : 'none'}
                          borderColor={borderColor}
                          px={4}
                          py={3}
                          zIndex={1}
                        >
                          <HStack spacing={2}>
                            {hasPhases && (
                              <Box
                                cursor="pointer"
                                onClick={() => toggleWorkflowExpanded(workflow.name)}
                                _hover={{ opacity: 0.7 }}
                                transition="transform 0.2s"
                                transform={isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'}
                              >
                                <Icon as={FAChevronRight} boxSize="12px" color={mutedTextColor} />
                              </Box>
                            )}
                            <VStack align="start" spacing={0} flex={1}>
                              <Text fontSize="sm" fontWeight="medium" color={textColor}>
                                {workflow.name}
                              </Text>
                              <Text fontSize="xs" color={mutedTextColor}>
                                {workflow.type === 'workflow' ? 'Workflow' : 'Dataset'}
                              </Text>
                            </VStack>
                          </HStack>
                        </Box>

                        {/* Permission cells */}
                        {teamsToUse.map((team, colIdx) => {
                          const currentLevel = permissions[workflow.name]?.[team.name] || 'none';
                          const config = getAccessConfig(currentLevel);

                          return (
                            <Box
                              key={team.id}
                              as="td"
                              bg={cellBg}
                              borderRight={colIdx < teamsToUse.length - 1 ? '1px' : 'none'}
                              borderBottom={!isExpanded && rowIdx < MOCK_WORKFLOWS.length - 1 ? '1px' : isExpanded ? 'none' : 'none'}
                              borderColor={borderColor}
                              px={3}
                              py={2}
                              transition="background 0.1s"
                            >
                              <Menu placement="bottom">
                                <Tooltip
                                  label={config.description}
                                  placement="top"
                                  hasArrow
                                  fontSize="xs"
                                >
                                  <MenuButton
                                    as={Box}
                                    bg={config.bg}
                                    color="white"
                                    px={3}
                                    py={1.5}
                                    borderRadius="full"
                                    fontSize="xs"
                                    fontWeight="medium"
                                    cursor="pointer"
                                    minW="70px"
                                    transition="all 0.15s"
                                    _hover={{
                                      bg: config.hoverBg,
                                      transform: 'scale(1.05)',
                                    }}
                                    _active={{
                                      transform: 'scale(0.98)',
                                    }}
                                  >
                                    <HStack spacing={1} justifyContent="center">
                                      <Text>{config.label}</Text>
                                      <Icon as={FAChevronDown} boxSize="10px" color="white" />
                                    </HStack>
                                  </MenuButton>
                                </Tooltip>
                                <MenuList minW="200px" zIndex={10001}>
                                  {ACCESS_LEVELS.map(level => (
                                    <MenuItem
                                      key={level.value}
                                      onClick={() => updatePermission(workflow.name, team.name, level.value)}
                                      px={3}
                                      py={2}
                                    >
                                      <VStack align="start" spacing={0} w="100%">
                                        <HStack spacing={2} w="100%">
                                          <Box
                                            bg={level.bg}
                                            color="white"
                                            px={2}
                                            py={1}
                                            borderRadius="full"
                                            fontSize="xs"
                                            fontWeight="medium"
                                            minW="70px"
                                            textAlign="center"
                                          >
                                            {level.label}
                                          </Box>
                                        </HStack>
                                        <Text fontSize="xs" color={mutedTextColor} mt={1}>
                                          {level.description}
                                        </Text>
                                      </VStack>
                                    </MenuItem>
                                  ))}
                                </MenuList>
                              </Menu>
                            </Box>
                          );
                        })}
                      </Box>

                      {/* Phase rows (shown when expanded) */}
                      {isExpanded && phases.map((phase, phaseIdx) => (
                        <Box as="tr" key={`${workflow.name}-${phase}`}>
                          {/* Phase name cell (indented, sticky left column) */}
                          <Box
                            as="td"
                            position="sticky"
                            left={0}
                            bg={phaseRowBg}
                            borderRight="1px"
                            borderBottom={phaseIdx === phases.length - 1 && rowIdx < MOCK_WORKFLOWS.length - 1 ? '1px' : phaseIdx < phases.length - 1 ? '1px' : 'none'}
                            borderColor={borderColor}
                            pl={8}
                            pr={4}
                            py={2}
                            zIndex={1}
                          >
                            <Text fontSize="xs" color={mutedTextColor}>
                              {phase}
                            </Text>
                          </Box>

                          {/* Phase permission cells (Edit/Read toggles) */}
                          {teamsToUse.map((team, colIdx) => {
                            const isEdit = phasePermissions[workflow.name]?.[phase]?.[team.name] ?? true;

                            return (
                              <Box
                                key={team.id}
                                as="td"
                                bg={phaseRowBg}
                                borderRight={colIdx < teamsToUse.length - 1 ? '1px' : 'none'}
                                borderBottom={phaseIdx === phases.length - 1 && rowIdx < MOCK_WORKFLOWS.length - 1 ? '1px' : phaseIdx < phases.length - 1 ? '1px' : 'none'}
                                borderColor={borderColor}
                                px={3}
                                py={2}
                                _hover={{ bg: phaseRowHoverBg }}
                                transition="background 0.1s"
                              >
                                <HStack spacing={2} justifyContent="center">
                                  <Switch
                                    size="sm"
                                    isChecked={isEdit}
                                    onChange={(e) => updatePhasePermission(workflow.name, phase, team.name, e.target.checked)}
                                    colorScheme="green"
                                  />
                                  <Text
                                    fontSize="xs"
                                    fontWeight="medium"
                                    color={isEdit ? editColor : readColor}
                                  >
                                    {isEdit ? 'Edit' : 'Read'}
                                  </Text>
                                </HStack>
                              </Box>
                            );
                          })}
                        </Box>
                      ))}
                    </>
                  );
                })}
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Footer with note */}
        <Box
          px={6}
          py={3}
          bg={headerBg}
          borderBottomRadius="lg"
          borderTop="1px"
          borderColor={borderColor}
        >
          <Text fontSize="xs" color={mutedTextColor}>
            Note: This is a preview with mock data. Real permissions integration coming soon.
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
