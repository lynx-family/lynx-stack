// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import type { Chunk, Compilation, Compiler } from '@rspack/core';
import invariant from 'tiny-invariant';

import type { ExtractStrConfig } from '@lynx-js/react/transform';
import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';
import { RuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

import { LAYERS } from './layer.js';
import { createLynxProcessEvalResultRuntimeModule } from './LynxProcessEvalResultRuntimeModule.js';

const require = createRequire(import.meta.url);
const UI_SOURCE_MAP_RECORDS_BUILD_INFO = 'lynxUiSourceMapRecords';
const DEBUG_METADATA_ASSET_NAME = 'debug-metadata.json';

interface UiSourceMapRecord {
  uiSourceMap: number;
  filename: string;
  lineNumber: number;
  columnNumber: number;
  snapshotId: string;
}

interface UiSourceMapData {
  version: 1;
  sources: string[];
  mappings: [number, number, number][];
  uiMaps: number[];
}

interface DebugMetadataAsset {
  uiSourceMap: UiSourceMapData;
  meta: {
    templateDebug: {
      templateUrl: string;
      templateDebugUrl: string;
    };
  };
}

interface ModuleWithUiSourceMapBuildInfo {
  identifier?: () => string;
  buildInfo?: Record<string, unknown>;
  modules?: Iterable<ModuleWithUiSourceMapBuildInfo>;
}

function collectUiSourceMapRecordsFromModule(
  module: ModuleWithUiSourceMapBuildInfo,
): UiSourceMapRecord[] {
  const records = module.buildInfo?.[UI_SOURCE_MAP_RECORDS_BUILD_INFO];
  if (Array.isArray(records)) {
    return records as UiSourceMapRecord[];
  }

  if (module.modules) {
    return Array.from(module.modules)
      .flatMap(nestedModule =>
        collectUiSourceMapRecordsFromModule(nestedModule)
      );
  }

  return [];
}

function compareUiSourceMapRecord(
  a: UiSourceMapRecord,
  b: UiSourceMapRecord,
): number {
  return a.filename.localeCompare(b.filename)
    || a.lineNumber - b.lineNumber
    || a.columnNumber - b.columnNumber
    || a.uiSourceMap - b.uiSourceMap;
}

function normalizeUiSourceMapSource(
  projectRoot: string,
  filename: string,
): string {
  const normalizedFilename = filename.replaceAll(
    path.win32.sep,
    path.posix.sep,
  );

  if (normalizedFilename.length === 0) {
    return normalizedFilename;
  }

  if (path.isAbsolute(filename)) {
    return path.posix.normalize(
      path.relative(projectRoot, filename).replaceAll(
        path.win32.sep,
        path.posix.sep,
      ),
    );
  }

  return path.posix.normalize(normalizedFilename);
}

function resolveTemplateUrl(
  filenameTemplate: string,
  publicPath: Compiler['options']['output']['publicPath'],
): string {
  const normalizedTemplate = filenameTemplate.replaceAll(
    path.win32.sep,
    path.posix.sep,
  );

  if (
    typeof publicPath === 'string'
    && publicPath !== 'auto'
    && publicPath !== '/'
  ) {
    return new URL(normalizedTemplate, publicPath).toString();
  }

  return normalizedTemplate;
}

function createDebugMetadataAsset(
  projectRoot: string,
  records: UiSourceMapRecord[],
  filenameTemplate: string,
  publicPath: Compiler['options']['output']['publicPath'],
  templateDebugUrl: string,
): DebugMetadataAsset {
  const sources: string[] = [];
  const sourceIndexes = new Map<string, number>();
  const mappings: [number, number, number][] = [];
  const uiMaps: number[] = [];

  for (const record of records) {
    if (!record.filename) {
      continue;
    }

    const source = normalizeUiSourceMapSource(projectRoot, record.filename);
    const sourceIndex = sourceIndexes.get(source) ?? sources.length;

    if (!sourceIndexes.has(source)) {
      sourceIndexes.set(source, sourceIndex);
      sources.push(source);
    }

    mappings.push([
      sourceIndex,
      record.lineNumber,
      record.columnNumber,
    ]);
    uiMaps.push(record.uiSourceMap);
  }

  return {
    uiSourceMap: {
      version: 1,
      sources,
      mappings,
      uiMaps,
    },
    meta: {
      templateDebug: {
        templateUrl: resolveTemplateUrl(filenameTemplate, publicPath),
        templateDebugUrl,
      },
    },
  };
}

/**
 * The options for ReactWebpackPlugin
 *
 * @public
 */
interface ReactWebpackPluginOptions {
  /**
   * Whether to emit debug-metadata assets for tasm encode.
   *
   * @defaultValue `false`
   */
  enableUiSourceMap?: boolean;

  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.compat.disableCreateSelectorQueryIncompatibleWarning}
   */
  disableCreateSelectorQueryIncompatibleWarning?: boolean | undefined;

  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.firstScreenSyncTiming}
   */
  firstScreenSyncTiming?: 'immediately' | 'jsReady';

  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.globalPropsMode}
   */
  globalPropsMode?: 'reactive' | 'event';

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
      enableUiSourceMap: false,
      disableCreateSelectorQueryIncompatibleWarning: false,
      firstScreenSyncTiming: 'immediately',
      globalPropsMode: 'reactive',
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

    const isDev = process.env['NODE_ENV'] === 'development'
      || compiler.options.mode === 'development';

    new DefinePlugin({
      __DEV__: isDev,
      // We enable profile by default in development.
      // It can also be disabled by environment variable `REACT_PROFILE=false`
      __PROFILE__: JSON.stringify(
        process.env['REACT_PROFILE']
          ?? options.profile
          ?? isDev,
      ),
      // User can enable ALog by environment variable `REACT_ALOG=true`
      __ALOG__: JSON.stringify(Boolean(process.env['REACT_ALOG'])),
      // User can enable ALog of element API calls by environment variable `REACT_ALOG_ELEMENT_API=true`
      __ALOG_ELEMENT_API__: JSON.stringify(
        Boolean(process.env['REACT_ALOG_ELEMENT_API']),
      ),
      __EXTRACT_STR__: JSON.stringify(Boolean(options.extractStr)),
      __FIRST_SCREEN_SYNC_TIMING__: JSON.stringify(
        options.firstScreenSyncTiming,
      ),
      __GLOBAL_PROPS_MODE__: JSON.stringify(options.globalPropsMode),
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

          if (options.enableUiSourceMap) {
            const uiSourceMapRecords = this.#collectUiSourceMapRecords(
              compilation,
              args.entryNames,
            );
            const debugMetadataAssetName = path.posix.format({
              dir: args.intermediate,
              base: DEBUG_METADATA_ASSET_NAME,
            });
            compilation.emitAsset(
              debugMetadataAssetName,
              new RawSource(
                JSON.stringify(
                  createDebugMetadataAsset(
                    compilation.compiler.context,
                    uiSourceMapRecords,
                    args.filenameTemplate,
                    compiler.options.output.publicPath,
                    String(
                      args.encodeData.compilerOptions['templateDebugUrl']
                        ?? '',
                    ),
                  ),
                  null,
                  2,
                ),
              ),
            );
            args.intermediateAssets.push(debugMetadataAssetName);
          }

          return args;
        },
      );

      if (
        compiler.options.plugins.some(
          (p) => p instanceof LynxTemplatePlugin,
        )
      ) {
        compilation.hooks.processAssets.tap(
          {
            name: this.constructor.name,
            // This wrapper must be injected after size/minify optimizations have
            // produced stable JS, but before devtool plugins finalize sourcemaps and
            // later encode hooks consume the wrapped asset.
            //
            // - Too early (<= OPTIMIZE_SIZE): the wrapper is added before the
            //   minimizer runs. For lazy bundles, the minimizer can treat the wrapped
            //   content as removable and collapse the emitted asset down to empty code.
            // - Too late (>= DEV_TOOLING): SourceMapDevToolPlugin emits `.map` assets
            //   and rewrites JS with `sourceMappingURL` in DEV_TOOLING. If we prepend
            //   wrapper lines after that point, the generated JS shifts but mappings do
            //   not.
            //
            // OPTIMIZE_SIZE + 1 is the safe window where both the emitted code and its
            // sourcemap stay aligned.
            stage:
              compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE
              + 1,
          },
          () => {
            compilation.chunkGroups.forEach(chunkGroup => {
              const isDynamicImport = !chunkGroup.isInitial()
                && chunkGroup.origins.every(
                  origin => origin.module?.layer === LAYERS.MAIN_THREAD,
                );

              chunkGroup.chunks.forEach(chunk => {
                for (const file of chunk.files) {
                  if (!file.endsWith('.js')) {
                    continue;
                  }

                  const shouldInjectWrapper = isDynamicImport
                    || (options.experimental_isLazyBundle
                      && options.mainThreadChunks?.includes(file));
                  if (!shouldInjectWrapper) {
                    continue;
                  }

                  const asset = compilation.getAsset(file);
                  if (!asset) {
                    continue;
                  }

                  compilation.updateAsset(
                    file,
                    old =>
                      new ConcatSource(
                        `(function (globDynamicComponentEntry) {\n`,
                        `  const module = { exports: {} }\n`,
                        `  const exports = module.exports;\n`,
                        old,
                        `\n  ;return module.exports\n})`,
                      ),
                  );
                }
              });
            });
          },
        );
      }

      // The react-transform will add `-react__${LAYER}` to the webpackChunkName.
      // We replace it with an empty string here to make sure main-thread & background chunk match.
      hooks.asyncChunkName.tap(
        this.constructor.name,
        (chunkName) =>
          chunkName
            ?.replaceAll(`-react__background`, '')
            ?.replaceAll(`-react__main-thread`, ''),
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

  #collectUiSourceMapRecords(
    compilation: Compilation,
    entryNames: string[],
  ): UiSourceMapRecord[] {
    const moduleSet = new Set<ModuleWithUiSourceMapBuildInfo>();

    for (const entryName of entryNames) {
      const chunkGroup = compilation.namedChunkGroups.get(entryName)
        ?? compilation.entrypoints.get(entryName);
      if (!chunkGroup) {
        continue;
      }

      for (const chunk of chunkGroup.chunks) {
        for (
          const module of compilation.chunkGraph.getChunkModulesIterable(chunk)
        ) {
          moduleSet.add(module as ModuleWithUiSourceMapBuildInfo);
        }
      }
    }

    const deduped = new Map<string, UiSourceMapRecord>();
    for (const module of moduleSet) {
      for (const record of collectUiSourceMapRecordsFromModule(module)) {
        const key = [
          record.uiSourceMap,
          record.filename,
          record.lineNumber,
          record.columnNumber,
          record.snapshotId,
        ].join(':');
        deduped.set(key, record);
      }
    }

    return Array.from(deduped.values()).sort(compareUiSourceMapRecord);
  }
}

export { ReactWebpackPlugin as ReactWebpackPlugin };
export type { ReactWebpackPluginOptions };
