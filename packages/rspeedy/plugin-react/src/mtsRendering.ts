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

// `<Background>` at the root of a `.render(` call (`root.render(...)`,
// `createRoot().render(...)`, …). Host-element wrappers are allowed in
// between — `root.render(<page><Background …>…</page>)` is the idiomatic
// shape — and only those: a JSX name starting with a lowercase letter is a
// host element by the JSX rules, while a *component* wrapper would mean the
// boundary is not statically at the root and must not be detected.
const ROOT_BACKGROUND_RENDER_RE =
  /\.render\(\s*(?:<[a-z][\w.-]*(?:\s[^>]*)?>\s*)*<Background[\s/>]/

// The opt-in twin, matched the same way. `<MainThread>` at the render root
// says the wrapped island — and only it — is the main thread's first frame,
// which is the same whole-program statement a root `<Background>` makes from
// the other end: no business code needs to be compiled for the main thread
// except what the boundary names.
const MAIN_THREAD_IMPORT_RE =
  /import[^{}]*\{[^}]*\bMainThread\b[^}]*\}\s*from\s*['"]@lynx-js\/react(?:\/[^'"]*)?['"]/

const ROOT_MAIN_THREAD_RENDER_RE =
  /\.render\(\s*(?:<[a-z][\w.-]*(?:\s[^>]*)?>\s*)*<MainThread[\s/>]/

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
 * Whether a single entry's source declares a root-level `<MainThread>` — the
 * island that is the first frame.
 *
 * @internal
 */
export function sourceHasRootMainThread(source: string): boolean {
  return MAIN_THREAD_IMPORT_RE.test(source)
    && ROOT_MAIN_THREAD_RENDER_RE.test(source)
}

/**
 * Whether a single entry's source declares either root-level first-screen
 * boundary. Both mean the same thing to the build: this entry is compiled for
 * the main thread, and what it renders there is what the boundary names — a
 * `<Background>`'s fallback, or a `<MainThread>`'s island.
 *
 * @internal
 */
export function sourceHasRootBoundary(source: string): boolean {
  return sourceHasRootBackground(source) || sourceHasRootMainThread(source)
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
function addEntryImport(
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
          addEntryImport(files, rootPath, item)
        }
      } else if (value && typeof value === 'object' && 'import' in value) {
        const imports = (value as { import?: string | string[] }).import
        for (const item of Array.isArray(imports) ? imports : [imports]) {
          addEntryImport(files, rootPath, item)
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
export function entriesDeclaringRootBoundary(
  chain: RspackChain,
  rootPath: string,
): Set<string> {
  const declaring = new Set<string>()
  for (
    const [entryName, files] of collectEntryImportsByEntry(chain, rootPath)
  ) {
    for (const file of files) {
      const source = tryReadFile(file)
      if (source !== undefined && sourceHasRootBoundary(source)) {
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
      .map((file) => tryReadFile(file))
      .filter((source): source is string => source !== undefined)
    sourcesByEntry.set(entryName, sources)
    detected ||= sources.some((source) => sourceHasRootBoundary(source))
  }
  if (!detected) {
    return true
  }

  if (options.experimental_useElementTemplate) {
    warn(
      'A root-level first-screen boundary was detected, but `experimental_useElementTemplate` '
        + 'does not support disabling main-thread rendering yet — keeping the classic build. '
        + 'The boundary still renders on the main thread at runtime.',
    )
    return true
  }
  if (options.enableSSR) {
    warn(
      'A root-level first-screen boundary was detected, but `enableSSR` '
        + 'does not support disabling main-thread rendering yet — keeping the classic build. '
        + 'The boundary still renders on the main thread at runtime.',
    )
    return true
  }

  for (const [entryName, sources] of sourcesByEntry) {
    if (!sources.some((source) => sourceHasRootBoundary(source))) {
      // The mode applies to the whole build: an entry without a root
      // <Background> gets an empty first frame (the `fallback={null}`
      // degenerate case) — worth saying out loud under `'auto'`.
      warn(
        `Entry ${
          JSON.stringify(entryName)
        } has no root-level <Background> or <MainThread>, but another `
          + `entry turned main-thread rendering off for this build — its first frame will be `
          + `empty until the background hydrates. Add a root <Background fallback={…}> to it, `
          + `or set \`enableMTSRendering: true\` to keep the classic build.`,
      )
    }
  }

  return false
}
