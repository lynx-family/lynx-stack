// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Chunk, Compilation, Compiler } from '@rspack/core';

import { RuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

import { CssRuntimeModule } from './runtime/CssRuntimeModule.js';
import { getCssChunkObject } from './runtime/helper.js';
import { JavaScriptRuntimeModule } from './runtime/JavaScriptRuntimeModule.js';

type RuntimeModule = Parameters<
  Compilation['hooks']['runtimeModule']['call']
>[0];

/**
 * The options for ChunkLoadingRspackPlugin
 *
 * @public
 */

// biome-ignore lint/suspicious/noEmptyInterface: As expected.
interface ChunkLoadingRspackPluginOptions {}

/**
 * @public
 * The ChunkLoadingRspackPlugin enables chunk loading for webpack in Lynx.
 *
 * @remarks
 * Note that this plugin should be used with `output.chunkFormat: 'require'`.
 * See {@link https://github.com/web-infra-dev/rspack/issues/5365 | [Feature Request]: runtimeModule hook support} for details.
 *
 * @example
 *
 * ```js
 * // rspack.config.js
 * import { ChunkLoadingRspackPlugin } from '@lynx-js/chunk-loading-webpack-plugin'
 * export default {
 *   output: {
 *     chunkFormat: 'require',
 *   },
 *   plugins: [new ChunkLoadingRspackPlugin()],
 * }
 * ```
 *
 * @deprecated Use {@link ChunkLoadingWebpackPlugin} instead.
 */
class ChunkLoadingRspackPlugin {
  constructor(
    private readonly options: Partial<ChunkLoadingRspackPluginOptions> = {},
  ) {}

  /**
   * `defaultOptions` is the default options that the {@link ChunkLoadingRspackPlugin} uses.
   *
   * @public
   */
  static defaultOptions = Object.freeze<
    Required<ChunkLoadingRspackPluginOptions>
  >({});

  /**
   * The entry point of a webpack plugin.
   * @param compiler - the webpack compiler
   */
  apply(compiler: Compiler): void {
    new ChunkLoadingRspackPluginImpl(
      compiler,
      Object.assign(
        {},
        ChunkLoadingRspackPlugin.defaultOptions,
        this.options,
      ),
    );
  }
}

export { ChunkLoadingRspackPlugin };
export type { ChunkLoadingRspackPluginOptions };

export class ChunkLoadingRspackPluginImpl {
  name = 'ChunkLoadingRspackPlugin';

  constructor(compiler: Compiler, _options: ChunkLoadingRspackPluginOptions) {
    compiler.hooks.thisCompilation.tap(this.name, (compilation) => {
      compilation.hooks.additionalTreeRuntimeRequirements.tap(
        this.name,
        (_, set) => {
          set.add(compiler.webpack.RuntimeGlobals.exports);
          set.add(compiler.webpack.RuntimeGlobals.publicPath);
        },
      );

      compilation.hooks.runtimeRequirementInTree.for(
        compiler.webpack.RuntimeGlobals.ensureChunkHandlers,
      ).tap(this.name, (_, runtimeRequirements) => {
        runtimeRequirements.add(RuntimeGlobals.lynxAsyncChunkIds);
      });

      compilation.hooks.runtimeModule.tap(this.name, (runtimeModule, chunk) => {
        if (
          runtimeModule.name === 'require_chunk_loading'
        ) {
          this.#overrideChunkLoadingRuntimeModule(runtimeModule);
          if (compiler.options.mode === 'development') {
            this.#overrideHMRChunkLoadingRuntimeModule(runtimeModule);
          }
        } else if (
          runtimeModule.name === 'css loading'
          // TODO: support production CSS chunk loading
          && compiler.options.mode === 'development'
        ) {
          this.#overrideCSSChunkLoadingRuntimeModule(
            compilation,
            runtimeModule,
            chunk,
          );
        }
      });
    });
  }

  #overrideChunkLoadingRuntimeModule(
    runtimeModule: RuntimeModule,
  ) {
    runtimeModule.source!.source = Buffer.concat([
      Buffer.from(runtimeModule.source!.source as Buffer),

      Buffer.from('\n'),

      Buffer.from('\n'),
      // withLoading
      Buffer.from(JavaScriptRuntimeModule.generateChunkLoadingRuntime('true')), // TODO: JS_MATCHER

      Buffer.from('\n'),
      // withOnChunkLoad
      Buffer.from(JavaScriptRuntimeModule.generateChunkOnloadRuntime()),
    ]);
  }

  #overrideHMRChunkLoadingRuntimeModule(
    runtimeModule: RuntimeModule,
  ) {
    runtimeModule.source!.source = Buffer.concat([
      Buffer.from(runtimeModule.source!.source as Buffer),

      // withHmr
      Buffer.from(
        JavaScriptRuntimeModule.generateHMRRuntime(),
      ),

      // withHmrManifest
      Buffer.from(
        JavaScriptRuntimeModule.generateHMRManifestRuntime(),
      ),
    ]);
  }

  #overrideCSSChunkLoadingRuntimeModule(
    compilation: Compilation,
    runtimeModule: RuntimeModule,
    chunk: Chunk,
  ) {
    const chunkMap = getCssChunkObject(
      // @ts-expect-error webpack-rspack types
      chunk,
      compilation,
    );
    runtimeModule.source!.source = Buffer.concat([
      Buffer.from('\n'),

      Buffer.from(CssRuntimeModule.generateLoadStyleRuntime()),
      Buffer.from('\n'),

      // withLoading
      Buffer.from(CssRuntimeModule.generateChunkLoadingRuntime(
        chunkMap,
        chunk.ids ?? [],
      )),
      Buffer.from('\n'),

      // withHmr
      Buffer.from(CssRuntimeModule.generateHMRLoadChunkRuntime()),
      Buffer.from('\n'),
    ]);
  }
}
