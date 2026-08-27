// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { isMtsEnabled } from './mts-capability.js';

export type MainThreadRefInitValuePatch = (
  | [id: number, value: unknown]
  | [id: number, value: unknown, type: string, mainThreadObjectProtocolVersion: number]
)[];

let mainThreadRefInitValuePatch: MainThreadRefInitValuePatch = [];

/**
 * @internal
 */
export function addMainThreadRefInitValue(
  id: number,
  value: unknown,
  type?: string,
  mainThreadObjectProtocolVersion?: number,
): void {
  if (!isMtsEnabled()) {
    return;
  }

  mainThreadRefInitValuePatch.push(
    type === undefined
      ? [id, value]
      : [id, value, type, mainThreadObjectProtocolVersion!],
  );
}

/**
 * @internal
 */
export function takeMainThreadRefInitValuePatch(): MainThreadRefInitValuePatch {
  const patch = mainThreadRefInitValuePatch;
  mainThreadRefInitValuePatch = [];
  return patch;
}
