import { useState } from '@lynx-js/react';

export interface UseCounterResult {
  count: number;
  inc: () => void;
  dec: () => void;
  reset: () => void;
}

export function useCounter(initial = 0): UseCounterResult {
  const [count, setCount] = useState(initial);

  const inc = (): void => setCount((v) => v + 1);
  const dec = (): void => setCount((v) => v - 1);
  const reset = (): void => setCount(initial);

  return {
    count: count,
    inc: inc,
    dec: dec,
    reset: reset,
  };
}
