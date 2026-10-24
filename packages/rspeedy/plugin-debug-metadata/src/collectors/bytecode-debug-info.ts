// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Artifact, LepusNGDebugInfoBody } from '@lynx-js/debug-metadata'

// The unit a card's root lepus code is filed under.
export const ROOT_DEBUG_INFO_UNIT = 'lepusNG_debug_info'

export function parseDebugInfoUnits(
  debugInfoJson: string,
): Map<string, LepusNGDebugInfoBody> | undefined {
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

  const units = new Map<string, LepusNGDebugInfoBody>()
  for (const [name, value] of Object.entries(parsed)) {
    if (isDebugInfoBody(value)) units.set(name, value)
  }
  return units.size > 0 ? units : undefined
}

function isDebugInfoBody(value: unknown): value is LepusNGDebugInfoBody {
  return typeof value === 'object' && value !== null
    && Array.isArray((value as Partial<LepusNGDebugInfoBody>).function_info)
}

// A unit is named after the asset it was compiled from, except a card's root
// lepus code. Removed from `units` so two artifacts cannot claim the same one.
export function takeDebugInfoUnit(
  artifact: Pick<Artifact, 'filename' | 'path' | 'tasmSection'>,
  units: Map<string, LepusNGDebugInfoBody>,
): LepusNGDebugInfoBody | undefined {
  const named = [artifact.path, artifact.filename]
    .flatMap(name => [name, name.replace(/\.[^./]+$/, '')])
    .find(name => units.has(name))
  if (named !== undefined) return take(units, named)

  const isRoot = artifact.tasmSection?.[0] === 'lepusCode'
    && artifact.tasmSection[1] === 'root'
  return isRoot ? take(units, ROOT_DEBUG_INFO_UNIT) : undefined
}

function take(
  units: Map<string, LepusNGDebugInfoBody>,
  name: string,
): LepusNGDebugInfoBody | undefined {
  const body = units.get(name)
  units.delete(name)
  return body
}
