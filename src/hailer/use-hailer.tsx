import { HailerApi, HailerAppConfig, HailerSettings, HailerSignal, HailerApiInfo } from '@hailer/app-sdk';
import { useEffect, useState, useCallback, useRef } from 'react';

// Store signal listeners globally so they persist across hot reloads
declare global {
  interface Window {
    hailerSignalListeners?: Set<(signal: HailerSignal) => void>;
  }
}

const useHailer = (allowedUrls?: string[]) => {
  const [info, setInfo] = useState<HailerApiInfo | null>(null);
  const [config, setConfig] = useState<HailerAppConfig | null>(null);
  const [settings, setSettings] = useState<HailerSettings | null>(null);
  const [inside, setInside] = useState(false);
  const [global, setGlobal] = useState<Window & typeof globalThis>()
  const [lastSignal, setLastSignal] = useState<HailerSignal | null>(null);
  const signalHandlerRef = useRef<(signal: HailerSignal) => void>();

  // Register this component's signal handler
  useEffect(() => {
    if (!window.hailerSignalListeners) {
      window.hailerSignalListeners = new Set();
    }

    const handler = (signal: HailerSignal) => {
      setLastSignal(signal);
    };

    signalHandlerRef.current = handler;
    window.hailerSignalListeners.add(handler);

    return () => {
      if (signalHandlerRef.current) {
        window.hailerSignalListeners?.delete(signalHandlerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setGlobal(window);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const self = window as unknown as any;

    if (self.hailerApiInstance) {
      // Using window instance to prevent hotload creating new instances on each change.
      return;
    }

    // Initialize signal listeners set
    if (!window.hailerSignalListeners) {
      window.hailerSignalListeners = new Set();
    }

    self.hailerApiInstance = new HailerApi({
      ...(allowedUrls?.length ? { allowedUrls } : {}),
      connected: async () => {
        if (!self.hailerApiInstance) {
          return;
        }
        setInside(true);
      },
      outside: async () => {
        setInside(false);
      },
      config: (config: HailerAppConfig) => {
        console.log('useHailer config callback received:', config);
        console.log('config.fields:', config?.fields);
        setConfig(config);

        if (self.hailerApiInstance) {
          setInfo(self.hailerApiInstance.info())
        }
      },
      settings: (settings: HailerSettings) => setSettings(settings),
      signals: (signal: HailerSignal) => {
        console.log('Signal received:', signal);
        // Broadcast to all registered listeners
        window.hailerSignalListeners?.forEach(listener => listener(signal));
      },
    });
  }, [allowedUrls]);

  // Helper to check if a signal is relevant to specific workflows
  const isActivitySignal = useCallback((signal: HailerSignal | null, workflowIds?: string[]): boolean => {
    if (!signal) return false;
    // Signal format: { sig: 'activity.create', meta: {...} }
    const activitySignals = ['activity.create', 'activity.update', 'activity.delete', 'activity.phase_changed'];
    if (!activitySignals.includes(signal.sig)) return false;

    // If no workflow filter, return true for any activity signal
    if (!workflowIds || workflowIds.length === 0) return true;

    // Check if signal's workflow matches any of the provided workflow IDs
    // The meta structure can vary - check multiple possible locations
    const meta = signal.meta || {};
    const signalWorkflowId = meta.process || meta.processId || meta.workflowId || meta.pid;

    // If we can't determine the workflow, ignore the signal (don't reload for unknown workflows)
    if (!signalWorkflowId) {
      console.log('Signal ignored - no workflow ID in meta:', meta);
      return false;
    }

    const matches = workflowIds.includes(signalWorkflowId);
    if (matches) {
      console.log('Signal matches watched workflow:', signalWorkflowId);
    }
    return matches;
  }, []);

  return {
    inside,
    info,
    config,
    settings,
    hailer: global?.hailerApiInstance as HailerApi,
    lastSignal,
    isActivitySignal,
  }
}

export default useHailer;
