// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Chunk, ChunkGraph, RuntimeModule } from 'webpack';

import { ChunkLoadingType } from './LynxChunkLoadingType.js';
import { JavaScriptRuntimeModule } from './runtime/JavaScriptRuntimeModule.js';

type ChunkLoadingRuntimeModule = new(
  runtimeRequirements: ReadonlySet<string>,
) => RuntimeModule;

export function createChunkLoadingRuntimeModule(
  webpack: typeof import('webpack'),
  options: ChunkLoadingType,
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

      // TODO: JS_MATCHER
      const chunkLoading = options === ChunkLoadingType.ASYNC
        ? JavaScriptRuntimeModule.generateChunkLoadingRuntime('true')
        : JavaScriptRuntimeModule.generateSyncChunkLoadingRuntime('true');

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
          ? JavaScriptRuntimeModule.generateChunkOnloadRuntime()
          : '// no on chunks loaded',
        withLoading
          ? JavaScriptRuntimeModule.generateInstallChunkRuntime(withOnload)
          : '// no chunk install function needed',
        withLoading
          ? chunkLoading
          : '// no chunk loading',
        withHmr
          ? JavaScriptRuntimeModule.generateHMRRuntime()
          : '// no HMR',
        withHmrManifest
          ? JavaScriptRuntimeModule.generateHMRManifestRuntime()
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

      return chunkGraph.getChunkModulesIterableBySourceType(chunk, 'javascript')
        ? true
        : false;
    }
  };
}
