// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Compiler } from 'webpack';

/**
 * The options for CommonJsChunkFormatPlugin
 */
interface CommonJsChunkFormatPluginOptions {
}

const PLUGIN_NAME = 'CommonJsChunkFormatPlugin';

export class CommonJsChunkFormatPlugin {
  constructor(
    public compiler: Compiler,
    public options: CommonJsChunkFormatPluginOptions,
  ) {
    const { RuntimeGlobals } = compiler.webpack;
    compiler.hooks.thisCompilation(PLUGIN_NAME, (compilation) => {
      compilation.hooks.additionalChunkRuntimeRequirements.tap(
        PLUGIN_NAME,
        (chunk, set, { chunkGraph }) => {
          if (chunk.hasRuntime()) return;
          if (chunkGraph.getNumberOfEntryModules(chunk) > 0) {
            set.add(RuntimeGlobals.require);
            set.add(RuntimeGlobals.startupEntrypoint);
            set.add(RuntimeGlobals.externalInstallChunk);
          }
        },
      );
    });
  }

  apply(compiler: Compiler): void {
  }
}
