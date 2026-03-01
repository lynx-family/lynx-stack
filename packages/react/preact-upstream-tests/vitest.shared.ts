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

const manualSkips = new Set<string>(
  [...skiplist.skip_list, ...skiplist.permanent_skip_list]
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

      while ((match = itPattern.exec(code)) !== null) {
        const itKeyword = match[1]; // 'it' or 'it.only'
        const testName = match[3];
        const fullMatchStart = match.index;

        // Check manual skip lists first
        if (manualSkips.has(testName)) {
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

export function createBaseConfig(name: string): UserConfig {
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
      setupFiles: [path.resolve(__dirname, 'setup.js')],

      include: [
        // Core rendering tests — the most valuable for alignment verification
        'preact/test/browser/render.test.js',
        'preact/test/browser/components.test.js',
        'preact/test/browser/fragments.test.js',
        'preact/test/browser/keys.test.js',
        'preact/test/browser/createContext.test.js',
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
      ],
      // Exclude compat tests (fork deleted handleDomVNode — className→class, onChange→onInput etc.)
      // Exclude debug tests (deferred to v2)
      // Exclude devtools tests (deferred to v2)
    },
  };
}

export { __dirname };
