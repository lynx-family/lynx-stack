// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useRef } from '@lynx-js/react';

import type { DefaultScrollGesture } from './defaultScrollGesture.js';
import type { FlingGesture } from './flingGesture.js';
import type { LongPressGesture } from './longPressGesture.js';
import type { PanGesture } from './panGesture.js';
import type { TapGesture } from './tapGesture.js';

type IBasicGestures =
  | PanGesture
  | FlingGesture
  | DefaultScrollGesture
  | TapGesture
  | LongPressGesture;

function useGesture<T extends IBasicGestures>(
  GestureConstructor: new() => T,
): T {
  const gestureRef = useRef<T>(new GestureConstructor());
  const lastExecIdRef = useRef(gestureRef.current.execId);

  if (lastExecIdRef.current !== gestureRef.current.execId) {
    lastExecIdRef.current = gestureRef.current.execId;
    const cloned = gestureRef.current.clone() as T;
    gestureRef.current = cloned;
  }

  return gestureRef.current;
}

export { useGesture };
