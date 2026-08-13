// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdtemp, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { rspack } from '@rspack/core';
import type { Configuration, Stats } from '@rspack/core';
import { describe, expect, test } from '@rstest/core';

import { LAYERS } from '../src/layer.js';
// Exercises the plugin's own source (the fixture cases run the built `lib`).
import { ReactWebpackPlugin } from '../src/ReactWebpackPlugin.js';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures/shared-modules');

function loaderRuleFor(layer: 'BACKGROUND' | 'MAIN_THREAD') {
  return {
    test: /\.[jt]sx?$/,
    issuerLayer: LAYERS[layer],
    use: [{
      loader: ReactWebpackPlugin.loaders[layer],
      options: { experimental_enableMTSRendering: false },
    }],
  };
}

type EntryMap = Record<string, { import: string; layer: string }>;

function buildEntry(entries: Record<string, string>): EntryMap {
  const entry: EntryMap = {};
  for (const [name, source] of Object.entries(entries)) {
    entry[`${name}__main-thread`] = {
      import: source,
      layer: LAYERS.MAIN_THREAD,
    };
    entry[`${name}__background`] = { import: source, layer: LAYERS.BACKGROUND };
  }
  return entry;
}

async function build(
  entries: Record<string, string>,
): Promise<Record<string, string>> {
  const dist = await mkdtemp(join(tmpdir(), 'rwp-shared-modules-'));
  const mainThreadEntries = Object.fromEntries(
    Object.keys(entries).map((name) => [
      `${name}__main-thread`,
      `${name}__background`,
    ]),
  );

  const config: Configuration = {
    context: FIXTURES,
    mode: 'development',
    devtool: false,
    entry: buildEntry(entries),
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          loader: 'builtin:swc-loader',
          options: { jsc: { parser: { syntax: 'ecmascript', jsx: true } } },
        },
        loaderRuleFor('BACKGROUND'),
        loaderRuleFor('MAIN_THREAD'),
      ],
    },
    resolve: { extensionAlias: { '.js': ['.js', '.jsx'] } },
    output: { filename: '[name].js', path: dist },
    optimization: { chunkIds: 'named', moduleIds: 'named', minimize: false },
    experiments: { layers: true },
    plugins: [
      new ReactWebpackPlugin({
        experimental_enableMTSRendering: false,
        mainThreadChunks: Object.keys(mainThreadEntries).map((n) => `${n}.js`),
        mainThreadEntries,
        workletRuntimePath: require.resolve(
          '@lynx-js/react/worklet-dev-runtime',
        ),
      }),
    ],
  };

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

  const assets: Record<string, string> = {};
  for (const name of Object.keys(mainThreadEntries)) {
    assets[name] = await readFile(join(dist, `${name}.js`), 'utf8');
  }
  return assets;
}

describe('shared modules under experimental_enableMTSRendering: false', () => {
  test('compiles the shared module in and registers it under the looked-up id', async () => {
    const { 'main__main-thread': mainThread } = await build({
      main: './index.jsx',
    });

    // The shared module itself reaches the main-thread layer...
    expect(mainThread).toContain('shared-module-marker');

    // ...behind a wrapper registering it under a build-stable id, which the
    // collected definition dereferences instead of a module binding.
    const registered =
      /__REACT_LYNX_SHARED_MODULES__[\s\S]*?\.set\("([0-9a-f]{16})"/
        .exec(mainThread!);
    expect(registered).not.toBeNull();
    expect(mainThread).toContain(`getSharedModule("${registered![1]}")`);
    expect(mainThread).toContain(
      'var getSharedModule = ReactLynx.getSharedModule;',
    );
  });

  test('gives every main-thread entry the shared modules it may reference', async () => {
    // Two entries importing shared modules used to abort the build: the
    // requests were resolved while the module graph was still being iterated.
    const assets = await build({
      main: './index.jsx',
      second: './second.jsx',
    });

    for (const name of ['main__main-thread', 'second__main-thread']) {
      expect(assets[name], name).toContain('shared-module-marker');
      expect(assets[name], name).toMatch(
        /__REACT_LYNX_SHARED_MODULES__[\s\S]*?\.set\("[0-9a-f]{16}"/,
      );
    }
  });
});
