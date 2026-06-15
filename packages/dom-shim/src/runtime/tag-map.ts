// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * HTML→Lynx tag map. See Shim_Design.md §7.4.
 *
 * **OQ-S.8 resolution.** Tag-map version is pinned to `@lynx-js/dom-shim`'s
 * SemVer; breaking tag-map changes (renaming entries, changing lynxFactory)
 * require a major bump. Additions are minor.
 *
 * **OQ-S.2 resolution.** Unmapped tags fall back permissively to `view`
 * with a `data-shim-tag="X"` attribute preserving the original HTML tag
 * for diagnostics and round-trip serialization.
 *
 * The mapping table is stored as JSON at
 * `packages/dom-shim/SPEC/TAG_MAP.json`. To keep the runtime free of JSON
 * IO and to enable `--experimental-strip-types` builds, this module mirrors
 * the table inline below. CI should fail if the two get out of sync (US-441
 * test fixture compares).
 */

/** Which PAPI create function backs a given HTML tag. */
export type LynxFactory =
  | 'view'
  | 'text'
  | 'image'
  | 'scrollView'
  | 'element';

export interface TagMapEntry {
  /** Skipped tags (e.g. `<script>`, `<style>`) are never created. */
  skip?: true;
  /** Optional divergence code logged when a skipped tag is encountered. */
  divergence?: string;
  lynxFactory?: LynxFactory;
  /** When `lynxFactory === 'element'`, passed through as the PAPI tag. */
  rawTag?: string;
  /** Default classes auto-applied at creation for spec-shaped layout. */
  defaultClasses?: string[];
}

/**
 * Versioned tag-map entries. **Keep in sync with SPEC/TAG_MAP.json.**
 * Tests in __tests__/tag-map.test.ts assert parity.
 */
export const TAG_MAP_VERSION = '1';

export const TAG_MAP: Readonly<Record<string, TagMapEntry>> = Object.freeze({
  div: { lynxFactory: 'view' },
  p: { lynxFactory: 'view', defaultClasses: ['shim-p'] },
  span: { lynxFactory: 'text' },
  a: { lynxFactory: 'text', defaultClasses: ['shim-a'] },
  strong: { lynxFactory: 'text', defaultClasses: ['shim-strong'] },
  em: { lynxFactory: 'text', defaultClasses: ['shim-em'] },
  b: { lynxFactory: 'text', defaultClasses: ['shim-b'] },
  i: { lynxFactory: 'text', defaultClasses: ['shim-i'] },
  u: { lynxFactory: 'text', defaultClasses: ['shim-u'] },
  small: { lynxFactory: 'text', defaultClasses: ['shim-small'] },
  h1: { lynxFactory: 'text', defaultClasses: ['shim-h1'] },
  h2: { lynxFactory: 'text', defaultClasses: ['shim-h2'] },
  h3: { lynxFactory: 'text', defaultClasses: ['shim-h3'] },
  h4: { lynxFactory: 'text', defaultClasses: ['shim-h4'] },
  h5: { lynxFactory: 'text', defaultClasses: ['shim-h5'] },
  h6: { lynxFactory: 'text', defaultClasses: ['shim-h6'] },
  button: { lynxFactory: 'view', defaultClasses: ['shim-button'] },
  label: { lynxFactory: 'text', defaultClasses: ['shim-label'] },
  img: { lynxFactory: 'image' },
  picture: { lynxFactory: 'image' },
  input: { lynxFactory: 'element', rawTag: 'input' },
  textarea: { lynxFactory: 'element', rawTag: 'input' },
  select: { lynxFactory: 'view', defaultClasses: ['shim-select'] },
  option: { lynxFactory: 'text', defaultClasses: ['shim-option'] },
  ul: { lynxFactory: 'view', defaultClasses: ['shim-ul'] },
  ol: { lynxFactory: 'view', defaultClasses: ['shim-ol'] },
  li: { lynxFactory: 'view', defaultClasses: ['shim-li'] },
  dl: { lynxFactory: 'view', defaultClasses: ['shim-dl'] },
  dt: { lynxFactory: 'text', defaultClasses: ['shim-dt'] },
  dd: { lynxFactory: 'view', defaultClasses: ['shim-dd'] },
  table: { lynxFactory: 'view', defaultClasses: ['shim-table'] },
  thead: { lynxFactory: 'view', defaultClasses: ['shim-thead'] },
  tbody: { lynxFactory: 'view', defaultClasses: ['shim-tbody'] },
  tfoot: { lynxFactory: 'view', defaultClasses: ['shim-tfoot'] },
  tr: { lynxFactory: 'view', defaultClasses: ['shim-tr'] },
  td: { lynxFactory: 'view', defaultClasses: ['shim-td'] },
  th: { lynxFactory: 'view', defaultClasses: ['shim-th'] },
  form: { lynxFactory: 'view', defaultClasses: ['shim-form'] },
  fieldset: { lynxFactory: 'view', defaultClasses: ['shim-fieldset'] },
  legend: { lynxFactory: 'text', defaultClasses: ['shim-legend'] },
  section: { lynxFactory: 'view', defaultClasses: ['shim-section'] },
  article: { lynxFactory: 'view', defaultClasses: ['shim-article'] },
  header: { lynxFactory: 'view', defaultClasses: ['shim-header'] },
  footer: { lynxFactory: 'view', defaultClasses: ['shim-footer'] },
  main: { lynxFactory: 'view', defaultClasses: ['shim-main'] },
  nav: { lynxFactory: 'view', defaultClasses: ['shim-nav'] },
  aside: { lynxFactory: 'view', defaultClasses: ['shim-aside'] },
  figure: { lynxFactory: 'view', defaultClasses: ['shim-figure'] },
  figcaption: {
    lynxFactory: 'text',
    defaultClasses: ['shim-figcaption'],
  },
  blockquote: {
    lynxFactory: 'view',
    defaultClasses: ['shim-blockquote'],
  },
  pre: { lynxFactory: 'view', defaultClasses: ['shim-pre'] },
  code: { lynxFactory: 'text', defaultClasses: ['shim-code'] },
  kbd: { lynxFactory: 'text', defaultClasses: ['shim-kbd'] },
  samp: { lynxFactory: 'text', defaultClasses: ['shim-samp'] },
  var: { lynxFactory: 'text', defaultClasses: ['shim-var'] },
  br: { lynxFactory: 'text', defaultClasses: ['shim-br'] },
  hr: { lynxFactory: 'view', defaultClasses: ['shim-hr'] },
  view: { lynxFactory: 'view' },
  text: { lynxFactory: 'text' },
  image: { lynxFactory: 'image' },
  'scroll-view': { lynxFactory: 'scrollView' },
  script: { skip: true, divergence: 'shim:L3b/script-skipped' },
  style: { skip: true, divergence: 'shim:L3b/css-style-tag-dropped' },
  link: { skip: true, divergence: 'shim:L3b/external-css-skipped' },
  meta: { skip: true },
  title: { skip: true },
});

