import { Box, HStack, Tooltip, useColorModeValue, Icon } from '@chakra-ui/react';
import { TeamInfo } from '../types';
import { FAGauge } from '../hailerTheme/hailerIcons/FAGauge';
import { FAUserPlus } from '../hailerTheme/hailerIcons/FAUserPlus';
import { FAUpRightFromSquare } from '../hailerTheme/hailerIcons/FAUpRightFromSquare';

export interface TeamActionButtonsProps {
  team: TeamInfo;
  employeeId: string; // The parent employee ID (for add member)
  onAddMember?: (employeeId: string, teamId?: string) => void;
  onOpenTeam?: (teamId: string) => void;
  onOpenDashboard?: (teamId: string) => void; // Opens mini dashboard popup
  // Future action handlers can be added here:
  // onEditTeam?: (teamId: string) => void;
  // onDeleteTeam?: (teamId: string) => void;
  // onMoveTeam?: (teamId: string) => void;
  size?: 'sm' | 'md'; // Button size variant
}

export default function TeamActionButtons({
  team,
  employeeId,
  onAddMember,
  onOpenTeam,
  onOpenDashboard,
  size = 'md',
}: TeamActionButtonsProps) {
  const dashboardBg = useColorModeValue('blue.500', 'blue.400');
  const dashboardHoverBg = useColorModeValue('blue.600', 'blue.300');
  const addMemberBg = useColorModeValue('purple.500', 'purple.400');
  const addMemberHoverBg = useColorModeValue('purple.600', 'purple.300');
  const openTeamBg = useColorModeValue('teal.500', 'teal.400');
  const openTeamHoverBg = useColorModeValue('teal.600', 'teal.300');

  // Size variants
  const buttonSize = size === 'sm' ? '14px' : '18px';
  const fontSize = size === 'sm' ? '10px' : '12px';
  const arrowFontSize = size === 'sm' ? '8px' : '10px';
  const spacing = size === 'sm' ? 1 : 2;

  return (
    <HStack spacing={spacing}>
      {/* Dashboard button - opens mini dashboard popup */}
      {team.id && onOpenDashboard && (
        <Tooltip label={`${team.name} dashboard`} fontSize="xs" placement="bottom" hasArrow>
          <Box
            as="button"
            w={buttonSize}
            h={buttonSize}
            borderRadius="full"
            bg={dashboardBg}
            color="white"
            fontSize={arrowFontSize}
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            boxShadow="sm"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              e.preventDefault();
              onOpenDashboard(team.id!);
            }}
            _hover={{ bg: dashboardHoverBg, transform: 'scale(1.15)' }}
            transition="all 0.15s"
          >
            <Icon as={FAGauge} boxSize={size === 'sm' ? '8px' : '10px'} />
          </Box>
        </Tooltip>
      )}

      {/* Add member button */}
      <Tooltip label={`Add member to ${team.name}`} fontSize="xs" placement="bottom" hasArrow>
        <Box
          as="button"
          w={buttonSize}
          h={buttonSize}
          borderRadius="full"
          bg={addMemberBg}
          color="white"
          fontSize={fontSize}
          fontWeight="bold"
          display="flex"
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          boxShadow="sm"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            onAddMember?.(employeeId, team.id || undefined);
          }}
          _hover={{ bg: addMemberHoverBg, transform: 'scale(1.15)' }}
          transition="all 0.15s"
        >
          <Icon as={FAUserPlus} boxSize={size === 'sm' ? '8px' : '10px'} />
        </Box>
      </Tooltip>

      {/* Open team button */}
      {team.id && (
        <Tooltip label={`Open ${team.name}`} fontSize="xs" placement="bottom" hasArrow>
          <Box
            as="button"
            w={buttonSize}
            h={buttonSize}
            borderRadius="full"
            bg={openTeamBg}
            color="white"
            fontSize={arrowFontSize}
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            boxShadow="sm"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              e.preventDefault();
              onOpenTeam?.(team.id!);
            }}
            _hover={{ bg: openTeamHoverBg, transform: 'scale(1.15)' }}
            transition="all 0.15s"
          >
            <Icon as={FAUpRightFromSquare} boxSize={size === 'sm' ? '8px' : '10px'} />
          </Box>
        </Tooltip>
      )}

      {/* Future buttons can be added here easily:

      {onEditTeam && team.id && (
        <Tooltip label={`Edit ${team.name}`} fontSize="xs" placement="bottom" hasArrow>
          <Box
            as="button"
            w={buttonSize}
            h={buttonSize}
            borderRadius="full"
            bg="blue.500"
            color="white"
            fontSize={arrowFontSize}
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            boxShadow="sm"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              e.preventDefault();
              onEditTeam?.(team.id!);
            }}
            _hover={{ bg: 'blue.600', transform: 'scale(1.15)' }}
            transition="all 0.15s"
          >
            ✎
          </Box>
        </Tooltip>
      )}

      */}
    </HStack>
  );
}
