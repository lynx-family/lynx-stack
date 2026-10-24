import { useCallback, useEffect, useRef, useState } from '@lynx-js/react';

import { createFlappy } from './lib/flappy.js';
import type { FlappyEngine, FlappyOptions } from './lib/flappy.js';

/**
 * React hook for flappy-bird physics.
 *
 * Returns `[y, jump]` — a state value and a stable callback.
 * The game loop runs automatically; cleanup happens on unmount.
 * Options are read once on mount and not reactive to later changes.
 *
 * @example
 * ```tsx
 * function Bird() {
 *   const [y, jump] = useFlappy();
 *   return (
 *     <view bindtap={jump} style={{ transform: `translateY(${y}px)` }}>
 *       <text>Tap me!</text>
 *     </view>
 *   );
 * }
 * ```
 */
export function useFlappy(
  options?: FlappyOptions,
): [number, () => void] {
  const [y, setY] = useState(0);
  const engineRef = useRef<FlappyEngine | null>(null);

  engineRef.current ??= createFlappy((newY) => {
    setY(newY);
  }, options);

  useEffect(() => {
    return () => {
      engineRef.current?.destroy();
    };
  }, []);

  const jump = useCallback(() => {
    'background-only';
    engineRef.current?.jump();
  }, []);

  return [y, jump];
}
