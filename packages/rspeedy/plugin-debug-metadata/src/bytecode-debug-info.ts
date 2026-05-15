// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { LepusNGDebugInfo } from '@lynx-js/debug-metadata'

/**
 * Parse the JSON string `LynxTemplatePlugin.beforeEmit` hands us as
 * `args.debugInfo` and return the `lepusNG_debug_info` payload, or
 * `undefined` when the build did not produce bytecode (e.g. lepusNG
 * encoding disabled, no main-thread chunks).
 */
export function parseLepusNGDebugInfo(
  debugInfoJson: string,
): LepusNGDebugInfo | undefined {
  if (!debugInfoJson) return undefined
  let parsed: { lepusNG_debug_info?: LepusNGDebugInfo }
  try {
    parsed = JSON.parse(debugInfoJson) as {
      lepusNG_debug_info?: LepusNGDebugInfo
    }
  } catch {
    return undefined
  }
  return parsed.lepusNG_debug_info
}
