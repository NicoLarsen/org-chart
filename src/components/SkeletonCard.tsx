import { Box, Text, VStack, HStack, useColorModeValue, Skeleton, SkeletonCircle, Tooltip, Icon } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { SkeletonNode } from '../types';
import { FAPlus } from '../hailerTheme/hailerIcons/FAPlus';
import { FABriefcase } from '../hailerTheme/hailerIcons/FABriefcase';
import { FAMagnifyingGlass } from '../hailerTheme/hailerIcons/FAMagnifyingGlass';
import { FAXmark } from '../hailerTheme/hailerIcons/FAXmark';
import { FACircleQuestion } from '../hailerTheme/hailerIcons/FACircleQuestion';
import { FACircleExclamation } from '../hailerTheme/hailerIcons/FACircleExclamation';

// Gentle pulse animation for skeleton cards
const pulseKeyframes = keyframes`
  0%, 100% { border-color: var(--chakra-colors-blue-300); }
  50% { border-color: var(--chakra-colors-blue-400); }
`;

interface SkeletonCardProps {
  skeleton: SkeletonNode;
  onDelete: (e: React.MouseEvent) => void;
  onAddEmployee: (skeletonId: string) => void;
  onOpenVacancy: (skeletonId: string) => void;
  onFindResource: (skeletonId: string) => void;
  hasSubordinates: boolean;
}

export default function SkeletonCard({
  skeleton,
  onDelete,
  onAddEmployee,
  onOpenVacancy,
  onFindResource,
  hasSubordinates,
}: SkeletonCardProps) {
  const bgColor = useColorModeValue('white', 'gray.700');
  const pulseAnimation = `${pulseKeyframes} 4s ease-in-out infinite`;

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(e);
  };

  const handleAddEmployeeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddEmployee(skeleton.tempId);
  };

  const handleOpenVacancyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenVacancy(skeleton.tempId);
  };

  const handleFindResourceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFindResource(skeleton.tempId);
  };

  // Render content based on skeleton state
  const renderContent = () => {
    switch (skeleton.state) {
      case 'with_details':
        return (
          <VStack spacing={0}>
            <Box
              w="24px"
              h="24px"
              borderRadius="full"
              bg="blue.100"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Icon as={FACircleQuestion} boxSize="14px" color="blue.600" />
            </Box>
            <Text fontWeight="semibold" fontSize="2xs" noOfLines={1} color="blue.700">
              {skeleton.employeeName || 'TBD'}
            </Text>
            {skeleton.title && (
              <Text fontSize="2xs" color="gray.500" noOfLines={1} lineHeight="1.1">
                {skeleton.title}
              </Text>
            )}
          </VStack>
        );
      case 'title_only':
        return (
          <VStack spacing={1}>
            <Box
              w="24px"
              h="24px"
              borderRadius="full"
              bg="blue.100"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Icon as={FACircleQuestion} boxSize="14px" color="blue.600" />
            </Box>
            <Text fontWeight="semibold" fontSize="2xs" noOfLines={1} color="blue.700">
              {skeleton.title || 'New Position'}
            </Text>
          </VStack>
        );
      case 'empty':
      default:
        return (
          <VStack spacing={1}>
            <SkeletonCircle size="6" speed={3} />
            <Skeleton height="8px" width="60px" speed={3} />
            <Skeleton height="6px" width="40px" speed={3} />
          </VStack>
        );
    }
  };

  return (
    <Box
      data-employee-id={skeleton.tempId}
      bg={bgColor}
      borderWidth="2px"
      borderColor="blue.300"
      borderRadius="md"
      borderStyle="dashed"
      px={2}
      py={2.5}
      minW="80px"
      maxW="100px"
      minH="70px"
      mx="auto"
      textAlign="center"
      boxShadow="sm"
      position="relative"
      animation={pulseAnimation}
      cursor="default"
      role="group"
      _hover={{
        borderColor: 'blue.500',
        boxShadow: 'md',
      }}
    >
      {/* X button to delete - only visible on hover */}
      <Tooltip label={hasSubordinates ? 'Delete (has subordinates)' : 'Delete'} fontSize="xs" placement="top" hasArrow>
        <Box
          position="absolute"
          top="-6px"
          right="-6px"
          bg="red.500"
          color="white"
          borderRadius="full"
          w="14px"
          h="14px"
          fontSize="10px"
          fontWeight="bold"
          display="flex"
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          opacity={0}
          transition="opacity 0.15s"
          _groupHover={{ opacity: 1 }}
          _hover={{ bg: 'red.600' }}
          onClick={handleDeleteClick}
        >
          <Icon as={FAXmark} boxSize="8px" />
        </Box>
      </Tooltip>

      {/* Subordinates indicator */}
      {hasSubordinates && (
        <Box
          position="absolute"
          top="-6px"
          left="-6px"
          bg="orange.400"
          color="white"
          borderRadius="full"
          w="14px"
          h="14px"
          fontSize="8px"
          fontWeight="bold"
          display="flex"
          alignItems="center"
          justifyContent="center"
          opacity={0}
          transition="opacity 0.15s"
          _groupHover={{ opacity: 1 }}
          title="Has subordinates"
        >
          <Icon as={FACircleExclamation} boxSize="10px" />
        </Box>
      )}

      {renderContent()}

      {/* Action buttons - shown on hover at the bottom */}
      <HStack
        position="absolute"
        bottom="-14px"
        left="50%"
        transform="translateX(-50%)"
        spacing={1}
        opacity={0}
        transition="opacity 0.15s"
        _groupHover={{ opacity: 1 }}
      >
        <Tooltip label="Add employee" fontSize="xs" placement="bottom" hasArrow>
          <Box
            bg="blue.500"
            color="white"
            borderRadius="full"
            w="18px"
            h="18px"
            fontSize="11px"
            fontWeight="bold"
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            boxShadow="sm"
            _hover={{ bg: 'blue.600', transform: 'scale(1.1)' }}
            transition="all 0.15s"
            onClick={handleAddEmployeeClick}
          >
            <Icon as={FAPlus} boxSize="10px" />
          </Box>
        </Tooltip>

        <Tooltip label="Open vacancy" fontSize="xs" placement="bottom" hasArrow>
          <Box
            bg="green.500"
            color="white"
            borderRadius="full"
            w="18px"
            h="18px"
            fontSize="9px"
            fontWeight="bold"
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            boxShadow="sm"
            _hover={{ bg: 'green.600', transform: 'scale(1.1)' }}
            transition="all 0.15s"
            onClick={handleOpenVacancyClick}
          >
            <Icon as={FABriefcase} boxSize="10px" />
          </Box>
        </Tooltip>

        <Tooltip label="Find resource" fontSize="xs" placement="bottom" hasArrow>
          <Box
            bg="purple.500"
            color="white"
            borderRadius="full"
            w="18px"
            h="18px"
            fontSize="9px"
            fontWeight="bold"
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            boxShadow="sm"
            _hover={{ bg: 'purple.600', transform: 'scale(1.1)' }}
            transition="all 0.15s"
            onClick={handleFindResourceClick}
          >
            <Icon as={FAMagnifyingGlass} boxSize="10px" />
          </Box>
        </Tooltip>
      </HStack>
    </Box>
  );
}
