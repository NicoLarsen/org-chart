import { useMemo, useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Box,
  VStack,
  HStack,
  Text,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
  Divider,
  Collapse,
  Link,
  useColorModeValue,
} from '@chakra-ui/react';
import { Employee } from '../types';

interface Team {
  _id: string;
  name: string;
  parentTeamId: string | null;
}

interface TeamDashboardPopupProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string | null;
  teamName?: string;
  employees: Employee[];
  teams: Team[];
  onOpenEmployee?: (employeeId: string) => void;
}

// Calculate age from date of birth timestamp
function calculateAge(dateOfBirth: number): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Find the head of team (employee whose headOfTeam._id matches teamId)
function findTeamHead(employees: Employee[], teamId: string): Employee | null {
  return employees.find(emp => emp.headOfTeam?._id === teamId) || null;
}

// Get all sub-teams of a given team (recursively via parentTeam chain)
function getSubTeams(teams: Team[], teamId: string): string[] {
  const subTeamIds: string[] = [];
  const visited = new Set<string>();

  function collectSubTeams(parentId: string) {
    teams.forEach(team => {
      if (team.parentTeamId === parentId && !visited.has(team._id)) {
        visited.add(team._id);
        subTeamIds.push(team._id);
        collectSubTeams(team._id);
      }
    });
  }

  collectSubTeams(teamId);
  return subTeamIds;
}

// Get all employees in a team and its sub-teams (branch by team hierarchy)
function getBranchEmployeesByTeam(employees: Employee[], teams: Team[], teamId: string): Employee[] {
  // Get this team + all sub-teams
  const allTeamIds = new Set([teamId, ...getSubTeams(teams, teamId)]);

  // Get all employees whose team is in this set
  return employees.filter(emp => {
    const empTeamId = typeof emp.team === 'object' ? emp.team?._id : null;
    return empTeamId && allTeamIds.has(empTeamId);
  });
}

// Get direct team members (employees whose team._id matches)
function getTeamMembers(employees: Employee[], teamId: string): Employee[] {
  return employees.filter(emp => {
    const empTeamId = typeof emp.team === 'object' ? emp.team?._id : null;
    return empTeamId === teamId;
  });
}

interface MissingDataInfo {
  missingTotalCost: Employee[];
  missingDateOfBirth: Employee[];
}

interface TeamMetrics {
  // Team only (direct members)
  teamMemberCount: number;
  teamTotalCost: number;
  teamAverageAge: number | null;
  teamMembersWithCost: number;
  teamMembersWithAge: number;
  teamMissingData: MissingDataInfo;

  // Branch (all employees in this team and sub-teams)
  branchMemberCount: number;
  branchTotalCost: number;
  branchAverageAge: number | null;
  branchMembersWithCost: number;
  branchMembersWithAge: number;
  branchMissingData: MissingDataInfo;
}

function calculateMetrics(employees: Employee[], teams: Team[], teamId: string): TeamMetrics {
  // Get direct team members
  const teamMembers = getTeamMembers(employees, teamId);

  // Get branch members (all employees in this team and sub-teams by team hierarchy)
  const branchMembers = getBranchEmployeesByTeam(employees, teams, teamId);

  // Team calculations - use totalCost (includes side costs for employees, consultancy fee for contractors)
  const teamCosts = teamMembers
    .filter(emp => emp.totalCost != null && emp.totalCost > 0)
    .map(emp => emp.totalCost!);
  const teamAges = teamMembers
    .filter(emp => emp.dateOfBirth != null)
    .map(emp => calculateAge(emp.dateOfBirth!));

  // Team missing data
  const teamMissingCost = teamMembers.filter(emp => emp.totalCost == null || emp.totalCost <= 0);
  const teamMissingDOB = teamMembers.filter(emp => emp.dateOfBirth == null);

  // Branch calculations - use totalCost
  const branchCosts = branchMembers
    .filter(emp => emp.totalCost != null && emp.totalCost > 0)
    .map(emp => emp.totalCost!);
  const branchAges = branchMembers
    .filter(emp => emp.dateOfBirth != null)
    .map(emp => calculateAge(emp.dateOfBirth!));

  // Branch missing data
  const branchMissingCost = branchMembers.filter(emp => emp.totalCost == null || emp.totalCost <= 0);
  const branchMissingDOB = branchMembers.filter(emp => emp.dateOfBirth == null);

  return {
    teamMemberCount: teamMembers.length,
    teamTotalCost: teamCosts.reduce((sum, s) => sum + s, 0),
    teamAverageAge: teamAges.length > 0
      ? teamAges.reduce((sum, a) => sum + a, 0) / teamAges.length
      : null,
    teamMembersWithCost: teamCosts.length,
    teamMembersWithAge: teamAges.length,
    teamMissingData: {
      missingTotalCost: teamMissingCost,
      missingDateOfBirth: teamMissingDOB,
    },

    branchMemberCount: branchMembers.length,
    branchTotalCost: branchCosts.reduce((sum, s) => sum + s, 0),
    branchAverageAge: branchAges.length > 0
      ? branchAges.reduce((sum, a) => sum + a, 0) / branchAges.length
      : null,
    branchMembersWithCost: branchCosts.length,
    branchMembersWithAge: branchAges.length,
    branchMissingData: {
      missingTotalCost: branchMissingCost,
      missingDateOfBirth: branchMissingDOB,
    },
  };
}

