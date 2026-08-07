// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as fs from 'node:fs';
import { createRequire } from 'node:module';

import type { Chunk, Compilation, Compiler } from '@rspack/core';
import invariant from 'tiny-invariant';

import type {
  ExtractStrConfig,
  TransformBuiltinAttributeNamesOptions,
} from '@lynx-js/react/transform';
import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';
import { RuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

import { LAYERS } from './layer.js';
import { ELEMENT_TEMPLATE_BUILD_INFO } from './loaders/main-thread.js';
import { createLynxProcessEvalResultRuntimeModule } from './LynxProcessEvalResultRuntimeModule.js';
import {
  MTS_SHARED_IMPORTS_BUILD_INFO,
  collectMTSDefines,
  createMTSDefinesRuntimeModule,
  renderLazyMTSDefines,
  sharedModuleWrapper,
} from './MTSDefinesRuntimeModule.js';
import type { MTSSharedImport } from './MTSDefinesRuntimeModule.js';

const require = createRequire(import.meta.url);

interface ElementTemplateBuildInfo {
  templateId: string;
  compiledTemplate: Record<string, unknown>;
}

export interface ModuleWithElementTemplateBuildInfo {
  buildInfo?: Record<string, unknown>;
  modules?: Iterable<ModuleWithElementTemplateBuildInfo>;
}

export function collectElementTemplatesFromModule(
  module: ModuleWithElementTemplateBuildInfo,
): ElementTemplateBuildInfo[] {
  const elementTemplates: ElementTemplateBuildInfo[] = [];
  const templates = module.buildInfo?.[ELEMENT_TEMPLATE_BUILD_INFO];

  if (Array.isArray(templates)) {
    elementTemplates.push(...templates as ElementTemplateBuildInfo[]);
  }

  if (module.modules) {
    for (const nestedModule of module.modules) {
      elementTemplates.push(...collectElementTemplatesFromModule(nestedModule));
    }
  }

  return elementTemplates;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function areCompiledTemplateValuesEqual(
  left: unknown,
  right: unknown,
): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (
      !Array.isArray(left)
      || !Array.isArray(right)
      || left.length !== right.length
    ) {
      return false;
    }

    return left.every((value, index) =>
      areCompiledTemplateValuesEqual(value, right[index])
    );
  }

  if (isPlainRecord(left) || isPlainRecord(right)) {
    if (!isPlainRecord(left) || !isPlainRecord(right)) {
      return false;
    }

    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();

    if (leftKeys.length !== rightKeys.length) {
      return false;
    }

    return leftKeys.every((key, index) =>
      key === rightKeys[index]
      && areCompiledTemplateValuesEqual(left[key], right[key])
    );
  }

  return false;
}

export function mergeElementTemplate(
  elementTemplates: Record<string, Record<string, unknown>>,
  templateId: string,
  compiledTemplate: Record<string, unknown>,
): void {
  const existingTemplate = elementTemplates[templateId];
  if (!existingTemplate) {
    elementTemplates[templateId] = compiledTemplate;
    return;
  }

  if (areCompiledTemplateValuesEqual(existingTemplate, compiledTemplate)) {
    return;
  }

  throw new Error(
    `Element Template id collision for ${templateId}: same template id has different compiledTemplate content.`,
  );
}

export function mergeElementTemplatesFromModule(
  elementTemplates: Record<string, Record<string, unknown>>,
  module: ModuleWithElementTemplateBuildInfo,
): void {
  for (
    const { templateId, compiledTemplate } of collectElementTemplatesFromModule(
      module,
    )
  ) {
    mergeElementTemplate(elementTemplates, templateId, compiledTemplate);
  }
}

/**
 * Collect element templates for a single encoded bundle, scoped to the modules
 * that belong to it. Iterating every module in the compilation would pull other
 * bundles' modules — including dynamic components — into the result, duplicating
 * their templates (e.g. a lazy component's template leaking into the main
 * bundle). An entrypoint's chunk group contains only its initial chunks, so
 * async (dynamic component) modules stay out of the main bundle, and each lazy
 * bundle keeps just its own templates.
 *
 * @internal
 */
