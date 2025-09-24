// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Chunk, ChunkGraph, RuntimeModule } from 'webpack';

import { JavaScriptRuntimeModule } from './runtime/JavaScriptRuntimeModule.js';

type ChunkLoadingRuntimeModule = new(
  runtimeRequirements: ReadonlySet<string>,
) => RuntimeModule;

export function createChunkLoadingRuntimeModule(
  webpack: typeof import('webpack'),
): ChunkLoadingRuntimeModule {
  const { RuntimeGlobals, RuntimeModule, Template } = webpack;
  return class ChunkLoadingRuntimeModule extends RuntimeModule {
    constructor(public runtimeRequirements: ReadonlySet<string>) {
      super('Lynx chunk loading', RuntimeModule.STAGE_ATTACH);
    }

    override generate(): string | null {
      const initialChunkIds = this.#getInitialChunkIds(
        this.chunk!,
        this.chunkGraph!,
        ChunkLoadingRuntimeModule.#chunkHasJs,
      );

      const withHmr = this.runtimeRequirements.has(
        RuntimeGlobals.hmrDownloadUpdateHandlers,
      );

      const withHmrManifest = this.runtimeRequirements.has(
        RuntimeGlobals.hmrDownloadManifest,
      );

      const withLoading = this.runtimeRequirements.has(
        RuntimeGlobals.ensureChunkHandlers,
      );

      const withOnload = this.runtimeRequirements.has(
        RuntimeGlobals.onChunksLoaded,
      );

      const stateExpression = withHmr
        ? `${RuntimeGlobals.hmrRuntimeStatePrefix}_require`
        : undefined;

      return Template.asString([
        '// object to store loaded chunks',
        '// "1" means "loaded", otherwise not loaded yet',
        `var installedChunks = ${
          stateExpression ? `${stateExpression} = ${stateExpression} || ` : ''
        }{`,
        Template.indent(
          Array.from(initialChunkIds, id => `${JSON.stringify(id)}: 1`).join(
            ',\n',
          ),
        ),
        '};',
        withOnload
          ? JavaScriptRuntimeModule.generateChunkOnloadRuntime(webpack)
          : '// no on chunks loaded',
        withLoading
          ? JavaScriptRuntimeModule.generateInstallChunkRuntime(
            webpack,
            withOnload,
          )
          : '// no chunk install function needed',
        withLoading
          ? JavaScriptRuntimeModule.generateChunkLoadingRuntime(webpack, 'true') // TODO: JS_MATCHER
          : '// no chunk loading',
        withHmr
          ? JavaScriptRuntimeModule.generateHMRRuntime(webpack)
          : '// no HMR',
        withHmrManifest
          ? JavaScriptRuntimeModule.generateHMRManifestRuntime(webpack)
          : '// no HMR manifest',
      ]);
    }

    #getInitialChunkIds(
      chunk: Chunk,
      chunkGraph: ChunkGraph,
      filterFn: (chunk: Chunk, chunkGraph: ChunkGraph) => boolean,
    ): Set<number | string> {
      const initialChunkIds = new Set(chunk.ids);
      for (const c of chunk.getAllInitialChunks()) {
        if (c === chunk || filterFn(c, chunkGraph)) continue;
        for (const id of c.ids ?? []) initialChunkIds.add(id);
      }
      return initialChunkIds;
    }

    static #chunkHasJs(
      this: void,
      chunk: Chunk,
      chunkGraph: ChunkGraph,
    ): boolean {
      if (chunkGraph.getNumberOfEntryModules(chunk) > 0) return true;

      const chunkModules = chunkGraph.getChunkModulesIterableBySourceType(
        chunk,
        'javascript',
      );

      // Webpack would return `undefined` when no chunk module is found
      if (!chunkModules) {
        return false;
      }

      // Rspack would return an empty array instead of `undefined`.
      return chunkModules[Symbol.iterator]().next().done !== true;
    }
  };
}
