import { HStack, Text, useColorModeValue } from '@chakra-ui/react';
import { TeamInfo } from '../types';
import TeamActionButtons from './TeamActionButtons';

interface TeamSeparatorPillProps {
  team: TeamInfo;
  parentEmployeeId: string; // The parent employee ID (supervisor of this team's members)
  onAddMember?: (employeeId: string, teamId?: string) => void;
  onOpenTeam?: (teamId: string) => void;
  onOpenDashboard?: (teamId: string) => void;
  isPublic?: boolean; // Hide action buttons in public mode
}

export default function TeamSeparatorPill({
  team,
  parentEmployeeId,
  onAddMember,
  onOpenTeam,
  onOpenDashboard,
  isPublic = false,
}: TeamSeparatorPillProps) {
  const pillBg = team.color || useColorModeValue('blue.500', 'blue.400');

  return (
    <HStack
      spacing={1}
      px={2}
      py={0.5}
      fontSize="8px"
      fontWeight="medium"
      bg={pillBg}
      color="white"
      borderRadius="md"
      boxShadow="sm"
      whiteSpace="nowrap"
      onClick={(e: React.MouseEvent) => {
        // Stop propagation on the entire pill to prevent parent card clicks
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      <Text noOfLines={1} maxW="70px">
        {team.name}
      </Text>
      <Text>({team.memberCount}/{team.totalDescendants})</Text>

      {/* Action buttons - hidden in public mode */}
      {!isPublic && (
        <TeamActionButtons
          team={team}
          employeeId={parentEmployeeId}
          onAddMember={onAddMember}
          onOpenTeam={onOpenTeam}
          onOpenDashboard={onOpenDashboard}
          size="sm"
        />
      )}
    </HStack>
  );
}
