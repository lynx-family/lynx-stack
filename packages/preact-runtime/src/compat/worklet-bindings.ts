// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Alias target for `@lynx-js/react/worklet-runtime/bindings`. Without a
 * compiler, "worklet ctx" values are plain functions running on the
 * background thread, so running one is a direct call.
 */

export function runWorkletCtx(
  ctx: unknown,
  params?: unknown[],
): unknown {
  if (typeof ctx === 'function') {
    return (ctx as (...args: unknown[]) => unknown)(...(params ?? []));
  }
  return undefined;
}
