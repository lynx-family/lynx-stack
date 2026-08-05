// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs'
import path from 'node:path'

import type { RspackChain } from '@rsbuild/core'

/**
 * A `<Background>` declares that its subtree does not participate in the
 * first screen. On the main-thread target the transform folds the boundary to
 * its `fallback`, so the deferred subtree's module closure leaves the
 * main-thread bundle while the fallback is compiled for it as ordinary code.
 *
 * How much that removes depends on where the boundaries sit, not on how many
 * there are: at the render root it takes the whole app, deeper in the tree it
 * takes each deferred subtree and leaves everything around them — the same
 * mechanism across the range, which is why detection only has to answer
 * "does this app defer anything at all?".
 *
 * `'auto'` (the default) answers that from the entry's own module graph;
 * `false` forces the mode; `true` forces it off.
 *
 * @internal
 */

// `Background` bound from `@lynx-js/react` (or a subpath) by *any* statement
// shape: a named import, an aliased one, a re-export, or a namespace import
// of the package as a whole. `[^{}]*` keeps a braced match inside a single
// `{ … }` so a `Background` from another module never binds to a separate
// `@lynx-js/react` statement.
const LYNX_REACT = String.raw`['"]@lynx-js\/react(?:\/[^'"]*)?['"]`
// import { Background } / { Background as B } / export { Background } from …
const NAMED = String.raw`(?:import|export)[^{}]*\{[^}]*\bBackground\b[^}]*\}`
// import * as ReactLynx from … — the namespace carries `Background` too.
const NAMESPACE = String.raw`import\s*\*\s*as\s+\w+`
// export * from … — re-exports the boundary along with everything else.
const STAR = String.raw`export\s*\*`
const BACKGROUND_BINDING_RE = new RegExp(
  [NAMED, NAMESPACE, STAR]
    .map(shape => String.raw`${shape}\s*from\s*${LYNX_REACT}`)
    .join('|'),
)

// Relative specifiers only: a boundary inside a dependency is not something
// this app can act on, and walking `node_modules` at config time would cost
// far more than it can find.
const RELATIVE_IMPORT_RE = /(?:import|export)[^'"]*?from\s*['"](\.[^'"]*)['"]/g

// Depth is bounded so a deep or cyclic graph cannot stall the config phase.
// Overrunning it only means the mode stays off — the safe direction.
const MAX_SCAN_DEPTH = 12

const RESOLVE_EXTENSIONS = [
  '',
  '.tsx',
  '.ts',
  '.jsx',
  '.js',
  '.mjs',
  '.cjs',
  '/index.tsx',
  '/index.ts',
  '/index.jsx',
  '/index.js',
]

/**
 * Whether a single module binds `Background` from the runtime.
 *
 * Deliberately asks about the *binding*, not about a `<Background>` element:
 * the answer only decides whether the entry is compiled for the main thread
 * at all, and compiling it is the safe direction. Getting that wrong the
 * other way is not a missed optimization but a blank first screen — the main
 * thread would be left with nothing to render even though the app has a
 * boundary the scan could not see through an alias, a namespace, a re-export
 * or a computed element type.
 *
 * The cost of a false positive is close to nil: an entry with no boundary
 * compiles exactly as it would have, and the assembled definitions subtract
 * everything the main-thread bundle already owns, which is all of it.
 *
 * @internal
 */
export function sourceHasBackground(source: string): boolean {
  return BACKGROUND_BINDING_RE.test(source)
}

/**
 * Resolve a relative import the way the bundler would, well enough to read
 * it. A specifier that does not land on a readable file is skipped: the scan
 * is an optimization hint, and a miss only keeps the classic build.
 */
function resolveRelative(
  fromFile: string,
  specifier: string,
): string | undefined {
  const base = path.resolve(path.dirname(fromFile), specifier)
  // `./App.js` habitually refers to `./App.tsx` in this codebase's sources.
  const withoutExt = base.replace(/\.(?:js|mjs|cjs)$/, '')
  for (const candidate of [base, withoutExt]) {
    for (const ext of RESOLVE_EXTENSIONS) {
      const file = candidate + ext
      try {
        if (fs.statSync(file).isFile()) {
          return file
        }
      } catch {
        // Not this one.
      }
    }
  }
  return undefined
}

/**
 * Whether an entry defers anything: a `<Background>` in the entry itself or
 * in any module reachable from it through relative imports.
 *
 * @internal
 */
export function entryHasBackground(entryFile: string): boolean {
  const visited = new Set<string>()

  const walk = (file: string, depth: number): boolean => {
    if (depth > MAX_SCAN_DEPTH || visited.has(file)) {
      return false
    }
    visited.add(file)

    const source = tryReadFile(file)
    if (source === undefined) {
      return false
    }
    if (sourceHasBackground(source)) {
      return true
    }

    RELATIVE_IMPORT_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = RELATIVE_IMPORT_RE.exec(source)) !== null) {
      const next = resolveRelative(file, match[1]!)
      if (next !== undefined && walk(next, depth + 1)) {
        return true
      }
    }
    return false
  }

  return walk(entryFile, 0)
}

