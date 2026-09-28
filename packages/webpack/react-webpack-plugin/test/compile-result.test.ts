// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises';
import path from 'node:path';

import { rspack } from '@rspack/core';
import type { Stats } from '@rspack/core';
import { expect, test } from '@rstest/core';

import { ReactWebpackPlugin } from '../src/ReactWebpackPlugin.js';

const REACT_COMPILATION_RESULT = Symbol.for(
  '@lynx-js/react/internal:compilation-result',
);

test('excludes a semantic candidate removed from the final chunk graph', async () => {
  const context = path.resolve(
    __dirname,
    'cases',
    'compile-result-tree-shaking',
  );
  const outputPath = await fs.mkdtemp(
    path.join(context, 'dist-'),
  );
  const compiler = rspack({
    context,
    mode: 'production',
    entry: './index.js',
    output: { path: outputPath },
    optimization: {
      minimize: false,
      sideEffects: true,
      usedExports: true,
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          loader: path.resolve(
            __dirname,
            'fixtures',
            'runtime-requirement-loader.cjs',
          ),
        },
      ],
    },
    plugins: [new ReactWebpackPlugin()],
  });

  try {
    const stats = await new Promise<Stats>((resolve, reject) => {
      compiler.run((error, value) => {
        if (error) {
          reject(error);
        } else if (!value) {
          reject(new Error('Missing Rspack stats'));
        } else if (value.hasErrors()) {
          reject(new Error(value.toString({ errors: true })));
        } else {
          resolve(value);
        }
      });
    });
    const unusedModule = [...stats.compilation.modules].find(module =>
      module.readableIdentifier().endsWith('unused.js')
    );

    expect(unusedModule).toBeDefined();
    expect([
      ...stats.compilation.chunkGraph.getModuleChunksIterable(unusedModule!),
    ]).toHaveLength(0);
    expect(
      (stats.compilation as unknown as Record<symbol, unknown>)[
        REACT_COMPILATION_RESULT
      ],
    ).toEqual({
      version: 1,
      runtimeRequirements: { mainThreadProgrammability: false },
    });
  } finally {
    await new Promise<void>(resolve => compiler.close(() => resolve()));
    await fs.rm(outputPath, { recursive: true, force: true });
  }
});
