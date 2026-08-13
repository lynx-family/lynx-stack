// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { isMtsEnabled } from '../functionality.js';

export type workletRefInitValuePatch = (
  | [id: number, value: unknown]
  | [id: number, value: unknown, type: string, mainThreadObjectProtocolVersion: number]
)[];

let initValuePatch: workletRefInitValuePatch = [];

/**
 * @internal
 */
export function addWorkletRefInitValue(
  id: number,
  value: unknown,
  type?: string,
  mainThreadObjectProtocolVersion?: number,
): void {
  if (!isMtsEnabled()) {
    return;
  }

  initValuePatch.push(
    type === undefined
      ? [id, value]
      : [id, value, type, mainThreadObjectProtocolVersion!],
  );
}

/**
 * @internal
 */
export function takeWorkletRefInitValuePatch(): workletRefInitValuePatch {
  const res = initValuePatch;
  initValuePatch = [];
  return res;
}
