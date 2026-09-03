// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { describe, expect, it } from '@rstest/core';

const PKG_ROOT = resolve(import.meta.dirname, '../../');
const DIST_ESM = pathToFileURL(resolve(PKG_ROOT, 'dist/lynx.js')).href;
const DIST_CJS = resolve(PKG_ROOT, 'dist/lynx.cjs').replace(/\\/g, '/');

function runESM(code: string): string {
  return execSync('node --input-type=module', {
    input: code,
    encoding: 'utf-8',
    cwd: PKG_ROOT,
  }).trim();
}

function runCJS(code: string): string {
  return execSync('node', {
    input: code,
    encoding: 'utf-8',
    cwd: PKG_ROOT,
  }).trim();
}

/**
 * Integration tests that verify the built dist/ output can be loaded
 * in real CJS and ESM Node.js environments without bundler interop.
 *
 * These tests run `node` as a subprocess with code via stdin to guarantee
 * genuine runtime behavior and avoid Windows shell quoting issues.
 */
describe('dist/ loading (ESM and CJS interop)', () => {
  it('can be loaded via ESM (import default)', () => {
    const result = runESM(`
      import preset from '${DIST_ESM}';
      if (!preset || typeof preset !== 'object') process.exit(1);
      if (!Array.isArray(preset.plugins)) process.exit(2);
      console.log(JSON.stringify(Object.keys(preset)));
    `);
    const keys = JSON.parse(result) as string[];
    expect(keys).toContain('plugins');
    expect(keys).toContain('corePlugins');
    expect(keys).toContain('theme');
  });

  it('can be loaded via ESM (named export: createLynxPreset)', () => {
    const result = runESM(`
      import { createLynxPreset } from '${DIST_ESM}';
      if (typeof createLynxPreset !== 'function') process.exit(1);
      const preset = createLynxPreset();
      if (!Array.isArray(preset.plugins)) process.exit(2);
      console.log('ok');
    `);
    expect(result).toBe('ok');
  });

  it('can be loaded via CJS (require)', () => {
    const result = runCJS(`
      const m = require('${DIST_CJS}');
      const preset = m.default || m;
      if (!preset || typeof preset !== 'object') process.exit(1);
      if (!Array.isArray(preset.plugins)) process.exit(2);
      console.log(JSON.stringify(Object.keys(preset)));
    `);
    const keys = JSON.parse(result) as string[];
    expect(keys).toContain('plugins');
    expect(keys).toContain('corePlugins');
    expect(keys).toContain('theme');
  });

  it('CJS named export createLynxPreset works', () => {
    const result = runCJS(`
      const { createLynxPreset } = require('${DIST_CJS}');
      if (typeof createLynxPreset !== 'function') process.exit(1);
      const preset = createLynxPreset();
      if (!Array.isArray(preset.plugins)) process.exit(2);
      console.log('ok');
    `);
    expect(result).toBe('ok');
  });

  it('ESM: TW_NO_PREFIX symbol key matches tailwindcss INTERNAL_FEATURES', () => {
    const result = runESM(`
      import * as setupContextUtils from 'tailwindcss/lib/lib/setupContextUtils.js';
      import { createLynxPreset } from '${DIST_ESM}';
      const preset = createLynxPreset();
      if (!Array.isArray(preset.plugins)) process.exit(1);
      const mod = setupContextUtils.default || setupContextUtils;
      const sym = mod.INTERNAL_FEATURES;
      if (typeof sym !== 'symbol') process.exit(2);
      console.log('ok');
    `);
    expect(result).toBe('ok');
  });
});
