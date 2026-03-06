// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Worklet capture helper function.
 * Called by SWC plugin to preserve MainThreadValue objects during closure extraction.
 * @internal
 */
// biome-ignore lint/suspicious/noExplicitAny: Called by generated code with dynamic args
export function workletCapture(
  obj: unknown,
  ...args: unknown[]
): unknown {
  // If it's a Main Thread Value (e.g. MotionValue), return it (ID will be serialized)
  if (obj && typeof obj === 'object' && (obj as { __MT_PERSIST__?: boolean }).__MT_PERSIST__) {
    return obj;
  }
  // Otherwise, reconstruct a lightweight object with only the captured properties
  const result: Record<string, unknown> = {};
  for (let i = 0; i < args.length; i += 2) {
    result[args[i] as string] = args[i + 1];
  }
  return result;
}
