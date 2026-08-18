'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Debounces a value by the specified delay.
 * Use for search inputs to avoid firing API calls on every keystroke.
 *
 * @example
 *   const [query, setQuery] = useState('');
 *   const debouncedQuery = useDebounce(query, 300);
 *   // debouncedQuery updates 300ms after the last setQuery call
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Returns a debounced version of the provided callback.
 * Useful for event handlers that should be throttled.
 *
 * @example
 *   const handleSearch = useDebouncedCallback((q) => fetchResults(q), 300);
 */
export function useDebouncedCallback(callback, delay = 300) {
  const timerRef = useRef(null);

  const debouncedFn = useCallback((...args) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => callback(...args), delay);
  }, [callback, delay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return debouncedFn;
}

/**
 * Tracks the previous value of a state/prop.
 * Useful for comparing current vs previous to detect changes.
 */
export function usePrevious(value) {
  const [current, setCurrent] = useState(value);
  const [previous, setPrevious] = useState(null);

  if (value !== current) {
    setPrevious(current);
    setCurrent(value);
  }

  return previous;
}

/**
 * Returns true after component has mounted (client-side only).
 * Use to guard against SSR hydration mismatches.
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);
  return mounted;
}
