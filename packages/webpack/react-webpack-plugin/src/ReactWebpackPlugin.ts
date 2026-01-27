// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';

import type { Chunk, Compilation, Compiler } from '@rspack/core';
import invariant from 'tiny-invariant';

import type { ExtractStrConfig } from '@lynx-js/react/transform';
import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';
import { RuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

import { LAYERS } from './layer.js';
import { createLynxProcessEvalResultRuntimeModule } from './LynxProcessEvalResultRuntimeModule.js';

const require = createRequire(import.meta.url);

/**
 * The options for ReactWebpackPlugin
 *
 * @public
 */
interface ReactWebpackPluginOptions {
  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.compat.disableCreateSelectorQueryIncompatibleWarning}
   */
  disableCreateSelectorQueryIncompatibleWarning?: boolean | undefined;

  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.firstScreenSyncTiming}
   */
  firstScreenSyncTiming?: 'immediately' | 'jsReady';

  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.enableSSR}
   */
  enableSSR?: boolean;

  /**
   * The chunk names to be considered as main thread chunks.
   */
  mainThreadChunks?: string[] | undefined;

  /**
   * Merge same string literals in JS and Lepus to reduce output bundle size.
   * Set to `false` to disable.
   *
   * @defaultValue false
   */
  extractStr?: Partial<ExtractStrConfig> | boolean;

  /**
   * Whether to enable lazy bundle.
   *
   * @alpha
   */
  experimental_isLazyBundle?: boolean;

  /**
   * Whether to enable profile.
   *
   * @defaultValue `false` when production, `true` when development
   */
  profile?: boolean | undefined;

  /**
   * The file path of `@lynx-js/react/worklet-runtime`.
   */
  workletRuntimePath: string;
}

/**
 * ReactWebpackPlugin allows using ReactLynx with webpack
 *
 * @example
 * ```js
 * // webpack.config.js
 * import { ReactWebpackPlugin } from '@lynx-js/react-webpack-plugin'
 * export default {
 *   plugins: [new ReactWebpackPlugin()],
 * }
 * ```
 *
 * @public
 */
class ReactWebpackPlugin {
  /**
   * The loaders for ReactLynx.
   *
   * @remarks
   * Note that this loader will only transform JSX/TSX to valid JavaScript.
   * For `.tsx` files, the type annotations would not be eliminated.
   * You should use `babel-loader` or `swc-loader` to load TypeScript files.
   *
   * @example
   * ```js
   * // webpack.config.js
   * import { ReactWebpackPlugin, LAYERS } from '@lynx-js/react-webpack-plugin'
   * export default {
   *   module: {
   *     rules: [
   *       {
   *         test: /\.tsx?$/,
   *         layer: LAYERS.MAIN_THREAD,
   *         use: ['swc-loader', ReactWebpackPlugin.loaders.MAIN_THREAD]
   *       },
   *       {
   *         test: /\.tsx?$/,
   *         layer: LAYERS.BACKGROUND,
   *         use: ['swc-loader', ReactWebpackPlugin.loaders.BACKGROUND]
   *       },
   *     ],
   *   },
   *   plugins: [new ReactWebpackPlugin()],
   * }
   * ```
   *
   * @public
   */
  static loaders: Record<keyof typeof LAYERS, string> = {
    BACKGROUND: require.resolve('../lib/loaders/background.js'),
    MAIN_THREAD: require.resolve('../lib/loaders/main-thread.js'),
  };

  constructor(
    private readonly options?: ReactWebpackPluginOptions | undefined,
  ) {}

  /**
   * `defaultOptions` is the default options that the {@link ReactWebpackPlugin} uses.
   *
   * @public
   */
  static defaultOptions: Readonly<Required<ReactWebpackPluginOptions>> = Object
    .freeze<Required<ReactWebpackPluginOptions>>({
      disableCreateSelectorQueryIncompatibleWarning: false,
      firstScreenSyncTiming: 'immediately',
      enableSSR: false,
      mainThreadChunks: [],
      extractStr: false,
      experimental_isLazyBundle: false,
      profile: undefined,
      workletRuntimePath: '',
    });

