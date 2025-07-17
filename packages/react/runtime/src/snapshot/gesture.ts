// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { processGesture } from '../gesture/processGesture.js';
import type { GestureKind } from '../gesture/types.js';
import { isMainThreadHydrationFinished } from '../lifecycle/patch/isMainThreadHydrationFinished.js';
import { SnapshotInstance } from '../snapshot.js';

export function updateGesture(
  snapshot: SnapshotInstance,
  expIndex: number,
  oldValue: any,
  elementIndex: number,
  workletType: string,
): void {
  if (!snapshot.__elements) {
    return;
  }
  if (__PROFILE__) {
    console.profile('updateGesture');
  }
  const value = snapshot.__values![expIndex] as GestureKind;

  if (workletType === 'main-thread') {
    processGesture(snapshot.__elements[elementIndex]!, value, oldValue as GestureKind, !isMainThreadHydrationFinished);
  }
  if (__PROFILE__) {
    console.profileEnd();
  }
}
