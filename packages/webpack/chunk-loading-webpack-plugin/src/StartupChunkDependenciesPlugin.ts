// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Chunk, Compiler } from 'webpack';

import { createStartupChunkDependenciesRuntimeModule } from './StartupChunkDependenciesRuntimeModule.js';

import type { StartupChunkDependenciesPluginOptions } from './index.js';

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
          set.add(RuntimeGlobals.startup);
          set.add(RuntimeGlobals.ensureChunk);
          set.add(RuntimeGlobals.ensureChunkIncludeEntries);
          compilation.addRuntimeModule(
            chunk,
            new StartupChunkDependenciesRuntimeModule(this.asyncChunkLoading),
          );
        },
      );
    });
  }
}