  /**
   * The entry point of a webpack plugin.
   * @param compiler - the webpack compiler
   */
  apply(compiler: Compiler): void {
    const options = Object.assign(
      {},
      ReactWebpackPlugin.defaultOptions,
      this.options,
    );
    const { BannerPlugin, DefinePlugin, EnvironmentPlugin } = compiler.webpack;

    if (!options.experimental_isLazyBundle) {
      new BannerPlugin({
        // TODO: handle cases that do not have `'use strict'`
        banner:
          `'use strict';var globDynamicComponentEntry=globDynamicComponentEntry||'__Card__';`,
        raw: true,
        test: options.mainThreadChunks!,
      }).apply(compiler);
    }

    new EnvironmentPlugin({
      // Default values of null and undefined behave differently.
      // Use undefined for variables that must be provided during bundling, or null if they are optional.
      DEBUG: null,
    }).apply(compiler);

    new DefinePlugin({
      __DEV__: JSON.stringify(compiler.options.mode === 'development'),
      // We enable profile by default in development.
      // It can also be disabled by environment variable `REACT_PROFILE=false`
      __PROFILE__: JSON.stringify(
        process.env['REACT_PROFILE']
          ?? options.profile
          ?? compiler.options.mode === 'development',
      ),
      // User can enable ALog by environment variable `REACT_ALOG=true`
      __ALOG__: JSON.stringify(Boolean(process.env['REACT_ALOG'])),
      __EXTRACT_STR__: JSON.stringify(Boolean(options.extractStr)),
      __FIRST_SCREEN_SYNC_TIMING__: JSON.stringify(
        options.firstScreenSyncTiming,
      ),
      __ENABLE_SSR__: JSON.stringify(options.enableSSR),
      __DISABLE_CREATE_SELECTOR_QUERY_INCOMPATIBLE_WARNING__: JSON.stringify(
        options.disableCreateSelectorQueryIncompatibleWarning,
      ),
    }).apply(compiler);

    compiler.hooks.thisCompilation.tap(this.constructor.name, compilation => {
      const onceForChunkSet = new WeakSet<Chunk>();

      compilation.hooks.runtimeRequirementInTree.for(
        compiler.webpack.RuntimeGlobals.ensureChunkHandlers,
      ).tap('ReactWebpackPlugin', (_, runtimeRequirements) => {
        runtimeRequirements.add(RuntimeGlobals.lynxProcessEvalResult);
      });

      compilation.hooks.runtimeRequirementInTree.for(
        RuntimeGlobals.lynxProcessEvalResult,
      ).tap('ReactWebpackPlugin', (chunk) => {
        if (onceForChunkSet.has(chunk)) {
          return;
        }
        onceForChunkSet.add(chunk);

        if (chunk.name?.includes(':background')) {
          return;
        }

        const LynxProcessEvalResultRuntimeModule =
          createLynxProcessEvalResultRuntimeModule(compiler.webpack);
        compilation.addRuntimeModule(
          chunk,
          new LynxProcessEvalResultRuntimeModule(),
        );
      });

      compilation.hooks.processAssets.tap(
        {
          name: this.constructor.name,
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        () => {
          for (const name of options.mainThreadChunks ?? []) {
            this.#updateMainThreadInfo(compilation, name);
          }

          compilation.chunkGroups
            // Async ChunkGroups
            .filter(cg => !cg.isInitial())
            // MainThread ChunkGroups
            .filter(cg =>
              cg.origins.every(origin =>
                origin.module?.layer === LAYERS.MAIN_THREAD
              )
            )
            .forEach(cg => {
              const files = cg.getFiles();
              files
                .filter(name => name.endsWith('.js'))
                .forEach(name => this.#updateMainThreadInfo(compilation, name));
            });
        },
      );

      // TODO: replace LynxTemplatePlugin types with Rspack
      // @ts-expect-error Rspack x Webpack compilation not match
      const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation);

      const { RawSource, ConcatSource } = compiler.webpack.sources;
      hooks.beforeEncode.tap(
        this.constructor.name,
        (args) => {
          const lepusCode = args.encodeData.lepusCode;
          if (
            lepusCode.root?.source.source().toString()?.includes(
              'registerWorkletInternal',
            )
          ) {
            lepusCode.chunks.push({
              name: 'worklet-runtime',
              source: new RawSource(fs.readFileSync(
                options.workletRuntimePath,
                'utf8',
              )),
              info: {
                ['lynx:main-thread']: true,
              },
            });
          }
          return args;
        },
      );

      // Inject `module.exports` for async main-thread chunks
      hooks.beforeEncode.tap(this.constructor.name, (args) => {
        const { encodeData } = args;

        // A lazy bundle may not have main-thread code
        if (!encodeData.lepusCode.root) {
          return args;
        }

        if (encodeData.sourceContent.appType === 'card') {
          return args;
        }

        // We inject `module.exports` for each async template.
        compilation.updateAsset(
          encodeData.lepusCode.root.name,
          (old) =>
            new ConcatSource(
              `\
(function (globDynamicComponentEntry) {
  const module = { exports: {} }
  const exports = module.exports;
`,
              old,
              `
  ;return module.exports
})`,
            ),
        );
        return args;
      });

      // The react-transform will add `-react__${LAYER}` to the webpackChunkName.
      // We normalize the chunk name using the resolved module path to ensure
      // that the same file imported via different paths produces a single bundle.
      // See: https://github.com/lynx-family/lynx-stack/issues/455
      hooks.asyncChunkName.tap(
        this.constructor.name,
        (chunkName, chunkGroup) => {
          // First strip the layer suffix from the chunk name
          const nameWithoutLayer = chunkName
            ?.replaceAll(`-react__background`, '')
            ?.replaceAll(`-react__main-thread`, '');

          // Try to normalize using ChunkGroup origin information
          // The origin contains the import request and the module that made the import
          if (chunkGroup && chunkGroup.origins.length > 0) {
            const origin = chunkGroup.origins[0];
            // origin.module is the module that contains the import() statement
            // origin.request is the original import string (e.g., './Foo.jsx')
            if (origin?.module && origin.request) {
              // Get the absolute path of the importing module directly from webpack
              // The 'resource' property contains the resolved absolute path
              const mod = origin.module as { resource?: string };
              const importerPath = mod.resource;

              if (!importerPath) {
                return nameWithoutLayer;
              }

              // Only normalize relative imports (starting with . or ..)
              if (
                !origin.request.startsWith('./')
                && !origin.request.startsWith('../')
              ) {
                return nameWithoutLayer;
              }

              // Resolve the import request relative to the importer's directory
              const importerDir = path.dirname(importerPath);
              const resolvedPath = path.resolve(importerDir, origin.request);

              // Calculate relative path from project root (keep extension)
              const rootContext = compilation.compiler.context;
              const relativePath = path.relative(rootContext, resolvedPath);

              return './' + relativePath;
            }
          }

          // Fallback to the original behavior if no origin info available
          return nameWithoutLayer;
        },
      );
    });
  }

  #updateMainThreadInfo(compilation: Compilation, name: string) {
    const asset = compilation.getAsset(name);

    invariant(asset, `Should have main thread asset ${name}`);

    compilation.updateAsset(
      asset.name,
      asset.source,
      {
        ...asset.info,
        'lynx:main-thread': true,
      },
    );
  }
}

export { ReactWebpackPlugin as ReactWebpackPlugin };
export type { ReactWebpackPluginOptions };
