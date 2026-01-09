import { useState } from 'react';
import { Box, Avatar, Text, VStack, HStack, useColorModeValue, Tooltip, Icon } from '@chakra-ui/react';
import { Employee, TeamInfo } from '../types';
import useHailer from '../hailer/use-hailer';
import { getFlagGradient } from '../utils/flagColors';
import SkeletonCard from './SkeletonCard';
import TeamPendingSkeleton from './TeamPendingSkeleton';
import { FAChevronDown } from '../hailerTheme/hailerIcons/FAChevronDown';
import { FAChevronRight } from '../hailerTheme/hailerIcons/FAChevronRight';
import { FAPlus } from '../hailerTheme/hailerIcons/FAPlus';
import { FAMedkit } from '../hailerTheme/hailerIcons/FAMedkit';
import { FABaby } from '../hailerTheme/hailerIcons/FABaby';
import { FASquareExclamation } from '../hailerTheme/hailerIcons/FASquareExclamation';

interface EmployeeCardProps {
  employee: Employee;
  childrenTeams: TeamInfo[]; // Array of teams for multi-team support
  isCollapsed?: boolean;
  isHeadOfTeam?: boolean;
  onToggle?: (event: React.MouseEvent) => void;
  onAddMember?: (parentId: string, teamId?: string) => void; // Added optional teamId
  onAddTeam?: (parentId: string) => void;
  onOpenTeam?: (teamId: string) => void;
  // Skeleton-specific handlers
  onSkeletonDelete?: (skeletonId: string) => void;
  onSkeletonAddEmployee?: (skeletonId: string) => void;
  onSkeletonOpenVacancy?: (skeletonId: string) => void;
  onSkeletonFindResource?: (skeletonId: string) => void;
  hasSkeletonSubordinates?: boolean;
  // Pending team creation state
  isPendingTeamCreation?: boolean;
  onCancelPendingTeam?: (parentId: string) => void;
  // Multi-team color indicator (when parent has multiple teams)
  teamBorderColor?: string;
  // Public mode - hides action buttons
  isPublic?: boolean;
}

