// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path';

import {
  AsyncSeriesBailHook,
  AsyncSeriesWaterfallHook,
  SyncWaterfallHook,
} from '@rspack/lite-tapable';
import groupBy from 'object.groupby';
import type {
  Asset,
  Chunk,
  ChunkGroup,
  Compilation,
  Compiler,
  WebpackError,
} from 'webpack';

import type * as CSS from '@lynx-js/css-serializer';
import { RuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

import { cssChunksToMap } from './css/cssChunksToMap.js';
import { createLynxAsyncChunksRuntimeModule } from './LynxAsyncChunksRuntimeModule.js';

export interface EncodeOptions {
  manifest: Record<string, string | undefined>;
  compilerOptions: Record<string, string | boolean>;
  lepusCode: {
    root: string | undefined;
    lepusChunk: Record<string, string>;
  };
  // `customSections` option only takes effect on Lynx >= 2.16.
  customSections: Record<string, {
    type?: 'lazy';
    content: string | Record<string, unknown>;
  }>;
  [k: string]: unknown;
}

const LynxTemplatePluginHooksMap = new WeakMap<Compilation, TemplateHooks>();

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
 *       LynxTemplatePlugin.getCompilationHooks(compilation).beforeEmit.tapAsync(
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
  asyncChunkName: SyncWaterfallHook<string | undefined | null>;

  /**
   * Called before the encode process. Can be used to modify the encode options.
   *
   * @alpha
   */
  beforeEncode: AsyncSeriesWaterfallHook<{
    encodeData: EncodeRawData;
    filenameTemplate: string;
    entryNames: string[];
  }>;

  /**
   * Call the encode process.
   *
   * @alpha
   */
  encode: AsyncSeriesBailHook<{
    encodeOptions: EncodeOptions;
    intermediate: string;
  }, { buffer: Buffer; debugInfo: string }>;

  /**
   * Called before the template is emitted. Can be used to modify the template.
   *
   * @alpha
   */
  beforeEmit: AsyncSeriesWaterfallHook<{
    finalEncodeOptions: EncodeOptions;
    debugInfo: string;
    template: Buffer;
    outputName: string;
    lepus: Asset[];
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
   * @defaultValue `'async/[name].[fullhash].bundle'`
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
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.enableICU}
   */
  enableICU: boolean;

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
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.enableParallelElement}
   */
  enableParallelElement?: boolean;

  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.enableRemoveCSSScope}
   */
  enableRemoveCSSScope: boolean;

  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.pipelineSchedulerConfig}
   */
  pipelineSchedulerConfig: number;

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
   * `encodeBinary` is used to specify the binary of the template encoder.
   *
   * @defaultValue `napi`
   *
   * @public
   */
  encodeBinary?: 'napi' | 'wasm';

  /**
   * {@inheritdoc @lynx-js/react-rsbuild-plugin#PluginReactLynxOptions.experimental_isLazyBundle}
   *
   * @alpha
   */
  experimental_isLazyBundle?: boolean;

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
    content: string | Record<string, unknown>;
  }>;
  sourceContent: {
    dsl: string;
    appType: string;
    config: Record<string, unknown>;
  };
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
    let hooks = LynxTemplatePluginHooksMap.get(compilation);
    // Setup the hooks only once
    if (hooks === undefined) {
      LynxTemplatePluginHooksMap.set(
        compilation,
        hooks = createLynxTemplatePluginHooks(),
      );
    }
    return hooks;
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
      lazyBundleFilename: 'async/[name].[fullhash].bundle',
      intermediate: '.rspeedy',
      chunks: 'all',
      excludeChunks: [],

      // lynx-specific
      customCSSInheritanceList: undefined,
      debugInfoOutside: true,
      enableICU: false,
      enableA11y: true,
      enableAccessibilityElement: false,
      enableCSSInheritance: false,
      enableCSSInvalidation: false,
      enableCSSSelector: true,
      enableNewGesture: false,
      enableParallelElement: true,
      defaultDisplayLinear: true,
      enableRemoveCSSScope: false,
      pipelineSchedulerConfig: 0x00010000,
      targetSdkVersion: '3.2',
      defaultOverflowVisible: true,
      removeDescendantSelectorScope: false,
      dsl: 'react_nodiff',
      encodeBinary: 'napi',

      experimental_isLazyBundle: false,
      cssPlugins: [],
    });

  /**
   * Convert the css chunks to css map.
   *
   * @param cssChunks - The CSS chunks content.
   * @param options - The encode options.
   * @returns The CSS map and css source.
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
    cssChunks: string[],
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

interface Hash {
  /**
   * Update hash {@link https://nodejs.org/api/crypto.html#crypto_hash_update_data_inputencoding}
   */
  update(data: string | Buffer, inputEncoding?: string): Hash;

  /**
   * Calculates the digest {@link https://nodejs.org/api/crypto.html#crypto_hash_digest_encoding}
   */
  digest(encoding?: string): string | Buffer;
}

