// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RuntimeModule } from '@rspack/core';

import { RuntimeGlobals as LynxRuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

import type { RuntimeConfigWebpackPluginOptions } from './RuntimeConfigWebpackPlugin.js';

type RuntimeConfigRuntimeModule = new(
  config: Readonly<RuntimeConfigWebpackPluginOptions>,
) => RuntimeModule;

/** Merge runtime-readable build configuration before application startup. */
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
      // The host overwrites earlier top-level values while preserving the
      // shared object reference, then shallow-freezes the merged config.
      return `${LynxRuntimeGlobals.lynxRuntimeConfig} = Object.freeze(Object.assign(${LynxRuntimeGlobals.lynxRuntimeConfig} || {}, ${
        JSON.stringify(this.config)
      }));`;
    }
  };
}
