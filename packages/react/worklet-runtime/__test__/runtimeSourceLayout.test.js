// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reactPackagesDir = path.resolve(__dirname, '..', '..');
const reactPackageJsonPath = path.join(reactPackagesDir, 'package.json');
const workletRuntimePackageJsonPath = path.join(
  reactPackagesDir,
  'worklet-runtime',
  'package.json',
);
const runtimeWorkletRuntimeDir = path.join(
  reactPackagesDir,
  'runtime',
  'src',
  'worklet-runtime',
);

describe('runtime-local worklet-runtime source layout', () => {
  test('stores the real implementation under runtime/src/worklet-runtime', () => {
    const expectedFiles = [
      'index.ts',
      path.join('bindings', 'index.ts'),
      path.join('api', 'lynxApi.ts'),
      'workletRuntime.ts',
    ];

    for (const file of expectedFiles) {
      expect(fs.existsSync(path.join(runtimeWorkletRuntimeDir, file))).toBe(true);
    }
  });

  test('keeps the shell package focused on dist-only worklet bundle outputs', () => {
    const workletRuntimePackageJson = JSON.parse(
      fs.readFileSync(workletRuntimePackageJsonPath, 'utf8'),
    );

    expect(workletRuntimePackageJson.exports['.']).toEqual({
      default: './dist/main.js',
    });
    expect(workletRuntimePackageJson.exports['./dev']).toEqual({
      default: './dist/dev.js',
    });
    expect(workletRuntimePackageJson.main).toBe('dist/main.js');
    expect(workletRuntimePackageJson.module).toBe('dist/main.js');
    expect(
      fs.existsSync(path.join(reactPackagesDir, 'worklet-runtime', 'src')),
    ).toBe(false);
  });

  test('preserves the public worklet-runtime export targets on @lynx-js/react', () => {
    const reactPackageJson = JSON.parse(fs.readFileSync(reactPackageJsonPath, 'utf8'));

    expect(reactPackageJson.exports['./worklet-runtime']).toEqual({
      types: './runtime/lib/worklet-runtime/index.d.ts',
      default: './worklet-runtime/dist/main.js',
    });
    expect(reactPackageJson.exports['./worklet-dev-runtime']).toEqual({
      types: './runtime/lib/worklet-runtime/index.d.ts',
      default: './worklet-runtime/dist/dev.js',
    });
    expect(reactPackageJson.exports['./worklet-runtime/bindings']).toEqual({
      types: './runtime/lib/worklet-runtime/bindings/index.d.ts',
      default: './runtime/lib/worklet-runtime/bindings/index.js',
    });
  });
});
