// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ClosureValueType, Worklet } from './bindings/types.js';

interface CtxTrace {
  ctx: Worklet;
}

export let currentCtx: CtxTrace | undefined;

export function traceCtxCall(ctx: Worklet, _params: ClosureValueType[]): void {
  currentCtx = {
    ctx,
  };
}

export function clearCurrentCtx(): void {
  currentCtx = undefined;
}
