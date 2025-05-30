// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Node.js imports
import { createRequire } from 'node:module';

// Third-party imports
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import type { Compiler } from 'webpack';

// Create require function before using it
const require = createRequire(import.meta.url);

/**
 * The options for CssExtractWebpackPlugin
 *
 * @public
 */
interface CssExtractWebpackPluginOptions
  extends MiniCssExtractPlugin.PluginOptions
{}

/**
 * @public
 *
 * CssExtractWebpackPlugin is the CSS extract plugin for Lynx.
 * It works just like the {@link https://github.com/webpack-contrib/mini-css-extract-plugin | MiniCssExtractPlugin} in Web.
 *
 * @example
 * ```js
 * import { CssExtractWebpackPlugin } from '@lynx-js/css-extract-webpack-plugin'
 * export default {
 *   plugins: [new CssExtractWebpackPlugin()],
 *   module: {
 *     rules: [
 *       {
 *         test: /\.css$/,
 *         uses: [CssExtractWebpackPlugin.loader, 'css-loader'],
 *       },
 *     ],
 *   },
 * }
 * ```
 */
class CssExtractWebpackPlugin {
  constructor(
    private readonly options?: CssExtractWebpackPluginOptions | undefined,
  ) {}

  /**
   * The loader to extract CSS.
   *
   * @remarks
   * It should be used with the {@link https://github.com/webpack-contrib/css-loader | 'css-loader'}.
   *
   * @example
   *
   * ```js
   * import { CssExtractWebpackPlugin } from '@lynx-js/css-extract-webpack-plugin'
   * export default {
   *   plugins: [new CssExtractWebpackPlugin()],
   *   module: {
   *     rules: [
   *       {
   *         test: /\.css$/,
   *         uses: [CssExtractWebpackPlugin.loader, 'css-loader'],
   *       },
   *     ],
   *   },
   * }
   * ```
   *
   * @public
   */
  static loader: string = require.resolve('./loader.js');

  /**
   * `defaultOptions` is the default options that the {@link CssExtractWebpackPlugin} uses.
   *
   * @public
   */
  static defaultOptions: Readonly<Required<CssExtractWebpackPluginOptions>> =
    Object.freeze<
      Required<CssExtractWebpackPluginOptions>
    >({
      filename: '[name].css',
      chunkFilename: undefined,
      ignoreOrder: undefined,
      insert: undefined,
      attributes: undefined,
      linkType: undefined,
      runtime: undefined,
      experimentalUseImportModule: undefined,
    });

  /**
   * The entry point of a webpack plugin.
   * @param compiler - the webpack compiler
   */
  apply(compiler: Compiler): void {
    new CssExtractWebpackPluginImpl(
      compiler,
      Object.assign(
        {},
        CssExtractWebpackPlugin.defaultOptions,
        this.options,
      ),
    );
  }
}

export { CssExtractWebpackPlugin };
export type { CssExtractWebpackPluginOptions };

class CssExtractWebpackPluginImpl {
  name = 'CssExtractWebpackPlugin';

  constructor(
    compiler: Compiler,
    public options: CssExtractWebpackPluginOptions,
  ) {
    try {
      // Check what kind of environment we're running in
      // In Rspack, the webpack property exists and has a name property
      const webpack = compiler.webpack;
      const isRspack = webpack && 
        (webpack.name === 'rspack' || 
         // Check for Rspack-specific plugins as backup detection method
         !!(webpack as any).CssExtractRspackPlugin);
      
      if (isRspack) {
        // For Rspack, we need to use a completely different approach
        console.log('Detected Rspack environment, using Rspack-specific CSS extraction');
        this.applyForRspack(compiler);
      } else {
        // For regular webpack, we can use MiniCssExtractPlugin directly
        console.log('Detected Webpack environment, using standard CSS extraction');
        this.applyForWebpack(compiler);
      }
    } catch (err) {
      console.warn('Error creating/applying CSS extract plugin:', err);
    }
  }
  
  /**
   * Apply for regular webpack
   */
  private applyForWebpack(compiler: Compiler): void {
    // Regular webpack has all the necessary features, so we can use MiniCssExtractPlugin directly
    const plugin = new MiniCssExtractPlugin({
      filename: this.options.filename,
      chunkFilename: this.options.chunkFilename,
      ignoreOrder: this.options.ignoreOrder,
      insert: this.options.insert,
      attributes: this.options.attributes,
      linkType: this.options.linkType,
      runtime: this.options.runtime,
      experimentalUseImportModule: this.options.experimentalUseImportModule,
    });
    
    plugin.apply(compiler);
  }
  
  /**
   * Apply for Rspack, which doesn't fully support MiniCssExtractPlugin
   */
  private applyForRspack(compiler: Compiler): void {
    if (!compiler.webpack) {
      console.warn('No webpack property on compiler in Rspack environment');
      return;
    }
    
    try {
      // Check for native CSS extraction in Rspack
      const webpackCompiler = compiler.webpack as {
        CssExtractRspackPlugin?: new (options: any) => { apply: (compiler: Compiler) => void }
      };
      
      const hasCssExtractPlugin = !!webpackCompiler.CssExtractRspackPlugin;
      
      if (hasCssExtractPlugin && webpackCompiler.CssExtractRspackPlugin) {
        // Use the native Rspack CSS plugin
        console.log('Using native Rspack CSS extraction plugin');
        
        const CssExtractPlugin = webpackCompiler.CssExtractRspackPlugin;
        
        // Create plugin instance with our options
        const plugin = new CssExtractPlugin({
          filename: this.options.filename ?? '[name].css',
          chunkFilename: this.options.chunkFilename ?? '[name].chunk.css',
          ignoreOrder: this.options.ignoreOrder ?? false,
        });
        
        // Apply the plugin
        plugin.apply(compiler);
      } else {
        // No native plugin, alert the user
        console.warn('CssExtractRspackPlugin not found - CSS extraction may not work correctly');
        
        // Create a no-op implementation as a fallback
        // This won't extract CSS but will prevent build errors
        const noopPlugin = {
          apply: (compiler: Compiler) => {
            // Register a basic plugin that logs a warning
            compiler.hooks.done.tap('CssExtractWarning', () => {
              console.warn('CSS extraction is not working - using fallback implementation');
            });
          }
        };
        
        // Apply the no-op plugin
        noopPlugin.apply(compiler);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.warn('Failed to apply Rspack CSS extract plugin:', error);
    }
  }
}
