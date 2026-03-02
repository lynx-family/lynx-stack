// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin, UserConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The preact fork submodule lives in the react package.
// We reference it by relative path to avoid maintaining a second submodule.
const preactDir = path.resolve(
  __dirname,
  '../../react/preact-upstream-tests/preact',
);

if (!existsSync(path.join(preactDir, 'src/index.js'))) {
  throw new Error(
    'Preact submodule not initialized.\n'
      + 'Run: pnpm --filter @lynx-js/preact-upstream-tests run preact:init',
  );
}

// --- Skiplist parsing ---

interface SkiplistEntry {
  tests: string[];
  comment?: string;
}

interface UnsupportedFeatureEntry {
  keywords: string[];
  comment: string;
}

interface Skiplist {
  unsupported_features: UnsupportedFeatureEntry[];
  skip_list: SkiplistEntry[];
  nocompile_skip_list: SkiplistEntry[];
  permanent_skip_list: SkiplistEntry[];
  compiler_skip_list: SkiplistEntry[];
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const skiplist: Skiplist = JSON.parse(
  readFileSync(path.resolve(__dirname, 'skiplist.json'), 'utf-8'),
);

const unsupportedFeatures = skiplist.unsupported_features.flatMap(
  ({ keywords }) =>
    keywords.map((kw) => ({
      keyword: kw,
      pattern: new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`),
    })),
);

const commonSkips = new Set<string>(
  [...skiplist.skip_list, ...skiplist.permanent_skip_list].flatMap(
    (entry) => entry.tests,
  ),
);

// --- Utility ---

function findMatchingParen(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function extractItBody(code: string, openParenOffset: number): string | null {
  const closeIdx = findMatchingParen(code.slice(openParenOffset));
  if (closeIdx === -1) return null;
  return code.slice(openParenOffset, openParenOffset + closeIdx + 1);
}

// --- SKIPLIST_ONLY mode (same interface as react package for consistency) ---

interface SkiplistOnlySpec {
  names: Set<string>;
  keywords: Array<{ keyword: string; pattern: RegExp }>;
}

function parseSkiplistOnly(): SkiplistOnlySpec | null {
  const envVal = process.env['SKIPLIST_ONLY'];
  if (!envVal) return null;

  const names = new Set<string>();
  const keywords: SkiplistOnlySpec['keywords'] = [];

  for (const part of envVal.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const colonIdx = trimmed.indexOf(':');
    const category = colonIdx === -1 ? trimmed : trimmed.slice(0, colonIdx);
    const groupIdx = colonIdx === -1
      ? undefined
      : parseInt(trimmed.slice(colonIdx + 1), 10);

    if (category === 'unsupported_features') {
      const entries = groupIdx !== undefined
        ? [skiplist.unsupported_features[groupIdx]!]
        : skiplist.unsupported_features;
      for (const entry of entries) {
        for (const kw of entry.keywords) {
          keywords.push({
            keyword: kw,
            pattern: new RegExp(
              `\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
            ),
          });
        }
      }
    } else {
      const list = skiplist[
        category as
          | 'skip_list'
          | 'nocompile_skip_list'
          | 'permanent_skip_list'
          | 'compiler_skip_list'
      ];
      if (!list) {
        throw new Error(
          `SKIPLIST_ONLY: unknown category "${category}". `
            + `Valid: unsupported_features, skip_list, permanent_skip_list`,
        );
      }
      const entries = groupIdx !== undefined ? [list[groupIdx]!] : list;
      for (const entry of entries) {
        for (const t of entry.tests) {
          names.add(t);
        }
      }
    }
  }

  return { names, keywords };
}

const skiplistOnlySpec = parseSkiplistOnly();

// --- Lynx render plugin ---
// Rewrites render( → __lynxRender( in test files so that Preact renders
// through our LynxDocument/LynxElement PAPI adapter (defined in setup.js)
// instead of the browser DOM.
//
// This is analogous to pipelineRenderPlugin in packages/react/preact-upstream-tests,
// but targets the main-thread direct renderer instead of the dual-thread pipeline.

