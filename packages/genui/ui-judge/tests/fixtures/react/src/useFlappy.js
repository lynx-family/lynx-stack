// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useEffect, useRef, useState } from '@lynx-js/react';

import { createFlappy } from './lib/flappy.js';

/**
 * React hook for flappy-bird physics.
 *
 * Returns `[y, jump]`, a state value and a stable callback.
 * The game loop runs automatically; cleanup happens on unmount.
 * Options are read once on mount and not reactive to later changes.
 */
export function useFlappy(options) {
  const [y, setY] = useState(0);
  const engineRef = useRef(null);

  engineRef.current ??= createFlappy((newY) => {
    setY(newY);
  }, options);

  useEffect(() => {
    return () => {
      engineRef.current?.destroy();
    };
  }, []);

  const jump = useCallback(() => {
    'main thread';
    engineRef.current?.jump();
  }, []);

  return [y, jump];
}
