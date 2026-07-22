// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path';

import type {
  Asset,
  Chunk,
  ChunkGroup,
  Compilation,
  Compiler,
} from '@rspack/core';
import {
  AsyncSeriesBailHook,
  AsyncSeriesWaterfallHook,
  SyncWaterfallHook,
} from '@rspack/lite-tapable';
import groupBy from 'object.groupby';

import type * as CSS from '@lynx-js/css-serializer';
import { cssChunksToMap } from '@lynx-js/css-serializer';
import { RuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

import { createLynxAsyncChunksRuntimeModule } from './LynxAsyncChunksRuntimeModule.js';

export type OriginManifest = Record<string, {
  content: string;
  size: number;
}>;

/**
 * The options for encoding a Lynx bundle.
 *
 * @public
 */
export interface EncodeOptions {
  manifest?: Record<string, string | undefined> | undefined;
  compilerOptions: Record<string, string | boolean>;
  lepusCode: {
    root: string | undefined;
    lepusChunk: Record<string, string>;
    filename: string | undefined;
  } | undefined;
  // `customSections` option only takes effect on Lynx >= 2.16.
  customSections: Record<string, {
    type?: 'lazy';
    encoding?: 'JsBytecode' | 'CSS';
    content: string | Record<string, unknown> | undefined;
  }>;
  /**
   * Element template data used by encoders that support element template output.
   */
  elementTemplate?: Record<string, unknown>;
  [k: string]: unknown;
}

// Use `Symbol.for` so duplicate copies of this module (e.g. from an npm hoist
// conflict that nests two copies under node_modules) share the same hooks slot.
const LYNX_TEMPLATE_HOOKS_KEY: unique symbol = Symbol.for(
  '@lynx-js/template-webpack-plugin/hooks',
) as never;

/**
 * To allow other plugins to alter the Template, this plugin executes
 * {@link https://github.com/webpack/tapable | tapable} hooks.
 *
 * @example
 * ```js
 * class MyPlugin {
 *   apply(compiler) {
 *     compiler.hooks.compilation.tap("MyPlugin", (compilation) => {
 *       console.log("The compiler is starting a new compilation...");
 *
 *       LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation).beforeEmit.tapAsync(
 *         "MyPlugin", // <-- Set a meaningful name here for stacktraces
 *         (data, cb) => {
 *           // Manipulate the content
 *           modifyTemplate(data.template)
 *           // Tell webpack to move on
 *           cb(null, data);
 *         },
 *       );
 *     });
 *   }
 * }
 * ```
 *
 * @public
 */
export interface TemplateHooks {
  /**
   * Get the real name of an async chunk. The files with the same `asyncChunkName` will be placed in the same template.
   *
   * @alpha
   */
  asyncChunkName: SyncWaterfallHook<string>;

  /**
   * Called before the encode process. Can be used to modify the encode options.
   *
   * @alpha
   */
  beforeEncode: AsyncSeriesWaterfallHook<{
    encodeData: EncodeRawData;
    filenameTemplate: string;
    /**
     * The chunk groups covered by this template.
     */
    chunkGroups: ChunkGroup[];
    intermediate: string;
    intermediateAssets: string[];
  }>;

  /**
   * Call the encode process.
   *
   * @alpha
   */
  encode: AsyncSeriesBailHook<
    {
      encodeOptions: EncodeOptions;
      intermediate?: string;
    },
    { buffer: Buffer; debugInfo: string; cssDiagnostics?: string }
  >;

  /**
   * Called before the template is emitted. Can be used to modify the template.
   *
   * @alpha
   */
  beforeEmit: AsyncSeriesWaterfallHook<{
    finalEncodeOptions: EncodeOptions;
    debugInfo: string;
    cssDiagnostics?: string;
    template: Buffer;
    outputName: string;
    mainThreadAssets: Asset[];
    cssChunks: Asset[];
    /**
     * The chunk groups covered by this template.
     */
    chunkGroups: ChunkGroup[];
  }>;

  /**
   * Called after the template is emitted.
   *
   * @alpha
   */
  afterEmit: AsyncSeriesWaterfallHook<{
    outputName: string;
  }>;
}

/**
 * Add hooks to the webpack compilation object to allow foreign plugins to
 * extend the LynxTemplatePlugin
 */
function createLynxTemplatePluginHooks(): TemplateHooks {
  return {
    asyncChunkName: new SyncWaterfallHook(['pluginArgs']),
    beforeEncode: new AsyncSeriesWaterfallHook(['pluginArgs']),
    encode: new AsyncSeriesBailHook(['pluginArgs']),
    beforeEmit: new AsyncSeriesWaterfallHook(['pluginArgs']),
    afterEmit: new AsyncSeriesWaterfallHook(['pluginArgs']),
  };
}

/**
 * The options for LynxTemplatePlugin
 *
 * @public
 */
export interface LynxTemplatePluginOptions {
  /**
   * The file to write the template to.
   * Supports subdirectories eg: `assets/template.js`.
   * [name] will be replaced by the entry name.
   * Supports a function to generate the name.
   *
   * @defaultValue `'[name].bundle'`
   */
  filename?: string | ((entryName: string) => string);

  /**
   * The filename of the lazy bundle.
   *
   * @defaultValue `'lazy-bundle/[name].[fullhash].bundle'`
   */
  lazyBundleFilename?: string;

  /**
   * {@inheritdoc @lynx-js/rspeedy#DistPath.intermediate}
   */
  intermediate?: string;

  /**
   * List all entries which should be injected
   *
   * @defaultValue `'all'`
   */
  chunks?: 'all' | string[];

  /**
   * List all entries which should not be injected
   *
   * @defaultValue `[]`
   */
  excludeChunks?: string[];

  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.customCSSInheritanceList}
   *
   * @example
   *
   * By setting `customCSSInheritanceList: ['direction', 'overflow']`, only the `direction` and `overflow` properties are inheritable.
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   *
   * export default defineConfig({
   *  plugins: [
   *    pluginReactLynx({
   *      enableCSSInheritance: true,
   *      customCSSInheritanceList: ['direction', 'overflow']
   *    }),
   *  ],
   * }
   * ```
   */
  customCSSInheritanceList: string[] | undefined;

  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.debugInfoOutside}
   */
  debugInfoOutside: boolean;

  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.defaultDisplayLinear}
   */
  defaultDisplayLinear: boolean;

  /**
   * Declare the current dsl to the encoder.
   *
   * @public
   */
  dsl?: 'tt' | 'react' | 'react_nodiff';

  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.enableAccessibilityElement}
   */
  enableAccessibilityElement: boolean;

  /**
   * Use Android View level APIs and system implementations.
   */
  enableA11y: boolean;

  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.enableCSSInheritance}
   */
  enableCSSInheritance: boolean;

  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.enableCSSInvalidation}
   */
  enableCSSInvalidation: boolean;

  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.enableCSSSelector}
   */
  enableCSSSelector: boolean;

  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.enableNewGesture}
   */
  enableNewGesture: boolean;

  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.enableRemoveCSSScope}
   */
  enableRemoveCSSScope: boolean;

  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.removeDescendantSelectorScope}
   */
  removeDescendantSelectorScope: boolean;

  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.targetSdkVersion}
   */
  targetSdkVersion: string;

  /**
   * When enabled, the default overflow CSS property for views and components will be `'visible'`. Otherwise, it will be `'hidden'`.
   *
   * @defaultValue `true`
   */
  defaultOverflowVisible?: boolean;

  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.experimental_isLazyBundle}
   *
   * @alpha
   */
  experimental_isLazyBundle?: boolean;

  /**
   * Resolved lazy-bundle fetcher mode. Decided by the caller (e.g.
   * `pluginReactLynx`) from the host engine version and any
   * `REACT_LAZY_BUNDLE_FETCHER` env override.
   *
   * @public
   */
  lazyBundleFetcher?: 'FetchBundle' | 'QueryComponent';

  /**
   * plugins passed to parser
   */
  cssPlugins: CSS.Plugin[];
}

interface EncodeRawData {
  compilerOptions: {
    enableCSSSelector: boolean;
    targetSdkVersion: string;
    [k: string]: string | boolean;
  };
  /**
   * main-thread
   */
  lepusCode: {
    root: Asset | undefined;
    chunks: Asset[];
    filename: string | undefined;
  };
  /**
   * background thread
   */
  manifest: Record<string, string>;
  css: {
    chunks: Asset[];
  } & ReturnType<typeof cssChunksToMap>;
  // `customSections` option only takes effect on Lynx >= 2.16.
  customSections: Record<string, {
    type?: 'lazy';
    encoding?: 'JsBytecode' | 'CSS';
    content: string | Record<string, unknown>;
  }>;
  sourceContent: {
    dsl: string;
    appType: string;
    config: Record<string, unknown>;
  };
  elementTemplate?: Record<string, unknown>;
  [k: string]: unknown;
}

/**
 * LynxTemplatePlugin
 *
 * @public
 */
export class LynxTemplatePlugin {
  constructor(private options?: LynxTemplatePluginOptions | undefined) {}

  /**
   * Returns all public hooks of the Lynx template webpack plugin for the given compilation
   */
  static getLynxTemplatePluginHooks(compilation: Compilation): TemplateHooks {
    const stash = compilation as unknown as {
      [LYNX_TEMPLATE_HOOKS_KEY]?: TemplateHooks;
    };
    let hooks = stash[LYNX_TEMPLATE_HOOKS_KEY];
    // Setup the hooks only once
    if (hooks === undefined) {
      hooks = createLynxTemplatePluginHooks();
      stash[LYNX_TEMPLATE_HOOKS_KEY] = hooks;
    }
    return hooks;
  }

  /**
   * Map an async chunk id to `<lazy bundle name>/<layer>`, used to route a lazy
   * bundle's intermediate js/css/hmr outputs into a single per-bundle directory.
   * Returns undefined for non-lazy chunks.
   */
  static getAsyncChunkLayoutName(
    compilation: Compilation,
    chunkId: string | number,
  ): string | undefined {
    return LynxTemplatePluginImpl.getAsyncChunkLayoutName(compilation, chunkId);
  }

  /**
   * `defaultOptions` is the default options that the {@link LynxTemplatePlugin} uses.
   *
   * @example
   * `defaultOptions` can be used to change part of the option and keep others as the default value.
   *
   * ```js
   * // webpack.config.js
   * import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'
   * export default {
   *   plugins: [
   *     new LynxTemplatePlugin({
   *       ...LynxTemplatePlugin.defaultOptions,
   *       enableRemoveCSSScope: true,
   *     }),
   *   ],
   * }
   * ```
   *
   * @public
   */
  static defaultOptions: Readonly<Required<LynxTemplatePluginOptions>> = Object
    .freeze<Required<LynxTemplatePluginOptions>>({
      filename: '[name].bundle',
      lazyBundleFilename: 'lazy-bundle/[name].[fullhash].bundle',
      intermediate: '.rspeedy',
      chunks: 'all',
      excludeChunks: [],

      // lynx-specific
      customCSSInheritanceList: undefined,
      debugInfoOutside: true,
      enableA11y: true,
      enableAccessibilityElement: false,
      enableCSSInheritance: false,
      enableCSSInvalidation: false,
      enableCSSSelector: true,
      enableNewGesture: false,
      defaultDisplayLinear: true,
      enableRemoveCSSScope: false,
      targetSdkVersion: '3.2',
      defaultOverflowVisible: true,
      removeDescendantSelectorScope: false,
      dsl: 'react_nodiff',

      experimental_isLazyBundle: false,
      lazyBundleFetcher: 'QueryComponent',
      cssPlugins: [],
    });

  /**
   * Convert the css chunks to css map.
   *
   * @param cssChunks - The CSS chunks content.
   * @param options - The encode options.
   * @returns The CSS map and css source.
   *
   * @remarks
   *
   * This helper currently forwards to `cssChunksToMap`.
   *
   * The returned `cssSource` is keyed by `cssId` and uses the synthetic
   * filename format `/cssId/<id>.css`.
   *
   * This helper does not remap generated `loc` fields to original source
   * coordinates.
   *
   * @example
   * ```
   * (console.log(await convertCSSChunksToMap(
   *   '.red { color: red; }',
   *   {
   *     targetSdkVersion: '3.2',
   *     enableCSSSelector: true,
   *   },
   * )));
   * ```
   */
  static convertCSSChunksToMap(
    cssChunks: Array<
      string | {
        content: string;
      }
    >,
    plugins: CSS.Plugin[],
    enableCSSSelector: boolean,
  ): {
    cssMap: Record<string, CSS.LynxStyleNode[]>;
    cssSource: Record<string, string>;
  } {
    return cssChunksToMap(cssChunks, plugins, enableCSSSelector);
  }

  /**
   * The entry point of a webpack plugin.
   * @param compiler - the webpack compiler
   */
  apply(compiler: Compiler): void {
    new LynxTemplatePluginImpl(
      compiler,
      Object.assign({}, LynxTemplatePlugin.defaultOptions, this.options),
    );
  }
}

const SECTION_MAIN_THREAD = 'main-thread';
const SECTION_BACKGROUND = 'background';
const SECTION_CSS = 'CSS';

interface CustomSectionEntry {
  type?: 'lazy';
  encoding?: 'JsBytecode' | 'CSS';
  content: string | Record<string, unknown>;
}

class LynxTemplatePluginImpl {
  name = 'LynxTemplatePlugin';

  static #taskQueue: Array<() => Promise<void>> | null = null;

  // Static so it spans the one-instance-per-entry plugins, whose serial
  // same-stage taps would otherwise feed the encode pool one template at a time.
  static #templateQueues: WeakMap<Compilation, Promise<void>[]> = new WeakMap();

  static #asyncLayoutInstalled = new WeakSet<Compiler>();

  /**
   * Route a lazy bundle's intermediate JS chunk to
   * `<intermediateRoot>/lazy-bundle/<name>/<layer>.js`, co-located with the bundle's
   * other intermediate outputs (mirroring `<intermediateRoot>/main/`).
   * Non-lazy chunks keep the default `output.chunkFilename`. Installed once
   * per compiler — the plugin is instantiated once per entry.
   */
  static #installAsyncChunkLayout(
    compiler: Compiler,
    intermediateRoot: string,
  ): void {
    if (LynxTemplatePluginImpl.#asyncLayoutInstalled.has(compiler)) {
      return;
    }
    LynxTemplatePluginImpl.#asyncLayoutInstalled.add(compiler);

    const prefix = intermediateRoot === '.' ? '' : `${intermediateRoot}/`;
    let compilation: Compilation | undefined;
    compiler.hooks.thisCompilation.tap(this.name, c => {
      compilation = c;
    });

    // `environment` fires after `applyRspackOptionsDefaults`, so the default
    // `output.chunkFilename` is resolved and can serve as the fallback.
    compiler.hooks.environment.tap(this.name, () => {
      const original = compiler.options.output.chunkFilename;

      compiler.options.output.chunkFilename = (pathData, assetInfo) => {
        const id = pathData.chunk?.id;
        if (compilation !== undefined && id !== undefined && id !== null) {
          const layoutName = LynxTemplatePluginImpl.getAsyncChunkLayoutName(
            compilation,
            id,
          );
          if (layoutName !== undefined) {
            return `${prefix}lazy-bundle/${layoutName}.js`;
          }
        }
        return typeof original === 'function'
          ? original(pathData, assetInfo)
          : original ?? '[id].js';
      };
    });
  }

  constructor(
    compiler: Compiler,
    options: Required<LynxTemplatePluginOptions>,
  ) {
    this.#options = options;

    LynxTemplatePluginImpl.#installAsyncChunkLayout(
      compiler,
      path.dirname(options.intermediate).replace(/\\/g, '/'),
    );

    // entryName to fileName conversion function
    const userOptionFilename = this.#options.filename;

    const filenameFunction = typeof userOptionFilename === 'function'
      ? userOptionFilename
      // Replace '[name]' with entry name
      : (entryName: string) =>
        userOptionFilename.replace(/\[name\]/g, entryName);

    /** output filenames for the given entry names */
    const entryNames = Object.keys(compiler.options.entry);
    const outputFileNames = new Set(
      (entryNames.length > 0 ? entryNames : ['main']).map((name) =>
        filenameFunction(name)
      ),
    );

    // convert absolute filenames into relative ones so that webpack can
    // generate them at the correct location
    const filenames = [...outputFileNames].map((outputFileName) => {
      if (path.resolve(outputFileName) === path.normalize(outputFileName)) {
        /** Once initialized the path is always a string */
        return path.relative(compiler.options.output.path!, outputFileName);
      }
      return outputFileName;
    });

    compiler.hooks.thisCompilation.tap(this.name, (compilation) => {
      const templateQueue = LynxTemplatePluginImpl.#templateQueue(
        compilation,
        compiler,
      );

      for (const filename of filenames) {
        compilation.hooks.processAssets.tap(
          {
            name: this.name,
            stage:
              /**
               * Generate the html after minification and dev tooling is done
               * and source-map is generated
               */
              compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_HASH,
          },
          // Don't await here — the coordinator awaits the whole queue, so
          // sibling entries' encodes reach the pool concurrently.
          () => {
            templateQueue.push(
              this.#generateTemplate(compiler, compilation, filename),
            );
          },
        );
      }
    });

    compiler.hooks.thisCompilation.tap(this.name, compilation => {
      const onceForChunkSet = new WeakSet<Chunk>();
      const LynxAsyncChunksRuntimeModule = createLynxAsyncChunksRuntimeModule(
        compiler.webpack,
      );

      const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation);

      compilation.hooks.runtimeRequirementInTree.for(
        RuntimeGlobals.lynxAsyncChunkIds,
      ).tap(this.name, (chunk, set) => {
        if (onceForChunkSet.has(chunk)) {
          return;
        }
        onceForChunkSet.add(chunk);

        // TODO: only add `getFullHash` when using fullhash
        set.add(compiler.webpack.RuntimeGlobals.getFullHash);

        compilation.addRuntimeModule(
          chunk,
          new LynxAsyncChunksRuntimeModule((asyncChunk) => {
            const mappedFilename = LynxTemplatePluginImpl
              .#getLazyBundleNameByChunkId(compilation)
              .get(asyncChunk.id!);
            const filename = mappedFilename === ''
              ? undefined
              : mappedFilename
                ?? (asyncChunk.name !== null && asyncChunk.name !== undefined
                  ? hooks.asyncChunkName.call(asyncChunk.name)
                  : undefined);

            if (filename === undefined || filename === '') {
              return undefined;
            }

            return this.#getAsyncFilenameTemplate(filename);
          }),
        );
      });

      compilation.hooks.processAssets.tapPromise({
        name: this.name,
        stage:
          /**
           * Generate the html after minification and dev tooling is done
           * and source-map is generated
           * and real content hash is generated
           */
          compiler.webpack.Compilation
            .PROCESS_ASSETS_STAGE_OPTIMIZE_HASH,
      }, async () => {
        await this.#generateAsyncTemplate(compilation);
      });
    });

    // There are multiple `LynxTemplatePlugin`s registered in one compiler.
    // We only want to tap `hooks.done` on one of them.
    if (LynxTemplatePluginImpl.#taskQueue === null) {
      LynxTemplatePluginImpl.#taskQueue = [];

      compiler.hooks.done.tap(this.name, () => {
        const queue = LynxTemplatePluginImpl.#taskQueue;
        LynxTemplatePluginImpl.#taskQueue = [];
        if (queue) {
          Promise.all(queue.map(fn => fn()))
            .catch((error) => {
              compiler.getInfrastructureLogger('LynxTemplatePlugin').error(
                error,
              );
            });
        }
      });
    }
  }

  // Returns the compilation's template-build queue, lazily creating it and
  // registering the coordinator tap (one stage later) that awaits the queue.
  static #templateQueue(
    compilation: Compilation,
    compiler: Compiler,
  ): Promise<void>[] {
    const existing = LynxTemplatePluginImpl.#templateQueues.get(compilation);
    if (existing) {
      return existing;
    }

    const queue: Promise<void>[] = [];
    LynxTemplatePluginImpl.#templateQueues.set(compilation, queue);
    compilation.hooks.processAssets.tapPromise({
      name: 'LynxTemplatePlugin:await-templates',
      stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_HASH
        + 1,
    }, async () => {
      // allSettled (not all): every encode was started eagerly, so wait for all
      // of them to finish before the phase unwinds — otherwise a single
      // rejection would let webpack move on while siblings still emit assets.
      const results = await Promise.allSettled(queue.splice(0));
      for (const result of results) {
        if (result.status === 'rejected') {
          compilation.errors.push(result.reason as Error);
        }
      }
    });
    return queue;
  }

  async #generateTemplate(
    _compiler: Compiler,
    compilation: Compilation,
    filenameTemplate: string,
  ) {
    // Get all entry point names for this template file
    const entryNames = Array.from(compilation.entrypoints.keys());
    const filteredEntryNames = this.#filterEntryChunks(
      entryNames,
      this.#options.chunks,
      this.#options.excludeChunks,
    );

    const assetsInfoByGroups = this.#getAssetsInformationByGroups(
      compilation,
      filteredEntryNames,
    );

    await this.#encodeByAssetsInformation(
      compilation,
      assetsInfoByGroups,
      filteredEntryNames
        .map(name =>
          compilation.namedChunkGroups.get(name)
            ?? compilation.entrypoints.get(name)
        )
        .filter((cg): cg is ChunkGroup => cg !== undefined),
      filenameTemplate,
      this.#options.intermediate,
      /** isAsync */ this.#options.experimental_isLazyBundle,
    );
  }

  static #asyncChunkGroups = new WeakMap<
    Compilation,
    Record<string, ChunkGroup[]>
  >();

  static #getChunkGroupFiles(
    compilation: Compilation,
    chunkGroups: ChunkGroup[],
  ) {
    // Merged chunk groups may share chunks, so dedupe the files.
    return Array.from(new Set(chunkGroups.flatMap(cg => cg.getFiles())))
      .filter(chunkFile =>
        predicateNonHotModuleReplacementAsset(chunkFile, compilation)
      );
  }

  static #chunkGroupCanEmitJavaScript(
    compilation: Compilation,
    chunkGroup: ChunkGroup,
  ) {
    return chunkGroup.chunks.some(chunk => {
      if (compilation.chunkGraph.getNumberOfEntryModules(chunk) > 0) {
        return true;
      }
      const modules = compilation.chunkGraph
        .getChunkModulesIterableBySourceType(chunk, 'javascript');
      // Rspack exposes Module Federation remote placeholders as JavaScript
      // modules even though they are fulfilled by the remotes runtime and do
      // not emit a chunk asset.
      return Array.from(modules ?? []).some(
        module => module.type !== 'remote-module',
      );
    });
  }

  static #getAsyncChunkGroups(compilation: Compilation) {
    let asyncChunkGroups = LynxTemplatePluginImpl.#asyncChunkGroups.get(
      compilation,
    );

    if (asyncChunkGroups) {
      return asyncChunkGroups;
    }

    const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation);

    const resources = collectChunkGroupResources(compilation);
    const context = compilation.compiler.context;

    asyncChunkGroups = groupBy(
      compilation.chunkGroups.filter(cg => !cg.isInitial()),
      cg => {
        // A `webpackChunkName` is user-provided (the react transform no longer
        // injects one) — group by it, after the `asyncChunkName` hook. Unnamed
        // chunk groups are grouped by the resolved modules of their dynamic
        // imports so that the same file imported via different paths (relative
        // or alias) produces a single lazy bundle.
        // See https://github.com/lynx-family/lynx-stack/issues/455
        if (cg.name !== null && cg.name !== undefined) {
          return hooks.asyncChunkName.call(cg.name);
        }
        const chunkGroupResources = resources.get(cg);
        if (chunkGroupResources) {
          return resourcesToLazyBundleName(chunkGroupResources, context);
        }
        return '';
      },
    );

    LynxTemplatePluginImpl.#asyncChunkGroups.set(compilation, asyncChunkGroups);

    return asyncChunkGroups;
  }

  static #lazyBundleNames = new WeakMap<
    Compilation,
    Map<string | number, string>
  >();

  static #getLazyBundleNameByChunkId(compilation: Compilation) {
    let lazyBundleNames = LynxTemplatePluginImpl.#lazyBundleNames.get(
      compilation,
    );

    if (lazyBundleNames) {
      return lazyBundleNames;
    }

    lazyBundleNames = new Map<string | number, string>();

    for (
      const [filename, chunkGroups] of Object.entries(
        LynxTemplatePluginImpl.#getAsyncChunkGroups(compilation),
      )
    ) {
      for (const chunkGroup of chunkGroups) {
        const mappedFilename =
          LynxTemplatePluginImpl.#chunkGroupCanEmitJavaScript(
              compilation,
              chunkGroup,
            )
            ? filename
            // Keep a tombstone for known assetless chunks so the named-chunk
            // fallback does not invent a lazy-bundle URL for them.
            : '';

        for (const chunk of chunkGroup.chunks) {
          if (chunk.id !== null && chunk.id !== undefined) {
            lazyBundleNames.set(chunk.id, mappedFilename);
          }
        }
      }
    }

    LynxTemplatePluginImpl.#lazyBundleNames.set(compilation, lazyBundleNames);

    return lazyBundleNames;
  }

  static #asyncLayoutNames = new WeakMap<
    Compilation,
    Map<string | number, string>
  >();

  /**
   * Map an async chunk id to `<lazy bundle name>/<layer>` (e.g.
   * `src/Foo.tsx/main-thread`), so intermediate js/css/hmr outputs can be
   * co-located per lazy bundle. Returns undefined for non-lazy chunks.
   */
  static getAsyncChunkLayoutName(
    compilation: Compilation,
    chunkId: string | number,
  ): string | undefined {
    let layoutNames = LynxTemplatePluginImpl.#asyncLayoutNames.get(compilation);

    if (!layoutNames) {
      layoutNames = new Map<string | number, string>();
      const { chunkGraph } = compilation;
      for (
        const [name, chunkGroups] of Object.entries(
          LynxTemplatePluginImpl.#getAsyncChunkGroups(compilation),
        )
      ) {
        // A named chunk group means the user wrote an explicit
        // `webpackChunkName` — keep the user-controlled `[name]` placement.
        // Context imports (`import(`./x/${y}`)`) group under an empty name
        // and are not lazy bundles — leave them on the default template.
        if (
          name === ''
          || chunkGroups.some(cg => cg.name !== null && cg.name !== undefined)
        ) {
          continue;
        }
        for (const chunk of chunkGroups.flatMap(cg => cg.chunks)) {
          if (chunk.id === null || chunk.id === undefined) {
            continue;
          }
          let layer: string | undefined;
          for (const module of chunkGraph.getChunkModulesIterable(chunk)) {
            if (module.layer) {
              layer = String(module.layer).split(':').pop();
              break;
            }
          }
          layoutNames.set(chunk.id, layer ? `${name}/${layer}` : name);
        }
      }
      LynxTemplatePluginImpl.#asyncLayoutNames.set(compilation, layoutNames);
    }

    return layoutNames.get(chunkId);
  }

  #getAsyncFilenameTemplate(filename: string) {
    return this.#options.lazyBundleFilename.replace(
      /\[name\]/,
      filename,
    );
  }

  static #encodedTemplate = new WeakMap<Compilation, Set<string>>();

  async #generateAsyncTemplate(compilation: Compilation) {
    const asyncChunkGroups = LynxTemplatePluginImpl.#getAsyncChunkGroups(
      compilation,
    );

    const intermediateRoot = path.dirname(this.#options.intermediate);

    // We cache the encoded template so that it will not be encoded twice
    if (!LynxTemplatePluginImpl.#encodedTemplate.has(compilation)) {
      LynxTemplatePluginImpl.#encodedTemplate.set(compilation, new Set());
    }

    const encodedTemplate = LynxTemplatePluginImpl.#encodedTemplate.get(
      compilation,
    )!;

    await Promise.all(
      Object.entries(asyncChunkGroups).map(
        ([filename, chunkGroups]): Promise<void> => {
          // If no filename is found, avoid generating async template
          if (!filename) {
            return Promise.resolve();
          }

          const chunkFiles = LynxTemplatePluginImpl.#getChunkGroupFiles(
            compilation,
            chunkGroups,
          );
          if (chunkFiles.length === 0) {
            return Promise.resolve();
          }

          const filenameTemplate = this.#getAsyncFilenameTemplate(filename);

          // Ignore the encoded templates
          if (encodedTemplate.has(filenameTemplate)) {
            return Promise.resolve();
          }

          encodedTemplate.add(filenameTemplate);

          const asyncAssetsInfoByGroups = this.#getAssetsInformationByFilenames(
            compilation,
            chunkFiles,
          );

          return this.#encodeByAssetsInformation(
            compilation,
            asyncAssetsInfoByGroups,
            chunkGroups,
            filenameTemplate,
            path.join(intermediateRoot, 'lazy-bundle', filename),
            /** isAsync */ true,
          );
        },
      ),
    );
  }

  async #encodeByAssetsInformation(
    compilation: Compilation,
    assetsInfoByGroups: AssetsInformationByGroups,
    chunkGroups: ChunkGroup[],
    filenameTemplate: string,
    intermediate: string,
    isAsync: boolean,
  ): Promise<void> {
    const compiler = compilation.compiler;

    const {
      customCSSInheritanceList,
      debugInfoOutside,
      defaultDisplayLinear,
      enableA11y,
      enableAccessibilityElement,
      enableCSSInheritance,
      enableCSSInvalidation,
      enableCSSSelector,
      enableNewGesture,
      enableRemoveCSSScope,
      removeDescendantSelectorScope,
      targetSdkVersion,
      defaultOverflowVisible,
      dsl,
      cssPlugins,
    } = this.#options;

    const isDev = process.env['NODE_ENV'] === 'development'
      || compiler.options.mode === 'development';

    const initialCSS = cssChunksToMap(
      assetsInfoByGroups.css
        .map(chunk => compilation.getAsset(chunk.name))
        .filter((v): v is Asset => !!v)
        .map(asset => asset.source.source().toString()),
      cssPlugins,
      enableCSSSelector,
    );

    const intermediatePosix = intermediate.replace(/\\/g, '/');

    const encodeRawData: EncodeRawData = {
      compilerOptions: {
        enableFiberArch: true,
        useLepusNG: true,
        enableReuseContext: true,
        bundleModuleMode: 'ReturnByFunction',
        // Will be filled later in `@lynx-js/debug-metadata-rsbuild-plugin`
        templateDebugUrl: '',

        debugInfoOutside,
        defaultDisplayLinear,
        enableCSSInvalidation,
        enableCSSSelector,
        enableLepusDebug: isDev,
        enableRemoveCSSScope,
        targetSdkVersion,
        defaultOverflowVisible,
      },
      sourceContent: {
        dsl,
        appType: isAsync ? 'DynamicComponent' : 'card',
        config: {
          lepusStrict: true,
          useNewSwiper: true,
          enableNewIntersectionObserver: true,
          enableNativeList: true,
          enableNewSticky: true,
          flexBasisZeroPercent: true,
          enableGridPlacementShorthands: true,
          syncXElementRegistry: true,
          enableA11y,
          enableAccessibilityElement,
          customCSSInheritanceList,
          enableCSSInheritance,
          enableNewGesture,
          removeDescendantSelectorScope,
          // Will be filled later in `@lynx-js/debug-metadata-rsbuild-plugin`
          debugMetadataUrl: '',
        },
      },
      css: {
        ...initialCSS,
        chunks: assetsInfoByGroups.css,
      },
      lepusCode: {
        // TODO: support multiple lepus chunks
        root: assetsInfoByGroups.mainThread[0],
        chunks: [],
        filename: (() => {
          const name = assetsInfoByGroups.mainThread[0]?.name;
          if (name) {
            return path.basename(name);
          }
          return undefined;
        })(),
      },
      manifest: Object.fromEntries(
        assetsInfoByGroups.backgroundThread.map(asset => {
          return [asset.name, asset.source.source().toString()];
        }),
      ),
      customSections: {},
    };
    const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
      compilation,
    );

    const { encodeData } = await hooks.beforeEncode.promise({
      encodeData: encodeRawData,
      filenameTemplate,
      chunkGroups,
      intermediate,
      intermediateAssets: [],
    });

    const { lepusCode, css } = encodeData;

    const lepusChunk = Object.fromEntries(
      lepusCode.chunks.map(asset => {
        return [asset.name, asset.source.source().toString()];
      }),
    );

    const isFetchBundleLazy = isAsync
      && this.#options.lazyBundleFetcher === 'FetchBundle';
    // Default to bytecode for FetchBundle lazy main-thread sections. Skip
    // in dev or when DEBUG matches rspeedy so the source stays debuggable.
    const enableLazyBundleBytecode = isFetchBundleLazy && !isDev
      && !isDebug();
    const fetchBundleSplit = isFetchBundleLazy
      ? this.#buildLazyBundleFetchBundleSections(
        lepusCode.root,
        encodeData.manifest,
        encodeData.css.chunks,
        enableLazyBundleBytecode,
      )
      : null;

    const resolvedEncodeOptions: EncodeOptions = {
      ...encodeData,
      css: {
        ...css,
        cssMap: fetchBundleSplit ? {} : css.cssMap,
        cssSource: fetchBundleSplit ? {} : css.cssSource,
        chunks: undefined,
        contentMap: undefined,
      },
      lepusCode: fetchBundleSplit ? undefined : {
        // TODO: support multiple lepus chunks
        root: lepusCode.root?.source.source().toString(),
        lepusChunk,
        filename: lepusCode.filename,
      },
      manifest: fetchBundleSplit
        ? fetchBundleSplit.remainingManifest
        : encodeData.manifest,
      customSections: {
        ...encodeData.customSections,
        ...(fetchBundleSplit ? fetchBundleSplit.sections : {}),
      },
    };

    const { RawSource } = compiler.webpack.sources;

    if (isDebug() || isDev) {
      compilation.emitAsset(
        path.posix.format({
          dir: intermediatePosix,
          base: 'tasm.json',
        }),
        new RawSource(
          JSON.stringify(resolvedEncodeOptions, null, 2),
        ),
      );
      Object.entries(lepusChunk).forEach(
        ([name, content]) => {
          compilation.emitAsset(
            path.posix.format({
              dir: intermediatePosix,
              name,
              ext: '.js',
            }),
            new RawSource(content),
          );
        },
      );
    }

    try {
      const { buffer, debugInfo, cssDiagnostics } = await hooks.encode.promise({
        encodeOptions: resolvedEncodeOptions,
        intermediate,
      });

      const filename = compilation.getPath(filenameTemplate, {
        chunk: {},
        // Fresh hash per buffer: builds run concurrently, so a shared instance
        // hash would interleave updates across entries.
        contentHash: compiler.webpack.util
          .createHash(compiler.options.output.hashFunction ?? 'xxhash64')
          .update(buffer)
          .digest('hex')
          .toString(),
      });

      const { template } = await hooks.beforeEmit.promise({
        finalEncodeOptions: resolvedEncodeOptions,
        debugInfo,
        ...(cssDiagnostics === undefined ? {} : { cssDiagnostics }),
        template: buffer,
        outputName: filename,
        mainThreadAssets: [lepusCode.root, ...encodeData.lepusCode.chunks]
          .filter(i => i !== undefined),
        cssChunks: assetsInfoByGroups.css,
        chunkGroups,
      });

      compilation.emitAsset(filename, new RawSource(template, false));

      await hooks.afterEmit.promise({ outputName: filename });
    } catch (error) {
      if (error && typeof error === 'object' && 'error_msg' in error) {
        compilation.errors.push(
          // TODO: use more human-readable error message(i.e.: using sourcemap to get source code)
          //       or give webpack/rspack with location of bundle
          new compiler.webpack.WebpackError(error.error_msg as string),
        );
      } else {
        compilation.errors.push(error as Error);
      }
    }
  }

  #buildLazyBundleFetchBundleSections(
    mainThreadAsset: Asset | undefined,
    manifest: Record<string, string>,
    cssAssets: Asset[],
    enableBytecode: boolean,
  ): {
    sections: Record<string, CustomSectionEntry>;
    remainingManifest: Record<string, string>;
  } {
    const { cssPlugins, enableCSSSelector } = this.#options;
    const sections: Record<string, CustomSectionEntry> = {};

    if (mainThreadAsset) {
      sections[SECTION_MAIN_THREAD] = {
        ...(enableBytecode ? { encoding: 'JsBytecode' as const } : {}),
        content: mainThreadAsset.source.source().toString(),
      };
    }

    const remainingManifest: Record<string, string> = {};
    let entryChunk: [string, string] | undefined;
    for (const [name, content] of Object.entries(manifest)) {
      if (name === '/app-service.js') {
        continue;
      }
      if (!entryChunk) {
        entryChunk = [name, content];
        continue;
      }
      remainingManifest[name] = content;
    }

    if (entryChunk) {
      sections[SECTION_BACKGROUND] = { content: entryChunk[1] };
    }

    const firstCss = cssAssets[0];
    if (firstCss) {
      const ruleList = cssChunksToMap(
        [firstCss.source.source().toString()],
        cssPlugins,
        enableCSSSelector,
      ).cssMap[0] ?? [];
      sections[SECTION_CSS] = {
        encoding: 'CSS',
        content: { ruleList },
      };
    }

    return { sections, remainingManifest };
  }

  /**
   * Return all chunks from the compilation result which match the exclude and include filters
   */
  #filterEntryChunks(
    chunks: string[],
    includedChunks: string[] | 'all',
    excludedChunks: string[],
  ) {
    return chunks.filter((chunkName) => {
      // Skip if the chunks should be filtered and the given chunk was not added explicitly
      if (
        Array.isArray(includedChunks) && !includedChunks.includes(chunkName)
      ) {
        return false;
      }

      // Skip if the chunks should be filtered and the given chunk was excluded explicitly
      if (excludedChunks.includes(chunkName)) {
        return false;
      }

      // Add otherwise
      return true;
    });
  }

  /**
   * The getAssetsInformationByGroups extracts the asset information of a webpack compilation for all given entry names.
   */
  #getAssetsInformationByGroups(
    compilation: Compilation,
    entryNames: string[],
  ): AssetsInformationByGroups {
    const filenames = entryNames.flatMap(entryName => {
      /** entryPointUnfilteredFiles - also includes hot module update files */
      const entryPointUnfilteredFiles = compilation.entrypoints.get(entryName)!
        .getFiles();
      return entryPointUnfilteredFiles.filter((chunkFile) =>
        predicateNonHotModuleReplacementAsset(chunkFile, compilation)
      );
    });

    return this.#getAssetsInformationByFilenames(compilation, filenames);
  }

  #getAssetsInformationByFilenames(
    compilation: Compilation,
    filenames: string[],
  ): AssetsInformationByGroups {
    const assets: AssetsInformationByGroups = {
      // Will contain all js and mjs files
      backgroundThread: [],
      // Will contain all css files
      css: [],
      // Will contain all lepus files
      mainThread: [],
    };

    // Extract paths to .js, .lepus and .css files from the current compilation
    const entryPointPublicPathMap: Record<string, boolean> = {};
    const extensionRegexp = /\.(css|js)(?:\?|$)/;

    filenames.forEach((filename) => {
      const extMatch = extensionRegexp.exec(filename);

      // Skip if the public path is not a .css, .mjs or .js file
      if (!extMatch) {
        return;
      }

      // Skip if this file is already known
      // (e.g. because of common chunk optimizations)
      if (entryPointPublicPathMap[filename]) {
        return;
      }

      const asset = compilation.getAsset(filename)!;

      if (asset.info['lynx:main-thread']) {
        assets.mainThread.push(asset);
        return;
      }

      entryPointPublicPathMap[filename] = true;

      // ext will contain .js or .css, because .mjs recognizes as .js
      const ext = (extMatch[1] === 'mjs' ? 'js' : extMatch[1]) as 'js' | 'css';

      assets[ext === 'js' ? 'backgroundThread' : 'css'].push(asset);
    });

    return assets;
  }

  #options: Required<LynxTemplatePluginOptions>;
}

interface AssetsInformationByGroups {
  backgroundThread: Asset[];
  css: Asset[];
  mainThread: Asset[];
}

export function isDebug(): boolean {
  if (!process.env['DEBUG']) {
    return false;
  }

  const values = process.env['DEBUG'].toLocaleLowerCase().split(',');
  return [
    'rspeedy',
    '*',
    'rspeedy:*',
    'rspeedy:template',
  ].some((key) => values.includes(key));
}

export function isRsdoctor(): boolean {
  return process.env['RSDOCTOR'] === 'true';
}

/**
 * Collect the resolved module paths of the dynamic imports that create each
 * chunk group, by traversing the `AsyncDependenciesBlock`s of all modules.
 */
function collectChunkGroupResources(
  compilation: Compilation,
): Map<ChunkGroup, string[]> {
  const { chunkGraph, moduleGraph } = compilation;
  const resources = new Map<ChunkGroup, Set<string>>();

  for (const module of compilation.modules) {
    for (const block of module.blocks) {
      const chunkGroup = chunkGraph.getBlockChunkGroup(block);
      if (!chunkGroup) {
        continue;
      }
      for (const dependency of block.dependencies) {
        // `nameForCondition()` is the resource path of a `NormalModule`. It is
        // `undefined` for `ContextModule`(e.g. `import(`./locales/${lang}`)`),
        // which keeps context imports on the default chunk loading.
        const resource = moduleGraph.getResolvedModule(dependency)
          ?.nameForCondition();
        if (!resource) {
          continue;
        }
        let chunkGroupResources = resources.get(chunkGroup);
        if (!chunkGroupResources) {
          chunkGroupResources = new Set();
          resources.set(chunkGroup, chunkGroupResources);
        }
        chunkGroupResources.add(resource);
      }
    }
  }

  return new Map(
    Array.from(
      resources,
      ([chunkGroup, chunkGroupResources]) => [
        chunkGroup,
        Array.from(chunkGroupResources).sort(),
      ],
    ),
  );
}

/**
 * Derive a lazy bundle name from the resolved module paths. The name is
 * relative to the compiler context with `..` segments replaced, so the
 * bundle never escapes the `lazy-bundle/` output directory.
 */
function resourcesToLazyBundleName(
  resources: string[],
  context: string,
): string {
  return resources
    .map(resource =>
      path.relative(context, resource)
        .split(path.sep)
        .map(segment => segment === '..' ? '__' : segment)
        .join('/')
    )
    .join('_');
}

export function predicateNonHotModuleReplacementAsset(
  chunkFile: string,
  compilation: Compilation,
): boolean {
  const asset = compilation.getAsset(chunkFile);

  // Prevent hot-module files from being included:
  const assetMetaInformation = asset?.info ?? {};

  return !(
    assetMetaInformation.hotModuleReplacement
      ?? assetMetaInformation.development
  );
}
