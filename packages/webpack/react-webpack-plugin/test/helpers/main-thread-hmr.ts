// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The generated runtime and Native section values are dynamic VM boundaries.
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */

import { createRequire } from 'node:module';
import path from 'node:path';
import { createContext, runInContext } from 'node:vm';

import { rspack } from '@rspack/core';
import type { Compilation, Compiler, Configuration, Stats } from '@rspack/core';

import type { ReactLoaderOptions } from '../../src/loaders/options.js';
// @ts-expect-error Existing JavaScript fixture has no declaration file.
import { createConfig } from '../create-react-config.js';

const { ChunkLoadingWebpackPlugin } = createRequire(import.meta.url)(
  '../../../chunk-loading-webpack-plugin/lib/index.js',
);
const { LynxEncodePlugin, LynxTemplatePlugin } = createRequire(import.meta.url)(
  '../../../template-webpack-plugin/lib/index.js',
) as typeof import('@lynx-js/template-webpack-plugin');
// Async boundary metadata is compiler-local; the plugin and its loaders must
// share the same module instance, as they do in an application build.
const { ReactWebpackPlugin } = createRequire(import.meta.url)(
  '../../lib/index.js',
) as typeof import('../../src/index.js');

export function createHMRCompiler(
  context: string,
  loaderOptions: ReactLoaderOptions = {},
  entryImports: string[] = ['./index.js'],
  moduleIds: 'named' | 'deterministic' = 'named',
  splitChunks: NonNullable<Configuration['optimization']>['splitChunks'] =
    false,
): Compiler {
  const entryPairs = [{
    mainThread: 'main__main-thread',
    background: 'main__background',
  }];
  const config = createConfig({ engineVersion: '3.9', ...loaderOptions }, {
    entryPairs,
  }) as Configuration;
  config.plugins![0] = new ReactWebpackPlugin({
    mainThreadChunks: ['main__main-thread.js'],
    entryPairs,
    experimental_useElementTemplate:
      loaderOptions.experimental_useElementTemplate ?? false,
  });
  config.context = context;
  config.mode = 'development';
  config.optimization!.moduleIds = moduleIds;
  config.optimization!.splitChunks = splitChunks;
  config.devtool = false;
  config.experiments = { ...config.experiments, css: true };
  config.module!.rules!.push({ test: /\.css$/, type: 'css/auto' });
  config.module!.rules!.unshift({
    test: /\.[jt]sx?$/,
    type: 'javascript/auto',
  });
  config.resolve = {
    ...config.resolve,
    modules: [path.resolve(__dirname, '../../node_modules'), 'node_modules'],
  };
  const entries = config.entry as Record<string, { import: string | string[] }>;
  // Match Rspeedy's parallel CSS entry: the first dependency is not the app.
  entries['main__main-thread']!.import = [
    createRequire(import.meta.url).resolve(
      '@lynx-js/css-extract-webpack-plugin/runtime/hotModuleReplacement.lepus.cjs',
    ),
    ...entryImports,
  ];
  config.output = {
    path: path.join(context, 'dist'),
    publicPath: '/',
    filename: '[name].js',
    chunkLoading: 'lynx',
    chunkFormat: 'commonjs',
    hotUpdateMainFilename: '[runtime].[fullhash].hot-update.json',
    hotUpdateChunkFilename: '[id].[fullhash].hot-update.js',
  };
  config.externals = {
    '@lynx-js/react/internal': 'commonjs probe-internal',
    '@lynx-js/react/worklet-runtime/init': 'commonjs probe-init',
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
    (compiler: Compiler) =>
      compiler.hooks.thisCompilation.tap('HMRExecutionTest', compilation => {
        LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation).encode
          .tapPromise(
            { name: 'HMRExecutionTest', stage: -100 },
            async ({ encodeOptions }) => ({
              buffer: Buffer.from(JSON.stringify(encodeOptions)),
              debugInfo: '',
            }),
          );
        compilation.hooks.additionalTreeRuntimeRequirements.tap(
          'HMRExecutionTest',
          chunk => {
            if (chunk.name !== 'main__main-thread') return;
            class ExposeRequire extends compiler.webpack.RuntimeModule {
              constructor() {
                super(
                  'HMR test require',
                  compiler.webpack.RuntimeModule.STAGE_ATTACH + 1,
                );
              }
              override generate(): string {
                return 'globalThis.testRequire = __webpack_require__;';
              }
            }
            compilation.addRuntimeModule(chunk, new ExposeRequire());
          },
        );
      }),
  );
  const compiler = rspack(config);
  // Keep split chunk assets distinct; this fixture executes the emitted JS
  // directly instead of exercising the template plugin's lazy output layout.
  compiler.options.output.chunkFilename = '[id].js';
  return compiler;
}

export function createMainThreadRuntime(stats: Stats): {
  context: ReturnType<typeof createContext>;
  registrations: Map<string, (...args: unknown[]) => unknown>;
  events: string[];
  loadAsyncModule: (compilation: Compilation, resource: string) => void;
  apply: (
    compilation: Compilation,
  ) => Promise<{ ok: boolean; hash: string; error?: string }>;
} {
  const registrations = new Map<string, (...args: unknown[]) => unknown>();
  const events: string[] = [];
  let acknowledge: (ack: { ok: boolean; hash: string; error?: string }) => void;
  const context = createContext({
    console,
    Promise,
    setTimeout,
    clearTimeout,
    require: () => ({
      registerWorklet: (
        _type: string,
        id: string,
        fn: (...args: unknown[]) => unknown,
      ) => {
        registrations.set(id, fn);
        events.push('register');
      },
    }),
    lynx: {
      getJSContext: () => ({
        addEventListener: () => undefined,
        dispatchEvent: (event: { data: string }) => {
          events.push('ack');
          acknowledge(JSON.parse(event.data));
        },
      }),
    },
  });
  // The shared Rspack test setup records HMR status transitions on self.
  context['self'] = context;
  runInContext(
    stats.compilation.getAsset('main__main-thread.js')!.source.source()
      .toString(),
    context,
  );
  let sequence = 0;
  return {
    context,
    registrations,
    events,
    loadAsyncModule: (compilation, resource) => {
      const module = [...compilation.modules].find(module =>
        module.layer === 'react:main-thread'
        && (module as { resource?: string }).resource === resource
      )!;
      const chunks = new Set(
        [...compilation.chunkGraph.getModuleChunksIterable(module)].flatMap(
          chunk => [...chunk.groupsIterable].flatMap(group => group.chunks),
        ),
      );
      for (const chunk of chunks) {
        for (const file of chunk.files) {
          if (!file.endsWith('.js')) continue;
          const result = runInContext(
            compilation.getAsset(file)!.source.source().toString(),
            context,
          );
          // Use the emitted lazy-bundle consumer to install and execute factories.
          context['processEvalResult'](
            result,
            'https://example.com/route.bundle',
          );
        }
      }
    },
    apply: async compilation => {
      const hash = context['testRequire'].h();
      const encoded = JSON.parse(
        compilation.getAsset(`main__main-thread.${hash}.hot-update.bundle`)!
          .source.source().toString(),
      );
      context['lynx'].fetchBundle = (url: string) =>
        Promise.resolve({ code: 0, url });
      context['lynx'].loadScript = (section: string) =>
        runInContext(encoded.customSections[section].content, context);
      const ack = new Promise<{ ok: boolean; hash: string; error?: string }>(
        resolve => {
          acknowledge = resolve;
        },
      );
      context['__lynxHMR_main__main-thread']({
        session: 'execution-test',
        sequence: ++sequence,
        hash,
      });
      return ack;
    },
  };
}
