import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  Button,
  Text,
  useColorModeValue,
  Box,
} from '@chakra-ui/react';
import { SkeletonNode } from '../types';

interface SkeletonActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  skeleton: SkeletonNode;
  onAddEmployee: () => void;
  onOpenVacancy: () => void;
  onFindResource: () => void;
}

export default function SkeletonActionMenu({
  isOpen,
  onClose,
  skeleton: _skeleton, // Reserved for future use (e.g., prefill title)
  onAddEmployee,
  onOpenVacancy,
  onFindResource,
}: SkeletonActionMenuProps) {
  const bgColor = useColorModeValue('white', 'gray.700');

  const handleAddEmployee = () => {
    onAddEmployee();
    onClose();
  };

  const handleOpenVacancy = () => {
    onOpenVacancy();
    onClose();
  };

  const handleFindResource = () => {
    onFindResource();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xs" isCentered>
      <ModalOverlay bg="blackAlpha.300" />
      <ModalContent bg={bgColor} mx={4}>
        <ModalHeader fontSize="sm" pb={2}>Fill this position</ModalHeader>
        <ModalCloseButton size="sm" />
        <ModalBody pb={4}>
          <VStack spacing={2} align="stretch">
            <Button
              size="sm"
              variant="ghost"
              justifyContent="flex-start"
              leftIcon={<Box as="span" fontSize="sm">+</Box>}
              onClick={handleAddEmployee}
              _hover={{ bg: 'blue.50' }}
            >
              <Text fontSize="sm">Add new employee</Text>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              justifyContent="flex-start"
              leftIcon={<Box as="span" fontSize="sm">O</Box>}
              onClick={handleOpenVacancy}
              _hover={{ bg: 'green.50' }}
            >
              <Text fontSize="sm">Open vacancy</Text>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              justifyContent="flex-start"
              leftIcon={<Box as="span" fontSize="sm">?</Box>}
              onClick={handleFindResource}
              _hover={{ bg: 'purple.50' }}
            >
              <Text fontSize="sm">Find resource</Text>
            </Button>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