/**
 * Lynx tag → preferred HTML tag for spec-shaped `tagName` output. Built
 * lazily by inverting the forward map at first call; the first-mapped
 * HTML tag for each `lynxFactory` wins.
 */
let _reverseCache: Map<string, string> | null = null;

function buildReverseCache(): Map<string, string> {
  const m = new Map<string, string>();
  // Hand-pick spec-shaped defaults; otherwise the first HTML tag in
  // insertion order that maps to each lynx tag wins.
  m.set('view', 'div');
  m.set('text', 'span');
  m.set('image', 'img');
  m.set('input', 'input');
  m.set('scroll-view', 'div');
  m.set('page', 'html');
  m.set('raw-text', '#text');
  return m;
}

export interface HtmlToLynxResult {
  /** PAPI create function. */
  factory: LynxFactory;
  /** When `factory === 'element'`, the tag passed to `__CreateElement`. */
  rawTag?: string;
  defaultClasses?: string[];
}

export type HtmlToLynxOutcome =
  | { kind: 'mapped'; result: HtmlToLynxResult }
  | {
    kind: 'skipped';
    /** Diagnostic code, suitable for `console.warn`. */
    divergence?: string;
  }
  | {
    kind: 'fallback';
    /** Original HTML tag, lower-cased. */
    rawTag: string;
  };

export function htmlToLynx(htmlTag: string): HtmlToLynxOutcome {
  const lower = htmlTag.toLowerCase();
  const entry = TAG_MAP[lower];
  if (entry === undefined) {
    return { kind: 'fallback', rawTag: lower };
  }
  if (entry.skip) {
    return { kind: 'skipped', divergence: entry.divergence };
  }
  return {
    kind: 'mapped',
    result: {
      factory: entry.lynxFactory!,
      rawTag: entry.rawTag,
      defaultClasses: entry.defaultClasses,
    },
  };
}

/**
 * Lynx tag → HTML tag for spec-shaped `tagName`. Returns the Lynx tag's
 * own uppercase form when no canonical HTML reverse exists.
 */
export function lynxToHtml(lynxTag: string): string {
  _reverseCache ??= buildReverseCache();
  return _reverseCache.get(lynxTag) ?? lynxTag;
}
