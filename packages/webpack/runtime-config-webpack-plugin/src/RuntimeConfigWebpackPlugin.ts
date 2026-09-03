// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Chunk, Compiler } from '@rspack/core';

import { RuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

import { createRuntimeConfigRuntimeModule } from './RuntimeConfigRuntimeModule.js';

/**
 * Page-scoped runtime configuration contributed by a bundle.
 *
 * The plugin deliberately leaves configuration keys and values to the DSL
 * that consumes them.
 *
 * @public
 */
export type RuntimeConfigWebpackPluginOptions = Record<string, unknown>;

function applyRuntimeConfigInjection(
  compiler: Compiler,
  config: Readonly<RuntimeConfigWebpackPluginOptions>,
  pluginName: string,
): void {
  compiler.hooks.thisCompilation.tap(pluginName, compilation => {
    const onceForChunk = new WeakSet<Chunk>();
    const RuntimeConfigRuntimeModule = createRuntimeConfigRuntimeModule(
      compiler.webpack,
    );

    compilation.hooks.additionalTreeRuntimeRequirements.tap(
      pluginName,
      (chunk, runtimeRequirements) => {
        if (onceForChunk.has(chunk) || !chunk.hasRuntime()) {
          return;
        }

        onceForChunk.add(chunk);
        runtimeRequirements.add(RuntimeGlobals.lynxRuntimeConfig);
        compilation.addRuntimeModule(
          chunk,
          new RuntimeConfigRuntimeModule(config),
        );
      },
    );
  });
}

/**
 * Merges and shallow-freezes runtime configuration in
 * `lynx.__runtime_configs__`.
 *
 * Bundles are merged in execution order. Later bundle values overwrite
 * earlier values with the same key.
 *
 * @public
 */
export class RuntimeConfigWebpackPlugin {
  constructor(
    private readonly options: Readonly<RuntimeConfigWebpackPluginOptions>,
  ) {}

  /**
   * The entry point of a webpack plugin.
   * @param compiler - the webpack compiler
   */
  apply(compiler: Compiler): void {
    applyRuntimeConfigInjection(
      compiler,
      this.options,
      this.constructor.name,
    );
  }
}
