// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs'

/**
 * A root-level `<Background>` — `root.render(<Background …>…</Background>)` —
 * declares a 0.0 first screen: the whole app's first frame is the static
 * `fallback`, so no component render logic should reach the main thread. That
 * is exactly the condition under which emptying every component body from the
 * main-thread (LEPUS) bundle is safe.
 *
 * We can decide this at compile time by scanning the entry sources: a
 * `<Background>` (imported from `@lynx-js/react`) sitting directly in a
 * `.render(...)` call is the signal. A `<Background>` nested *inside* the app
 * (a partial opt-out) never appears in the entry's `.render(...)`, so it is
 * correctly ignored here.
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
 * An explicit `experimental_stripAllComponents` (the internal switch) always
 * wins. When it is `undefined`, we auto-detect a root-level `<Background>` by
 * reading the given entry files — unreadable paths (bare specifiers, injected
 * runtime entries) are skipped.
 *
 * @internal
 */
export function resolveStripAllComponents(
  explicit: boolean | undefined,
  entryFiles: Iterable<string>,
): boolean {
  if (explicit !== undefined) {
    return explicit
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
