// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { LepusNGDebugInfo } from '@lynx-js/debug-metadata'

/**
 * Parse the JSON string `LynxTemplatePlugin.beforeEmit` hands us as
 * `args.debugInfo` into a {@link LepusNGDebugInfo}. The encoder writes
 * the exact same `{ lepusNG_debug_info: … }` envelope shape that the
 * type declares, so the parse is a JSON-parse + cast. Returns
 * `undefined` when the build did not produce bytecode (empty string,
 * lepusNG encoding disabled, no main-thread chunks).
 */
export function parseLepusNGDebugInfo(
  debugInfoJson: string,
): LepusNGDebugInfo | undefined {
  if (!debugInfoJson) return undefined
  let parsed: LepusNGDebugInfo
  try {
    parsed = JSON.parse(debugInfoJson) as LepusNGDebugInfo
  } catch {
    return undefined
  }
  if (!parsed.lepusNG_debug_info) return undefined
  return parsed
}
