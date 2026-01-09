import { useEffect, useMemo } from 'react';
import useHailer from './hailer/use-hailer';
import { Box, useColorMode, Heading } from '@chakra-ui/react';
import OrgChart from './components/OrgChart';

export default function App() {
  const { inside, settings } = useHailer();
  const { setColorMode } = useColorMode();

  // Check for public mode via URL query parameter
  const isPublic = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('public') === 'true';
  }, []);

  useEffect(() => {
    if (settings) {
      if (settings.theme === 'dark') {
        setColorMode('dark');
      } else {
        setColorMode('light');
      }
    }
  }, [settings, setColorMode]);

  return (
    <Box>
      {inside || isPublic ? (
        <OrgChart isPublic={isPublic} />
      ) : (
        <Box p="2em">
          <Heading fontSize="lg" color="subtleText">
            You are outside of Hailer
          </Heading>
        </Box>
      )}
    </Box>
  );
}
