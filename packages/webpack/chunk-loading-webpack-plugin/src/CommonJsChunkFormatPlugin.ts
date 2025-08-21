// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Compiler } from '@rspack/core';

/**
 * The options for CommonJsChunkFormatPlugin
 */
interface CommonJsChunkFormatPluginOptions {
}

export class CommonJsChunkFormatPlugin {
  apply(compiler: Compiler): void {
    new CommonJsChunkFormatPluginImpl(
      compiler,
      {},
    );
  }
}

class CommonJsChunkFormatPluginImpl {
  name = 'CommonJsChunkFormatPlugin';

  constructor(
    compiler: Compiler,
    public options: CommonJsChunkFormatPluginOptions,
  ) {
    const { RuntimeGlobals } = compiler.webpack;

    compiler.hooks.thisCompilation.tap(this.name, (compilation) => {
      compilation.hooks.additionalChunkRuntimeRequirements.tap(
        this.name,
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
}
