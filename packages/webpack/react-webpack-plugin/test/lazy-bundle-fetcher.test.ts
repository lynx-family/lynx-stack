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

interface BuildResult {
  mainThread: string;
  background: string;
}

async function build(
  pluginOptions: Record<string, unknown>,
): Promise<BuildResult> {
  const dist = await mkdtemp(join(tmpdir(), 'rwp-fetchbundle-'));
  const config = createConfig({}, {
    experimental_isLazyBundle: true,
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
  // The wrapper-injection branch is gated on a LynxTemplatePlugin being
  // present; add a minimal one so the gate passes.
  config.plugins = [
    ...(config.plugins ?? []),
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      chunks: ['main__main-thread', 'main__background'],
      filename: 'main/template.js',
      intermediate: '.rspeedy/main',
      experimental_isLazyBundle: true,
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
    background: await readFile(
      join(dist, 'main__background.js'),
      'utf8',
    ),
  };
}

describe('ReactWebpackPlugin: lazyBundleFetcher', () => {
  test('FetchBundle: main-thread chunk wrapped as self-invoking IIFE with __Card__', async () => {
    const { mainThread } = await build({ lazyBundleFetcher: 'FetchBundle' });
    expect(mainThread).toContain(
      `var globDynamicComponentEntry = '__Card__'`,
    );
    expect(mainThread.trimStart().startsWith('(function () {')).toBe(true);
    expect(mainThread.trimEnd().endsWith('})()')).toBe(true);
  });

  test('QueryComponent (default): main-thread chunk wrapped as parameterised non-IIFE', async () => {
    const { mainThread } = await build({});
    expect(mainThread).not.toContain(
      `var globDynamicComponentEntry = '__Card__'`,
    );
    expect(
      mainThread.trimStart().startsWith(
        '(function (globDynamicComponentEntry) {',
      ),
    ).toBe(true);
    expect(mainThread.trimEnd().endsWith('})')).toBe(true);
    // Importantly: NOT self-invoking.
    expect(mainThread.trimEnd().endsWith('})()')).toBe(false);
  });

  describe('__LAZY_BUNDLE_FETCHER__ define injection', () => {
    test('FetchBundle: define replaces references with literal "FetchBundle"', async () => {
      const { background } = await build({ lazyBundleFetcher: 'FetchBundle' });
      expect(background).toContain('"FetchBundle"');
      expect(background).not.toContain('__LAZY_BUNDLE_FETCHER__');
    });

    test('QueryComponent (default): define replaces references with literal "QueryComponent"', async () => {
      const { background } = await build({});
      expect(background).toContain('"QueryComponent"');
      expect(background).not.toContain('__LAZY_BUNDLE_FETCHER__');
    });
  });
});
