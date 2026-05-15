// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path'

/**
 * Walk webpack's (already-normalized) `compiler.options.entry` and
 * produce a `name → source files` map, with every path expressed
 * relative to `repoRoot` (git toplevel) so the metadata is portable
 * across machines / CI envs. Falls back to `cwd` (compiler context)
 * when there is no git root.
 */
export function collectEntryPathMap(
  entryConfig: unknown,
  cwd: string,
  repoRoot: string | null,
): Record<string, string[]> {
  const baseDir = repoRoot ?? cwd
  const out: Record<string, string[]> = {}

  const toRel = (p: string): string =>
    path.relative(baseDir, path.resolve(cwd, p))

  const normalizeSourceList = (v: unknown): string[] => {
    if (typeof v === 'string') return [toRel(v)]
    if (Array.isArray(v)) {
      return v.filter((x): x is string => typeof x === 'string').map(p =>
        toRel(p)
      )
    }
    if (v && typeof v === 'object') {
      const importValue = (v as { import?: unknown }).import
      if (typeof importValue === 'string') return [toRel(importValue)]
      if (Array.isArray(importValue)) {
        return importValue
          .filter((x): x is string => typeof x === 'string')
          .map(p => toRel(p))
      }
    }
    return []
  }

  if (typeof entryConfig === 'string' || Array.isArray(entryConfig)) {
    out['main'] = normalizeSourceList(entryConfig)
    return out
  }
  if (entryConfig && typeof entryConfig === 'object') {
    for (const [name, value] of Object.entries(entryConfig)) {
      if (name === '__placeholder__') continue
      out[name] = normalizeSourceList(value)
    }
  }
  return out
}

/** Stable de-dup preserving first-seen order. */
export function dedupe<T>(xs: T[]): T[] {
  return Array.from(new Set(xs))
}
