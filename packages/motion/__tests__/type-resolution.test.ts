// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const packageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
let consumerDir: string;

beforeAll(() => {
  consumerDir = mkdtempSync(path.join(tmpdir(), 'lynx-motion-types-'));
  const scopeDir = path.join(consumerDir, 'node_modules/@lynx-js');
  mkdirSync(scopeDir, { recursive: true });
  symlinkSync(packageDir, path.join(scopeDir, 'motion'), 'junction');
});

afterAll(() => {
  rmSync(consumerDir, { recursive: true, force: true });
});

describe.each(
  [
    ['node', ts.ModuleResolutionKind.Node10, ts.ModuleKind.ESNext],
    ['bundler', ts.ModuleResolutionKind.Bundler, ts.ModuleKind.ESNext],
    ['nodenext', ts.ModuleResolutionKind.NodeNext, ts.ModuleKind.NodeNext],
  ] as const,
)('TypeScript %s module resolution', (_, moduleResolution, module) => {
  test.each([
    ['@lynx-js/motion', 'dist/index.d.ts'],
    ['@lynx-js/motion/mini', 'dist/mini/index.d.ts'],
  ])('resolves %s to its published declaration', (specifier, declaration) => {
    const { resolvedModule } = ts.resolveModuleName(
      specifier,
      path.join(consumerDir, 'index.mts'),
      { module, moduleResolution },
      ts.sys,
      undefined,
      undefined,
      ts.ModuleKind.ESNext,
    );

    expect(resolvedModule?.resolvedFileName).toBe(
      realpathSync(path.join(packageDir, declaration)),
    );
    expect(resolvedModule?.extension).toBe(ts.Extension.Dts);
  });
});
