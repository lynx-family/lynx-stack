// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Chunk, Compiler, RuntimeModule } from 'webpack';

import { RuntimeGlobals as LynxRuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

import { createChunkLoadingRuntimeModule } from './ChunkLoadingRuntimeModule.js';
import { createCssChunkLoadingRuntimeModule } from './CssChunkLoadingRuntimeModule.js';

import type { ChunkLoadingWebpackPluginOptions } from './index.js';

export class ChunkLoadingWebpackPluginImpl {
  name = 'ChunkLoadingWebpackPlugin';

  static chunkLoadingValue = 'lynx';

  constructor(
    public compiler: Compiler,
    public options: ChunkLoadingWebpackPluginOptions,
  ) {
    const { RuntimeGlobals, javascript } = compiler.webpack;

    javascript.EnableChunkLoadingPlugin.setEnabled(
      compiler,
      ChunkLoadingWebpackPluginImpl.chunkLoadingValue,
    );

    if (
      compiler.options.output.chunkLoading
        !== ChunkLoadingWebpackPluginImpl.chunkLoadingValue
    ) {
      return;
    }

    // javascript chunk loading
    compiler.hooks.thisCompilation.tap(this.name, (compilation) => {
      const ChunkLoadingRuntimeModule = createChunkLoadingRuntimeModule(
        compiler.webpack,
      );
      // TODO(colinaaa): enable this after https://github.com/web-infra-dev/rspack/issues/9849 is fixed.
      // const onceForChunkSet = new WeakSet<Chunk>();

      const globalChunkLoading = compilation.outputOptions.chunkLoading;
      /**
       * @param {Chunk} chunk chunk
       * @returns {boolean} true, if wasm loading is enabled for the chunk
       */
      const isEnabledForChunk = (chunk: Chunk): boolean => {
        const options = chunk.getEntryOptions();
        const chunkLoading = options && options.chunkLoading !== undefined
          ? options.chunkLoading
          : globalChunkLoading;
        return chunkLoading === ChunkLoadingWebpackPluginImpl.chunkLoadingValue;
      };

      const handler = (chunk: Chunk, runtimeRequirements: Set<string>) => {
        // if (onceForChunkSet.has(chunk)) return;
        // onceForChunkSet.add(chunk);
        if (!isEnabledForChunk(chunk)) return;
        runtimeRequirements.add(RuntimeGlobals.getChunkUpdateScriptFilename);
        runtimeRequirements.add(RuntimeGlobals.moduleFactoriesAddOnly);
        runtimeRequirements.add(RuntimeGlobals.hasOwnProperty);
        runtimeRequirements.add(RuntimeGlobals.publicPath);
        runtimeRequirements.add(LynxRuntimeGlobals.lynxAsyncChunkIds);
        compilation.addRuntimeModule(
          chunk,
          new ChunkLoadingRuntimeModule(runtimeRequirements),
        );
      };

      compilation.hooks.runtimeRequirementInTree
        .for(RuntimeGlobals.ensureChunkHandlers)
        .tap(this.name, handler);
      compilation.hooks.runtimeRequirementInTree
        .for(RuntimeGlobals.hmrDownloadUpdateHandlers)
        .tap(this.name, handler);
      compilation.hooks.runtimeRequirementInTree
        .for(RuntimeGlobals.hmrDownloadManifest)
        .tap(this.name, handler);
      compilation.hooks.runtimeRequirementInTree
        .for(RuntimeGlobals.baseURI)
        .tap(this.name, handler);
      compilation.hooks.runtimeRequirementInTree
        .for(RuntimeGlobals.externalInstallChunk)
        .tap(this.name, handler);
      compilation.hooks.runtimeRequirementInTree
        .for(RuntimeGlobals.onChunksLoaded)
        .tap(this.name, handler);

      compilation.hooks.runtimeRequirementInTree
        .for(RuntimeGlobals.ensureChunkHandlers)
        .tap(this.name, (chunk, set) => {
          if (!isEnabledForChunk(chunk)) return;
          set.add(RuntimeGlobals.getChunkScriptFilename);
        });
      compilation.hooks.runtimeRequirementInTree
        .for(RuntimeGlobals.hmrDownloadUpdateHandlers)
        .tap(this.name, (chunk, set) => {
          if (!isEnabledForChunk(chunk)) return;
          set.add(RuntimeGlobals.getChunkUpdateScriptFilename);
          set.add(RuntimeGlobals.moduleCache);
          set.add(RuntimeGlobals.hmrModuleData);
          set.add(RuntimeGlobals.moduleFactoriesAddOnly);
        });
      compilation.hooks.runtimeRequirementInTree
        .for(RuntimeGlobals.hmrDownloadManifest)
        .tap(this.name, (chunk, set) => {
          if (!isEnabledForChunk(chunk)) return;
          set.add(RuntimeGlobals.getUpdateManifestFilename);
        });
    });

    // TODO: support experiments.css

    // css chunk loading for mini-extract-css-plugin
    compiler.hooks.thisCompilation.tap(this.name, (compilation) => {
      const CssChunkLoadingRuntimeModule = createCssChunkLoadingRuntimeModule(
        compiler.webpack,
      );
      const originAddRuntimeModule = compilation.addRuntimeModule.bind(
        compilation,
      );
      compilation.addRuntimeModule = (function addRuntimeModule(
        chunk: Chunk,
        runtimeModule: RuntimeModule & {
          runtimeOptions?: unknown;
          runtimeRequirements?: Set<string>;
        },
      ) {
        if (
          runtimeModule.constructor.name === 'CssLoadingRuntimeModule'
          && runtimeModule.runtimeOptions
        ) {
          return originAddRuntimeModule(
            chunk,
            new CssChunkLoadingRuntimeModule(
              runtimeModule.runtimeRequirements!,
            ),
          );
        }
        return originAddRuntimeModule(chunk, runtimeModule);
      }).bind(compilation);
    });
  }
}
