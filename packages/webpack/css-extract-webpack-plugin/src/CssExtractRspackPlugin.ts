// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createRequire } from 'node:module';

import type {
  Chunk,
  Compiler,
  CssExtractRspackPluginOptions as ExternalCssExtractRspackPluginOptions,
  RspackError,
} from '@rspack/core';

import { CSS, LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';

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

  constructor(
    compiler: Compiler,
    public options: CssExtractRspackPluginOptions,
  ) {
    new compiler.webpack.CssExtractRspackPlugin({
      filename: options.filename ?? '[name].css',
      chunkFilename: options.chunkFilename ?? '',
      ignoreOrder: options.ignoreOrder ?? false,
      insert: options.insert ?? '',
      attributes: options.attributes ?? {},
      linkType: options.linkType ?? '',
      runtime: options.runtime ?? false,
    }).apply(compiler);

    compiler.hooks.thisCompilation.tap(this.name, (compilation) => {
      if (
        compiler.options.mode === 'development'
        || process.env['NODE_ENV'] === 'development'
      ) {
        const hooks = LynxTemplatePlugin.getLynxTemplatePluginHooks(
          // @ts-expect-error Rspack to Webpack Compilation
          compilation,
        );

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
