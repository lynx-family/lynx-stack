// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Chunk, Compiler } from 'webpack';

import { createStartupChunkDependenciesRuntimeModule } from './StartupChunkDependenciesRuntimeModule.js';
import { createStartupEntrypointRuntimeModule } from './StartupEntrypointRuntimeModule.js';

/**
 * The options for StartupChunkDependenciesPlugin
 */
interface StartupChunkDependenciesPluginOptions {
  /**
   * Specifies the chunk loading method
   * @defaultValue 'lynx'
   * @remarks Currently only 'lynx' is supported
   */
  chunkLoading: string;

  /**
   * Whether to enable async chunk loading
   * @defaultValue true
   * @remarks Currently only async loading mode is supported
   */
  asyncChunkLoading: boolean;
}

const PLUGIN_NAME = 'StartupChunkDependenciesPlugin';

export class StartupChunkDependenciesPlugin {
  chunkLoading: string;
  asyncChunkLoading: boolean;

  constructor(
    public options: StartupChunkDependenciesPluginOptions,
  ) {
    this.chunkLoading = options.chunkLoading;
    this.asyncChunkLoading = typeof options.asyncChunkLoading === 'boolean'
      ? options.asyncChunkLoading
      : true;
  }

  apply(compiler: Compiler): void {
    const { RuntimeGlobals } = compiler.webpack;

    const StartupChunkDependenciesRuntimeModule =
      createStartupChunkDependenciesRuntimeModule(
        compiler.webpack,
      );

    const StartupEntrypointRuntimeModule = createStartupEntrypointRuntimeModule(
      compiler.webpack,
    );

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      const globalChunkLoading = compilation.outputOptions.chunkLoading;

      const isEnabledForChunk = (chunk: Chunk): boolean => {
        const options = chunk.getEntryOptions();
        const chunkLoading = options && options.chunkLoading !== undefined
          ? options.chunkLoading
          : globalChunkLoading;
        return chunkLoading === this.chunkLoading;
      };

      compilation.hooks.additionalTreeRuntimeRequirements.tap(
        PLUGIN_NAME,
        (chunk, set) => {
          if (!isEnabledForChunk(chunk)) return;

          if (compilation.chunkGraph.hasChunkEntryDependentChunks(chunk)) {
            set.add(RuntimeGlobals.startup);
            set.add(RuntimeGlobals.ensureChunk);
            set.add(RuntimeGlobals.ensureChunkIncludeEntries);
            compilation.addRuntimeModule(
              chunk,
              new StartupChunkDependenciesRuntimeModule(this.asyncChunkLoading),
            );
          }
        },
      );

      compilation.hooks.runtimeRequirementInTree
        .for(RuntimeGlobals.startupEntrypoint)
        .tap(PLUGIN_NAME, (chunk, set) => {
          if (!isEnabledForChunk(chunk)) return;

          set.add(RuntimeGlobals.require);
          set.add(RuntimeGlobals.ensureChunk);
          set.add(RuntimeGlobals.ensureChunkIncludeEntries);
          compilation.addRuntimeModule(
            chunk,
            new StartupEntrypointRuntimeModule(this.asyncChunkLoading),
          );
        });
    });
  }
}
