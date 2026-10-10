// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { rspack } from '@rspack/core';
import type { Configuration, Stats } from '@rspack/core';
import { describe, expect, test } from '@rstest/core';

import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';

// `create-react-config.js` is plain JS without a generated d.ts.
// @ts-expect-error untyped JS helper
import { createConfig as createConfigUntyped } from './create-react-config.js';

const createConfig = createConfigUntyped as (
  loaderOptions: Record<string, unknown>,
  pluginOptions: Record<string, unknown>,
) => Configuration;

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, 'fixtures/lazy-bundle-fetcher/index.jsx');
const RELOADER = `lynx[Symbol.for('__LYNX_MAIN_THREAD_ENTRY_RELOADER__')]`;

async function buildMainThread(experimental_isLazyBundle: boolean) {
  const dist = await mkdtemp(join(tmpdir(), 'rwp-re-eval-'));
  const config = createConfig({}, {
    experimental_isLazyBundle,
    experimental_reEvalJSOnReload: true,
    mainThreadChunks: ['main__main-thread.js'],
  });
  config.entry = {
    'main__main-thread': { import: FIXTURE, layer: 'react:main-thread' },
    'main__background': { import: FIXTURE, layer: 'react:background' },
  };
  config.context = dirname(FIXTURE);
  config.output = { ...config.output, filename: '[name].js', path: dist };
  config.mode = 'development';
  config.devtool = false;
  config.plugins = [
    ...(config.plugins ?? []),
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      chunks: ['main__main-thread', 'main__background'],
      filename: 'main/template.js',
      intermediate: '.rspeedy/main',
      experimental_isLazyBundle,
    }),
  ];

  const compiler = rspack(config);
  let stats: Stats;
  try {
    stats = await new Promise((resolve, reject) => {
      compiler.run((err, result) => {
        if (err) return reject(err);
        if (!result) return reject(new Error('rspack returned empty stats'));
        resolve(result);
      });
    });
  } finally {
    await new Promise<void>(resolve => compiler.close(() => resolve()));
  }
  if (stats.hasErrors()) {
    throw new Error(stats.toString({ all: false, errors: true }));
  }

  return readFile(join(dist, 'main__main-thread.js'), 'utf8');
}

describe('ReactWebpackPlugin: experimental re-evaluation', () => {
  test('installs the entry reloader for a regular bundle', async () => {
    const mainThread = await buildMainThread(false);
    expect(mainThread).toContain(`${RELOADER} = () => {`);
  });

  test('does not install the entry reloader for a lazy bundle', async () => {
    const mainThread = await buildMainThread(true);
    expect(mainThread).not.toContain(RELOADER);
  });
});
