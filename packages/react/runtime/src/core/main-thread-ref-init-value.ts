// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { isMtsEnabled } from './mts-capability.js';

export type MainThreadRefInitValuePatch = [id: number, value: unknown][];

let mainThreadRefInitValuePatch: MainThreadRefInitValuePatch = [];

/**
 * @internal
 */
export function addMainThreadRefInitValue(id: number, value: unknown): void {
  if (!isMtsEnabled()) {
    return;
  }

  mainThreadRefInitValuePatch.push([id, value]);
}

/**
 * @internal
 */
export function takeMainThreadRefInitValuePatch(): MainThreadRefInitValuePatch {
  const patch = mainThreadRefInitValuePatch;
  mainThreadRefInitValuePatch = [];
  return patch;
}
