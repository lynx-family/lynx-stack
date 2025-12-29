// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Chunk, Compiler } from 'webpack';

import { RuntimeGlobals as LynxRuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

import { createLynxCacheEventsRuntimeModule } from './LynxCacheEventsRuntimeModule.js';
import { createLynxCacheEventsSetupListRuntimeModule } from './LynxCacheEventsSetupListRuntimeModule.js';

/**
 * The options for {@link LynxCacheEventsPlugin}
 *
 * @public
 */
export interface LynxCacheEventsPluginOptions {
  /**
   * The transformer function to modify the setup list.
   *
   * @example
   * ```js
   * // webpack.config.js
   * import { LynxCacheEventsPlugin } from '@lynx-js/cache-events-webpack-plugin'
   *
   * const config = {
   *   plugins: [
   *     new LynxCacheEventsPlugin({
   *       setupListTransformer: (setupList) => {
   *         setupList.push(
   *           `{
   *             name: 'customCacheEvent',
   *             setup: () => {
   *               console.log('customCacheEvent setup');
   *               return () => {
   *                 console.log('customCacheEvent teardown');
   *               }
   *             }
   *           }`
   *         )
   *         return setupList;
   *       },
   *     }),
   *   ],
   * }
   * ```
   *
   * @public
   */
  setupListTransformer?: (setupList: string[]) => string[];
}

/**
 * A webpack plugin that cache Lynx native events until the BTS chunk is fully loaded, and replay them when the BTS chunk is ready.
 *
 * @public
 */
export class LynxCacheEventsPlugin {
  constructor(protected options?: LynxCacheEventsPluginOptions | undefined) {}
  /**
   * `defaultOptions` is the default options that the {@link LynxCacheEventsPlugin} uses.
   *
   * @example
   * `defaultOptions` can be used to change part of the option and keep others as the default value.
   *
   * ```js
   * // webpack.config.js
   * import { LynxCacheEventsPlugin } from '@lynx-js/cache-events-webpack-plugin'
   * export default {
   *   plugins: [
   *     new LynxCacheEventsPlugin({
   *       ...LynxCacheEventsPlugin.defaultOptions,
   *       setupListTransformer: (setupList) => setupList,
   *     }),
   *   ],
   * }
   * ```
   *
   * @public
   */
  static defaultOptions: Readonly<Required<LynxCacheEventsPluginOptions>> =
    Object
      .freeze<Required<LynxCacheEventsPluginOptions>>({
        setupListTransformer: (setupList) => setupList,
      });
  /**
   * The entry point of a webpack plugin.
   * @param compiler - the webpack compiler
   */
  apply(compiler: Compiler): void {
    new LynxCacheEventsPluginImpl(
      compiler,
      Object.assign({}, LynxCacheEventsPlugin.defaultOptions, this.options),
    );
  }
}

export class LynxCacheEventsPluginImpl {
  name = 'LynxCacheEventsPlugin';
  protected options: Required<LynxCacheEventsPluginOptions>;

  static chunkLoadingValue = 'lynx';

  constructor(
    compiler: Compiler,
    options: Required<LynxCacheEventsPluginOptions>,
  ) {
    this.options = options;

    if (
      compiler.options.output.chunkLoading
        !== LynxCacheEventsPluginImpl.chunkLoadingValue
    ) {
      return;
    }

    const { RuntimeGlobals } = compiler.webpack;

    compiler.hooks.thisCompilation.tap(this.name, compilation => {
      const handler = (chunk: Chunk, runtimeRequirements: Set<string>) => {
        const globalChunkLoading = compilation.outputOptions.chunkLoading;
        const isEnabledForChunk = (chunk: Chunk): boolean => {
          const options = chunk.getEntryOptions();
          const chunkLoading = options && options.chunkLoading !== undefined
            ? options.chunkLoading
            : globalChunkLoading;
          return chunkLoading === LynxCacheEventsPluginImpl.chunkLoadingValue;
        };
        if (!isEnabledForChunk(chunk)) return;
        runtimeRequirements.add(LynxRuntimeGlobals.lynxCacheEventsSetupList);
        runtimeRequirements.add(LynxRuntimeGlobals.lynxCacheEvents);
      };
      compilation.hooks.runtimeRequirementInTree
        .for(RuntimeGlobals.startup)
        .tap(this.name, handler);

      const onceForChunkSet = {
        [LynxRuntimeGlobals.lynxAsyncChunkIds]: new WeakSet<Chunk>(),
        [LynxRuntimeGlobals.lynxCacheEvents]: new WeakSet<Chunk>(),
        [LynxRuntimeGlobals.lynxCacheEventsSetupList]: new WeakSet<Chunk>(),
      };

      const LynxCacheEventsSetupListRuntimeModule =
        createLynxCacheEventsSetupListRuntimeModule(
          compiler.webpack,
        );
      const LynxCacheEventsRuntimeModule = createLynxCacheEventsRuntimeModule(
        compiler.webpack,
      );
      compilation.hooks.runtimeRequirementInTree.for(
        LynxRuntimeGlobals.lynxCacheEventsSetupList,
      ).tap(this.name, (chunk) => {
        // Only add the LynxCacheEventsSetupListRuntimeModule once
        if (
          onceForChunkSet[LynxRuntimeGlobals.lynxCacheEventsSetupList].has(
            chunk,
          )
        ) {
          return;
        }
        onceForChunkSet[LynxRuntimeGlobals.lynxCacheEventsSetupList].add(chunk);

        if (chunk.name?.includes('__main-thread')) {
          return;
        }

        compilation.addRuntimeModule(
          chunk,
          new LynxCacheEventsSetupListRuntimeModule(
            this.options.setupListTransformer,
          ),
        );
      });
      compilation.hooks.runtimeRequirementInTree.for(
        LynxRuntimeGlobals.lynxCacheEvents,
      ).tap(this.name, (chunk, set) => {
        // Only add the LynxCacheEventsRuntimeModule once
        if (onceForChunkSet[LynxRuntimeGlobals.lynxCacheEvents].has(chunk)) {
          return;
        }
        onceForChunkSet[LynxRuntimeGlobals.lynxCacheEvents].add(chunk);

        if (chunk.name?.includes('__main-thread')) {
          return;
        }

        set.add(LynxRuntimeGlobals.lynxCacheEventsSetupList);
        compilation.addRuntimeModule(
          chunk,
          new LynxCacheEventsRuntimeModule(),
        );
      });
    });
  }
}
