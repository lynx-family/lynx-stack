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

/**
 * Parse the per-section debug-info shape returned when TASM compiles
 * `customSections` as `JsBytecode`.
 *
 * Each top-level key is the actual custom-section name used in runtime stack
 * frames. Its value has the same shape as `lepusNG_debug_info`, but without
 * the ordinary template encoder's outer envelope.
 */
export function parseCustomSectionDebugInfo(
  debugInfoJson: string,
): Record<string, LepusNGDebugInfo> | undefined {
  if (!debugInfoJson) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(debugInfoJson)
  } catch {
    return undefined
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return undefined
  }

  const sections: Record<string, LepusNGDebugInfo> = {}
  for (const [sectionName, debugInfo] of Object.entries(parsed)) {
    // The ordinary encoder envelope may coexist with custom-section payloads.
    // It is not itself a custom section and must keep using the root fallback.
    if (sectionName === 'lepusNG_debug_info') continue
    if (
      !debugInfo
      || typeof debugInfo !== 'object'
      || Array.isArray(debugInfo)
      || !Array.isArray(
        (debugInfo as { function_info?: unknown }).function_info,
      )
    ) {
      continue
    }
    sections[sectionName] = {
      lepusNG_debug_info: debugInfo as LepusNGDebugInfo['lepusNG_debug_info'],
    }
  }

  return Object.keys(sections).length > 0 ? sections : undefined
}
