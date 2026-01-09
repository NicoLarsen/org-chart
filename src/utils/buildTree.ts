import { Employee, TreeNode } from '../types';

export interface TreeBuildResult {
  tree: TreeNode | null;
  error: DataIntegrityError | null;
  availableOrganizations: OrganizationOption[] | null;
}

export interface OrganizationOption {
  teamId: string;
  teamName: string;
  employeeCount: number;
}

export interface DataIntegrityError {
  type: 'too_many_orphans' | 'circular_reference' | 'missing_supervisor';
  message: string;
  hint: string;
  affectedEmployees: Array<{ _id: string; name: string; issue: string }>;
}

export function buildTree(employees: Employee[]): TreeNode | null {
  const result = buildTreeWithValidation(employees);
  // For backward compatibility, return just the tree
  // Components that want error info should use buildTreeWithValidation directly
  return result.tree;
}

export function buildTreeWithValidation(employees: Employee[], selectedOrgTeamId?: string | null): TreeBuildResult {
  if (employees.length === 0) return { tree: null, error: null, availableOrganizations: null };

  const employeeMap = new Map<string, Employee>();
  employees.forEach(emp => employeeMap.set(emp._id, emp));

  // Detect data integrity issues before building tree
  const issues: Array<{ _id: string; name: string; issue: string }> = [];

  // Check for circular references (employee is their own supervisor)
  employees.forEach(emp => {
    if (emp.supervisor && emp.supervisor._id === emp._id) {
      // Self-reference is OK for CEO/root - skip those
      const positionStr = getPositionString(emp);
      const isCEO = positionStr.includes('ceo') || positionStr.includes('chief executive');
      if (!isCEO) {
        issues.push({
          _id: emp._id,
          name: emp.name,
          issue: `Self-referencing supervisor (not CEO)`
        });
      }
    }
  });

  // Check for supervisors that don't exist in the employee list
  employees.forEach(emp => {
    if (emp.supervisor && emp.supervisor._id && !employeeMap.has(emp.supervisor._id)) {
      // Check if supervisor might be a skeleton (starts with 'skeleton-')
      if (!emp.supervisor._id.startsWith('skeleton-')) {
        issues.push({
          _id: emp._id,
          name: emp.name,
          issue: `Supervisor "${emp.supervisor.name || emp.supervisor._id}" not found in active employees`
        });
      }
    }
  });

  // Find all root employees (no supervisor) and group by team
  const rootEmployees = employees.filter(emp => !emp.supervisor);
  console.log('[buildTree] Root employees (no supervisor):', rootEmployees.map(e => ({ name: e.name, team: e.team })));

  const teamsWithRoots = new Map<string, { teamName: string; employees: Employee[] }>();

  rootEmployees.forEach(emp => {
    const team = emp.team;
    const teamId = team && typeof team === 'object' ? team._id : null;
    const teamName = team ? (typeof team === 'object' ? team.name : String(team)) : null;

    console.log(`[buildTree] Root "${emp.name}" - teamId: ${teamId}, teamName: ${teamName}`);

    if (teamId && teamName) {
      if (!teamsWithRoots.has(teamId)) {
        teamsWithRoots.set(teamId, { teamName, employees: [] });
      }
      teamsWithRoots.get(teamId)!.employees.push(emp);
    }
  });

  console.log('[buildTree] Teams with roots:', teamsWithRoots.size, Array.from(teamsWithRoots.keys()));

  // Helper function to find the root of an employee's supervisor chain
  const findRootEmployee = (emp: Employee, visited: Set<string> = new Set()): Employee | null => {
    if (visited.has(emp._id)) return null; // Circular reference
    visited.add(emp._id);

    if (!emp.supervisor) return emp;

    const supervisor = employeeMap.get(emp.supervisor._id);
    if (!supervisor) return null; // Supervisor not in list

    return findRootEmployee(supervisor, visited);
  };

  // If there are 2+ teams with root employees, offer organization switching
  if (teamsWithRoots.size >= 2) {
    // Calculate employee counts by following supervisor chains to determine org membership
    const orgCounts = new Map<string, number>();
    teamsWithRoots.forEach((_data, teamId) => orgCounts.set(teamId, 0));

    employees.forEach(emp => {
      const root = findRootEmployee(emp);
      if (root) {
        const rootTeamId = root.team && typeof root.team === 'object' ? root.team._id : null;
        if (rootTeamId && orgCounts.has(rootTeamId)) {
          orgCounts.set(rootTeamId, (orgCounts.get(rootTeamId) || 0) + 1);
        }
      }
    });

    const organizations: OrganizationOption[] = Array.from(teamsWithRoots.entries()).map(([teamId, data]) => ({
      teamId,
      teamName: data.teamName,
      employeeCount: orgCounts.get(teamId) || data.employees.length
    }));

    // If user has selected an organization, filter employees to only that org
    if (selectedOrgTeamId) {
      const selectedOrg = teamsWithRoots.get(selectedOrgTeamId);
      if (selectedOrg) {
        // Get all employees whose supervisor chain leads to the selected org's root
        const orgEmployeeIds = new Set<string>();

        employees.forEach(emp => {
          const root = findRootEmployee(emp);
          if (root) {
            const rootTeamId = root.team && typeof root.team === 'object' ? root.team._id : null;
            if (rootTeamId === selectedOrgTeamId) {
              orgEmployeeIds.add(emp._id);
            }
          }
        });

        // Filter to only org employees and rebuild
        const orgEmployees = employees.filter(emp => orgEmployeeIds.has(emp._id));

        // Find root for this org (employee with no supervisor in the selected team)
        const orgRoot = orgEmployees.find(emp => !emp.supervisor) || orgEmployees[0];

        if (orgRoot) {
          const orgEmployeeMap = new Map<string, Employee>();
          orgEmployees.forEach(emp => orgEmployeeMap.set(emp._id, emp));

          const placed = new Set<string>();
          const rootNode = buildNodeSimple(orgRoot, orgEmployeeMap, placed);

          return { tree: rootNode, error: null, availableOrganizations: organizations };
        }
      }
    }

    // No organization selected - return null tree with available organizations
    return {
      tree: null,
      error: null,
      availableOrganizations: organizations
    };
  }

  // Find the CEO/root - employee with no supervisor or self-referencing CEO
  const root = employees.find(emp => {
    const positionStr = getPositionString(emp);
    const isCEO = positionStr.includes('ceo') || positionStr.includes('chief executive');
    const noSupervisor = !emp.supervisor;
    const selfRef = emp.supervisor && emp.supervisor._id === emp._id;
    return isCEO || noSupervisor || selfRef;
  }) || employees[0];

  // Build tree using direct supervisor relationships only
  const placed = new Set<string>();
  const rootNode = buildNodeSimple(root, employeeMap, placed);

  // Find any orphans (employees not placed in tree)
  const orphans = employees.filter(emp => !placed.has(emp._id));

  // Check if orphan ratio is too high - indicates data problem
  const orphanRatio = orphans.length / employees.length;
  const ORPHAN_THRESHOLD = 0.3; // 30% orphans suggests data issue

  if (orphans.length > 0 && orphanRatio > ORPHAN_THRESHOLD) {
    // Too many orphans - likely a data integrity issue
    // Analyze each orphan to determine the specific issue

    // Group orphans by their team to detect "team without head" pattern
    const teamOrphans = new Map<string, { teamName: string; employees: typeof orphans }>();

    orphans.forEach(orphan => {
      const team = orphan.team;
      const teamId = team && typeof team === 'object' ? team._id : null;
      const teamName = team ? (typeof team === 'object' ? team.name : String(team)) : null;

      if (teamId && teamName) {
        if (!teamOrphans.has(teamId)) {
          teamOrphans.set(teamId, { teamName, employees: [] });
        }
        teamOrphans.get(teamId)!.employees.push(orphan);
      }
    });

    // Check if orphans are mostly from teams without heads
    const orphanTeamsWithoutHeads: string[] = [];
    teamOrphans.forEach((data, _teamId) => {
      // If all employees in this team are orphans AND none have a supervisor,
      // the team likely has no Head of Team assigned
      const allNoSupervisor = data.employees.every(emp => !emp.supervisor);
      if (allNoSupervisor && data.employees.length > 0) {
        orphanTeamsWithoutHeads.push(data.teamName);
      }
    });

    // Add orphan info to issues list with better context
    orphans.forEach(orphan => {
      const team = orphan.team;
      const teamName = team ? (typeof team === 'object' ? team.name : String(team)) : null;

      let issueDescription: string;
      if (!orphan.supervisor && teamName && orphanTeamsWithoutHeads.includes(teamName)) {
        issueDescription = `Team "${teamName}" has no Head of Team assigned`;
      } else if (orphan.supervisor) {
        const supervisorName = orphan.supervisor.name || orphan.supervisor._id;
        if (!employeeMap.has(orphan.supervisor._id)) {
          issueDescription = `Supervisor "${supervisorName}" not found in active employees`;
        } else {
          issueDescription = `Supervisor "${supervisorName}" - check supervisor chain`;
        }
      } else if (teamName) {
        issueDescription = `No supervisor set (in team "${teamName}")`;
      } else {
        issueDescription = `No supervisor and no team assigned`;
      }

      issues.push({
        _id: orphan._id,
        name: orphan.name,
        issue: issueDescription
      });
    });

    // Build a more specific hint based on detected issues
    const hints: string[] = [];
    if (orphanTeamsWithoutHeads.length > 0) {
      hints.push(`• Teams without Head of Team: ${orphanTeamsWithoutHeads.join(', ')}`);
    }
    const missingSupers = issues.filter(i => i.issue.includes('not found in active'));
    if (missingSupers.length > 0) {
      hints.push(`• Employees with supervisors who are not in "Active Employees"`);
    }
    const noSuperNoTeam = issues.filter(i => i.issue.includes('No supervisor and no team'));
    if (noSuperNoTeam.length > 0) {
      hints.push(`• Employees with no supervisor and no team assigned`);
    }
    if (hints.length === 0) {
      hints.push(`• Check supervisor assignments and team configurations`);
    }

    return {
      tree: null,
      error: {
        type: 'too_many_orphans',
        message: `Data integrity issue detected: ${orphans.length} of ${employees.length} employees (${Math.round(orphanRatio * 100)}%) could not be placed in the org chart hierarchy.`,
        hint: `To fix this, check:\n${hints.join('\n')}`,
        affectedEmployees: issues
      },
      availableOrganizations: null
    };
  }

  // Attach orphans to root (normal behavior for small number of orphans)
  if (orphans.length > 0) {
    console.log('Orphan employees attached to root:', orphans.map(e => e.name));
    orphans.forEach(orphan => {
      rootNode.children.push({ employee: orphan, children: [] });
      placed.add(orphan._id);
    });
  }

  return { tree: rootNode, error: null, availableOrganizations: null };
}

