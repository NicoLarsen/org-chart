import { useEffect, useState, useCallback } from 'react';
import { HailerApi, Workflow } from '@hailer/app-sdk';

interface FieldSchemaMap {
  // Maps "workflowId:fieldKey" -> fieldId
  [compositeKey: string]: string;
}

interface UseFieldSchemaOptions {
  workflowIds: string[];
  hailer: HailerApi | undefined;
}

interface UseFieldSchemaReturn {
  isLoading: boolean;
  error: Error | null;
  getFieldId: (workflowId: string, fieldKey: string) => string | null;
  schemaMap: FieldSchemaMap;
}

/**
 * Hook to fetch workflow schemas and provide field key -> ID resolution.
 *
 * This enables workspace-portable apps by using field keys instead of
 * hardcoded field IDs. The hook fetches schemas on mount and builds
 * a mapping from portable field keys to workspace-specific field IDs.
 *
 * @param options.workflowIds - Array of workflow IDs to fetch schemas for
 * @param options.hailer - HailerApi instance from useHailer hook
 *
 * @example
 * const { getFieldId, isLoading } = useFieldSchema({
 *   workflowIds: [WORKFLOW_ID, TEAMS.WORKFLOW_ID],
 *   hailer
 * });
 *
 * const positionFieldId = getFieldId(WORKFLOW_ID, 'position');
 * const value = activity.fields[positionFieldId]?.value;
 */
export function useFieldSchema({ workflowIds, hailer }: UseFieldSchemaOptions): UseFieldSchemaReturn {
  const [schemaMap, setSchemaMap] = useState<FieldSchemaMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!hailer || workflowIds.length === 0) {
      return;
    }

    const fetchSchemas = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch all workflow schemas in parallel
        const workflows = await Promise.all(
          workflowIds.map(id => hailer.workflow.get(id))
        );

        // Build the key -> ID mapping
        const map: FieldSchemaMap = {};

        workflows.forEach((workflow: Workflow) => {
          if (!workflow.fields) return;

          console.log(`[useFieldSchema] Processing workflow ${workflow._id} (${workflow.name})`);

          Object.entries(workflow.fields).forEach(([fieldId, field]) => {
            // Field key is stored in the field definition
            const fieldKey = field?.key;
            if (fieldKey) {
              const compositeKey = `${workflow._id}:${fieldKey}`;
              map[compositeKey] = fieldId;
              console.log(`  [useFieldSchema] Mapped key "${fieldKey}" -> ${fieldId}`);
            }
          });
        });

        console.log('[useFieldSchema] Schema map built:', Object.keys(map).length, 'mappings');
        setSchemaMap(map);
      } catch (err) {
        console.error('Failed to fetch workflow schemas:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    };

    fetchSchemas();
  }, [hailer, workflowIds.join(',')]); // Join to create stable dependency

  /**
   * Resolves a portable field key to a workspace-specific field ID.
   *
   * @param workflowId - The workflow containing the field
   * @param fieldKey - The portable field key (e.g., "position", "team")
   * @returns The workspace-specific field ID, or null if not found
   */
  const getFieldId = useCallback((workflowId: string, fieldKey: string): string | null => {
    const compositeKey = `${workflowId}:${fieldKey}`;
    const fieldId = schemaMap[compositeKey];

    if (fieldId) {
      return fieldId;
    }

    // Fallback: Check if fieldKey is already a field ID (24 hex chars)
    // This handles cases where some code still uses IDs directly
    if (/^[a-f0-9]{24}$/i.test(fieldKey)) {
      console.warn(`Using field ID directly as fallback: ${fieldKey}`);
      return fieldKey;
    }

    console.warn(`Field key "${fieldKey}" not found in workflow ${workflowId}`);
    return null;
  }, [schemaMap]);

  return {
    isLoading,
    error,
    getFieldId,
    schemaMap,
  };
}

export default useFieldSchema;
