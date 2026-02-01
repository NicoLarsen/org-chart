import { useState } from 'react';
import { Box, Text, VStack, HStack, useColorModeValue, Skeleton, SkeletonCircle, Tooltip, Icon } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { SkeletonNode } from '../types';
import { FAPlus } from '../hailerTheme/hailerIcons/FAPlus';
import { FABriefcase } from '../hailerTheme/hailerIcons/FABriefcase';
import { FAMagnifyingGlass } from '../hailerTheme/hailerIcons/FAMagnifyingGlass';
import { FAXmark } from '../hailerTheme/hailerIcons/FAXmark';
import { FACircleQuestion } from '../hailerTheme/hailerIcons/FACircleQuestion';
import { FACircleExclamation } from '../hailerTheme/hailerIcons/FACircleExclamation';
import { FAChevronDown } from '../hailerTheme/hailerIcons/FAChevronDown';
import { FAChevronRight } from '../hailerTheme/hailerIcons/FAChevronRight';

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
  onAddTeam?: (skeletonId: string) => void;
  hasSubordinates: boolean;
  isCollapsed?: boolean;
  onToggle?: (event: React.MouseEvent) => void;
  /** Team name to display in the chevron (for vacancy heads that lead a team) */
  teamName?: string;
}

export default function SkeletonCard({
  skeleton,
  onDelete,
  onAddEmployee,
  onOpenVacancy,
  onFindResource,
  onAddTeam,
  hasSubordinates,
  isCollapsed = false,
  onToggle,
  teamName,
}: SkeletonCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const bgColor = useColorModeValue('white', 'gray.700');
  const pulseAnimation = `${pulseKeyframes} 4s ease-in-out infinite`;
  const addTeamBg = useColorModeValue('green.500', 'green.400');
  const addTeamHoverBg = useColorModeValue('green.600', 'green.300');
  const expanderBg = useColorModeValue('blue.500', 'blue.400');

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

  const handleAddTeamClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onAddTeam) return;
    onAddTeam(skeleton.tempId);
  };

  // Format date timestamp to readable format (compact)
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Render content based on skeleton state
  const renderContent = () => {
    switch (skeleton.state) {
      case 'has_vacancy':
        return (
          <VStack spacing={0}>
            <Box
              w="24px"
              h="24px"
              borderRadius="full"
              bg="green.100"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Icon as={FABriefcase} boxSize="14px" color="green.600" />
            </Box>
            <Text fontWeight="bold" fontSize="10px" noOfLines={1} color="green.700">
              {skeleton.vacancy?.name || 'Vacancy'}
            </Text>
            {skeleton.vacancy?.applicationPeriod && (
              <Text fontSize="8px" color="gray.500" noOfLines={1} lineHeight="1.1" textAlign="center">
                {formatDate(skeleton.vacancy.applicationPeriod.start)} - {formatDate(skeleton.vacancy.applicationPeriod.end)}
              </Text>
            )}
          </VStack>
        );
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

  // Determine border styling based on state
  const isVacancy = skeleton.state === 'has_vacancy';
  const borderColor = isVacancy ? 'green.500' : 'blue.300';
  const borderStyle = isVacancy ? 'solid' : 'dashed';
  const hoverBorderColor = isVacancy ? 'green.600' : 'blue.500';

  return (
    <Box
      data-employee-id={skeleton.tempId}
      bg={bgColor}
      borderWidth="2px"
      borderColor={borderColor}
      borderRadius="md"
      borderStyle={borderStyle}
      px={2}
      py={2.5}
      minW="80px"
      maxW="100px"
      minH="70px"
      mx="auto"
      textAlign="center"
      boxShadow="sm"
      position="relative"
      animation={isVacancy ? undefined : pulseAnimation}
      cursor="default"
      role="group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      overflow="visible"
      _hover={{
        borderColor: hoverBorderColor,
        boxShadow: 'md',
      }}
    >
      {/* X button to delete - only visible on hover, hidden when has_vacancy */}
      {skeleton.state !== 'has_vacancy' && (
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
      )}

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

      {/* For vacancy cards: centered overlay with action buttons on hover */}
      {skeleton.state === 'has_vacancy' && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="blackAlpha.600"
          borderRadius="md"
          display="flex"
          alignItems="center"
          justifyContent="center"
          opacity={0}
          transition="opacity 0.2s ease-in-out"
          _groupHover={{ opacity: 1 }}
        >
          <HStack spacing={2}>
            <Tooltip label="Add employee" fontSize="xs" placement="top" hasArrow>
              <Box
                bg="white"
                color="blue.600"
                borderRadius="full"
                w="18px"
                h="18px"
                fontSize="11px"
                fontWeight="bold"
                display="flex"
                alignItems="center"
                justifyContent="center"
                cursor="pointer"
                boxShadow="lg"
                _hover={{ bg: 'blue.50', transform: 'scale(1.1)' }}
                transition="all 0.2s"
                onClick={handleAddEmployeeClick}
              >
                <Icon as={FAPlus} boxSize="10px" />
              </Box>
            </Tooltip>

            <Tooltip label="Find resource" fontSize="xs" placement="top" hasArrow>
              <Box
                bg="white"
                color="purple.600"
                borderRadius="full"
                w="18px"
                h="18px"
                fontSize="9px"
                fontWeight="bold"
                display="flex"
                alignItems="center"
                justifyContent="center"
                cursor="pointer"
                boxShadow="lg"
                _hover={{ bg: 'purple.50', transform: 'scale(1.1)' }}
                transition="all 0.2s"
                onClick={handleFindResourceClick}
              >
                <Icon as={FAMagnifyingGlass} boxSize="10px" />
              </Box>
            </Tooltip>
          </HStack>
        </Box>
      )}

      {/* For non-vacancy cards: action buttons shown on hover at the bottom */}
      {skeleton.state !== 'has_vacancy' && (
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
      )}

      {/* Add Team button for vacancy cards - shown on hover when no subordinates */}
      {skeleton.state === 'has_vacancy' && !hasSubordinates && isHovered && onAddTeam && (
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

      {/* Team chevron for vacancy cards with subordinates */}
      {skeleton.state === 'has_vacancy' && hasSubordinates && onToggle && (
        <Box position="absolute" top="100%" left="50%" transform="translateX(-50%)" mt="-4px" zIndex={1}>
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
            onClick={(e) => {
              e.stopPropagation();
              onToggle(e);
            }}
            _hover={{ opacity: 0.9 }}
            transition="all 0.15s"
          >
            <Icon as={isCollapsed ? FAChevronRight : FAChevronDown} boxSize="6px" />
            <Text>{teamName || skeleton.vacancy?.name || 'Team'}</Text>
          </HStack>
        </Box>
      )}
    </Box>
  );
}
