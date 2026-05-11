// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { dirname } from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from '@rstest/core';
import webpack from 'webpack';

import { LynxEncodePlugin, LynxTemplatePlugin } from '../src/index.js';

const FIXTURE_ENTRY = './fixtures/lazy-bundle-fetcher/entry.js';
const CONTEXT = dirname(new URL(import.meta.url).pathname);

interface CapturedEncode {
  outputName: string;
  customSections: Record<string, { content: unknown; encoding?: string }>;
  manifest: Record<string, string | undefined> | undefined;
  lepusCodeRoot: string | undefined;
  cssMap: Record<string, unknown> | undefined;
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
          manifest: args.finalEncodeOptions.manifest,
          lepusCodeRoot: args.finalEncodeOptions.lepusCode?.root,
          cssMap: (args.finalEncodeOptions['css'] as
            | { cssMap?: Record<string, unknown> }
            | undefined)
            ?.cssMap,
        });
        return Promise.resolve(args);
      });
    });
  };
  return { captured, plugin };
}

function buildConfig(
  fetcherOptions: Partial<
    NonNullable<ConstructorParameters<typeof LynxTemplatePlugin>[0]>
  >,
  capturePlugin: (compiler: webpack.Compiler) => void,
  mode: 'development' | 'production' = 'production',
): webpack.Configuration {
  return {
    context: CONTEXT,
    mode,
    devtool: false,
    entry: FIXTURE_ENTRY,
    output: { iife: false },
    plugins: [
      capturePlugin,
      new LynxTemplatePlugin({
        ...fetcherOptions,
        intermediate: '.rspeedy/main',
      }),
      new LynxEncodePlugin(),
      // Strip the React-style layer suffixes so MT/BG chunks share a
      // template, mirroring the production setup that LynxTemplatePlugin
      // is built for.
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
      // Mark assets whose name contains `:main-thread` as
      // `lynx:main-thread` so LynxTemplatePlugin routes them into the
      // mainThread bucket (mirroring `react-webpack-plugin`'s loader).
      (compiler) => {
        compiler.hooks.thisCompilation.tap('mark-mt', (compilation) => {
          compilation.hooks.processAssets.tap(
            {
              name: 'mark-mt',
              stage: compiler.webpack.Compilation
                .PROCESS_ASSETS_STAGE_DERIVED,
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

describe('LynxTemplatePlugin: lazyBundleFetcher', () => {
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

  test('FetchBundle async chunk emits customSections shape', async () => {
    const { captured, plugin } = captureBeforeEmit();
    const stats = await runWebpack(
      buildConfig({ lazyBundleFetcher: 'FetchBundle' }, plugin),
    );
    expect(stats.compilation.errors).toEqual([]);

    const lazy = captured.find((c) => c.outputName.startsWith('async/'));
    expect(lazy).toBeDefined();

    expect(lazy!.customSections['main-thread']).toBeDefined();
    expect(lazy!.customSections['main-thread']!.encoding).toBe('JsBytecode');
    expect(typeof lazy!.customSections['main-thread']!.content).toBe('string');

    expect(lazy!.customSections['background']).toBeDefined();
    expect(lazy!.customSections['background']!.encoding).toBeUndefined();
    expect(typeof lazy!.customSections['background']!.content).toBe('string');

    // For FetchBundle, lepusCode.root is moved into customSections; the
    // legacy slot is empty.
    expect(lazy!.lepusCodeRoot).toBeUndefined();
    expect(lazy!.cssMap).toEqual({});
  });

  test('QueryComponent (default) keeps legacy lepusCode + manifest shape', async () => {
    const { captured, plugin } = captureBeforeEmit();
    const stats = await runWebpack(buildConfig({}, plugin));
    expect(stats.compilation.errors).toEqual([]);

    const lazy = captured.find((c) => c.outputName.startsWith('async/'));
    expect(lazy).toBeDefined();

    // Customsections shouldn't carry main-thread/background/CSS for
    // QueryComponent — the legacy lepusCode + manifest path owns them.
    expect(lazy!.customSections['main-thread']).toBeUndefined();
    expect(lazy!.customSections['background']).toBeUndefined();
    expect(lazy!.lepusCodeRoot).toBeDefined();
  });

  describe('FetchBundle main-thread bytecode encoding', () => {
    test('production → encoding: JsBytecode', async () => {
      const { captured, plugin } = captureBeforeEmit();
      await runWebpack(
        buildConfig({ lazyBundleFetcher: 'FetchBundle' }, plugin, 'production'),
      );
      const lazy = captured.find((c) => c.outputName.startsWith('async/'));
      expect(lazy!.customSections['main-thread']!.encoding).toBe('JsBytecode');
    });

    test('development → no JsBytecode encoding', async () => {
      const { captured, plugin } = captureBeforeEmit();
      await runWebpack(
        buildConfig(
          { lazyBundleFetcher: 'FetchBundle' },
          plugin,
          'development',
        ),
      );
      const lazy = captured.find((c) => c.outputName.startsWith('async/'));
      expect(lazy!.customSections['main-thread']!.encoding).toBeUndefined();
    });

    test('DEBUG=rspeedy → no JsBytecode encoding even in production', async () => {
      process.env['DEBUG'] = 'rspeedy';
      const { captured, plugin } = captureBeforeEmit();
      await runWebpack(
        buildConfig({ lazyBundleFetcher: 'FetchBundle' }, plugin, 'production'),
      );
      const lazy = captured.find((c) => c.outputName.startsWith('async/'));
      expect(lazy!.customSections['main-thread']!.encoding).toBeUndefined();
    });

    test('DEBUG=other → JsBytecode encoding still on', async () => {
      process.env['DEBUG'] = 'unrelated';
      const { captured, plugin } = captureBeforeEmit();
      await runWebpack(
        buildConfig({ lazyBundleFetcher: 'FetchBundle' }, plugin, 'production'),
      );
      const lazy = captured.find((c) => c.outputName.startsWith('async/'));
      expect(lazy!.customSections['main-thread']!.encoding).toBe('JsBytecode');
    });
  });
});
