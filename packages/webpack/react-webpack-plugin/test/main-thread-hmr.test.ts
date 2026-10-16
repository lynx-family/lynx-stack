// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The fixture executes the emitted CommonJS factories inside a VM.
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, import/no-commonjs */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createContext, runInContext } from 'node:vm';

import { rspack } from '@rspack/core';
import type { Compiler, Configuration, Stats } from '@rspack/core';
import { expect, it } from '@rstest/core';

import { ChunkLoadingWebpackPlugin } from '@lynx-js/chunk-loading-webpack-plugin';
import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';
import type { EncodeOptions } from '@lynx-js/template-webpack-plugin';

// @ts-expect-error Existing JavaScript fixture has no declaration file.
import { createConfig as untypedCreateConfig } from './create-react-config.js';
import { ReactWebpackPlugin } from '../src/ReactWebpackPlugin.js';

const createConfig = (
  loaderOptions: { engineVersion?: string },
  pluginOptions?: { entryPairs: { mainThread: string; background: string }[] },
): Configuration => {
  const config = untypedCreateConfig(
    loaderOptions,
    pluginOptions,
  ) as Configuration;
  // Instrument the plugin executed by the watch fixture; loaders still use
  // the built package, as they do in the application compiler.
  config.plugins![0] = new ReactWebpackPlugin({
    mainThreadChunks: ['main__main-thread.js'],
    ...pluginOptions,
  });
  return config;
};

const syntheticApp = (value: number) => `
    const label = __BACKGROUND__ ? require('./bhelper.js').label : '';
    export function App() {
      const task = () => { 'main thread'; return ${value}; };
      return [task, label];
    }
  `;

