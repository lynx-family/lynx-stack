// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Output-shape tests live in `test/cases/lazy-bundle-fetcher/{fetchbundle,
// querycomponent}/`. This file is a separate runner because the bytecode
// gating is driven by env vars (`process.env.DEBUG`) that need to be
// flipped per test — `cases.test.ts` runs all cases in the same process,
// so env mutations would leak.

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from '@rstest/core';
import webpack from 'webpack';

import { LynxEncodePlugin, LynxTemplatePlugin } from '../src/index.js';

const FIXTURE_ENTRY = './fixtures/lazy-bundle-fetcher/entry.js';
const CONTEXT = dirname(new URL(import.meta.url).pathname);

interface CapturedEncode {
  outputName: string;
  customSections: Record<string, { content: unknown; encoding?: string }>;
}

function captureBeforeEmit() {
  const captured: CapturedEncode[] = [];
  const plugin = (compiler: webpack.Compiler) => {
    compiler.hooks.thisCompilation.tap('cap', (compilation) => {
      const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation);
      hooks.beforeEmit.tapPromise('cap', (args) => {
        captured.push({
          outputName: args.outputName,
          customSections: args.finalEncodeOptions.customSections as Record<
            string,
            { content: unknown; encoding?: string }
          >,
        });
        return Promise.resolve(args);
      });
    });
  };
  return { captured, plugin };
}

function buildConfig(
  capturePlugin: (compiler: webpack.Compiler) => void,
  mode: 'development' | 'production',
): webpack.Configuration {
  // Each build gets its own temp output dir so parallel/serial test runs
  // don't clobber each other (or the package's `dist/`).
  const dist = mkdtempSync(join(tmpdir(), 'tmpl-fetchbundle-'));
  return {
    context: CONTEXT,
    mode,
    devtool: false,
    entry: FIXTURE_ENTRY,
    output: { iife: false, path: dist },
    plugins: [
      capturePlugin,
      new LynxTemplatePlugin({
        ...LynxTemplatePlugin.defaultOptions,
        lazyBundleFetcher: 'FetchBundle',
        intermediate: '.rspeedy/main',
      }),
      new LynxEncodePlugin(),
      (compiler) => {
        compiler.hooks.thisCompilation.tap('strip', (compilation) => {
          const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
            compilation,
          );
          hooks.asyncChunkName.tap(
            'strip',
            (chunkName) =>
              chunkName.replace(':main-thread', '').replace(':background', ''),
          );
        });
      },
      (compiler) => {
        compiler.hooks.thisCompilation.tap('mark-mt', (compilation) => {
          compilation.hooks.processAssets.tap(
            {
              name: 'mark-mt',
              stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_DERIVED,
            },
            (assets) => {
              for (const name of Object.keys(assets)) {
                if (!name.includes(':main-thread')) continue;
                const asset = compilation.getAsset(name);
                if (!asset) continue;
                compilation.updateAsset(asset.name, asset.source, {
                  ...asset.info,
                  'lynx:main-thread': true,
                });
              }
            },
          );
        });
      },
    ],
  };
}

function runWebpack(config: webpack.Configuration): Promise<webpack.Stats> {
  const compiler = webpack(config);
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) return reject(err);
      if (!stats) return reject(new Error('webpack returned empty stats'));
      resolve(stats);
      compiler.close(() => void 0);
    });
  });
}

async function runAndGetMtEncoding(
  mode: 'development' | 'production',
): Promise<string | undefined> {
  const { captured, plugin } = captureBeforeEmit();
  await runWebpack(buildConfig(plugin, mode));
  const lazy = captured.find((c) => c.outputName.startsWith('lazy-bundle/'));
  return lazy?.customSections['main-thread']?.encoding;
}

describe('LynxTemplatePlugin: FetchBundle main-thread bytecode encoding', () => {
  const originalDebug = process.env['DEBUG'];
  void beforeEach(() => {
    // The vitest/rstest harness sets DEBUG=rspeedy by default, which
    // would force bytecode off in every test below. Clear it so each
    // test opts into a specific value.
    delete process.env['DEBUG'];
  });
  void afterEach(() => {
    if (originalDebug === undefined) delete process.env['DEBUG'];
    else process.env['DEBUG'] = originalDebug;
  });

  test('production → encoding: JsBytecode', async () => {
    expect(await runAndGetMtEncoding('production')).toBe('JsBytecode');
  });

  test('development → no JsBytecode encoding', async () => {
    expect(await runAndGetMtEncoding('development')).toBeUndefined();
  });

  test('DEBUG=rspeedy → no JsBytecode encoding even in production', async () => {
    process.env['DEBUG'] = 'rspeedy';
    expect(await runAndGetMtEncoding('production')).toBeUndefined();
  });

  test('DEBUG=other → JsBytecode encoding still on', async () => {
    process.env['DEBUG'] = 'unrelated';
    expect(await runAndGetMtEncoding('production')).toBe('JsBytecode');
  });
});
