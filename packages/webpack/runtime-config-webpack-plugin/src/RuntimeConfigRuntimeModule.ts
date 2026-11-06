// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RuntimeModule } from '@rspack/core';

import { RuntimeGlobals as LynxRuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

import type { RuntimeConfigWebpackPluginOptions } from './RuntimeConfigWebpackPlugin.js';

type RuntimeConfigRuntimeModule = new(
  config: Readonly<RuntimeConfigWebpackPluginOptions>,
) => RuntimeModule;

/** Reset runtime-readable build configuration before application startup. */
export function createRuntimeConfigRuntimeModule(
  webpack: typeof import('@rspack/core').rspack,
): RuntimeConfigRuntimeModule {
  const { RuntimeModule } = webpack;

  return class RuntimeConfigRuntimeModule extends RuntimeModule {
    constructor(
      private readonly config: Readonly<RuntimeConfigWebpackPluginOptions>,
    ) {
      super(
        'webpack/runtime/lynx runtime config',
        RuntimeModule.STAGE_NORMAL,
      );
    }

    override generate(): string {
      // `lynxRuntimeConfig` is the page-scoped `lynx.__runtime_configs__`.
      // Reset stale configuration whenever the host entry is re-evaluated.
      const runtimeConfig = LynxRuntimeGlobals.lynxRuntimeConfig;
      const config = JSON.stringify(this.config);
      return `${runtimeConfig} = ${config};`;
    }
  };
}