class LynxTemplatePluginImpl {
  name = 'LynxTemplatePlugin';

  static #taskQueue: Array<() => Promise<void>> | null = null;
  protected hash: Hash;

  constructor(
    compiler: Compiler,
    options: Required<LynxTemplatePluginOptions>,
  ) {
    this.#options = options;

    const { createHash } = compiler.webpack.util;

    this.hash = createHash(compiler.options.output.hashFunction ?? 'xxhash64');

    compiler.hooks.initialize.tap(this.name, () => {
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

      outputFileNames.forEach((outputFileName) => {
        // convert absolute filename into relative so that webpack can
        // generate it at correct location
        let filename = outputFileName;
        if (path.resolve(filename) === path.normalize(filename)) {
          filename = path.relative(
            /** Once initialized the path is always a string */
            compiler.options.output.path!,
            filename,
          );
        }

        compiler.hooks.thisCompilation.tap(this.name, (compilation) => {
          compilation.hooks.processAssets.tapPromise(
            {
              name: this.name,
              stage:
                /**
                 * Generate the html after minification and dev tooling is done
                 * and source-map is generated
                 */
                compiler.webpack.Compilation
                  .PROCESS_ASSETS_STAGE_OPTIMIZE_HASH,
            },
            () => {
              return this.#generateTemplate(
                compiler,
                compilation,
                filename,
              );
            },
          );
        });
      });
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
          new LynxAsyncChunksRuntimeModule((chunkName) => {
            const filename = hooks.asyncChunkName.call(chunkName)!;

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
      filteredEntryNames,
      filenameTemplate,
      this.#options.intermediate,
      /** isAsync */ this.#options.experimental_isLazyBundle,
    );
  }

  static #asyncChunkGroups = new WeakMap<
    Compilation,
    Record<string, ChunkGroup[]>
  >();

  #getAsyncChunkGroups(compilation: Compilation) {
    let asyncChunkGroups = LynxTemplatePluginImpl.#asyncChunkGroups.get(
      compilation,
    );

    if (asyncChunkGroups) {
      return asyncChunkGroups;
    }

    const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation);

    asyncChunkGroups = groupBy(
      compilation.chunkGroups
        .filter(cg => !cg.isInitial()),
      cg => hooks.asyncChunkName.call(cg.name)!,
    );

    LynxTemplatePluginImpl.#asyncChunkGroups.set(compilation, asyncChunkGroups);

