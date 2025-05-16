// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { onWorkletCtxUpdate } from '@lynx-js/react/worklet-runtime/bindings';
import type { Worklet } from '@lynx-js/react/worklet-runtime/bindings';

import { SnapshotInstance } from '../snapshot.js';

function updateWorkletEvent(
  snapshot: SnapshotInstance,
  expIndex: number,
  _oldValue: Worklet,
  elementIndex: number,
  workletType: string,
  eventType: string,
  eventName: string,
): void {
  if (!snapshot.__elements) {
    return;
  }
  const value = (snapshot.__values![expIndex] as Worklet || undefined) ?? {};
  value._workletType = workletType;

  if (workletType === 'main-thread') {
    onWorkletCtxUpdate(value, snapshot.__elements[elementIndex]!);
    const event = {
      type: 'worklet',
      value,
    };
    __AddEvent(snapshot.__elements[elementIndex]!, eventType, eventName, event);
  }
}

export { updateWorkletEvent };
