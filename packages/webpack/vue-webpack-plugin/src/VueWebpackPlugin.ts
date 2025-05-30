// VueWebpackPlugin.ts
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0

import { createRequire } from 'node:module';

import type { Chunk, Compilation, Compiler } from '@rspack/core';

import { RuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

import { LAYERS } from './layer.js';
import { createLynxProcessEvalResultRuntimeModule } from './LynxProcessEvalResultRuntimeModule.js';


const require = createRequire(import.meta.url);

interface VueWebpackPluginOptions {
  isProduction?: boolean;
  enableDevTools?: boolean;
  mainThreadChunks?: string[];
  experimental_isLazyBundle?: boolean;
}

class VueWebpackPlugin {
  static loaders = {
    BACKGROUND: require.resolve('./loaders/background.js'),
    MAIN_THREAD: require.resolve('./loaders/main-thread.js'),
  };

  constructor(private options?: VueWebpackPluginOptions) {}

  static defaultOptions: Required<VueWebpackPluginOptions> = {
    isProduction: false,
    enableDevTools: false,
    mainThreadChunks: [],
    experimental_isLazyBundle: false,
  };

  apply(compiler: Compiler): void {
    const options = { ...VueWebpackPlugin.defaultOptions, ...this.options };
    const { BannerPlugin, DefinePlugin } = compiler.webpack;

    // Inject Vue loader rules programmatically
    compiler.hooks.afterEnvironment.tap(this.constructor.name, () => {
      compiler.options.module.rules.push({
        test: /\.vue$/,
        oneOf: [
          {
            resourceQuery: /main/,
            layer: LAYERS.MAIN_THREAD,
            use: [VueWebpackPlugin.loaders.MAIN_THREAD],
          },
          {
            layer: LAYERS.BACKGROUND,
            use: [VueWebpackPlugin.loaders.BACKGROUND],
          },
        ],
      });
    });

    // Common configuration
    new DefinePlugin({
      __VUE_OPTIONS_API__: JSON.stringify(true),
      __VUE_PROD_DEVTOOLS__: JSON.stringify(options.enableDevTools),
      __VUE_PROD__: JSON.stringify(options.isProduction),
    }).apply(compiler);

    if (!options.experimental_isLazyBundle) {
      new BannerPlugin({
        banner: `'use strict';var globDynamicComponentEntry=globDynamicComponentEntry||'__Card__';`,
        raw: true,
        test: options.mainThreadChunks,
      }).apply(compiler);
    }

    compiler.hooks.thisCompilation.tap(this.constructor.name, (compilation) => {
      this.handleRuntimeModules(compilation, compiler);
      this.handleAssetProcessing(compilation, compiler, options);
    });
  }

  private handleRuntimeModules(compilation: Compilation, compiler: Compiler) {
    const onceForChunkSet = new WeakSet<Chunk>();

    compilation.hooks.runtimeRequirementInTree
      .for(compiler.webpack.RuntimeGlobals.ensureChunkHandlers)
      .tap('VueWebpackPlugin', (_, runtimeRequirements) => {
        runtimeRequirements.add(RuntimeGlobals.lynxProcessEvalResult);
      });

    compilation.hooks.runtimeRequirementInTree
      .for(RuntimeGlobals.lynxProcessEvalResult)
      .tap('VueWebpackPlugin', (chunk) => {
        if (onceForChunkSet.has(chunk)) return;
        onceForChunkSet.add(chunk);

        if (chunk.name?.includes(':background')) return;

        const RuntimeModule = createLynxProcessEvalResultRuntimeModule(compiler.webpack);
        compilation.addRuntimeModule(chunk, new RuntimeModule());
      });
  }

  private handleAssetProcessing(compilation: Compilation, compiler: Compiler, options: Required<VueWebpackPluginOptions>) {
    compilation.hooks.processAssets.tap(
      {
        name: this.constructor.name,
        stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
      },
      () => {
        for (const name of options.mainThreadChunks) {
          this.updateMainThreadInfo(compilation, name);
        }

        compilation.chunkGroups
          .filter(cg => !cg.isInitial())
          .filter(cg => cg.origins.every(origin => 
            origin.module?.layer === LAYERS.MAIN_THREAD
          ))
          .forEach(cg => {
            cg.getFiles()
              .filter(name => name.endsWith('.js'))
              .forEach(name => this.updateMainThreadInfo(compilation, name));
          });
      }
    );
  }

  private updateMainThreadInfo(compilation: Compilation, name: string) {
    const asset = compilation.getAsset(name);
    if (asset) {
      compilation.updateAsset(name, asset.source, {
        ...asset.info,
        'lynx:main-thread': true,
      });
    }
  }
}

export { VueWebpackPlugin, type VueWebpackPluginOptions };