function buildNodeSimple(
  employee: Employee,
  employeeMap: Map<string, Employee>,
  placed: Set<string>
): TreeNode {
  placed.add(employee._id);

  // Find direct children - employees whose supervisor is this employee
  const children: TreeNode[] = [];

  employeeMap.forEach(emp => {
    if (placed.has(emp._id)) return;
    if (emp.supervisor && emp.supervisor._id === employee._id) {
      children.push(buildNodeSimple(emp, employeeMap, placed));
    }
  });

  // Build team ID to name mapping from siblings that have both
  // This helps resolve skeleton team IDs (which have ID but no name) to proper names
  const teamIdToName = new Map<string, string>();
  // Also use parent's headOfTeam if available
  if (employee.headOfTeam) {
    teamIdToName.set(employee.headOfTeam._id, employee.headOfTeam.name);
  }
  children.forEach(child => {
    const team = child.employee.team;
    if (team && typeof team === 'object' && team._id && team.name) {
      teamIdToName.set(team._id, team.name);
    }
  });

  // Helper to get resolved team name
  const getResolvedTeamName = (emp: Employee): string => {
    const team = emp.team;
    if (!team) return '';
    if (typeof team === 'string') return team;
    // Object team - use name if available, else look up from our mapping
    if (team.name) return team.name;
    return teamIdToName.get(team._id) || '';
  };

  // Sort children: by team name first, then within each team: real employees first, then skeletons
  children.sort((a, b) => {
    // 1. Sort by team NAME (canonical identifier)
    const aTeamName = getResolvedTeamName(a.employee);
    const bTeamName = getResolvedTeamName(b.employee);

    // If both have the same resolved team name, they're in the same team
    if (aTeamName === bTeamName) {
      // Same team (or both unassigned) - continue to pending/date sorting below
    } else if (aTeamName && bTeamName) {
      // Different teams - sort alphabetically
      return aTeamName.localeCompare(bTeamName);
    } else {
      // One has team, one doesn't - unassigned goes last
      return aTeamName ? -1 : 1;
    }

    // 2. Within same team: real employees first, skeletons last
    const aIsPending = a.employee.pending ? 1 : 0;
    const bIsPending = b.employee.pending ? 1 : 0;

    if (aIsPending !== bIsPending) {
      return aIsPending - bIsPending;
    }

    // 3. Within same team and same type, sort by created date (oldest first, newest last)
    const aCreated = a.employee.created || 0;
    const bCreated = b.employee.created || 0;
    if (aCreated !== bCreated) {
      return aCreated - bCreated;
    }

    // 4. Final tiebreaker: sort by _id for stable ordering when created timestamps are equal
    return a.employee._id.localeCompare(b.employee._id);
  });

  return { employee, children };
}

function getPositionString(employee: Employee): string {
  if (typeof employee.position === 'string') {
    return employee.position.toLowerCase();
  }
  if (employee.position && typeof employee.position === 'object' && 'name' in employee.position) {
    return (employee.position as { name: string }).name.toLowerCase();
  }
  return '';
}

