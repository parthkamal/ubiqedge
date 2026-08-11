import { useEffect, useState } from 'react';

// debounces a value client-side before it's used to call the backend's
// `search` query param — see implementation spec §8 ("list-screen search
// inputs are debounced client-side")
export function useDebouncedValue(value, delayMs = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
