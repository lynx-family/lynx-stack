// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { rspack } from '@rspack/core';
import type { Configuration, EntryObject, Stats } from '@rspack/core';
import { describe, expect, test } from '@rstest/core';

import { LynxEncodePlugin, LynxTemplatePlugin } from '../src/index.js';

const CONTEXT = dirname(fileURLToPath(import.meta.url));
const ENTRY = './fixtures/lazy-chunk-filename/entry.js';

function runRspack(config: Configuration): Promise<Stats> {
  const compiler = rspack(config);
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) return reject(err);
      if (!stats) return reject(new Error('rspack returned empty stats'));
      resolve(stats);
      compiler.close(() => void 0);
    });
  });
}

async function buildLazyChunks(entry: EntryObject): Promise<string[]> {
  const stats = await runRspack({
    context: CONTEXT,
    mode: 'production',
    devtool: false,
    experiments: { layers: true },
    entry,
    output: { iife: false, path: mkdtempSync(join(tmpdir(), 'tmpl-lazy-')) },
    plugins: [
      new LynxTemplatePlugin({
        ...LynxTemplatePlugin.defaultOptions,
        intermediate: '.rspeedy/main',
      }),
      new LynxEncodePlugin(),
    ],
  });
  const { assets = [] } = stats.toJson({ assets: true });
  return assets
    .map(asset => asset.name)
    .filter(name => name.includes('lazy-bundle/') && name.endsWith('.js'))
    .map(name => name.replace(/\.[0-9a-f]{8}\.js$/, '.[hash].js'))
    .sort();
}

describe('lazy chunk filename', () => {
  test('mirrors the filename of the entry in the same layer', async () => {
    await expect(buildLazyChunks({
      main: {
        import: ENTRY,
        layer: 'test:background',
        filename: '.rspeedy/main/background.[contenthash:8].js',
      },
      'main__main-thread': {
        import: ENTRY,
        layer: 'test:main-thread',
        filename: '.rspeedy/main/main-thread.js',
      },
    })).resolves.toMatchInlineSnapshot(`
      [
        .rspeedy/lazy-bundle/fixtures_lazy-chunk-filename_lazy.js/background.[hash].js,
        .rspeedy/lazy-bundle/fixtures_lazy-chunk-filename_lazy.js/main-thread.js,
      ]
    `);
  });

  test('stays in the output root of the entry', async () => {
    await expect(buildLazyChunks({
      main: {
        import: ENTRY,
        layer: 'test:background',
        filename: 'main/background.[contenthash:8].js',
      },
    })).resolves.toMatchInlineSnapshot(`
      [
        lazy-bundle/fixtures_lazy-chunk-filename_lazy.js/background.[hash].js,
      ]
    `);
  });

  test('falls back to the layer name without an entry filename', async () => {
    await expect(buildLazyChunks({
      main: {
        import: ENTRY,
        layer: 'test:background',
      },
    })).resolves.toMatchInlineSnapshot(`
      [
        .rspeedy/lazy-bundle/fixtures_lazy-chunk-filename_lazy.js/background.js,
      ]
    `);
  });
});