/**
 * Resolve the `experimental_enableMTSRendering` option to the boolean the
 * build uses.
 *
 * - `true` — business code is compiled for the main thread and rendered
 *   there (the classic dual-thread build). A root-level `<Background>` still
 *   yields a 0.0 first screen at runtime: the component renders its
 *   `fallback` on the main thread.
 * - `false` — force the assembled main-thread bundle: business code is not
 *   compiled for the main thread; its definitions are collected from the
 *   background compilation (the escape hatch, e.g. for an entry shape the
 *   detection cannot see).
 * - `'auto'` (the default) — production builds disable MTS rendering when an
 *   entry declares a root-level `<Background>`, detected by reading the given
 *   entry files. Unreadable paths (bare specifiers, injected runtime entries)
 *   are skipped. Development builds keep the classic path, where the
 *   `<Background>` component itself renders the fallback — the same first
 *   frame, with HMR intact.
 *
 * @internal
 */
export function resolveEnableMTSRendering(
  explicit: boolean | 'auto' | undefined,
  isProd: boolean,
  entryFiles: Iterable<string>,
): boolean {
  if (typeof explicit === 'boolean') {
    return explicit
  }
  if (!isProd) {
    return true
  }

  for (const file of entryFiles) {
    if (entryHasBackground(file)) {
      return false
    }
  }

  return true
}

/**
 * Whether this build folds `<Background>` boundaries while the main thread
 * keeps compiling and rendering everything around them.
 *
 * The fold and the assembled definitions do not depend on the main thread
 * being empty — `experimental_enableMTSRendering: false` merely happens to leave it that
 * way. Turning them on under the classic build is what makes a boundary a
 * *hole* in a rendered tree rather than the whole first frame, and lets a
 * multi-entry build defer in one entry without emptying another's first
 * frame.
 *
 * Off in development, where the main thread compiles a `MIXED` target and
 * HMR needs the full module graph: the `<Background>` component still renders
 * its fallback at runtime, so the first frame is the same.
 *
 * @internal
 */
export function resolveBackgroundIslands(
  options: {
    experimental_backgroundIslands: boolean
    experimental_useElementTemplate: boolean
    enableSSR: boolean
  },
  experimental_enableMTSRendering: boolean,
  isProd: boolean,
): boolean {
  if (!options.experimental_backgroundIslands || !isProd) {
    return false
  }
  // `experimental_enableMTSRendering: false` already folds every boundary for the whole
  // build; `pluginReactLynx` rejects the combination up front, and a `'auto'`
  // detection landing on it resolves here.
  if (!experimental_enableMTSRendering) {
    return false
  }
  // Same demotions as the assembled bundle: neither backend can consume the
  // assembled definitions yet.
  return !options.experimental_useElementTemplate && !options.enableSSR
}

function tryReadFile(file: string): string | undefined {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    // Not a readable local file (e.g. a bare specifier or a virtual entry).
    return undefined
  }
}

/**
 * The file paths every entry of the chain imports, resolved against the
 * project root. Non-string entry items (`dependOn`-style descriptors are
 * unwrapped; anything else is skipped) never end up in the set.
 *
 * @internal
 */
export function collectEntryImports(
  chain: RspackChain,
  rootPath: string,
): Set<string> {
  const files = new Set<string>()
  for (const imports of collectEntryImportsByEntry(chain, rootPath).values()) {
    for (const file of imports) {
      files.add(file)
    }
  }
  return files
}

