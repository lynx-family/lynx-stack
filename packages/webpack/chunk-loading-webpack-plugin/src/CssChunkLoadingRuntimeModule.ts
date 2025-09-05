// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RuntimeModule } from 'webpack';

import { CssRuntimeModule } from './runtime/CssRuntimeModule.js';
import { getCssChunkObject } from './runtime/helper.js';

type CssChunkLoadingRuntimeModule = new(
  runtimeRequirements: Set<string>,
) => RuntimeModule;

export function createCssChunkLoadingRuntimeModule(
  webpack: typeof import('webpack'),
): CssChunkLoadingRuntimeModule {
  const { RuntimeModule, RuntimeGlobals, Template } = webpack;

  return class CssChunkLoadingRuntimeModule extends RuntimeModule {
    constructor(public runtimeRequirements: Set<string>) {
      super('Lynx css loading', 10);

      this.runtimeRequirements = runtimeRequirements;
    }

    override generate() {
      const { chunk, runtimeRequirements } = this;
      const chunkMap = getCssChunkObject(
        chunk!,
        this.compilation!,
      );

      const withLoading =
        runtimeRequirements.has(RuntimeGlobals.ensureChunkHandlers)
        && Object.keys(chunkMap).length > 0;
      const withHmr = runtimeRequirements.has(
        RuntimeGlobals.hmrDownloadUpdateHandlers,
      );

      if (!withLoading && !withHmr) {
        return '';
      }
      return Template.asString([
        CssRuntimeModule.generateLoadStyleRuntime(webpack),
        '',
        withLoading
          ? CssRuntimeModule.generateChunkLoadingRuntime(
            webpack,
            chunkMap,
            chunk!.ids ?? [],
          )
          : '// no chunk loading',
        '',
        withHmr
          ? CssRuntimeModule.generateHMRLoadChunkRuntime(webpack)
          : '// no hmr',
      ]);
    }
  };
}