export default function EmployeeCard({
  employee,
  childrenTeams = [],
  isCollapsed = false,
  isHeadOfTeam = false,
  onToggle,
  onAddMember,
  onAddTeam,
  onOpenTeam,
  onSkeletonDelete,
  onSkeletonAddEmployee,
  onSkeletonOpenVacancy,
  onSkeletonFindResource,
  hasSkeletonSubordinates = false,
  isPendingTeamCreation = false,
  onCancelPendingTeam,
  teamBorderColor,
  isPublic = false,
}: EmployeeCardProps) {
  const { hailer } = useHailer();
  const [isHovered, setIsHovered] = useState(false);
  const bgColor = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const hoverBgColor = useColorModeValue('gray.50', 'gray.600');
  const expanderBg = useColorModeValue('blue.500', 'blue.400');
  const addTeamBg = useColorModeValue('green.500', 'green.400');
  const addTeamHoverBg = useColorModeValue('green.600', 'green.300');
  const addMemberBg = useColorModeValue('purple.500', 'purple.400');
  const addMemberHoverBg = useColorModeValue('purple.600', 'purple.300');
  const openTeamBg = useColorModeValue('teal.500', 'teal.400');
  const openTeamHoverBg = useColorModeValue('teal.600', 'teal.300');

  const handleCardClick = () => {
    if (hailer && employee._id) {
      hailer.ui.activity.open(employee._id);
    }
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    onToggle?.(e);
  };

  const handleAddTeamClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    if (!onAddTeam) return;
    onAddTeam(employee._id);
  };

  // Show chevron if there are teams or employee is head of team
  const showChevron = childrenTeams.length > 0 || isHeadOfTeam;
  const flagGradient = getFlagGradient(employee.nationality);
  const isPending = employee.pending;

  // Skeleton card for pending positions - uses SkeletonCard component
  if (isPending && employee.skeletonData) {
    const handleSkeletonCardDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      onSkeletonDelete?.(employee._id);
    };

    return (
      <SkeletonCard
        skeleton={employee.skeletonData}
        onDelete={handleSkeletonCardDelete}
        onAddEmployee={onSkeletonAddEmployee || (() => {})}
        onOpenVacancy={onSkeletonOpenVacancy || (() => {})}
        onFindResource={onSkeletonFindResource || (() => {})}
        hasSubordinates={hasSkeletonSubordinates}
      />
    );
  }

  return (
    <Box
      data-employee-id={employee._id}
      bg={bgColor}
      borderWidth={teamBorderColor ? '2px' : '1px'}
      borderColor={teamBorderColor || borderColor}
      borderRadius="md"
      px={2}
      py={2.5}
      minW="80px"
      maxW="100px"
      minH="70px"
      mx="auto"
      textAlign="center"
      boxShadow="sm"
      transition="all 0.15s"
      position="relative"
      cursor="pointer"
      onClick={handleCardClick}
      role="group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      overflow="visible"
      _hover={{
        bg: hoverBgColor,
        boxShadow: 'md',
      }}
    >
      {/* Flag gradient accent at top */}
      {flagGradient && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          height="3px"
          background={flagGradient}
          borderTopRadius="md"
        />
      )}

      {/* Status indicators - top right corner */}
      {(employee.status === 'Long sick leave' || employee.status === 'Parental leave' || employee.hasDisciplinaryAction) && (
        <HStack
          position="absolute"
          top="4px"
          right="4px"
          spacing={0.5}
          zIndex={2}
        >
          {employee.status === 'Long sick leave' && (
            <Tooltip label="Long sick leave" fontSize="xs" placement="top">
              <Box>
                <Icon as={FAMedkit} boxSize="10px" color="red.500" />
              </Box>
            </Tooltip>
          )}
          {employee.status === 'Parental leave' && (
            <Tooltip label="Parental leave" fontSize="xs" placement="top">
              <Box>
                <Icon as={FABaby} boxSize="10px" color="purple.500" />
              </Box>
            </Tooltip>
          )}
          {employee.hasDisciplinaryAction && (
            <Tooltip label="Disciplinary action" fontSize="xs" placement="top">
              <Box>
                <Icon as={FASquareExclamation} boxSize="10px" color="orange.500" />
              </Box>
            </Tooltip>
          )}
        </HStack>
      )}

      <VStack spacing={1}>
        <Avatar
          size="xs"
          name={employee.name}
          src={employee.avatar}
        />
        <Text fontWeight="semibold" fontSize="2xs" noOfLines={1}>
          {employee.name}
        </Text>
        {employee.position && (
          <Text fontSize="3xs" color="gray.500" noOfLines={1} lineHeight="1" mt={-0.5}>
            {typeof employee.position === 'object' ? employee.position.name : employee.position}
          </Text>
        )}
      </VStack>

      {/* Team chevron - single team shows team name, multi-team shows "X teams" summary */}
      {showChevron && (
        <Box position="absolute" top="100%" left="50%" transform="translateX(-50%)" mt="-4px" zIndex={1}>
          <VStack spacing={1} align="center">
            {/* Single team: show team name pill only - action buttons rendered in OrgChart */}
            {childrenTeams.length === 1 && (
              <HStack
                spacing={1}
                px={2}
                py={0.5}
                fontSize="8px"
                fontWeight="medium"
                bg={expanderBg}
                color="white"
                borderRadius="md"
                boxShadow="sm"
                whiteSpace="nowrap"
                cursor="pointer"
                onClick={handleToggleClick}
                _hover={{ opacity: 0.9 }}
                transition="all 0.15s"
              >
                <Icon as={isCollapsed ? FAChevronRight : FAChevronDown} boxSize="6px" />
                <Text noOfLines={1} maxW="80px">
                  {childrenTeams[0].name}
                </Text>
                <Text>({childrenTeams[0].memberCount}/{childrenTeams[0].totalDescendants})</Text>
              </HStack>
            )}

            {/* Multi-team: show "X teams (combined/combined)" summary */}
            {childrenTeams.length > 1 && (
              <VStack spacing={1} align="center">
                {/* Multi-team summary pill - clickable to toggle */}
                <HStack
                  spacing={1}
                  px={2}
                  py={0.5}
                  fontSize="8px"
                  fontWeight="medium"
                  bg={expanderBg}
                  color="white"
                  borderRadius="md"
                  boxShadow="sm"
                  whiteSpace="nowrap"
                  cursor="pointer"
                  onClick={handleToggleClick}
                  _hover={{ opacity: 0.9 }}
                  transition="all 0.15s"
                >
                  <Icon as={isCollapsed ? FAChevronRight : FAChevronDown} boxSize="6px" />
                  <Text>{childrenTeams.length} teams</Text>
                  <Text>
                    ({childrenTeams.reduce((sum, t) => sum + t.memberCount, 0)}/
                    {childrenTeams.reduce((sum, t) => sum + t.totalDescendants, 0)})
                  </Text>
                </HStack>
              </VStack>
            )}
          </VStack>
        </Box>
      )}

      {/* Pending team skeleton - Knight Rider animation while creating */}
      {!showChevron && isPendingTeamCreation && (
        <TeamPendingSkeleton onCancel={() => onCancelPendingTeam?.(employee._id)} />
      )}

      {/* Add team button - shown on hover when no children, not head of team, not pending, and not public */}
      {!isPublic && !showChevron && !isPendingTeamCreation && isHovered && (
        <HStack
          position="absolute"
          bottom="-12px"
          left="50%"
          transform="translateX(-50%)"
          spacing={1}
          bg={addTeamBg}
          color="white"
          borderRadius="md"
          px={2}
          py={0.5}
          fontSize="8px"
          fontWeight="medium"
          boxShadow="sm"
          cursor="pointer"
          onClick={handleAddTeamClick}
          whiteSpace="nowrap"
          _hover={{
            bg: addTeamHoverBg,
            transform: 'translateX(-50%) scale(1.05)',
          }}
          transition="all 0.15s"
        >
          <Icon as={FAPlus} boxSize="8px" />
          <Text>Add Team</Text>
        </HStack>
      )}

    </Box>
  );
}
