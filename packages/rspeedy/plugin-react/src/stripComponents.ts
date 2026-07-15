// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs'

/**
 * A root-level `<Background>` — `root.render(<Background …>…</Background>)` —
 * declares a 0.0 first screen: the whole app's first frame is the static
 * `fallback`, so no component render logic needs to *run* on the main thread.
 * That is the condition under which emptying every component body from the
 * main-thread (LEPUS) bundle is safe.
 *
 * The runtime half of that declaration is always on — the boundary renders
 * the `fallback` on the main thread with no build support. The compile-time
 * half (the whole-program strip) is an *opt-in*: `'auto'` lights it up when a
 * root-level `<Background>` is detected in the entry sources, `true` forces
 * it. A `<Background>` nested *inside* the app (a partial opt-out) never
 * appears in the entry's `.render(...)`, so detection correctly ignores it.
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
 * Resolve whether the main thread should strip every component render body.
 *
 * - `true` — force the strip (the internal switch; e.g. for an entry shape
 *   the detection cannot see).
 * - `'auto'` — strip when an entry declares a root-level `<Background>`,
 *   detected by reading the given entry files. Unreadable paths (bare
 *   specifiers, injected runtime entries) are skipped.
 * - `false` / `undefined` (the default) — never strip. A root-level
 *   `<Background>` still yields a 0.0 first screen at runtime (the fallback
 *   is all that renders); every module stays in the main-thread bundle.
 *
 * @internal
 */
export function resolveStripAllComponents(
  explicit: boolean | 'auto' | undefined,
  entryFiles: Iterable<string>,
): boolean {
  if (explicit === true) {
    return true
  }
  if (explicit !== 'auto') {
    return false
  }

  for (const file of entryFiles) {
    let source: string
    try {
      source = fs.readFileSync(file, 'utf8')
    } catch {
      // Not a readable local file (e.g. a bare specifier or a virtual entry).
      continue
    }
    if (sourceHasRootBackground(source)) {
      return true
    }
  }

  return false
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
 * Guardrail for the strip: a root `<Background>`'s `fallback` is what the 0.0
 * first screen renders, and with every component body emptied from the
 * main-thread bundle a *user component* in that fallback would silently render
 * nothing. Flags a capitalized JSX tag in the fallback so the build can warn.
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
