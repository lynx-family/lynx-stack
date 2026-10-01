// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdtempSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { rspack } from '@rspack/core';
import type { Stats } from '@rspack/core';
import { describe, expect, test } from '@rstest/core';

import { LAYERS, ReactWebpackPlugin } from '../src/index.js';

const require = createRequire(import.meta.url);
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
  const dist = mkdtempSync(path.join(tmpdir(), 'reload-entry-'));
  const compiler = rspack({
    context: __dirname,
    mode: 'none',
    entry: {
      'main__main-thread': { import: FIXTURE, layer: LAYERS.MAIN_THREAD },
      'main__background': { import: FIXTURE, layer: LAYERS.BACKGROUND },
    },
    experiments: { layers: true },
    output: { path: dist, filename: '[name].js' },
    plugins: [
      new ReactWebpackPlugin({
        mainThreadChunks: ['main__main-thread.js'],
        workletRuntimePath: require.resolve(
          '@lynx-js/react/worklet-dev-runtime',
        ),
        ...pluginOptions,
      }),
    ],
  });

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
    // The background is re-evaluated by Lynx core, not by a wrapper.
    expect(background).not.toContain(RELOADER);
  });
});
