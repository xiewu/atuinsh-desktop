import { useCallback, useEffect, useRef } from 'react';

/**
 * Hook for CodeMirror that avoids React re-renders on every keystroke
 * Uses refs to store current value and only syncs to external state when needed
 */
export function useCodeMirrorValue(
  initialValue: string,
  onUpdate: (value: string) => void,
  delay: number = 50
) {
  const valueRef = useRef(initialValue);
  const timeoutRef = useRef<number | undefined>(undefined);
  const lastSyncedValue = useRef(initialValue);
  const onUpdateRef = useRef(onUpdate);

  // Keep onUpdate ref current
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // Handle CodeMirror changes - updates ref without triggering re-render
  const onChange = useCallback((val: string) => {
    valueRef.current = val;
    
    // Debounce the sync to external state
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      if (valueRef.current !== lastSyncedValue.current) {
        onUpdateRef.current(valueRef.current);
        lastSyncedValue.current = valueRef.current;
      }
    }, delay);
  }, [delay]);

  // Sync external changes to ref
  useEffect(() => {
    if (initialValue !== lastSyncedValue.current) {
      valueRef.current = initialValue;
      lastSyncedValue.current = initialValue;
    }
  }, [initialValue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Return the initial value for CodeMirror and the onChange handler
  // CodeMirror should automatically update when initialValue changes via props
  return {
    value: initialValue, // Should auto-update when props change
    onChange,
    getCurrentValue: () => valueRef.current
  };
}