export function collectElementTemplatesForEntries<TChunk>(
  entryNames: Iterable<string>,
  getChunkGroup: (name: string) => { chunks: Iterable<TChunk> } | undefined,
  getChunkModules: (
    chunk: TChunk,
  ) => Iterable<ModuleWithElementTemplateBuildInfo>,
): Record<string, Record<string, unknown>> {
  const elementTemplates: Record<string, Record<string, unknown>> = {};
  const visited = new Set<ModuleWithElementTemplateBuildInfo>();
  for (const entryName of entryNames) {
    const chunkGroup = getChunkGroup(entryName);
    if (chunkGroup === undefined) {
      continue;
    }
    for (const chunk of chunkGroup.chunks) {
      for (const module of getChunkModules(chunk)) {
        if (visited.has(module)) {
          continue;
        }
        visited.add(module);
        mergeElementTemplatesFromModule(elementTemplates, module);
      }
    }
  }
  return elementTemplates;
}

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
  firstScreenSyncTiming?: 'immediately' | 'jsReady' | 'manual';

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

  /**
   * Whether to enable Element Template compilation.
   *
   * @experimental
   */
  experimental_useElementTemplate?: boolean;

  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.experimental_enableMTSRendering}
   */
  experimental_enableMTSRendering?: boolean;

  /**
   * The background entry name of each main-thread entry.
   */
  mainThreadEntries?: Record<string, string>;

  /**
   * The builtin attribute-name transform configuration used by runtime spread
   * attributes.
   *
   * @experimental
   */
  experimental_transformBuiltinAttributeNames?:
    | boolean
    | TransformBuiltinAttributeNamesOptions;

  /**
   * Resolved lazy-bundle fetcher mode. Decided by the caller (e.g.
   * `pluginReactLynx`) from the host engine version and any
   * `REACT_LAZY_BUNDLE_FETCHER` env override.
   *
   * @public
   */
  lazyBundleFetcher?: 'FetchBundle' | 'QueryComponent';
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
  static loaders: Record<keyof typeof LAYERS | 'TESTING', string> = {
    BACKGROUND: require.resolve('../lib/loaders/background.js'),
    MAIN_THREAD: require.resolve('../lib/loaders/main-thread.js'),
    TESTING: require.resolve('../lib/loaders/testing.js'),
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
      globalPropsMode: 'reactive',
      enableSSR: false,
      mainThreadChunks: [],
      extractStr: false,
      experimental_isLazyBundle: false,
      profile: undefined,
      workletRuntimePath: '',
      experimental_useElementTemplate: false,
      experimental_enableMTSRendering: true,
      mainThreadEntries: {},
      experimental_transformBuiltinAttributeNames: false,
      lazyBundleFetcher: 'QueryComponent',
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
      // Whether preact devtools is enabled. Enabled by default in development;
      // in production it can be enabled by environment variable `REACT_DEVTOOL`
      // (which also keeps `@lynx-js/preact-devtools` from being stripped). This
      // gates the dev-only runtime hooks that devtools depends on
      // (e.g. `injectLepusMethods`).
      __REACT_DEVTOOL__: JSON.stringify(
        isDev || Boolean(process.env['REACT_DEVTOOL']),
      ),
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
      __USE_ELEMENT_TEMPLATE__: JSON.stringify(
        options.experimental_useElementTemplate,
      ),
      __EXPERIMENTAL_TRANSFORM_BUILTIN_ATTRIBUTE_NAMES__: JSON.stringify(
        options.experimental_transformBuiltinAttributeNames,
      ),
      __LAZY_BUNDLE_FETCHER__: JSON.stringify(options.lazyBundleFetcher),
      __ENABLE_MTS_RENDERING__: JSON.stringify(
        options.experimental_enableMTSRendering,
      ),
    }).apply(compiler);

    if (options.experimental_enableMTSRendering === false) {
      compiler.hooks.finishMake.tapPromise(
        this.constructor.name,
        (compilation) =>
          this.#includeSharedModules(
            compiler,
            compilation,
            Object.keys(options.mainThreadEntries ?? {}),
          ),
      );
    }

    compiler.hooks.thisCompilation.tap(this.constructor.name, compilation => {
      const onceForChunkSet = new WeakSet<Chunk>();

      compilation.hooks.runtimeRequirementInTree.for(
        compiler.webpack.RuntimeGlobals.ensureChunkHandlers,
      ).tap('ReactWebpackPlugin', (_, runtimeRequirements) => {
        runtimeRequirements.add(RuntimeGlobals.lynxProcessEvalResultByHost);
      });

      compilation.hooks.runtimeRequirementInTree.for(
        RuntimeGlobals.lynxProcessEvalResultByHost,
      ).tap('ReactWebpackPlugin', (chunk) => {
        if (onceForChunkSet.has(chunk)) {
          return;
        }
        onceForChunkSet.add(chunk);

        const isMainThreadChunk = Array.from(
          compilation.chunkGraph.getChunkModulesIterable(chunk),
        ).some(module => module.layer === LAYERS.MAIN_THREAD);
        if (!isMainThreadChunk) {
          return;
        }

        const LynxProcessEvalResultRuntimeModule =
          createLynxProcessEvalResultRuntimeModule(compiler.webpack);
        compilation.addRuntimeModule(
          chunk,
          new LynxProcessEvalResultRuntimeModule(),
        );
      });

      if (options.experimental_enableMTSRendering === false) {
        const MTSDefinesRuntimeModule = createMTSDefinesRuntimeModule(
          compiler.webpack,
        );

        compilation.hooks.additionalTreeRuntimeRequirements.tap(
          this.constructor.name,
          (chunk, runtimeRequirements) => {
            for (
              const [mainThreadEntry, backgroundEntry] of Object.entries(
                options.mainThreadEntries ?? {},
              )
            ) {
              if (
                compilation.entrypoints.get(mainThreadEntry)
                  ?.getEntrypointChunk() !== chunk
              ) {
                continue;
              }
              runtimeRequirements.add(
                compiler.webpack.RuntimeGlobals.ensureChunkHandlers,
              );
              runtimeRequirements.add(
                RuntimeGlobals.lynxProcessEvalResultByHost,
              );
              runtimeRequirements.add(
                compiler.webpack.RuntimeGlobals.externalInstallChunk,
              );
              runtimeRequirements.add(compiler.webpack.RuntimeGlobals.require);
              compilation.addRuntimeModule(
                chunk,
                new MTSDefinesRuntimeModule(backgroundEntry),
              );
            }
          },
        );
      }

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

      const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation);

      const { RawSource, ConcatSource } = compiler.webpack.sources;
      hooks.beforeEncode.tap(
        this.constructor.name,
        (args) => {
          const lepusCode = args.encodeData.lepusCode;

          // A lazy bundle has no main-thread chunk of its own in this mode: its
          // section is assembled from the definitions of the modules the
          // background put in its async chunks.
          if (
            options.experimental_enableMTSRendering === false
            && lepusCode.root === undefined
            && args.chunkGroups.length > 0
            && args.chunkGroups.every(cg => !cg.isInitial())
          ) {
            const { chunkGraph } = compilation;
            const defines = collectMTSDefines(
              args.chunkGroups.flatMap(cg => cg.chunks),
              (chunk) => chunkGraph.getChunkModules(chunk),
              (module) => module.identifier(),
            );
            if (defines.length > 0) {
              const name = `${args.intermediate}/main-thread.js`;
              lepusCode.root = {
                name,
                source: new RawSource(
                  renderLazyMTSDefines(defines, `lynx:${name}`),
                ),
                info: { ['lynx:main-thread']: true },
              };
              lepusCode.filename = 'main-thread.js';
            }
          }

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
            const wrappedFiles = new Set<string>();

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

                  // A shared async chunk can belong to multiple chunk groups.
                  if (wrappedFiles.has(file)) {
                    continue;
                  }

                  const asset = compilation.getAsset(file);
                  if (!asset) {
                    continue;
                  }

                  wrappedFiles.add(file);
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

      if (options.experimental_useElementTemplate) {
        hooks.beforeEncode.tap(
          `${this.constructor.name}.ElementTemplate`,
          (args) => {
            const { chunkGraph } = compilation;
            const elementTemplates = collectElementTemplatesForEntries(
              args.chunkGroups.flatMap(cg =>
                cg.name === null || cg.name === undefined ? [] : [cg.name]
              ),
              (name) => compilation.namedChunkGroups.get(name),
              (chunk) =>
                chunkGraph.getChunkModules(
                  chunk,
                ) as ModuleWithElementTemplateBuildInfo[],
            );

            args.encodeData.sourceContent.config['enableUnifyFixedBehavior'] =
              true;
            args.encodeData.elementTemplate = elementTemplates;
            return args;
          },
        );
      }
    });
  }

  /**
   * Compiles the `runtime: 'shared'` modules the collected main-thread
   * definitions reference into the main-thread layer. Each one enters the
   * main-thread entries behind a registering wrapper, so it becomes a real
   * webpack-resolved module in the main-thread chunk — one live instance per
   * thread. The wrapper is a real entry: it runs at chunk bootstrap, after
   * the framework entry, which is early enough because the assembled
   * definitions only look shared modules up at worklet invocation time.
   */
  async #includeSharedModules(
    compiler: Compiler,
    compilation: Compilation,
    mainThreadEntries: string[],
  ): Promise<void> {
    const { EntryPlugin } = compiler.webpack;

    if (mainThreadEntries.length === 0) {
      return;
    }

    // Snapshot the requests before doing anything asynchronous: awaiting while
    // iterating `compilation.modules` lets the compilation take back the module
    // graph the iterator is reading, which aborts the build.
    const requests: {
      id: string;
      request: string;
      context: string;
      from: string;
    }[] = [];
    const seen = new Set<string>();
    for (const module of compilation.modules) {
      const sharedImports = (module.buildInfo
        ?.[MTS_SHARED_IMPORTS_BUILD_INFO]) as MTSSharedImport[] | undefined;
      if (!Array.isArray(sharedImports)) {
        continue;
      }
      const context = module.context ?? compiler.context;
      for (const { id, request } of sharedImports) {
        if (seen.has(id)) {
          continue;
        }
        seen.add(id);
        requests.push({ id, request, context, from: module.identifier() });
      }
    }

    if (requests.length === 0) {
      return;
    }

    const resolver = compilation.resolverFactory.get('normal', {
      dependencyType: 'esm',
    });

    // The request is resolved from the importing module, since the virtual
    // wrapper has no location of its own to resolve a relative request from;
    // the wrapper then imports the resolved path.
    const resolved = await Promise.all(
      requests.map(({ id, request, context, from }) =>
        new Promise<{ id: string; context: string; resource: string }>(
          (resolve, reject) => {
            resolver.resolve({}, context, request, {}, (err, resource) => {
              if (err || typeof resource !== 'string') {
                reject(
                  new Error(
                    `The shared import ${
                      JSON.stringify(request)
                    } of ${from} resolved to no module to compile into the main-thread layer.`,
                  ),
                );
                return;
              }
              resolve({ id, context, resource });
            });
          },
        )
      ),
    );

    // Which main-thread entry needs which shared module is unknowable before
    // the chunk graph exists, so each one enters every main-thread entry. A
    // registration nobody looks up costs size, not behavior.
    await Promise.all(
      resolved.flatMap(({ id, context, resource }) =>
        mainThreadEntries.map((mainThreadEntry) =>
          new Promise<void>((resolve, reject) => {
            compilation.addEntry(
              context,
              EntryPlugin.createDependency(sharedModuleWrapper(id, resource)),
              { name: mainThreadEntry, layer: LAYERS.MAIN_THREAD },
              (err) => {
                if (err) {
                  reject(err);
                  return;
                }
                resolve();
              },
            );
          })
        )
      ),
    );
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
