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
  Avatar,
  useColorModeValue,
  Divider,
} from '@chakra-ui/react';
import { Employee } from '../types';

interface FindResourcePopupProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  skeletonId?: string;
  teamId?: string | null;
  onMoveImmediately?: (employeeId: string) => void;
  onInitiateChange?: (employeeId: string) => void;
  mode?: 'find_resource' | 'view_orphans';
  placedEmployeeIds?: Set<string>;
  orphanReasons?: Map<string, string>;
}

export default function FindResourcePopup({
  isOpen,
  onClose,
  employees,
  skeletonId: _skeletonId, // Reserved for future filtering
  teamId: _teamId, // Reserved for future team-based filtering
  onMoveImmediately,
  onInitiateChange,
  mode = 'find_resource',
  placedEmployeeIds,
  orphanReasons,
}: FindResourcePopupProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showActions, setShowActions] = useState(false);

  const bgColor = useColorModeValue('white', 'gray.700');
  const hoverBg = useColorModeValue('blue.50', 'blue.900');
  const selectedBg = useColorModeValue('blue.100', 'blue.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  // Filter out skeleton employees and apply search
  const filteredEmployees = useMemo(() => {
    let baseEmployees = employees.filter(e => !e.pending);

    // In orphan mode, only show employees NOT in the tree
    if (mode === 'view_orphans' && placedEmployeeIds) {
      baseEmployees = baseEmployees.filter(e => !placedEmployeeIds.has(e._id));
    }

    if (!searchQuery.trim()) return baseEmployees;
    const query = searchQuery.toLowerCase();
    return baseEmployees.filter(emp => {
      const name = emp.name.toLowerCase();
      const position = typeof emp.position === 'object'
        ? emp.position?.name?.toLowerCase() || ''
        : (emp.position || '').toLowerCase();
      return name.includes(query) || position.includes(query);
    });
  }, [employees, searchQuery, mode, placedEmployeeIds]);

  const handleSelectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setShowActions(true);
  };

  const handleMoveImmediately = () => {
    if (selectedEmployee && onMoveImmediately) {
      onMoveImmediately(selectedEmployee._id);
      handleClose();
    }
  };

  const handleInitiateChange = () => {
    if (selectedEmployee && onInitiateChange) {
      onInitiateChange(selectedEmployee._id);
      handleClose();
    }
  };

  const handleBack = () => {
    setShowActions(false);
    setSelectedEmployee(null);
  };

  const handleClose = () => {
    setSearchQuery('');
    setSelectedEmployee(null);
    setShowActions(false);
    onClose();
  };

  const getPositionText = (emp: Employee) => {
    if (!emp.position) return 'No position';
    return typeof emp.position === 'object' ? emp.position.name : emp.position;
  };

  const getTeamText = (emp: Employee) => {
    if (!emp.team) return '';
    return typeof emp.team === 'object' ? emp.team.name : emp.team;
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md" isCentered>
      <ModalOverlay />
      <ModalContent bg={bgColor}>
        <ModalHeader fontSize="md">
          {showActions ? 'Choose Action' : (mode === 'view_orphans' ? 'Orphaned Employees' : 'Find Resource')}
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody>
          {!showActions ? (
            // Employee selection view
            <VStack spacing={3} align="stretch">
              <Input
                placeholder="Search by name or position..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="sm"
              />

              <Box
                maxH="300px"
                overflowY="auto"
                borderWidth="1px"
                borderColor={borderColor}
                borderRadius="md"
              >
                {filteredEmployees.length === 0 ? (
                  <Text p={3} fontSize="sm" color="gray.500" textAlign="center">
                    No employees found
                  </Text>
                ) : (
                  <VStack spacing={0} align="stretch">
                    {filteredEmployees.map((emp) => (
                      <HStack
                        key={emp._id}
                        px={3}
                        py={2}
                        cursor="pointer"
                        bg={selectedEmployee?._id === emp._id ? selectedBg : 'transparent'}
                        _hover={{ bg: selectedEmployee?._id === emp._id ? selectedBg : hoverBg }}
                        onClick={() => handleSelectEmployee(emp)}
                        borderBottomWidth="1px"
                        borderColor={borderColor}
                        _last={{ borderBottomWidth: 0 }}
                        spacing={3}
                      >
                        <Avatar size="xs" name={emp.name} src={emp.avatar} />
                        <VStack align="start" spacing={0} flex={1}>
                          <Text fontSize="sm" fontWeight="medium">
                            {emp.name}
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            {getPositionText(emp)}
                            {getTeamText(emp) && ` • ${getTeamText(emp)}`}
                          </Text>
                          {mode === 'view_orphans' && orphanReasons?.has(emp._id) && (
                            <Text fontSize="xs" color="orange.500" fontStyle="italic">
                              {orphanReasons.get(emp._id)}
                            </Text>
                          )}
                        </VStack>
                      </HStack>
                    ))}
                  </VStack>
                )}
              </Box>

              <Text fontSize="xs" color="gray.500">
                {mode === 'view_orphans'
                  ? 'These employees are not connected to the organization chart.'
                  : 'Select an employee to move to this position.'}
              </Text>
            </VStack>
          ) : mode === 'find_resource' ? (
            // Action selection view (only in find_resource mode)
            <VStack spacing={4} align="stretch">
              {selectedEmployee && (
                <HStack
                  p={3}
                  bg={selectedBg}
                  borderRadius="md"
                  spacing={3}
                >
                  <Avatar size="sm" name={selectedEmployee.name} src={selectedEmployee.avatar} />
                  <VStack align="start" spacing={0}>
                    <Text fontSize="sm" fontWeight="semibold">
                      {selectedEmployee.name}
                    </Text>
                    <Text fontSize="xs" color="gray.600">
                      {getPositionText(selectedEmployee)}
                    </Text>
                  </VStack>
                </HStack>
              )}

              <Divider />

              <Text fontSize="sm" fontWeight="medium">
                How would you like to proceed?
              </Text>

              <VStack spacing={2} align="stretch">
                <Button
                  variant="outline"
                  colorScheme="blue"
                  size="sm"
                  onClick={handleMoveImmediately}
                  justifyContent="flex-start"
                  h="auto"
                  py={3}
                  px={4}
                >
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="semibold">Move immediately</Text>
                    <Text fontSize="xs" color="gray.500" fontWeight="normal">
                      Update employee's position and team now
                    </Text>
                  </VStack>
                </Button>

                <Button
                  variant="outline"
                  colorScheme="green"
                  size="sm"
                  onClick={handleInitiateChange}
                  justifyContent="flex-start"
                  h="auto"
                  py={3}
                  px={4}
                >
                  <VStack align="start" spacing={0}>
                    <Text fontWeight="semibold">Initiate change request</Text>
                    <Text fontSize="xs" color="gray.500" fontWeight="normal">
                      Open change management workflow
                    </Text>
                  </VStack>
                </Button>
              </VStack>
            </VStack>
          ) : null}
        </ModalBody>

        <ModalFooter>
          <HStack spacing={2}>
            {showActions ? (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                Back
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Cancel
              </Button>
            )}
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
