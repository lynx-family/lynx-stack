// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reactPackagesDir = path.resolve(__dirname, '..', '..');
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
});