it.each([
  { synthetic: false, recover: false },
  { synthetic: true, recover: false },
  { synthetic: false, recover: true },
])(
  'updates native worklets and owners (BTS-only source=$synthetic, diagnostic recovery=$recover)',
  async ({ synthetic, recover }) => {
    const tempRoot = path.resolve(
      __dirname,
      '../../../../.tmp/main-thread-hmr',
    );
    await fs.mkdir(tempRoot, { recursive: true });
    const context = await fs.mkdtemp(path.join(tempRoot, 'watch-'));
    await fs.writeFile(
      path.join(context, 'index.js'),
      synthetic
        ? `if (__BACKGROUND__) require('./app.jsx');`
        : `export { App } from './app.jsx';`,
    );
    await fs.writeFile(
      path.join(context, 'app.jsx'),
      synthetic ? syntheticApp(12) : `
    import { helper } from './helper.js' with { runtime:'shared' };
    const label = __BACKGROUND__ ? require('./bhelper.js').label : '';
    export function App() {
      const task = () => { 'main thread'; return helper(3); };
      return [task, label];
    }
  `,
    );
    await fs.writeFile(
      path.join(context, 'helper.js'),
      `
    export function helper(x) { if (__MAIN_THREAD__) return require('./mhelper.js').helper(x); return x; }
  `,
    );
    await fs.writeFile(
      path.join(context, 'bhelper.js'),
      `export const label = 'one';`,
    );
    await fs.writeFile(
      path.join(context, 'mhelper.js'),
      `export const helper = x => x * 2;`,
    );

    const config: Configuration = createConfig({ engineVersion: '3.9' }, {
      entryPairs: [{
        mainThread: 'main__main-thread',
        background: 'main__background',
      }],
    });
    config.context = context;
    config.module!.rules!.unshift({
      test: /\.[jt]sx?$/,
      type: 'javascript/auto',
    });
    config.mode = 'development';
    config.devtool = false;
    config.resolve = {
      ...config.resolve,
      modules: [path.resolve(__dirname, '../node_modules'), 'node_modules'],
    };
    config.output = {
      path: path.join(context, 'dist'),
      filename: '[name].js',
      chunkLoading: 'lynx',
      chunkFormat: 'commonjs',
      hotUpdateMainFilename: '[runtime].[fullhash].hot-update.json',
      hotUpdateChunkFilename: '[id].[fullhash].hot-update.js',
    };
    config.plugins!.push(
      new rspack.HotModuleReplacementPlugin(),
      new ChunkLoadingWebpackPlugin(),
      new LynxEncodePlugin(),
      new LynxTemplatePlugin({
        ...LynxTemplatePlugin.defaultOptions,
        filename: 'base.bundle',
        chunks: ['main__main-thread', 'main__background'],
      }),
      (compiler: Compiler) => {
        compiler.hooks.thisCompilation.tap('TestEncoder', compilation => {
          LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation).encode
            .tapPromise(
              { name: 'TestEncoder', stage: -100 },
              async ({ encodeOptions }) => ({
                buffer: Buffer.from(JSON.stringify(encodeOptions)),
                debugInfo: '',
              }),
            );
        });
      },
    );

    const compiler = rspack(config);
    const hashes: string[] = [];
    try {
      await new Promise<void>((resolve, reject) => {
        const watcher = compiler.watch(
          { aggregateTimeout: 100 },
          (error, stats) => {
            void (async () => {
              try {
                if (error) throw error;
                if (recover && hashes.length === 3) {
                  expect(stats!.hasErrors()).toBe(true);
                  expect(stats!.toString({ all: false, errors: true }))
                    .toContain('missing.js');
                  hashes.push(stats!.hash!);
                  await fs.writeFile(
                    path.join(context, 'mhelper.js'),
                    `export const helper = x => x * 7;`,
                  );
                  return;
                }
                if (stats!.hasErrors()) {
                  throw new Error(
                    stats!.toString({ all: false, errors: true }),
                  );
                }
                hashes.push(stats!.hash!);
                const compilation = stats!.compilation;
                const n = hashes.length;
                if (n === 1) {
                  const initial = compilation.getAsset('main__main-thread.js')!
                    .source.source().toString();
                  expect(initial).toContain('lynxHMRLoad');
                  if (!synthetic) {
                    expect(initial).toContain('module.hot.accept()');
                  }
                  await fs.writeFile(
                    path.join(context, 'bhelper.js'),
                    `export const label = 'two';`,
                  );
                } else {
                  const oldHash = hashes[n - 2]!;
                  const native = compilation.getAsset(
                    `main__main-thread.${oldHash}.hot-update.bundle`,
                  );
                  expect(native).toBeDefined();
                  const encoded = JSON.parse(
                    native!.source.source().toString(),
                  ) as EncodeOptions;
                  expect(encoded['sourceContent']).toMatchObject({
                    appType: 'DynamicComponent',
                  });
                  const manifest = compilation.getAsset(
                    `main__main-thread.${oldHash}.hot-update.json`,
                  )!;
                  expect(
                    runInContext(
                      encoded.customSections['manifest']!.content as string,
                      createContext(),
                    ),
                  ).toEqual(JSON.parse(manifest.source.source().toString()));
                  const updates = runInContext(
                    `(${encoded.customSections['updates']!.content as string})`,
                    createContext(),
                  ) as Record<string, { modules: Record<string, unknown> }>;
                  const file = `main__main-thread.${oldHash}.hot-update.js`;
                  expect(compilation.getAsset(file)!.info['lynx:main-thread'])
                    .toBe(
                      true,
                    );
                  const background = compilation.getAsset(
                    `main__background.${oldHash}.hot-update.js`,
                  )!.source.source().toString();
                  if (n === 2) {
                    expect(Object.keys(updates[file]!.modules)).toEqual([]);
                    expect(background).not.toContain('lynxRefreshModules');
                    await fs.writeFile(
                      path.join(context, synthetic ? 'app.jsx' : 'mhelper.js'),
                      synthetic
                        ? syntheticApp(15)
                        : `export const helper = x => x * 5;`,
                    );
                  } else {
                    if (synthetic) {
                      const registrations: (() => number)[] = [];
                      const vm = createContext();
                      const vmUpdates = runInContext(
                        `(${encoded.customSections['updates']!
                          .content as string})`,
                        vm,
                      );
                      const key = Object.keys(vmUpdates[file].modules).find(
                        id => id.includes('__lynx-react-defines'),
                      )!;
                      expect(key).toBeDefined();
                      let accepted = false;
                      const module = {
                        hot: {
                          accept: () => {
                            accepted = true;
                          },
                        },
                        exports: {},
                      };
                      vmUpdates[file].modules[key](
                        module,
                        module.exports,
                        Object.assign(() => ({
                          registerWorklet: (
                            _type: string,
                            _id: string,
                            fn: () => number,
                          ) => registrations.push(fn),
                        }), {
                          r: () => undefined,
                          d: () => undefined,
                        }),
                      );
                      expect(accepted).toBe(true);
                      expect(registrations[0]!()).toBe(15);
                    } else {
                      expect(Object.keys(updates[file]!.modules)).toEqual([
                        '(react:main-thread)/./mhelper.js',
                      ]);
                      expect(background).toContain(
                        'exports.lynxRefreshModules=["(react:background)/./app.jsx"]',
                      );
                    }
                    if (recover && n === 3) {
                      await fs.writeFile(
                        path.join(context, 'mhelper.js'),
                        `import './missing.js'; export const helper = x => x * 5;`,
                      );
                    } else {
                      watcher.close(resolve);
                    }
                  }
                }
              } catch (error) {
                watcher.close(() => reject(new Error(String(error))));
              }
            })();
          },
        );
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        compiler.close(error =>
          error ? reject(new Error(String(error))) : resolve()
        )
      );
      await fs.rm(context, { recursive: true, force: true });
    }
  },
);

