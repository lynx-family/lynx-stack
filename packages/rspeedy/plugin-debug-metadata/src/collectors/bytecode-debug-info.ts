// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { LepusNGDebugInfo } from '@lynx-js/debug-metadata'

export function parseLepusNGDebugInfo(
  debugInfoJson: string,
): LepusNGDebugInfo | undefined {
  if (!debugInfoJson) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(debugInfoJson)
  } catch {
    return undefined
  }
  if (!parsed || typeof parsed !== 'object') return undefined
  const maybe = parsed as Partial<LepusNGDebugInfo>
  if (!maybe.lepusNG_debug_info) return undefined
  return maybe as LepusNGDebugInfo
}
