// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { isMtsEnabled } from './functionality.js';

let initValuePatch: [number, unknown][] = [];
const initValueIdSet = /*#__PURE__*/ new Set<number>();

/**
 * @internal
 */
export function addWorkletRefInitValue(id: number, value: unknown): void {
  if (!isMtsEnabled()) {
    return;
  }

  initValueIdSet.add(id);
  initValuePatch.push([id, value]);
}

/**
 * @internal
 */
export function takeWorkletRefInitValuePatch(): [number, unknown][] {
  const res = initValuePatch;
  initValuePatch = [];
  return res;
}
