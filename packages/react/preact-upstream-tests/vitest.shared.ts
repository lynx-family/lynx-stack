// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin, UserConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const preactDir = path.resolve(__dirname, 'preact');

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

const unsupportedFeatures = skiplist.unsupported_features
  .flatMap(({ keywords }) =>
    keywords.map((kw) => ({
      keyword: kw,
      pattern: new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`),
    }))
  );

const commonSkips = new Set<string>(
  [...skiplist.skip_list, ...skiplist.permanent_skip_list]
    .flatMap((entry) => entry.tests),
);

const noCompileSkips = new Set<string>(
  skiplist.nocompile_skip_list
    .flatMap((entry) => entry.tests),
);

const compilerSkips = new Set<string>(
  skiplist.compiler_skip_list
    .flatMap((entry) => entry.tests),
);

// --- Utility functions ---

// Find the closing ')' that matches the opening '(' at position 0 of string s.
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

// Extract the source text of an it() block starting from the '(' after 'it'.
// Returns the full source from '(' to the matching ')'.
function extractItBody(code: string, openParenOffset: number): string | null {
  const closeIdx = findMatchingParen(code.slice(openParenOffset));
  if (closeIdx === -1) return null;
  return code.slice(openParenOffset, openParenOffset + closeIdx + 1);
}

// --- Shared plugins ---

export function pipelineRenderPlugin(): Plugin {
  return {
    name: 'preact-pipeline-render',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('/test/') || id.includes('_util/')) return null;
      if (!id.endsWith('.js') && !id.endsWith('.jsx')) return null;

      if (code.includes('render') && (code.includes('from \'preact\'') || code.includes('from "preact"'))) {
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
            return '__pipelineRender(';
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

// --- SKIPLIST_ONLY mode ---
// Parse SKIPLIST_ONLY env var to determine which skipped tests to run exclusively.
// Format: "category" or "category:groupIndex" (comma-separated for multiple).
// Examples:
//   SKIPLIST_ONLY=skip_list                    — run all tests from skip_list
//   SKIPLIST_ONLY=nocompile_skip_list          — run all tests from nocompile_skip_list
//   SKIPLIST_ONLY=skip_list:0                  — run only the first group in skip_list
//   SKIPLIST_ONLY=skip_list:0,skip_list:1      — run first two groups
//   SKIPLIST_ONLY=unsupported_features:2       — run tests matching dangerouslySetInnerHTML keywords
//   SKIPLIST_ONLY=permanent_skip_list           — run all permanently skipped tests

interface SkiplistOnlySpec {
  /** Set of test names to run (from name-based categories) */
  names: Set<string>;
  /** Keyword patterns to match in test bodies (from unsupported_features) */
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
    const groupIdx = colonIdx === -1 ? undefined : Number.parseInt(trimmed.slice(colonIdx + 1), 10);

    if (category === 'unsupported_features') {
      const entries = groupIdx === undefined
        ? skiplist.unsupported_features
        : [skiplist.unsupported_features[groupIdx]!];
      for (const entry of entries) {
        for (const kw of entry.keywords) {
          keywords.push({
            keyword: kw,
            pattern: new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`),
          });
        }
      }
    } else {
      const list =
        skiplist[category as 'skip_list' | 'nocompile_skip_list' | 'permanent_skip_list' | 'compiler_skip_list'];
      if (!list) {
        throw new Error(
          `SKIPLIST_ONLY: unknown category "${category}". `
            + `Valid: unsupported_features, skip_list, nocompile_skip_list, permanent_skip_list, compiler_skip_list`,
        );
      }
      const entries = groupIdx === undefined ? list : [list[groupIdx]!];
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

export function skiplistPlugin(projectName?: string): Plugin {
  const isCompiled = projectName === 'preact-upstream-compiled';
  return {
    name: 'preact-skiplist',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('/test/') || id.includes('_util/')) return null;
      if (!id.endsWith('.js') && !id.endsWith('.jsx')) return null;

      let transformed = code;
      let changed = false;

      // Process it( and it.only( calls — rewrite to it.skip( when matched.
      // Regex matches: it('name' or it("name" or it.only('name' etc.
      const itPattern = /\b(it(?:\.only)?)\s*\(\s*(['"`])((?:(?!\2).)*)\2/g;
      let match;
      const replacements: Array<{ start: number; end: number; replacement: string }> = [];

      if (skiplistOnlySpec) {
        // --- SKIPLIST_ONLY mode: only run specified skipped tests ---
        while ((match = itPattern.exec(code)) !== null) {
          const itKeyword = match[1]; // 'it' or 'it.only'
          const testName = match[3];
          const fullMatchStart = match.index;

          // Check if this test is in the "only" set
          let shouldRun = false;

          // Check name-based match
          if (skiplistOnlySpec.names.has(testName)) {
            shouldRun = true;
          }

          // Check keyword-based match (unsupported_features)
          if (!shouldRun && skiplistOnlySpec.keywords.length > 0) {
            const openParen = code.indexOf('(', fullMatchStart + itKeyword.length);
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

          // Skip tests that are NOT in the "only" set
          if (!shouldRun) {
            replacements.push({
              start: fullMatchStart,
              end: fullMatchStart + itKeyword.length,
              replacement: 'it.skip',
            });
          }
        }
      } else {
        // --- Normal mode: skip tests that are in skip lists ---
        while ((match = itPattern.exec(code)) !== null) {
          const itKeyword = match[1]; // 'it' or 'it.only'
          const testName = match[3];
          const fullMatchStart = match.index;

          // Check manual skip lists first
          if (commonSkips.has(testName)) {
            replacements.push({
              start: fullMatchStart,
              end: fullMatchStart + itKeyword.length,
              replacement: 'it.skip',
            });
            continue;
          }

          // Check no-compile-specific skip list
          if (!isCompiled && noCompileSkips.has(testName)) {
            replacements.push({
              start: fullMatchStart,
              end: fullMatchStart + itKeyword.length,
              replacement: 'it.skip',
            });
            continue;
          }

          // Check compiler-specific skip list (only in compiled mode)
          if (isCompiled && compilerSkips.has(testName)) {
            replacements.push({
              start: fullMatchStart,
              end: fullMatchStart + itKeyword.length,
              replacement: 'it.skip',
            });
            continue;
          }

          // Check keyword-based unsupported features by scanning the it() body
          const openParen = code.indexOf('(', fullMatchStart + itKeyword.length);
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

      // Apply replacements in reverse order to preserve offsets
      for (const r of replacements.reverse()) {
        transformed = transformed.slice(0, r.start) + r.replacement + transformed.slice(r.end);
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

export function createBaseConfig(name: string, options?: { setupFile?: string }): UserConfig {
  const setupFile = options?.setupFile ?? 'setup-nocompile.js';
  return {
    esbuild: {
      // Treat .js files as JSX (upstream tests use /** @jsx createElement */ pragma)
      loader: 'jsx',
      include: /.*\.js$/,
      exclude: ['node_modules'],
      jsx: 'transform',
      jsxFactory: 'createElement',
      jsxFragment: 'Fragment',
    },
    resolve: {
      alias: [
        // Map preact bare specifiers to fork source (from submodule)
        // Order matters: more specific paths must come before less specific ones.
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
    plugins: [
      pipelineRenderPlugin(),
      skiplistPlugin(name),
    ],
    test: {
      name,
      globals: true,
      environment: 'jsdom',
      setupFiles: [path.resolve(__dirname, setupFile)],

      include: [
        // Core rendering tests — the most valuable for alignment verification
        'preact/test/browser/render.test.js',
        'preact/test/browser/components.test.js',
        'preact/test/browser/fragments.test.js',
        'preact/test/browser/keys.test.js',
        'preact/test/browser/createContext.test.js',

        // Lifecycle methods
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

        // Utilities and additional browser tests
        'preact/test/browser/spec.test.js',
        'preact/test/browser/cloneElement.test.js',
        'preact/test/browser/isValidElement.test.js',
        'preact/test/browser/toChildArray.test.js',
        'preact/test/browser/placeholders.test.js',
        'preact/test/browser/events.test.js',
        'preact/test/browser/focus.test.js',

        // Hooks
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
        // PAPI: no createElementNS — SVG/MathML namespace tests fail
        'preact/test/browser/svg.test.js',
        'preact/test/browser/mathml.test.js',
        'preact/test/browser/customBuiltInElements.test.js',
        // Missing dep: preact-render-to-string (deferred to v2)
        'preact/hooks/test/browser/useId.test.js',
        // JSDOM: CSSStyleDeclaration.setProperty behavior differs from browsers
        'preact/test/browser/style.test.js',
        // Preact internals: accesses _children VNode attachment on DOM nodes, not pipeline-compatible
        'preact/test/browser/getDomSibling.test.js',
        // replaceNode (3rd render() param): pre-populated DOM + internal _children state, web-specific
        'preact/test/browser/replaceNode.test.js',
        // refs: ~17/26 fail in both modes — BSI refs vs DOM nodes (tracked in skip_list)
        // Deferred until BSI ref bridging is implemented
        'preact/test/browser/refs.test.js',
      ],
      // Exclude compat tests (fork deleted handleDomVNode — className→class, onChange→onInput etc.)
      // Exclude debug tests (deferred to v2)
      // Exclude devtools tests (deferred to v2)
    },
  };
}

export { __dirname };
