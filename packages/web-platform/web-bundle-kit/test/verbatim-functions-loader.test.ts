// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, test } from '@rstest/core';

const require = createRequire(import.meta.url);
const loader = require('../scripts/verbatim-functions-loader.cjs') as (
  this: { resourcePath: string },
  source: string,
) => string;

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verbatim-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

/** Writes `source`, runs the loader on it and imports both versions. */
async function load(source: string) {
  const file = path.join(dir, `m${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(file, source);
  const transformed = loader.call({ resourcePath: file }, source);
  const out = `${file}.out.mjs`;
  // What bundling the kit does to an identifier it owns: rename it in the
  // code. The text the loader added only mentions it inside strings.
  const marker = transformed.lastIndexOf('// Added by web-bundle-kit');
  fs.writeFileSync(
    out,
    transformed.slice(0, marker).replaceAll(
      '__webpack_require__',
      '__nested_rspack_require_1_2__',
    ) + transformed.slice(marker),
  );
  const original = (await import(pathToFileURL(file).href)) as Record<
    string,
    unknown
  >;
  const bundled = (await import(pathToFileURL(out).href)) as Record<
    string,
    unknown
  >;
  return { original, bundled };
}

describe('verbatim-functions-loader', () => {
  test('an anonymous default export keeps its published text', async () => {
    const source = [
      'var __webpack_require__ = undefined;',
      'export default function () {',
      '  // a comment',
      '  return __webpack_require__("x");',
      '}',
      '',
    ].join('\n');
    const { original, bundled } = await load(source);
    expect(String(bundled['default'])).toBe(String(original['default']));
    expect(String(bundled['default'])).toContain('__webpack_require__("x")');
  });

  test('named, async and generator functions keep their text', async () => {
    const source = [
      'export function a() { return 1 }',
      'export async function b(x) { return x }',
      'export function* c() { yield 1 }',
      'function d() {}',
      'export default async function () {}',
      'export const e = d;',
      '',
    ].join('\n');
    const { original, bundled } = await load(source);
    for (const name of ['a', 'b', 'c', 'e', 'default']) {
      expect(String(bundled[name])).toBe(String(original[name]));
    }
  });

  test('a module without a top-level function is rejected', () => {
    const file = path.join(dir, 'none.mjs');
    const source = 'export const x = () => 1;\n';
    fs.writeFileSync(file, source);
    expect(() => loader.call({ resourcePath: file }, source)).toThrow(
      /declares no top-level function/,
    );
  });

  test('a module another loader changed is rejected', () => {
    const file = path.join(dir, 'changed.mjs');
    fs.writeFileSync(file, 'export default function () {}\n');
    expect(() =>
      loader.call({ resourcePath: file }, 'export default function () {1}\n')
    ).toThrow(/another loader changed this module/);
  });

  test('the runtimes of chunk-loading-webpack-plugin', async () => {
    const pkg = path.dirname(
      require.resolve('@lynx-js/chunk-loading-webpack-plugin/package.json', {
        paths: [
          path.dirname(
            require.resolve('@lynx-js/rsbuild-plugin/package.json'),
          ),
        ],
      }),
    );
    const file = path.join(pkg, 'lib/runtime/javascript/hmr-runtime.js');
    const source = fs.readFileSync(file, 'utf-8');
    const { original, bundled } = await load(source);
    expect(String(bundled['default'])).toBe(String(original['default']));
    expect(String(bundled['default'])).toContain(
      'currentUpdateRuntime[i](__webpack_require__)',
    );
  });
});
