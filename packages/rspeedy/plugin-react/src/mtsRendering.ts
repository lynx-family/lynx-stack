// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs'
import path from 'node:path'

import type { RspackChain } from '@rsbuild/core'

/**
 * A root-level `<Background>` — `root.render(<Background …>…</Background>)` —
 * declares a 0.0 first screen: the whole app's first frame is the static
 * `fallback`, so no business code needs to *run* on the main thread. That is
 * the condition under which the main thread can stop compiling business code
 * altogether (`enableMTSRendering: false`, the assembled main-thread bundle
 * of #3284) — the mode becomes the implementation detail of the declarative
 * root `<Background>` API.
 *
 * The runtime half of the declaration is always on — the `<Background>`
 * component renders its `fallback` on the main thread with no build support.
 * The compile-time half resolves here: `'auto'` (the default) lights the mode
 * up for production builds when a root-level `<Background>` is detected in
 * the entry sources; `false` forces the mode; `true` forces it off. A
 * `<Background>` nested *inside* the app keeps meaning per-subtree runtime
 * deferral and never appears in the entry's `.render(...)`, so detection
 * correctly ignores it.
 *
 * @internal
 */

// A named import of `Background` from `@lynx-js/react` (or a subpath such as
// `@lynx-js/react/internal`), scoped to a *single* import statement: `[^}]*`
// keeps the match inside one `{ … }` (it may span lines), and only whitespace
// is allowed between `}` and `from`, so a `Background` imported from another
// module never binds to a separate `@lynx-js/react` import.
const BACKGROUND_IMPORT_RE =
  /import[^{}]*\{[^}]*\bBackground\b[^}]*\}\s*from\s*['"]@lynx-js\/react(?:\/[^'"]*)?['"]/

// `<Background>` sitting directly inside a `.render(` call (`root.render(...)`,
// `createRoot().render(...)`, …). `\s*` spans the whitespace/newlines a
// formatter inserts between `.render(` and the opening tag.
const ROOT_BACKGROUND_RENDER_RE = /\.render\(\s*<Background[\s/>]/

/**
 * Whether a single entry's source declares a root-level `<Background>`.
 *
 * @internal
 */
export function sourceHasRootBackground(source: string): boolean {
  return BACKGROUND_IMPORT_RE.test(source)
    && ROOT_BACKGROUND_RENDER_RE.test(source)
}

/**
 * Resolve the `enableMTSRendering` option to the boolean the build uses.
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
    const source = tryReadFile(file)
    if (source !== undefined && sourceHasRootBackground(source)) {
      return false
    }
  }

  return true
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
 * Best-effort extraction of the root `<Background>`'s `fallback={…}` attribute
 * value from an entry source: find the `<Background` that sits in a
 * `.render(...)` call, then the `fallback` attribute inside that tag (scanning
 * with brace balance, since the value may nest JSX with its own braces).
 *
 * Returns `undefined` when there is no root `<Background>` or no inline
 * `fallback` attribute to inspect (e.g. `fallback={fallbackFromElsewhere}` is
 * still inspected, but yields no element to flag).
 */
function extractRootBackgroundFallback(source: string): string | undefined {
  const render = ROOT_BACKGROUND_RENDER_RE.exec(source)
  if (!render) {
    return undefined
  }
  const tagStart = source.indexOf('<Background', render.index)
  if (tagStart === -1) {
    return undefined
  }

  // The opening tag ends at the first `>` at brace depth 0 (a `>` inside a
  // `fallback={<view/>}` value sits at depth ≥ 1).
  let tagEnd = source.length
  let depth = 0
  for (let i = tagStart; i < source.length; i++) {
    const ch = source[i]
    if (ch === '{') depth++
    else if (ch === '}') depth--
    else if (ch === '>' && depth === 0) {
      tagEnd = i
      break
    }
  }

  const fallbackIdx = source.slice(tagStart, tagEnd).search(/\bfallback\s*=/)
  if (fallbackIdx === -1) {
    return undefined
  }
  const braceStart = source.indexOf('{', tagStart + fallbackIdx)
  if (braceStart === -1 || braceStart >= tagEnd) {
    return undefined
  }
  depth = 0
  for (let i = braceStart; i < source.length; i++) {
    const ch = source[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        return source.slice(braceStart + 1, i)
      }
    }
  }
  return undefined
}

