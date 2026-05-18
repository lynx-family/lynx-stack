// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path'

import type { RsbuildEntry } from '@rsbuild/core'
import type { Compilation } from 'webpack'

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

/**
 * For a lazy-bundle chunkGroup (one whose name is an internal chunk
 * name that doesn't appear in rsbuild `source.entry`), return the
 * source file(s) that originated the dynamic `import()` call(s) which
 * created this chunkGroup.
 *
 * rspack has no one-shot `chunkGroup → entry module` API, but the
 * pieces compose down to ~3 hops:
 *
 *  1. `cg.origins[i].module` — the module that contains an `import()`
 *     call that produced this chunkGroup (usually exactly one entry).
 *  2. `importer.blocks` — the importer's `AsyncDependenciesBlock`s;
 *     match against `cg` using `chunkGraph.getBlockChunkGroup(block)`.
 *  3. `block.dependencies[0]` is the import dependency;
 *     `moduleGraph.getResolvedModule(dep).resource` is the absolute
 *     path of the resolved target file (e.g. `.tsx` even when the
 *     request was `'./Foo.js'`).
 *
 * Returns absolute resource paths, deduped. Caller is responsible for
 * normalizing to a repo-relative path.
 */
export function collectLazyBundleEntryResources(
  compilation: Compilation,
  chunkGroupName: string,
): string[] {
  const cg = compilation.namedChunkGroups.get(chunkGroupName)
  if (!cg) return []
  const chunkGraph = compilation.chunkGraph as
    | { getBlockChunkGroup?: (b: unknown) => unknown }
    | undefined
  const moduleGraph = compilation.moduleGraph as
    | { getResolvedModule?: (d: unknown) => unknown }
    | undefined
  if (!chunkGraph || !moduleGraph) return []

  const out: string[] = []
  const origins = (cg as { origins?: Array<{ module?: unknown }> }).origins
    ?? []
  for (const origin of origins) {
    const importer = origin.module as
      | { blocks?: Array<{ dependencies?: unknown[] }> }
      | null
      | undefined
    if (!importer?.blocks) continue
    for (const block of importer.blocks) {
      if (chunkGraph.getBlockChunkGroup?.(block) !== cg) continue
      for (const dep of block.dependencies ?? []) {
        const resolved = moduleGraph.getResolvedModule?.(dep) as
          | { resource?: unknown }
          | null
          | undefined
        const resource = resolved?.resource
        if (typeof resource === 'string' && path.isAbsolute(resource)) {
          out.push(resource)
        }
      }
    }
  }
  return dedupe(out)
}

/** Stable de-dup preserving first-seen order. */
export function dedupe<T>(xs: T[]): T[] {
  return Array.from(new Set(xs))
}
