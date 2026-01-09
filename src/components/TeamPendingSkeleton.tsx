import { Box, HStack, Text } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';

// Knight Rider text glow animation - sweeps across text only
const textGlowSweep = keyframes`
  0% {
    background-position: -100% center;
  }
  100% {
    background-position: 200% center;
  }
`;

interface TeamPendingSkeletonProps {
  teamName?: string;
  onCancel?: () => void;
}

export default function TeamPendingSkeleton({ teamName, onCancel }: TeamPendingSkeletonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCancel?.();
  };

  return (
    <Box
      position="absolute"
      bottom="-12px"
      left="50%"
      transform="translateX(-50%)"
    >
      <HStack
        spacing={1}
        bg="gray.600"
        color="white"
        borderRadius="md"
        px={2}
        py={0.5}
        fontSize="8px"
        fontWeight="medium"
        boxShadow="sm"
        whiteSpace="nowrap"
        position="relative"
        minW="70px"
        cursor="pointer"
        onClick={handleClick}
        _hover={{
          bg: 'gray.500',
        }}
        transition="all 0.15s"
        title="Click to cancel"
      >
        {/* Content */}
        <Text opacity={0.8}>▼</Text>
        <Text
          noOfLines={1}
          maxW="60px"
          background="linear-gradient(90deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.5) 35%, rgba(255,60,60,1) 45%, rgba(255,60,60,1) 55%, rgba(255,255,255,0.5) 65%, rgba(255,255,255,0.5) 100%)"
          backgroundSize="200% 100%"
          backgroundClip="text"
          sx={{
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
          animation={`${textGlowSweep} 4s ease-in-out infinite`}
        >
          {teamName || 'Creating...'}
        </Text>
      </HStack>
    </Box>
  );
}
