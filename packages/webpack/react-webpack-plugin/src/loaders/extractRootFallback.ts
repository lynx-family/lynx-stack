// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Best-effort extraction of the snapshot id a root-level first-screen
 * boundary — `<Background>` or `<MainThread>` — declares as its static
 * `fallback`, from the *transformed* background output of an entry module.
 *
 * By the time this runs, the snapshot transform has already replaced the
 * fallback's JSX with a reference to its hoisted definition:
 *
 * ```js
 * root.render(_jsx(Background, {
 *   fallback: _jsx(__snapshot_e540c_index_1, {}),
 *   children: _jsx(App, {}),
 * }));
 * ```
 *
 * The definition itself travels to the main thread through the MTS defines
 * channel (it is produced by the same background compilation), so naming its
 * id is all the main-thread entry needs to render the fallback pre-hydration.
 *
 * Extraction is intentionally strict: only a fallback that compiled into a
 * *single, fully static* snapshot (`_jsx(__snapshot_…, {})` — no `values`, no
 * dynamic children) is accepted. Anything else degrades to no fallback (an
 * empty first frame, today's `enableMTSRendering: false` behavior) and is
 * reported through `warning` so the build can say why.
 */

// A root boundary sitting directly inside a `.render(...)` call, compiled to
// the automatic JSX runtime. The raw-source detection in the rsbuild plugin
// only matches a non-aliased import, and the transform preserves the
// identifier, so the names are matched literally here as well.
//
// `<MainThread>` is the opt-in twin of `<Background>`: it declares an island
// as the first frame, and its `fallback` is what paints when the island did
// not make it into the main-thread bundle. Both take the same static
// `fallback`, so both are extracted the same way.
const ROOT_BOUNDARY_RENDER_RE =
  /\.render\(\s*(?:\/\*#__PURE__\*\/\s*)?_jsxs?\((?:Background|MainThread),\s*\{/g;

const FALLBACK_SNAPSHOT_RE =
  /^fallback:\s*(?:\/\*#__PURE__\*\/\s*)?_jsxs?\(\s*(__snapshot_[\w$]+)\s*,\s*\{\s*\}\s*[,)]/;

export interface RootFallback {
  /**
   * The snapshot id of the static fallback, when the entry declares one this
   * extraction can prove static.
   */
  id?: string | undefined;

  /**
   * Why a declared `fallback` was not usable, when it was declared but did
   * not compile into a single static snapshot.
   */
  warning?: string | undefined;
}

/**
 * Scan the props object of the root boundary for a top-level
 * `fallback:` property and classify its value.
 *
 * Returns `undefined` when the module has no root boundary at all.
 */
export function extractRootFallback(
  code: string,
): RootFallback | undefined {
  ROOT_BOUNDARY_RENDER_RE.lastIndex = 0;
  const render = ROOT_BOUNDARY_RENDER_RE.exec(code);
  if (!render) {
    return undefined;
  }

  // Position of the `{` opening the props object.
  const propsStart = render.index + render[0].length - 1;

  // Walk the props object and stop at a top-level `fallback:` key. Depth is
  // tracked across `{}`, `[]` and `()` so nested props (e.g. a `children`
  // array that comes first) are skipped; string literals are skipped so
  // braces inside text content cannot unbalance the walk.
  let depth = 0;
  for (let i = propsStart; i < code.length; i++) {
    const ch = code[i]!;
    if (ch === '"' || ch === '\'' || ch === '`') {
      for (i++; i < code.length; i++) {
        if (code[i] === '\\') {
          i++;
        } else if (code[i] === ch) {
          break;
        }
      }
      continue;
    }
    if (ch === '{' || ch === '[' || ch === '(') {
      depth++;
      continue;
    }
    if (ch === '}' || ch === ']' || ch === ')') {
      depth--;
      if (depth === 0) {
        // End of the props object: no `fallback` prop at all. That is the
        // documented `fallback={null}` degenerate case — nothing to warn on.
        return {};
      }
      continue;
    }
    if (
      depth === 1 && code.startsWith('fallback:', i)
      // A property key, not the tail of a longer identifier.
      && /[{,\s]/.test(code[i - 1]!)
    ) {
      const value = code.slice(i);
      const match = FALLBACK_SNAPSHOT_RE.exec(value);
      if (match) {
        return { id: match[1]! };
      }
      return {
        warning:
          'The root first-screen boundary\'s `fallback` did not compile into a single static snapshot, '
          + 'so it will not be rendered as the pre-hydration first frame. '
          + 'Compose the fallback from static host elements (<view>, <text>, …) '
          + 'with literal attributes — no user components, no dynamic expressions.',
      };
    }
  }

  return {};
}