export function lynxRenderPlugin(): Plugin {
  return {
    name: 'preact-lynx-render',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('/test/') || id.includes('_util/')) return null;
      if (!id.endsWith('.js') && !id.endsWith('.jsx')) return null;

      if (
        code.includes('render')
        && (code.includes('from \'preact\'') || code.includes('from "preact"'))
      ) {
        const transformed = code.replace(
          /\brender\s*\(/g,
          (match, offset) => {
            // Skip if part of another word (rerender, prerender, etc.)
            if (offset > 0 && /\w/.test(code[offset - 1])) return match;
            // Skip property access: .render(
            if (offset > 0 && code[offset - 1] === '.') return match;
            // Skip method definitions: render() { or render(props) {
            const afterRender = code.slice(offset + match.length - 1);
            const closeIdx = findMatchingParen(afterRender);
            if (closeIdx !== -1) {
              const afterClose = afterRender.slice(closeIdx + 1).trimStart();
              if (afterClose.startsWith('{')) return match;
            }
            return '__lynxRender(';
          },
        );
        if (transformed !== code) {
          return { code: transformed, map: null };
        }
      }
      return null;
    },
  };
}

// --- Skiplist plugin ---

export function skiplistPlugin(): Plugin {
  return {
    name: 'preact-skiplist',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('/test/') || id.includes('_util/')) return null;
      if (!id.endsWith('.js') && !id.endsWith('.jsx')) return null;

      let transformed = code;
      let changed = false;

      const itPattern = /\b(it(?:\.only)?)\s*\(\s*(['"`])((?:(?!\2).)*)\2/g;
      let match;
      const replacements: Array<{
        start: number;
        end: number;
        replacement: string;
      }> = [];

      if (skiplistOnlySpec) {
        while ((match = itPattern.exec(code)) !== null) {
          const itKeyword = match[1]!;
          const testName = match[3]!;
          const fullMatchStart = match.index;

          let shouldRun = skiplistOnlySpec.names.has(testName);

          if (!shouldRun && skiplistOnlySpec.keywords.length > 0) {
            const openParen = code.indexOf(
              '(',
              fullMatchStart + itKeyword.length,
            );
            if (openParen !== -1) {
              const body = extractItBody(code, openParen);
              if (body) {
                for (const { pattern } of skiplistOnlySpec.keywords) {
                  if (pattern.test(body)) {
                    shouldRun = true;
                    break;
                  }
                }
              }
            }
          }

          if (!shouldRun) {
            replacements.push({
              start: fullMatchStart,
              end: fullMatchStart + itKeyword.length,
              replacement: 'it.skip',
            });
          }
        }
      } else {
        while ((match = itPattern.exec(code)) !== null) {
          const itKeyword = match[1]!;
          const testName = match[3]!;
          const fullMatchStart = match.index;

          if (commonSkips.has(testName)) {
            replacements.push({
              start: fullMatchStart,
              end: fullMatchStart + itKeyword.length,
              replacement: 'it.skip',
            });
            continue;
          }

          const openParen = code.indexOf(
            '(',
            fullMatchStart + itKeyword.length,
          );
          if (openParen === -1) continue;
          const body = extractItBody(code, openParen);
          if (!body) continue;

          for (const { pattern } of unsupportedFeatures) {
            if (pattern.test(body)) {
              replacements.push({
                start: fullMatchStart,
                end: fullMatchStart + itKeyword.length,
                replacement: 'it.skip',
              });
              break;
            }
          }
        }
      }

      for (const r of replacements.reverse()) {
        transformed = transformed.slice(0, r.start)
          + r.replacement
          + transformed.slice(r.end);
        changed = true;
      }

      if (changed) {
        return { code: transformed, map: null };
      }
      return null;
    },
  };
}

// --- Shared config factory ---

export function createBaseConfig(): UserConfig {
  return {
    esbuild: {
      // Upstream tests use /** @jsx createElement */ pragma
      loader: 'jsx',
      include: /.*\.js$/,
      exclude: ['node_modules'],
      jsx: 'transform',
      jsxFactory: 'createElement',
      jsxFragment: 'Fragment',
    },
    resolve: {
      alias: [
        // Map preact bare specifiers to the forked source in the react submodule.
        // More specific paths must come before less specific ones.
        {
          find: /^preact\/hooks$/,
          replacement: path.join(preactDir, 'hooks/src/index.js'),
        },
        {
          find: /^preact\/test-utils$/,
          replacement: path.join(preactDir, 'test-utils/src/index.js'),
        },
        {
          find: /^preact\/compat$/,
          replacement: path.join(preactDir, 'compat/src/index.js'),
        },
        {
          find: /^preact\/debug$/,
          replacement: path.join(preactDir, 'debug/src/index.js'),
        },
        {
          find: /^preact\/devtools$/,
          replacement: path.join(preactDir, 'devtools/src/index.js'),
        },
        {
          find: /^preact\/jsx-runtime$/,
          replacement: path.join(preactDir, 'jsx-runtime/src/index.js'),
        },
        {
          find: /^preact$/,
          replacement: path.join(preactDir, 'src/index.js'),
        },
      ],
    },
    plugins: [lynxRenderPlugin(), skiplistPlugin()],
    test: {
      name: 'preact-main-thread',
      globals: true,
      environment: 'jsdom',
      setupFiles: [path.resolve(__dirname, 'setup.js')],

      include: [
        // --- Core rendering ---
        'preact/test/browser/render.test.js',
        'preact/test/browser/components.test.js',
        'preact/test/browser/fragments.test.js',
        'preact/test/browser/keys.test.js',
        'preact/test/browser/createContext.test.js',

        // --- Refs: now fully enabled ---
        // In the react package, refs.test.js was excluded because ref.current
        // returns a BSI (BackgroundSnapshotInstance), not a DOM node. Here,
        // Preact renders directly in jsdom, so refs return real DOM nodes.
        'preact/test/browser/refs.test.js',

        // --- Events ---
        // In the react package these were excluded due to Lynx's distinct event model.
        // In direct jsdom rendering, addEventListener/removeEventListener work natively.
        'preact/test/browser/events.test.js',

        // --- Focus ---
        // jsdom has basic focus support (activeElement, focus(), blur()).
        // Not all tests may pass (layout-dependent ones won't), but many will.
        'preact/test/browser/focus.test.js',

        // --- Other browser utilities ---
        'preact/test/browser/spec.test.js',
        'preact/test/browser/cloneElement.test.js',
        'preact/test/browser/isValidElement.test.js',
        'preact/test/browser/toChildArray.test.js',
        'preact/test/browser/placeholders.test.js',

        // --- All lifecycle methods ---
        'preact/test/browser/lifecycles/lifecycle.test.js',
        'preact/test/browser/lifecycles/componentDidCatch.test.js',
        'preact/test/browser/lifecycles/getDerivedStateFromError.test.js',
        'preact/test/browser/lifecycles/getDerivedStateFromProps.test.js',
        'preact/test/browser/lifecycles/getSnapshotBeforeUpdate.test.js',
        'preact/test/browser/lifecycles/shouldComponentUpdate.test.js',
        'preact/test/browser/lifecycles/componentDidMount.test.js',
        'preact/test/browser/lifecycles/componentDidUpdate.test.js',
        'preact/test/browser/lifecycles/componentWillMount.test.js',
        'preact/test/browser/lifecycles/componentWillUnmount.test.js',
        'preact/test/browser/lifecycles/componentWillUpdate.test.js',
        'preact/test/browser/lifecycles/componentWillReceiveProps.test.js',

        // --- All hooks ---
        'preact/hooks/test/browser/useState.test.js',
        'preact/hooks/test/browser/useEffect.test.js',
        'preact/hooks/test/browser/useContext.test.js',
        'preact/hooks/test/browser/useReducer.test.js',
        'preact/hooks/test/browser/useCallback.test.js',
        'preact/hooks/test/browser/useMemo.test.js',
        'preact/hooks/test/browser/useRef.test.js',
        'preact/hooks/test/browser/useLayoutEffect.test.js',
        'preact/hooks/test/browser/useImperativeHandle.test.js',
        'preact/hooks/test/browser/combinations.test.js',
        'preact/hooks/test/browser/errorBoundary.test.js',
        'preact/hooks/test/browser/componentDidCatch.test.js',
      ],

      exclude: [
        // JSDOM: CSSStyleDeclaration.setProperty behavior differs from browsers
        'preact/test/browser/style.test.js',

        // Namespace elements (SVG/MathML/custom): deferred
        'preact/test/browser/svg.test.js',
        'preact/test/browser/mathml.test.js',
        'preact/test/browser/customBuiltInElements.test.js',

        // Missing dep: preact-render-to-string
        'preact/hooks/test/browser/useId.test.js',

        // Deferred: SSR hydration
        'preact/test/browser/hydrate.test.js',

        // Deferred: select element specifics
        'preact/test/browser/select.test.js',

        // Deferred: debug value display
        'preact/hooks/test/browser/useDebugValue.test.js',

        // Deferred: options hook internals
        'preact/hooks/test/browser/hooks.options.test.js',

        // PAPI incompatibility: getDomSibling.test.js compares vnode._dom
        // (which is a LynxElement) against raw jsdom elements — they won't match.
        'preact/test/browser/getDomSibling.test.js',

        // PAPI incompatibility: replaceNode passes a raw jsdom element as the
        // 3rd render() arg but Preact now tracks LynxElement nodes internally.
        'preact/test/browser/replaceNode.test.js',
      ],
    },
  };
}

export { __dirname };