/**
 * Same as {@link collectEntryImports}, grouped by entry name — for per-entry
 * guardrails (e.g. warning on an entry that has no root `<Background>` while
 * another entry turned the mode on).
 *
 * @internal
 */
function addResolved(
  files: string[],
  rootPath: string,
  item: unknown,
): void {
  if (typeof item === 'string') {
    files.push(path.resolve(rootPath, item))
  }
}

export function collectEntryImportsByEntry(
  chain: RspackChain,
  rootPath: string,
): Map<string, string[]> {
  const byEntry = new Map<string, string[]>()
  const entryPoints = chain.entryPoints.entries() ?? {}
  for (const [entryName, entryPoint] of Object.entries(entryPoints)) {
    const files: string[] = []
    for (const value of entryPoint.values()) {
      if (typeof value === 'string' || Array.isArray(value)) {
        for (const item of Array.isArray(value) ? value : [value]) {
          addResolved(files, rootPath, item)
        }
      } else if (value && typeof value === 'object' && 'import' in value) {
        const imports = (value as { import?: string | string[] }).import
        for (const item of Array.isArray(imports) ? imports : [imports]) {
          addResolved(files, rootPath, item)
        }
      }
    }
    byEntry.set(entryName, files)
  }
  return byEntry
}

/**
 * The entries whose sources declare a root-level `<Background>`, and so bring
 * a fallback the main thread should compile and render.
 *
 * @internal
 */
export function entriesDeclaringRootBackground(
  chain: RspackChain,
  rootPath: string,
): Set<string> {
  const declaring = new Set<string>()
  for (
    const [entryName, files] of collectEntryImportsByEntry(chain, rootPath)
  ) {
    for (const file of files) {
      if (entryHasBackground(file)) {
        declaring.add(entryName)
        break
      }
    }
  }
  return declaring
}

const noop = (): void => {
  // The loaders hook resolves silently; the entry hook owns the warnings.
}

/**
 * Resolve the mode for a build and surface its guardrails.
 *
 * Detection (`'auto'`), the safety demotions (`experimental_useElementTemplate`
 * and `enableSSR` do not support the assembled main-thread bundle yet), and
 * the fallback guardrails all live here so every `modifyBundlerChain` hook
 * resolves identically. Pass a `warn` only from the hook that owns user-facing
 * warnings — other hooks resolve silently.
 *
 * @internal
 */
export function resolveMTSRendering(
  options: {
    experimental_enableMTSRendering: boolean | 'auto'
    experimental_useElementTemplate: boolean
    enableSSR: boolean
  },
  isProd: boolean,
  chain: RspackChain,
  rootPath: string,
  warn: (message: string) => void = noop,
): boolean {
  if (typeof options.experimental_enableMTSRendering === 'boolean') {
    // The explicit switches skip detection entirely. `false` +
    // `experimental_useElementTemplate` is rejected eagerly by
    // `pluginReactLynx` before any hook runs.
    return options.experimental_enableMTSRendering
  }
  if (!isProd) {
    return true
  }

  const deferringEntries = entriesDeclaringRootBackground(chain, rootPath)
  if (deferringEntries.size === 0) {
    return true
  }

  if (options.experimental_useElementTemplate) {
    warn(
      'A <Background> was detected, but `experimental_useElementTemplate` '
        + 'does not support disabling main-thread rendering yet — keeping the classic build. '
        + 'The <Background> fallback still renders on the main thread at runtime.',
    )
    return true
  }
  if (options.enableSSR) {
    warn(
      'A <Background> was detected, but `enableSSR` '
        + 'does not support disabling main-thread rendering yet — keeping the classic build. '
        + 'The <Background> fallback still renders on the main thread at runtime.',
    )
    return true
  }

  for (const entryName of collectEntryImportsByEntry(chain, rootPath).keys()) {
    if (!deferringEntries.has(entryName)) {
      // The mode applies to the whole build: an entry without a root
      // <Background> gets an empty first frame (the `fallback={null}`
      // degenerate case) — worth saying out loud under `'auto'`.
      warn(
        `Entry ${
          JSON.stringify(entryName)
        } defers nothing with a <Background>, but another `
          + `entry turned main-thread rendering off for this build — its first frame will be `
          + `empty until the background hydrates. Add a <Background fallback={…}> to it, `
          + `or set \`experimental_enableMTSRendering: true\` to keep the classic build.`,
      )
    }
  }

  return false
}
