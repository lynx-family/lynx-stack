// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path'

import type { RsbuildEntry, Rspack } from '@rsbuild/core'

/**
 * `entry`: {
 *   main: './src/index.ts',
 * }
 *
 * `cwd`: /projects/lynx-stack/examples/react
 * `repoRoot`: /projects/lynx-stack
 *
 * returns: {
 *   main: ['examples/react/src/index.ts'],
 * }
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
 * For dynamic import like `import('./Foo.jsx')`,
 * locate the absolute path to the Foo.jsx file.
 */
export function collectLazyBundleEntryResources(
  compilation: Rspack.Compilation,
  cg: Rspack.ChunkGroup,
): string[] {
  const chunkGraph = compilation.chunkGraph
  const moduleGraph = compilation.moduleGraph
  if (!chunkGraph || !moduleGraph) return []

  const { AsyncDependenciesBlock } = compilation.compiler.webpack

  const out: string[] = []
  for (const origin of cg.origins) {
    const importer = origin.module
    if (!importer?.blocks) continue
    for (const block of importer.blocks) {
      if (
        !(block instanceof AsyncDependenciesBlock)
        || chunkGraph.getBlockChunkGroup(block) !== cg
      ) {
        continue
      }
      const dep = block.dependencies[0]
      const resolved = dep
        ? moduleGraph.getResolvedModule(dep) as Rspack.NormalModule | null
        : null
      const resource = resolved?.resource
      if (typeof resource === 'string' && path.isAbsolute(resource)) {
        out.push(resource)
      }
    }
  }
  return dedupe(out)
}

/** Stable de-dup preserving first-seen order. */
export function dedupe<T>(xs: T[]): T[] {
  return Array.from(new Set(xs))
}
