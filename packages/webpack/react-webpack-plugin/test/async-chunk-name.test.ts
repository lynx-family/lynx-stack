// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { rspack } from '@rspack/core';
import { expect, it } from '@rstest/core';

import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';

import { ReactWebpackPlugin } from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function stripSuffix(name: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const compiler = rspack({
      context: __dirname,
      mode: 'none',
      entry: { main: './fixtures/empty.js' },
      experiments: { layers: true },
      output: {
        path: mkdtempSync(path.join(tmpdir(), 'async-chunk-name-')),
        filename: '[name].js',
      },
      plugins: [
        new ReactWebpackPlugin({
          workletRuntimePath: require.resolve(
            '@lynx-js/react/worklet-dev-runtime',
          ),
        }),
        (compiler: import('@rspack/core').Compiler) => {
          compiler.hooks.thisCompilation.tap('test', (compilation) => {
            const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
              compilation,
            );
            resolve(hooks.asyncChunkName.call(name));
          });
        },
      ],
    });
    compiler.run((error) => {
      compiler.close(() => void 0);
      if (error) {
        reject(error);
      }
    });
  });
}

it('should strip the layer a lazy bundle name carries', async () => {
  await expect(stripSuffix('comp-react__background')).resolves.toBe('comp');
  await expect(stripSuffix('comp-react__main-thread')).resolves.toBe('comp');
  await expect(stripSuffix('comp')).resolves.toBe('comp');
  await expect(stripSuffix('comp-react__background-v2')).resolves.toBe(
    'comp-react__background-v2',
  );
});
