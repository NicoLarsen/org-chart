import { useState, useMemo } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  Input,
  VStack,
  HStack,
  Text,
  Box,
  useColorModeValue,
} from '@chakra-ui/react';

interface Team {
  _id: string;
  name: string;
}

interface TeamPickerPopupProps {
  isOpen: boolean;
  onClose: () => void;
  teams: Team[];
  onSelectTeam: (teamId: string) => void;
  title?: string;
}

export default function TeamPickerPopup({
  isOpen,
  onClose,
  teams,
  onSelectTeam,
  title = 'Select Parent Team',
}: TeamPickerPopupProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const bgColor = useColorModeValue('white', 'gray.700');
  const hoverBg = useColorModeValue('blue.50', 'blue.900');
  const selectedBg = useColorModeValue('blue.100', 'blue.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return teams;
    const query = searchQuery.toLowerCase();
    return teams.filter(team => team.name.toLowerCase().includes(query));
  }, [teams, searchQuery]);

  const handleSelect = () => {
    if (selectedTeamId) {
      onSelectTeam(selectedTeamId);
      setSearchQuery('');
      setSelectedTeamId(null);
      onClose();
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSelectedTeamId(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md" isCentered>
      <ModalOverlay />
      <ModalContent bg={bgColor}>
        <ModalHeader fontSize="md">{title}</ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          <VStack spacing={3} align="stretch">
            <Input
              placeholder="Search teams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="sm"
            />

            <Box
              maxH="250px"
              overflowY="auto"
              borderWidth="1px"
              borderColor={borderColor}
              borderRadius="md"
            >
              {filteredTeams.length === 0 ? (
                <Text p={3} fontSize="sm" color="gray.500" textAlign="center">
                  No teams found
                </Text>
              ) : (
                <VStack spacing={0} align="stretch">
                  {filteredTeams.map((team) => (
                    <Box
                      key={team._id}
                      px={3}
                      py={2}
                      cursor="pointer"
                      bg={selectedTeamId === team._id ? selectedBg : 'transparent'}
                      _hover={{ bg: selectedTeamId === team._id ? selectedBg : hoverBg }}
                      onClick={() => setSelectedTeamId(team._id)}
                      borderBottomWidth="1px"
                      borderColor={borderColor}
                      _last={{ borderBottomWidth: 0 }}
                    >
                      <Text fontSize="sm" fontWeight={selectedTeamId === team._id ? 'semibold' : 'normal'}>
                        {team.name}
                      </Text>
                    </Box>
                  ))}
                </VStack>
              )}
            </Box>

            <Text fontSize="xs" color="gray.500">
              Select the parent team for the new team being created under a skeleton position.
            </Text>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <HStack spacing={2}>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              size="sm"
              onClick={handleSelect}
              isDisabled={!selectedTeamId}
            >
              Select Team
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
