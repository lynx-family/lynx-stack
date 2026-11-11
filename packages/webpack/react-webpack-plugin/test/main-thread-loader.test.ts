// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from '@rstest/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMainThreadLoader(
  content: string,
  buildInfo: Record<string, unknown>,
): Promise<{ code: string; map?: string }> {
  return new Promise((resolve, reject) => {
    const transformPath = path.resolve(
      __dirname,
      './fixtures/mock-main-thread-transform.cjs',
    );

    import('../src/loaders/main-thread.js').then(
      (mod) => {
        const loader = mod.default;

        const ctx: Record<string, unknown> = {
          getOptions: () => ({
            engineVersion: '3.2',
            transformPath,
          }),
          resourcePath: path.resolve(__dirname, 'fixture.tsx'),
          rootContext: __dirname,
          sourceMap: false,
          hot: false,
          experiments: undefined,
          emitError: (err: Error) => reject(err),
          // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op
          emitWarning: () => {},
          _module: { buildInfo },
          callback: (
            err: Error | null,
            code?: string,
            map?: string,
          ) => {
            if (err) reject(err);
            else resolve({ code: code!, map });
          },
        };

        void loader.call(ctx as ThisParameterType<typeof loader>, content);
      },
    ).catch(reject);
  });
}

describe('main-thread loader', () => {
  it('replaces semantic runtime requirements when a rebuilt module changes', async () => {
    const buildInfo: Record<string, unknown> = {};

    await runMainThreadLoader(
      '/* __mainThreadProgrammability */ export function App() { return null; }',
      buildInfo,
    );

    expect(buildInfo['lynx:react-runtime-requirements']).toEqual({
      mainThreadProgrammability: true,
    });

    await runMainThreadLoader(
      'export function App() { return null; }',
      buildInfo,
    );

    expect(buildInfo['lynx:react-runtime-requirements']).toEqual({
      mainThreadProgrammability: false,
    });
  });

  it.each(['__missingRuntimeRequirements', '__invalidRuntimeRequirements'])(
    'rejects a transform without the required module-delivery protocol: %s',
    async (marker) => {
      await expect(
        runMainThreadLoader(
          `/* ${marker} */ export function App() { return null; }`,
          {},
        ),
      ).rejects.toThrow(
        'upgrade the build plugins and @lynx-js/react (runtime and transform) together',
      );
    },
  );

  it('clears stale element-template build info when recompilation stops emitting templates', async () => {
    const buildInfo: Record<string, unknown> = {};

    await runMainThreadLoader(
      '/* __emitTemplate */ export function App() { return null; }',
      buildInfo,
    );

    expect(buildInfo['lynx:element-templates']).toEqual([
      {
        templateId: '_et_fixture',
        compiledTemplate: { type: 'view' },
        sourceFile: 'fixture.tsx',
      },
    ]);

    await runMainThreadLoader(
      'export function App() { return null; }',
      buildInfo,
    );

    expect(buildInfo).not.toHaveProperty('lynx:element-templates');
  });
});
