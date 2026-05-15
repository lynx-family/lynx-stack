// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path'

import type { RsbuildEntry } from '@rsbuild/core'

/**
 * Walk an rsbuild `source.entry` map and produce a
 * `name → source files` map with every path relative to `repoRoot`
 * (git toplevel; falls back to `cwd` when there is no git root) so the
 * metadata is portable across machines / CI envs.
 *
 * Separators are always normalized to forward slashes so the JSON
 * payload is identical whether the build ran on Windows or POSIX.
 */
export function collectEntryPathMap(
  entry: RsbuildEntry,
  cwd: string,
  repoRoot: string | null,
): Record<string, string[]> {
  const baseDir = repoRoot ?? cwd
  const toRel = (p: string): string =>
    path.relative(baseDir, path.resolve(cwd, p)).split(path.sep).join('/')

  const out: Record<string, string[]> = {}
  for (const [name, value] of Object.entries(entry)) {
    out[name] = normalizeImports(value).map(p => toRel(p))
  }
  return out
}

function normalizeImports(value: RsbuildEntry[string]): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value
  const imp = value.import
  if (typeof imp === 'string') return [imp]
  if (Array.isArray(imp)) return imp
  return []
}

/** Stable de-dup preserving first-seen order. */
export function dedupe<T>(xs: T[]): T[] {
  return Array.from(new Set(xs))
}