// Format currency for display
function formatCurrency(amount: number): string {
  return amount.toLocaleString('fi-FI');
}

// Clickable employee name component
function EmployeeLink({
  employee,
  onOpenEmployee,
  linkColor,
}: {
  employee: Employee;
  onOpenEmployee?: (id: string) => void;
  linkColor: string;
}) {
  return (
    <Link
      color={linkColor}
      fontSize="xs"
      onClick={(e) => {
        e.preventDefault();
        onOpenEmployee?.(employee._id);
      }}
      cursor="pointer"
      _hover={{ textDecoration: 'underline' }}
    >
      {employee.name}
    </Link>
  );
}

// Missing data section component
function MissingDataSection({
  title,
  missingData,
  totalCount,
  onOpenEmployee,
  labelColor,
  linkColor,
  warningBg,
}: {
  title: string;
  missingData: MissingDataInfo;
  totalCount: number;
  onOpenEmployee?: (id: string) => void;
  labelColor: string;
  linkColor: string;
  warningBg: string;
}) {
  const [showCost, setShowCost] = useState(false);
  const [showDOB, setShowDOB] = useState(false);

  const hasMissingCost = missingData.missingTotalCost.length > 0;
  const hasMissingDOB = missingData.missingDateOfBirth.length > 0;

  if (!hasMissingCost && !hasMissingDOB) {
    return null;
  }

  return (
    <Box bg={warningBg} p={3} borderRadius="md" mt={2}>
      <Text fontSize="xs" fontWeight="semibold" color={labelColor} mb={2}>
        {title} - Missing Data
      </Text>

      {hasMissingCost && (
        <Box mb={hasMissingDOB ? 2 : 0}>
          <HStack
            spacing={1}
            cursor="pointer"
            onClick={() => setShowCost(!showCost)}
            _hover={{ opacity: 0.8 }}
          >
            <Text fontSize="xs" color={labelColor}>
              {showCost ? '▼' : '▶'}
            </Text>
            <Text fontSize="xs" color={labelColor}>
              Missing Cost ({missingData.missingTotalCost.length} of {totalCount})
            </Text>
          </HStack>
          <Collapse in={showCost}>
            <Box pl={3} pt={1}>
              {missingData.missingTotalCost.map((emp) => (
                <Box key={emp._id}>
                  <EmployeeLink
                    employee={emp}
                    onOpenEmployee={onOpenEmployee}
                    linkColor={linkColor}
                  />
                </Box>
              ))}
            </Box>
          </Collapse>
        </Box>
      )}

      {hasMissingDOB && (
        <Box>
          <HStack
            spacing={1}
            cursor="pointer"
            onClick={() => setShowDOB(!showDOB)}
            _hover={{ opacity: 0.8 }}
          >
            <Text fontSize="xs" color={labelColor}>
              {showDOB ? '▼' : '▶'}
            </Text>
            <Text fontSize="xs" color={labelColor}>
              Missing Date of Birth ({missingData.missingDateOfBirth.length} of {totalCount})
            </Text>
          </HStack>
          <Collapse in={showDOB}>
            <Box pl={3} pt={1}>
              {missingData.missingDateOfBirth.map((emp) => (
                <Box key={emp._id}>
                  <EmployeeLink
                    employee={emp}
                    onOpenEmployee={onOpenEmployee}
                    linkColor={linkColor}
                  />
                </Box>
              ))}
            </Box>
          </Collapse>
        </Box>
      )}
    </Box>
  );
}