it.each([
  { mode: 'production' as const, hot: false, native: true },
  { mode: 'development' as const, hot: false, native: true },
  { mode: 'development' as const, hot: true, native: false },
])(
  'keeps the coordinator out of $mode hot=$hot native=$native builds',
  async ({ mode, hot, native }) => {
    const tempRoot = path.resolve(
      __dirname,
      '../../../../.tmp/main-thread-hmr',
    );
    await fs.mkdir(tempRoot, { recursive: true });
    const context = await fs.mkdtemp(path.join(tempRoot, 'disabled-'));
    await fs.writeFile(
      path.join(context, 'index.js'),
      'export const value = 1;',
    );
    const config: Configuration = createConfig({}, {
      entryPairs: [{
        mainThread: 'main__main-thread',
        background: 'main__background',
      }],
    });
    config.context = context;
    config.mode = mode;
    config.devtool = false;
    config.output = { filename: '[name].js', path: path.join(context, 'dist') };
    config.optimization = { ...config.optimization, minimize: false };
    if (hot) config.plugins!.push(new rspack.HotModuleReplacementPlugin());
    if (native) config.plugins!.push(new LynxEncodePlugin());
    const compiler = rspack(config);
    try {
      const stats = await new Promise<Stats>((resolve, reject) =>
        compiler.run((error, stats) => {
          if (error) reject(new Error(String(error)));
          else resolve(stats!);
        })
      );
      expect(stats.hasErrors()).toBe(false);
      for (const name of ['main__main-thread.js', 'main__background.js']) {
        const source = stats.compilation.getAsset(name)!.source.source()
          .toString();
        expect(source).not.toContain('LynxHMR:');
        expect(source).not.toContain('__lynxHMR_');
        expect(source).not.toContain('Main-thread HMR');
      }
    } finally {
      await new Promise<void>((resolve, reject) =>
        compiler.close(error =>
          error ? reject(new Error(String(error))) : resolve()
        )
      );
      await fs.rm(context, { recursive: true, force: true });
    }
  },
);
