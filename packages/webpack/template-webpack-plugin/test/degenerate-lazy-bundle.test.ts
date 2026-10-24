// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { rspack } from '@rspack/core';
import type { Configuration, Stats } from '@rspack/core';
import { describe, expect, test } from '@rstest/core';

import { LynxEncodePlugin, LynxTemplatePlugin } from '../src/index.js';

const CONTEXT = dirname(fileURLToPath(import.meta.url));

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

async function build() {
  const stats = await runRspack({
    context: CONTEXT,
    mode: 'development',
    devtool: false,
    entry: './fixtures/degenerate-lazy-bundle/entry.js',
    output: { iife: false, path: mkdtempSync(join(tmpdir(), 'tmpl-degen-')) },
    plugins: [
      new LynxTemplatePlugin({
        ...LynxTemplatePlugin.defaultOptions,
        intermediate: '.rspeedy/main',
      }),
      new LynxEncodePlugin(),
    ],
  });

  const { assets = [] } = stats.toJson({ assets: true });

  return assets.map(asset => asset.name);
}

describe('degenerate lazy bundle', () => {
  test('emits no template for an import() that is also imported statically', async () => {
    const assetNames = await build();

    expect(assetNames.some(name => name.includes('split'))).toBe(true);
    expect(assetNames.some(name => name.includes('shared'))).toBe(false);
  });
});