export default function TeamDashboardPopup({
  isOpen,
  onClose,
  teamId,
  teamName = 'Team',
  employees,
  teams,
  onOpenEmployee,
}: TeamDashboardPopupProps) {
  const bgColor = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const cardBg = useColorModeValue('gray.50', 'gray.600');
  const labelColor = useColorModeValue('gray.600', 'gray.300');
  const linkColor = useColorModeValue('blue.600', 'blue.300');
  const warningBg = useColorModeValue('orange.50', 'orange.900');

  const metrics = useMemo(() => {
    if (!teamId) return null;
    return calculateMetrics(employees, teams, teamId);
  }, [employees, teams, teamId]);

  // Find team head for display
  const teamHead = useMemo(() => {
    if (!teamId) return null;
    return findTeamHead(employees, teamId);
  }, [employees, teamId]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" isCentered>
      <ModalOverlay />
      <ModalContent bg={bgColor} maxW="600px" maxH="80vh">
        <ModalHeader fontSize="md" borderBottomWidth="1px" borderColor={borderColor}>
          <VStack align="start" spacing={0} mb={2}>
            <Text>{teamName} Dashboard</Text>
            {teamHead && (
              <Text fontSize="xs" color={labelColor} fontWeight="normal" pb={1}>
                Head: {teamHead.name}
              </Text>
            )}
          </VStack>
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody p={4} overflowY="auto">
          {metrics ? (
            <VStack spacing={4} align="stretch">
              {/* Team Section */}
              <Box>
                <Text fontSize="sm" fontWeight="semibold" color={labelColor} mb={2}>
                  Direct Team Members
                </Text>
                <SimpleGrid columns={3} spacing={3}>
                  <Box bg={cardBg} p={3} borderRadius="md">
                    <Stat size="sm">
                      <StatLabel fontSize="xs">Members</StatLabel>
                      <StatNumber fontSize="xl">{metrics.teamMemberCount}</StatNumber>
                    </Stat>
                  </Box>
                  <Box bg={cardBg} p={3} borderRadius="md">
                    <Stat size="sm">
                      <StatLabel fontSize="xs">Total Cost/mo</StatLabel>
                      <StatNumber fontSize="xl">
                        {metrics.teamTotalCost > 0 ? `€${formatCurrency(metrics.teamTotalCost)}` : '-'}
                      </StatNumber>
                      {metrics.teamMembersWithCost > 0 && (
                        <StatHelpText fontSize="xs" mb={0}>
                          {metrics.teamMembersWithCost} of {metrics.teamMemberCount} reported
                        </StatHelpText>
                      )}
                    </Stat>
                  </Box>
                  <Box bg={cardBg} p={3} borderRadius="md">
                    <Stat size="sm">
                      <StatLabel fontSize="xs">Avg Age</StatLabel>
                      <StatNumber fontSize="xl">
                        {metrics.teamAverageAge != null ? metrics.teamAverageAge.toFixed(1) : '-'}
                      </StatNumber>
                      {metrics.teamMembersWithAge > 0 && (
                        <StatHelpText fontSize="xs" mb={0}>
                          {metrics.teamMembersWithAge} of {metrics.teamMemberCount} known
                        </StatHelpText>
                      )}
                    </Stat>
                  </Box>
                </SimpleGrid>

                {/* Team Missing Data */}
                <MissingDataSection
                  title="Team"
                  missingData={metrics.teamMissingData}
                  totalCount={metrics.teamMemberCount}
                  onOpenEmployee={onOpenEmployee}
                  labelColor={labelColor}
                  linkColor={linkColor}
                  warningBg={warningBg}
                />
              </Box>

              <Divider />

              {/* Branch Section */}
              <Box>
                <HStack justify="space-between" mb={2}>
                  <Text fontSize="sm" fontWeight="semibold" color={labelColor}>
                    Full Branch (incl. sub-teams)
                  </Text>
                  <Text fontSize="xs" color={labelColor}>
                    This team + all sub-teams
                  </Text>
                </HStack>
                <SimpleGrid columns={3} spacing={3}>
                  <Box bg={cardBg} p={3} borderRadius="md">
                    <Stat size="sm">
                      <StatLabel fontSize="xs">Total People</StatLabel>
                      <StatNumber fontSize="xl">{metrics.branchMemberCount}</StatNumber>
                    </Stat>
                  </Box>
                  <Box bg={cardBg} p={3} borderRadius="md">
                    <Stat size="sm">
                      <StatLabel fontSize="xs">Total Cost/mo</StatLabel>
                      <StatNumber fontSize="xl">
                        {metrics.branchTotalCost > 0 ? `€${formatCurrency(metrics.branchTotalCost)}` : '-'}
                      </StatNumber>
                      {metrics.branchMembersWithCost > 0 && (
                        <StatHelpText fontSize="xs" mb={0}>
                          {metrics.branchMembersWithCost} of {metrics.branchMemberCount} reported
                        </StatHelpText>
                      )}
                    </Stat>
                  </Box>
                  <Box bg={cardBg} p={3} borderRadius="md">
                    <Stat size="sm">
                      <StatLabel fontSize="xs">Avg Age</StatLabel>
                      <StatNumber fontSize="xl">
                        {metrics.branchAverageAge != null ? metrics.branchAverageAge.toFixed(1) : '-'}
                      </StatNumber>
                      {metrics.branchMembersWithAge > 0 && (
                        <StatHelpText fontSize="xs" mb={0}>
                          {metrics.branchMembersWithAge} of {metrics.branchMemberCount} known
                        </StatHelpText>
                      )}
                    </Stat>
                  </Box>
                </SimpleGrid>

                {/* Branch Missing Data */}
                <MissingDataSection
                  title="Branch"
                  missingData={metrics.branchMissingData}
                  totalCount={metrics.branchMemberCount}
                  onOpenEmployee={onOpenEmployee}
                  labelColor={labelColor}
                  linkColor={linkColor}
                  warningBg={warningBg}
                />
              </Box>
            </VStack>
          ) : (
            <Box
              w="100%"
              h="200px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              color="gray.500"
              fontSize="sm"
            >
              No team selected
            </Box>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
