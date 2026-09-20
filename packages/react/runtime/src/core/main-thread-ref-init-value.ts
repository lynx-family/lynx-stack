// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { MainThreadRefInitValuePatch } from '@lynx-js/react/worklet-runtime/bindings';

import { isMtsEnabled } from './mts-capability.js';

let mainThreadRefInitValuePatch: MainThreadRefInitValuePatch = [];

/**
 * @internal
 */
export function addMainThreadRefInitValue(
  id: number,
  value: unknown,
  mainThreadObject?: { readonly type: string; readonly protocolVersion: number },
): void {
  if (!isMtsEnabled()) {
    return;
  }

  mainThreadRefInitValuePatch.push(
    mainThreadObject === undefined
      ? [id, value]
      : [id, value, mainThreadObject.type, mainThreadObject.protocolVersion],
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
