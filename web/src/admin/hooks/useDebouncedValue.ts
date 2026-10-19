import { useEffect, useState } from 'react';

/** Trailing search delay; explicit search and submission actions should remain immediate. */
export const SEARCH_DEBOUNCE_MS = 300;

export function useDebouncedValue<T>(value: T, delay = SEARCH_DEBOUNCE_MS) {
  const [state, setState] = useState({ input: value, settled: value, pending: false });
  const changed = !Object.is(state.input, value);
  // Reconcile before commit: A → B → A still needs a full trailing delay.
  if (changed) setState({ ...state, input: value, pending: true });
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setState((current) =>
        Object.is(current.input, value)
          ? { input: value, settled: value, pending: false }
          : current,
      );
    }, delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return { value: state.settled, pending: changed || state.pending };
}
