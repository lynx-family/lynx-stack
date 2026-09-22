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
const FIXTURE = join(__dirname, 'fixtures/reload-entry-reeval/index.jsx');

const RELOADER =
  `globalThis[Symbol.for('__LYNX_MAIN_THREAD_ENTRY_RELOADER__')]`;

interface BuildResult {
  mainThread: string;
  background: string;
}

async function build(
  pluginOptions: Record<string, unknown>,
): Promise<BuildResult> {
  const dist = await mkdtemp(join(tmpdir(), 'rwp-reload-entry-'));
  const config = createConfig({}, {
    mainThreadChunks: ['main__main-thread.js'],
    ...pluginOptions,
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
    }),
  ];

  const compiler = rspack(config);
  let stats: Stats;
  try {
    stats = await new Promise((resolve, reject) => {
      compiler.run((err, s) => {
        if (err) return reject(err);
        if (!s) return reject(new Error('rspack returned empty stats'));
        resolve(s);
      });
    });
  } finally {
    await new Promise<void>((r) => compiler.close(() => r()));
  }
  if (stats.hasErrors()) {
    throw new Error(stats.toString({ all: false, errors: true }));
  }

  return {
    mainThread: await readFile(join(dist, 'main__main-thread.js'), 'utf8'),
    background: await readFile(join(dist, 'main__background.js'), 'utf8'),
  };
}

describe('ReactWebpackPlugin: experimental_reloadEntryReeval', () => {
  test('leaves the main thread chunk alone by default', async () => {
    const { mainThread } = await build({});

    expect(mainThread).not.toContain(RELOADER);
  });

  test('wraps the main thread chunk into a reloader that runs once', async () => {
    const { mainThread, background } = await build({
      experimental_reloadEntryReeval: true,
    });

    expect(mainThread.startsWith(`${RELOADER} = () => {`)).toBe(true);
    expect(mainThread.trimEnd().endsWith(`${RELOADER}();`)).toBe(true);
    // Only the main thread entry is re-evaluated.
    expect(background).not.toContain(RELOADER);
  });
});
