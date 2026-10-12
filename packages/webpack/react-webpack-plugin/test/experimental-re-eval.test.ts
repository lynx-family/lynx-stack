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
import { RuntimeWrapperWebpackPlugin } from '../../runtime-wrapper-webpack-plugin/src/index.js';

const createConfig = createConfigUntyped as (
  loaderOptions: Record<string, unknown>,
  pluginOptions: Record<string, unknown>,
) => Configuration;

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, 'fixtures/lazy-bundle-fetcher/index.jsx');
const RELOADER = `lynx[Symbol.for('__LYNX_MAIN_THREAD_ENTRY_RELOADER__')]`;
const ENTRY_SUPPORT =
  `lynx[Symbol.for('__LYNX_ENTRY_SUPPORTS_RE_EVAL__')] = true;`;

async function buildMainThread(
  experimental_isLazyBundle: boolean,
  experimental_reEvalJSOnReload = true,
) {
  const dist = await mkdtemp(join(tmpdir(), 'rwp-re-eval-'));
  const config = createConfig({}, {
    experimental_isLazyBundle,
    experimental_reEvalJSOnReload,
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
    new RuntimeWrapperWebpackPlugin({
      experimental_isLazyBundle,
      experimental_reEvalJSOnReload,
      test: /background\.js$/,
    }),
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

  return {
    mainThread: await readFile(join(dist, 'main__main-thread.js'), 'utf8'),
    background: await readFile(join(dist, 'main__background.js'), 'utf8'),
  };
}

describe('ReactWebpackPlugin: experimental re-evaluation', () => {
  test('does not mark entries when re-evaluation is disabled', async () => {
    const { mainThread, background } = await buildMainThread(false, false);
    expect(mainThread).not.toContain(ENTRY_SUPPORT);
    expect(background).not.toContain(ENTRY_SUPPORT);
    expect(mainThread).not.toContain(RELOADER);
  });

  test('installs the entry reloader for a regular bundle', async () => {
    const { mainThread, background } = await buildMainThread(false);
    expect(mainThread).toContain(`${RELOADER} = () => {`);
    expect(mainThread).toContain(ENTRY_SUPPORT);
    expect(mainThread.indexOf(ENTRY_SUPPORT)).toBeGreaterThan(
      mainThread.indexOf(RELOADER),
    );
    expect(background).toContain(ENTRY_SUPPORT);
    expect(background.indexOf(ENTRY_SUPPORT)).toBeLessThan(
      background.indexOf('var Promise = lynx.Promise;'),
    );
  });

  test('does not install the entry reloader for a lazy bundle', async () => {
    const { mainThread, background } = await buildMainThread(true);
    expect(mainThread).not.toContain(RELOADER);
    expect(mainThread).not.toContain(ENTRY_SUPPORT);
    expect(background).not.toContain(ENTRY_SUPPORT);
  });
});