    return asyncChunkGroups;
  }

  #getAsyncFilenameTemplate(filename: string) {
    return this.#options.lazyBundleFilename.replace(
      /\[name\]/,
      filename,
    );
  }

  static #encodedTemplate = new WeakMap<Compilation, Set<string>>();

  async #generateAsyncTemplate(compilation: Compilation) {
    const asyncChunkGroups = this.#getAsyncChunkGroups(compilation);

    const intermediateRoot = path.dirname(this.#options.intermediate);

    const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(compilation);

    // We cache the encoded template so that it will not be encoded twice
    if (!LynxTemplatePluginImpl.#encodedTemplate.has(compilation)) {
      LynxTemplatePluginImpl.#encodedTemplate.set(compilation, new Set());
    }

    const encodedTemplate = LynxTemplatePluginImpl.#encodedTemplate.get(
      compilation,
    )!;

    await Promise.all(
      Object.entries(asyncChunkGroups).map(([entryName, chunkGroups]) => {
        const chunkNames =
          // We use the chunk name(provided by `webpackChunkName`) as filename
          chunkGroups
            .map(cg => hooks.asyncChunkName.call(cg.name))
            .filter(chunkName => chunkName !== undefined);

        const filename = Array.from(new Set(chunkNames)).join('_');

        // If no filename is found, avoid generating async template
        if (!filename) {
          return;
        }

        const filenameTemplate = this.#getAsyncFilenameTemplate(filename);

        // Ignore the encoded templates
        if (encodedTemplate.has(filenameTemplate)) {
          return;
        }

        encodedTemplate.add(filenameTemplate);

        const asyncAssetsInfoByGroups = this.#getAssetsInformationByFilenames(
          compilation,
          chunkGroups.flatMap(cg => cg.getFiles()),
        );

        return this.#encodeByAssetsInformation(
          compilation,
          asyncAssetsInfoByGroups,
          [entryName],
          filenameTemplate,
          path.join(intermediateRoot, 'async', filename),
          /** isAsync */ true,
        );
      }),
    );
  }

  async #encodeByAssetsInformation(
    compilation: Compilation,
    assetsInfoByGroups: AssetsInformationByGroups,
    entryNames: string[],
    filenameTemplate: string,
    intermediate: string,
    isAsync: boolean,
  ): Promise<void> {
    const compiler = compilation.compiler;

    const {
      customCSSInheritanceList,
      debugInfoOutside,
      defaultDisplayLinear,
      enableICU,
      enableA11y,
      enableAccessibilityElement,
      enableCSSInheritance,
      enableCSSInvalidation,
      enableCSSSelector,
      enableNewGesture,
      enableParallelElement,
      enableRemoveCSSScope,
      pipelineSchedulerConfig,
      removeDescendantSelectorScope,
      targetSdkVersion,
      defaultOverflowVisible,
      dsl,
      cssPlugins,
    } = this.#options;

    const isDev = process.env['NODE_ENV'] === 'development'
      || compiler.options.mode === 'development';

    const css = cssChunksToMap(
      assetsInfoByGroups.css
        .map(chunk => compilation.getAsset(chunk.name))
        .filter((v): v is Asset => !!v)
        .map(asset => asset.source.source().toString()),
      cssPlugins,
      enableCSSSelector,
    );
    const encodeRawData: EncodeRawData = {
      compilerOptions: {
        enableFiberArch: true,
        useLepusNG: true,
        enableReuseContext: true,
        bundleModuleMode: 'ReturnByFunction',
        templateDebugUrl: '',

        debugInfoOutside,
        defaultDisplayLinear,
        enableCSSInvalidation,
        enableCSSSelector,
        enableLepusDebug: isDev,
        enableParallelElement,
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
          enableICU,
          enableNewIntersectionObserver: true,
          enableNativeList: true,
          enableA11y,
          enableAccessibilityElement,
          customCSSInheritanceList,
          enableCSSInheritance,
          enableNewGesture,
          pipelineSchedulerConfig,
          removeDescendantSelectorScope,
        },
      },
      css: {
        ...css,
        chunks: assetsInfoByGroups.css,
      },
      lepusCode: {
        // TODO: support multiple lepus chunks
        root: assetsInfoByGroups.lepus[0],
        chunks: [],
      },
      manifest: Object.fromEntries(
        assetsInfoByGroups.js.map(asset => {
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
      entryNames,
    });

    const { lepusCode } = encodeData;

    const resolvedEncodeOptions: EncodeOptions = {
      ...encodeData,
      css: {
        ...css,
        chunks: undefined,
        contentMap: undefined,
      },
      lepusCode: {
        // TODO: support multiple lepus chunks
        root: lepusCode.root?.source.source().toString(),
        lepusChunk: Object.fromEntries(
          lepusCode.chunks.map(asset => {
            return [asset.name, asset.source.source().toString()];
          }),
        ),
      },
    };

    const debugInfoPath = path.posix.format({
      dir: intermediate,
      base: 'debug-info.json',
    });

    // TODO: Support publicPath function
    if (
      typeof compiler.options.output.publicPath === 'string'
      && compiler.options.output.publicPath !== 'auto'
      && compiler.options.output.publicPath !== '/'
    ) {
      resolvedEncodeOptions.compilerOptions['templateDebugUrl'] = new URL(
        debugInfoPath,
        compiler.options.output.publicPath,
      ).toString();
    }

    const { RawSource } = compiler.webpack.sources;

    if (isDebug() || isDev) {
      compilation.emitAsset(
        path.format({
          dir: intermediate,
          base: 'tasm.json',
        }),
        new RawSource(
          JSON.stringify(resolvedEncodeOptions, null, 2),
        ),
      );
      Object.entries(resolvedEncodeOptions.lepusCode.lepusChunk).forEach(
        ([name, content]) => {
          compilation.emitAsset(
            path.format({
              dir: intermediate,
              name,
              ext: '.js',
            }),
            new RawSource(content),
          );
        },
      );
    }

    try {
      const { buffer, debugInfo } = await hooks.encode.promise({
        encodeOptions: resolvedEncodeOptions,
        intermediate,
      });

      const filename = compilation.getPath(filenameTemplate, {
        // @ts-expect-error we have a mock chunk here to make contenthash works in webpack
        chunk: {},
        contentHash: this.hash.update(buffer).digest('hex').toString(),
      });

      const { template } = await hooks.beforeEmit.promise({
        finalEncodeOptions: resolvedEncodeOptions,
        debugInfo,
        template: buffer,
        outputName: filename,
        lepus: encodeData.lepusCode.chunks,
      });

      compilation.emitAsset(filename, new RawSource(template, false));

      if (isDebug() || isDev) {
        compilation.emitAsset(debugInfoPath, new RawSource(debugInfo));
      }

      await hooks.afterEmit.promise({ outputName: filename });
    } catch (error) {
      if (error && typeof error === 'object' && 'error_msg' in error) {
        compilation.errors.push(
          // TODO: use more human-readable error message(i.e.: using sourcemap to get source code)
          //       or give webpack/rspack with location of bundle
          new compiler.webpack.WebpackError(error.error_msg as string),
        );
      } else {
        compilation.errors.push(error as WebpackError);
      }
    }
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
      // Skip if the chunks should be filtered and the given chunk was not added explicity
      if (
        Array.isArray(includedChunks) && !includedChunks.includes(chunkName)
      ) {
        return false;
      }

      // Skip if the chunks should be filtered and the given chunk was excluded explicity
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
      return entryPointUnfilteredFiles.filter((chunkFile) => {
        const asset = compilation.getAsset(chunkFile);

        // Prevent hot-module files from being included:
        const assetMetaInformation = asset?.info ?? {};

        return !(
          assetMetaInformation.hotModuleReplacement
            ?? assetMetaInformation.development
        );
      });
    });

    return this.#getAssetsInformationByFilenames(compilation, filenames);
  }

  #getAssetsInformationByFilenames(
    compilation: Compilation,
    filenames: string[],
  ): AssetsInformationByGroups {
    const assets: AssetsInformationByGroups = {
      // Will contain all js and mjs files
      js: [],
      // Will contain all css files
      css: [],
      // Will contain all lepus files
      lepus: [],
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
        assets.lepus.push(asset);
        return;
      }

      entryPointPublicPathMap[filename] = true;

      // ext will contain .js or .css, because .mjs recognizes as .js
      const ext = (extMatch[1] === 'mjs' ? 'js' : extMatch[1]) as 'js' | 'css';

      assets[ext].push(asset);
    });

    return assets;
  }

  #options: Required<LynxTemplatePluginOptions>;
}

interface AssetsInformationByGroups {
  js: Asset[];
  css: Asset[];
  lepus: Asset[];
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
