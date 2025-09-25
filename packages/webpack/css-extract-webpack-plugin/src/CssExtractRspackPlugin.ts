// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createRequire } from 'node:module';

import type {
  Chunk,
  ChunkGroup,
  Compiler,
  CssExtractRspackPluginOptions as ExternalCssExtractRspackPluginOptions,
  RspackError,
} from '@rspack/core';

import { CSS, LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';

import type { CSSModuleId2Deps } from './loader.js';

/**
 * The options for {@link @lynx-js/css-extract-webpack-plugin#CssExtractRspackPlugin}
 *
 * @public
 */
interface CssExtractRspackPluginOptions
  extends ExternalCssExtractRspackPluginOptions
{
  /**
   * plugins passed to parser
   */
  cssPlugins: Parameters<typeof LynxTemplatePlugin.convertCSSChunksToMap>[1];

  /**
   * The name of non-initial CSS chunk files
   */
  chunkFilename?: string;

  /**
   * The name of each output bundle.
   */
  filename?: string;
}

const require = createRequire(import.meta.url);

/**
 * @public
 *
 * CssExtractRspackPlugin is the CSS extract plugin for Lynx.
 * It works just like the {@link https://www.rspack.dev/plugins/rspack/css-extract-rspack-plugin.html | CssExtractRspackPlugin} in Web.
 *
 * @example
 * ```js
 * import { CssExtractRspackPlugin } from '@lynx-js/css-extract-webpack-plugin'
 * export default {
 *   plugins: [new CssExtractRspackPlugin()],
 *   module: {
 *     rules: [
 *       {
 *         test: /\.css$/,
 *         uses: [CssExtractRspackPlugin.loader, 'css-loader'],
 *       },
 *     ],
 *   },
 * }
 * ```
 */
class CssExtractRspackPlugin {
  constructor(
    private readonly options?: CssExtractRspackPluginOptions | undefined,
  ) {}

  // TODO: implement a custom loader for scoped CSS.
  /**
   * The loader to extract CSS.
   *
   * @remarks
   * It should be used with the {@link https://github.com/webpack-contrib/css-loader | 'css-loader'}.
   *
   * @example
   *
   * ```js
   * import { CssExtractRspackPlugin } from '@lynx-js/css-extract-webpack-plugin'
   * export default {
   *   plugins: [new CssExtractRspackPlugin()],
   *   module: {
   *     rules: [
   *       {
   *         test: /\.css$/,
   *         uses: [CssExtractRspackPlugin.loader, 'css-loader'],
   *       },
   *     ],
   *   },
   * }
   * ```
   *
   * @public
   */
  static loader: string = require.resolve('./rspack-loader.js');

  /**
   * `defaultOptions` is the default options that the {@link CssExtractRspackPlugin} uses.
   *
   * @public
   */
  static defaultOptions: Readonly<CssExtractRspackPluginOptions> = Object
    .freeze<CssExtractRspackPluginOptions>({
      filename: '[name].css',
      cssPlugins: [
        CSS.Plugins.removeFunctionWhiteSpace(),
      ],
    });

  /**
   * The entry point of a webpack plugin.
   * @param compiler - the webpack compiler
   */
  apply(compiler: Compiler): void {
    new CssExtractRspackPluginImpl(
      compiler,
      Object.assign({}, CssExtractRspackPlugin.defaultOptions, this.options),
    );
  }
}

export { CssExtractRspackPlugin };
export type { CssExtractRspackPluginOptions };

class CssExtractRspackPluginImpl {
  name = 'CssExtractRspackPlugin';
  private hash: string | null = null;

  /**
   * `main` -> `main`
   * `main__main-thread` -> `main`
   * `./Foo.jsx-react__main-thread` -> `./Foo.jsx`
   * `./Foo.jsx-react__background` -> `./Foo.jsx`
   */
  private normalizeEntryName(name: string) {
    let isMainThread = false, entryName = name;
    // lazy bundle will append `-react__main-thread`
    if (name.endsWith('-react__main-thread')) {
      entryName = name.slice(0, -'-react__main-thread'.length);
      isMainThread = true;
    } else if (name.endsWith('-react__background')) {
      entryName = name.slice(0, -'-react__background'.length);
    } else if (name.endsWith('__main-thread')) {
      entryName = name.slice(0, -'__main-thread'.length);
      isMainThread = true;
    }
    return { entryName, isMainThread };
  }

  constructor(
    compiler: Compiler,
    public options: CssExtractRspackPluginOptions,
  ) {
    compiler.hooks.thisCompilation.tap(this.name, (compilation) => {
      const _compiler = compiler as unknown as {
        cssModuleId2Deps: CSSModuleId2Deps;
      };
      _compiler.cssModuleId2Deps ??= {};
      const cssModuleId2Deps = _compiler.cssModuleId2Deps;

      /**
       * The map from entry name to CSS module set.
       *
       * An entry `main` will generate two entries (different layers) in rspeedy:
       * `main` and `main__main-thread`, we will merge the two sets into one to
       * ensure all css modules will be extracted into one `main.lynx.bundle`.
       *
       * For example:
       *
       * `main` -> `Set(['./src/CompMain.css', './src/CompBackground.css'])`
       *
       * `./Foo.jsx` -> `Set(['./src/CompFoo.css'])`
       */
      const cssModuleId2PreOrder = new Map<string, number>();
      const entryName2CssContent: Map<string, string> = new Map<
        string,
        string
      >();

      // This hook is before module concatenation so we can
      // get all css modules before concatenated
      compilation.hooks.afterOptimizeModules.tap(this.name, () => {
        const entryName2MainThreadChunkGroup = new Map<string, ChunkGroup>();
        const groupName2BackgroundChunkGroup = new Map<string, ChunkGroup>();
        const entryName2CssModuleSet = new Map<string, Set<string>>();
        /**
         * Map from the chunk group to all css modules it contains
         */
        const chunkGroup2CssModuleSet = new WeakMap<ChunkGroup, Set<string>>();
        for (const group of compilation.chunkGroups) {
          if (!group.name) {
            continue;
          }
          const { entryName, isMainThread } = this.normalizeEntryName(
            group.name,
          );
          if (isMainThread) {
            entryName2MainThreadChunkGroup.set(entryName, group);
          } else {
            groupName2BackgroundChunkGroup.set(entryName, group);
          }
          const cssModuleSet = new Set<string>();
          for (const chunk of group.chunks) {
            for (
              const module of compilation.chunkGraph.getChunkModules(chunk)
            ) {
              const id = module.identifier();
              if (cssModuleId2Deps[id]) {
                cssModuleSet.add(id);
                // Always make main-thread group before background group
                // this will keep css order consistent in both
                // development and production environment
                cssModuleId2PreOrder.set(
                  id,
                  group.getModulePreOrderIndex(module)!
                    - (isMainThread ? 1e10 : 0),
                );
              }
            }
          }

          chunkGroup2CssModuleSet.set(group, cssModuleSet);
        }

        for (
          const entryName of new Set([
            ...entryName2MainThreadChunkGroup.keys(),
            ...groupName2BackgroundChunkGroup.keys(),
          ])
        ) {
          const mainThreadChunkGroup = entryName2MainThreadChunkGroup.get(
            entryName,
          );
          const backgroundChunkGroup = groupName2BackgroundChunkGroup.get(
            entryName,
          );

          let cssModuleSet = new Set<string>();

          if (mainThreadChunkGroup) {
            const mainThreadCssModuleSet = chunkGroup2CssModuleSet.get(
              mainThreadChunkGroup,
            )!;
            cssModuleSet = new Set([
              ...cssModuleSet,
              ...mainThreadCssModuleSet,
            ]);
          }
          if (backgroundChunkGroup) {
            const backgroundCssModuleSet = chunkGroup2CssModuleSet.get(
              backgroundChunkGroup,
            )!;
            cssModuleSet = new Set([
              ...cssModuleSet,
              ...backgroundCssModuleSet,
            ]);
          }

          entryName2CssModuleSet.set(entryName, cssModuleSet);
        }

        for (const [entryName, cssModuleSet] of entryName2CssModuleSet) {
          let cssContent = '';
          for (
            const cssModule of [...cssModuleSet].sort((a, b) =>
              cssModuleId2PreOrder.get(a)! - cssModuleId2PreOrder.get(b)!
            )
          ) {
            const deps = cssModuleId2Deps[cssModule]!;
            deps.forEach(dep => {
              cssContent += dep.content.toString() + '\n';
            });
          }
          if (cssContent) {
            compilation.emitAsset(
              this.options.filename!.replaceAll('[name]', entryName),
              new compiler.webpack.sources.RawSource(cssContent),
            );
          }
          entryName2CssContent.set(entryName, cssContent);
        }
      });

      const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
        // @ts-expect-error Rspack to Webpack Compilation
        compilation,
      );

      hooks.beforeEncode.tapPromise({
        name: this.name,
        stage: -256,
      }, async (args) => {
        const { entryNames } = args;
        const entrySet = new Set(
          entryNames.map(entryName =>
            this.normalizeEntryName(entryName).entryName
          ),
        );
        const cssContentList = [];
        for (const entryName of entrySet) {
          cssContentList.push(entryName2CssContent.get(entryName) ?? '');
        }

        const css = LynxTemplatePlugin.convertCSSChunksToMap(
          cssContentList,
          options.cssPlugins,
          Boolean(
            args.encodeData.compilerOptions.enableCSSSelector,
          ),
        );

        return {
          ...args,
          encodeData: {
            ...args.encodeData,
            css: {
              ...css,
              chunks: [...entrySet].map(entryName => ({
                name: this.options.filename!.replaceAll('[name]', entryName),
                source: new compiler.webpack.sources.RawSource(
                  entryName2CssContent.get(entryName) ?? '',
                ),
                info: {},
              })),
            },
          },
        };
      });

      if (
        compiler.options.mode === 'development'
        || process.env['NODE_ENV'] === 'development'
      ) {
        hooks.beforeEmit.tapPromise(this.name, async (args) => {
          for (
            const {
              name: filename,
              source,
            } of args.cssChunks
          ) {
            const content: string = source.source().toString('utf-8');
            const css = LynxTemplatePlugin.convertCSSChunksToMap(
              [content],
              options.cssPlugins,
              Boolean(
                args.finalEncodeOptions.compilerOptions['enableCSSSelector'],
              ),
            );
            const cssDeps = Object.entries(css.cssMap).reduce<
              Record<string, string[]>
            >((acc, [key, value]) => {
              const importRuleNodes = value.filter(
                (node) => node.type === 'ImportRule',
              );

              acc[key] = importRuleNodes.map(({ href }) => href);
              return acc;
            }, {});

            try {
              const {
                compilerOptions: {
                  // remove the `templateDebugUrl` to avoid "emit different content to the same filename" error while chunk splitting is enabled, see #1481
                  templateDebugUrl,
                  ...restCompilerOptions
                },
              } = args.finalEncodeOptions;
              const { buffer } = await hooks.encode.promise({
                encodeOptions: {
                  ...args.finalEncodeOptions,
                  compilerOptions: restCompilerOptions,
                  css,
                  lepusCode: {
                    root: undefined,
                    lepusChunk: {},
                  },
                  manifest: {},
                  customSections: {},
                },
              });
              const result = {
                content: buffer.toString('base64'),
                deps: cssDeps,
              };
              compilation.emitAsset(
                filename.replace(
                  '.css',
                  `${this.hash ? `.${this.hash}` : ''}.css.hot-update.json`,
                ),
                new compiler.webpack.sources.RawSource(
                  JSON.stringify(result),
                  true,
                ),
              );
            } catch (error) {
              if (error && typeof error === 'object' && 'error_msg' in error) {
                compilation.errors.push(
                  // TODO: use more human-readable error message(i.e.: using sourcemap to get source code)
                  //       or give webpack/rspack with location of bundle
                  new compiler.webpack.WebpackError(error.error_msg as string),
                );
              } else {
                compilation.errors.push(error as RspackError);
              }
            }
          }
          this.hash = compilation.hash;

          return args;
        });

        const { RuntimeGlobals, RuntimeModule } = compiler.webpack;

        class CSSHotUpdateRuntimeModule extends RuntimeModule {
          hash: string | null;

          constructor(hash: string | null) {
            super('lynx css hot update');
            this.hash = hash;
          }

          override generate(): string {
            const chunk = this.chunk!;

            const asyncChunks = Array.from(chunk.getAllAsyncChunks())
              .map(c => {
                const { path } = compilation.getAssetPathWithInfo(
                  options.chunkFilename ?? '.rspeedy/async/[name]/[name].css',
                  { chunk: c },
                );
                return [c.name!, path];
              });

            const { path } = compilation.getPathWithInfo(
              options.filename ?? '[name].css',
              { chunk },
            );

            const initialChunk = [chunk.name!, path];

            const cssHotUpdateList = [...asyncChunks, initialChunk].map((
              [chunkName, cssHotUpdatePath],
            ) => [
              chunkName!,
              cssHotUpdatePath!.replace(
                '.css',
                `${this.hash ? `.${this.hash}` : ''}.css.hot-update.json`,
              ),
            ]);

            return `
${RuntimeGlobals.require}.cssHotUpdateList = ${
              cssHotUpdateList ? JSON.stringify(cssHotUpdateList) : 'null'
            };
`;
          }
        }

        const onceForChunkSet = new WeakSet<Chunk>();
        const handler = (chunk: Chunk, runtimeRequirements: Set<string>) => {
          if (onceForChunkSet.has(chunk)) return;
          onceForChunkSet.add(chunk);
          runtimeRequirements.add(RuntimeGlobals.publicPath);
          compilation.addRuntimeModule(
            chunk,
            new CSSHotUpdateRuntimeModule(this.hash),
          );
        };

        compilation.hooks.runtimeRequirementInTree
          .for(RuntimeGlobals.ensureChunkHandlers)
          .tap(this.name, handler);
        compilation.hooks.runtimeRequirementInTree
          .for(RuntimeGlobals.hmrDownloadUpdateHandlers)
          .tap(this.name, handler);
        compilation.hooks.runtimeRequirementInTree
          .for(RuntimeGlobals.hmrDownloadManifest)
          .tap(this.name, handler);
        compilation.hooks.runtimeRequirementInTree
          .for(RuntimeGlobals.baseURI)
          .tap(this.name, handler);
        compilation.hooks.runtimeRequirementInTree
          .for(RuntimeGlobals.externalInstallChunk)
          .tap(this.name, handler);
        compilation.hooks.runtimeRequirementInTree
          .for(RuntimeGlobals.onChunksLoaded)
          .tap(this.name, handler);
      }
    });
  }
}