/**
 * Guardrail for the assembled main-thread bundle: a root `<Background>`'s
 * `fallback` is what the 0.0 first screen renders, and with no business code
 * compiled for the main thread a *user component* in that fallback would
 * silently render nothing. Flags a capitalized JSX tag in the fallback so the
 * build can warn.
 *
 * Best-effort by design (regex + brace scan, not a parse): it flags the
 * canonical inline-fallback shape and stays silent on anything it cannot see.
 *
 * @internal
 */
export function rootBackgroundFallbackHasUserComponent(
  source: string,
): boolean {
  const fallback = extractRootBackgroundFallback(source)
  if (fallback === undefined) {
    return false
  }
  return /<\s*[A-Z]/.test(fallback)
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
export function collectEntryImportsByEntry(
  chain: RspackChain,
  rootPath: string,
): Map<string, string[]> {
  const byEntry = new Map<string, string[]>()
  const entryPoints = chain.entryPoints.entries() ?? {}
  for (const [entryName, entryPoint] of Object.entries(entryPoints)) {
    const files: string[] = []
    const add = (item: unknown) => {
      if (typeof item === 'string') {
        files.push(path.resolve(rootPath, item))
      }
    }
    for (const value of entryPoint.values()) {
      if (typeof value === 'string' || Array.isArray(value)) {
        for (const item of Array.isArray(value) ? value : [value]) {
          add(item)
        }
      } else if (value && typeof value === 'object' && 'import' in value) {
        const imports = (value as { import?: string | string[] }).import
        for (const item of Array.isArray(imports) ? imports : [imports]) {
          add(item)
        }
      }
    }
    byEntry.set(entryName, files)
  }
  return byEntry
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
    enableMTSRendering: boolean | 'auto'
    experimental_useElementTemplate: boolean
    enableSSR: boolean
  },
  isProd: boolean,
  chain: RspackChain,
  rootPath: string,
  warn: (message: string) => void = noop,
): boolean {
  if (typeof options.enableMTSRendering === 'boolean') {
    // The explicit switches skip detection entirely. `false` +
    // `experimental_useElementTemplate` is rejected eagerly by
    // `pluginReactLynx` before any hook runs.
    return options.enableMTSRendering
  }
  if (!isProd) {
    return true
  }

  const byEntry = collectEntryImportsByEntry(chain, rootPath)
  const sourcesByEntry = new Map<string, string[]>()
  let detected = false
  for (const [entryName, files] of byEntry) {
    const sources = files
      .map(tryReadFile)
      .filter((source): source is string => source !== undefined)
    sourcesByEntry.set(entryName, sources)
    detected ||= sources.some(sourceHasRootBackground)
  }
  if (!detected) {
    return true
  }

  if (options.experimental_useElementTemplate) {
    warn(
      'A root-level <Background> was detected, but `experimental_useElementTemplate` '
        + 'does not support disabling main-thread rendering yet — keeping the classic build. '
        + 'The <Background> fallback still renders on the main thread at runtime.',
    )
    return true
  }
  if (options.enableSSR) {
    warn(
      'A root-level <Background> was detected, but `enableSSR` '
        + 'does not support disabling main-thread rendering yet — keeping the classic build. '
        + 'The <Background> fallback still renders on the main thread at runtime.',
    )
    return true
  }

  for (const [entryName, sources] of sourcesByEntry) {
    const declaring = sources.filter(sourceHasRootBackground)
    if (declaring.length === 0) {
      // The mode applies to the whole build: an entry without a root
      // <Background> gets an empty first frame (the `fallback={null}`
      // degenerate case) — worth saying out loud under `'auto'`.
      warn(
        `Entry ${
          JSON.stringify(entryName)
        } has no root-level <Background>, but another `
          + `entry turned main-thread rendering off for this build — its first frame will be `
          + `empty until the background hydrates. Add a root <Background fallback={…}> to it, `
          + `or set \`enableMTSRendering: true\` to keep the classic build.`,
      )
      continue
    }
    for (const source of declaring) {
      if (rootBackgroundFallbackHasUserComponent(source)) {
        warn(
          `The root <Background> fallback of entry ${
            JSON.stringify(entryName)
          } `
            + `appears to contain a user component. Business code is not compiled for the `
            + `main thread in this mode, so it would render nothing on the first screen — compose `
            + `the fallback from static host elements (<view>, <text>, …) instead.`,
        )
      }
    }
  }

  return false
}
