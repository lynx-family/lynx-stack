// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
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
    ['node16', ts.ModuleResolutionKind.Node16, ts.ModuleKind.Node16],
    ['nodenext', ts.ModuleResolutionKind.NodeNext, ts.ModuleKind.NodeNext],
    ['bundler', ts.ModuleResolutionKind.Bundler, ts.ModuleKind.Preserve],
  ] as const,
)('TypeScript %s module resolution', (_, moduleResolution, module) => {
  describe.each(
    [
      ['ESM', 'mts', ts.ModuleKind.ESNext],
      ['CommonJS', 'cts', ts.ModuleKind.CommonJS],
    ] as const,
  )('%s consumer', (_, extension, resolutionMode) => {
    const options: ts.CompilerOptions = {
      module: moduleResolution === ts.ModuleResolutionKind.Node10
        ? resolutionMode
        : module,
      moduleResolution,
      target: ts.ScriptTarget.ESNext,
      noEmit: true,
      strict: true,
      skipLibCheck: true,
      types: [],
      ignoreDeprecations: '6.0',
    };

    test.each([
      ['@lynx-js/motion', 'dist/index.d.ts'],
      ['@lynx-js/motion/mini', 'dist/mini/index.d.ts'],
    ])('resolves %s to its published declaration', (specifier, declaration) => {
      const { resolvedModule } = ts.resolveModuleName(
        specifier,
        path.join(consumerDir, `index.${extension}`),
        options,
        ts.sys,
        undefined,
        undefined,
        resolutionMode,
      );

      expect(resolvedModule?.resolvedFileName).toBe(
        realpathSync(path.join(packageDir, declaration)),
      );
      expect(resolvedModule?.extension).toBe(ts.Extension.Dts);
    });

    test('type-checks both entry points without losing type safety', () => {
      const entry = path.join(consumerDir, `index.${extension}`);
      // Motion publishes ESM; CommonJS consumers can load it with import().
      const imports = resolutionMode === ts.ModuleKind.ESNext
        ? `
          import { motionValue } from '@lynx-js/motion';
          import { animate, createMotionValue, useMotionValueRef, useMotionValueRefEvent } from '@lynx-js/motion/mini';
        `
        : `
          const { motionValue } = await import('@lynx-js/motion');
          const { animate, createMotionValue, useMotionValueRef, useMotionValueRefEvent } = await import('@lynx-js/motion/mini');
        `;
      const body = `
        motionValue(0).set(1);
        // @ts-expect-error Motion values retain their numeric type.
        motionValue(0).set('invalid');
        animate(createMotionValue(0), 1, { type: 'spring' }).stop();
        // @ts-expect-error Mini animations require numeric values.
        animate(createMotionValue('invalid'), 1);
        const value = useMotionValueRef(0);
        useMotionValueRefEvent(value, 'change', current => {
          const number: number = current;
          return number;
        });
      `;
      writeFileSync(
        entry,
        resolutionMode === ts.ModuleKind.ESNext
          ? `${imports}\n${body}`
          : `export async function checkImports() {\n${imports}\n${body}\n}`,
      );

      const program = ts.createProgram([entry], options);
      const diagnostics = ts.getPreEmitDiagnostics(program);
      expect(
        diagnostics.map(diagnostic =>
          ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
        ),
      ).toEqual([]);
    });
  });
});
