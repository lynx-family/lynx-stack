// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Compilation, Compiler } from '@rspack/core';
import invariant from 'tiny-invariant';

import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';

import { moduleHasWorkletUsage } from './workletMetadata.js';

const WORKLET_RUNTIME_CHUNK_NAME: string = 'worklet-runtime';

interface LepusChunkPipelineItem {
  chunkName: string;
  sourcePath: string;
  shouldCompile: (module: unknown) => boolean;
  shouldInject: (lepusRootSource: string | undefined) => boolean;
}

interface LepusChunkPipelineOptions {
  workletRuntimePath: string;
}

interface LepusChunkCompiledAsset {
  source: {
    source: () => { toString: () => string };
  };
}

function createLepusChunkPipeline(
  options: LepusChunkPipelineOptions,
): LepusChunkPipelineItem[] {
  const chunks: LepusChunkPipelineItem[] = [];

  if (options.workletRuntimePath) {
    chunks.push({
      chunkName: WORKLET_RUNTIME_CHUNK_NAME,
      sourcePath: options.workletRuntimePath,
      shouldCompile: moduleHasWorkletUsage,
      shouldInject: (lepusRootSource) =>
        lepusRootSource?.includes('registerWorkletInternal') ?? false,
    });
  }

  return chunks;
}

function injectLepusChunkEntries(
  compiler: Compiler,
  lepusChunkPipeline: LepusChunkPipelineItem[],
): void {
  if (lepusChunkPipeline.length === 0) {
    return;
  }

  compiler.hooks.make.tapAsync(
    'ReactWebpackPlugin:LepusChunkEntry',
    (compilation, callback) => {
      compilation.hooks.finishModules.tapAsync(
        'ReactWebpackPlugin:LepusChunkEntry',
        (modules, finishCallback) => {
          const allModules = [...modules];
          const queuedChunks = lepusChunkPipeline.filter((chunk) =>
            !hasEntry(compiler, chunk.chunkName)
            && allModules.some(module => chunk.shouldCompile(module))
          );

          if (queuedChunks.length === 0) {
            finishCallback();
            return;
          }

          let pending = queuedChunks.length;
          let settled = false;
          const done = (error?: Error) => {
            if (settled) {
              return;
            }
            if (error) {
              settled = true;
              finishCallback(error);
              return;
            }
            pending -= 1;
            if (pending === 0) {
              settled = true;
              finishCallback();
            }
          };

          for (const chunk of queuedChunks) {
            const dependency = compiler.webpack.EntryPlugin.createDependency(
              chunk.sourcePath,
            );
            // Build lepus runtime chunks through the standard entry pipeline so
            // source maps can be discovered from compilation assets/chunks.
            compilation.addEntry(
              compiler.context,
              dependency,
              { name: chunk.chunkName },
              (error) => {
                if (error) {
                  done(error);
                  return;
                }
                done();
              },
            );
          }
        },
      );

      callback();
    },
  );
}

function excludeLepusChunksFromTemplate(
  compiler: Compiler,
  lepusChunkPipeline: LepusChunkPipelineItem[],
): void {
  const chunkNames = new Set(lepusChunkPipeline.map(chunk => chunk.chunkName));
  if (chunkNames.size === 0) {
    return;
  }

  for (const plugin of compiler.options.plugins ?? []) {
    if (!(plugin instanceof LynxTemplatePlugin)) {
      continue;
    }

    const templatePlugin = plugin as unknown as {
      options?: {
        excludeChunks?: string[];
      };
    };
    templatePlugin.options ??= {};
    templatePlugin.options.excludeChunks ??= [];

    for (const chunkName of chunkNames) {
      if (templatePlugin.options.excludeChunks.includes(chunkName)) {
        continue;
      }
      templatePlugin.options.excludeChunks.push(chunkName);
    }
  }
}

function getLepusChunkPrimaryJsAsset(
  compilation: Compilation,
  chunkName: string,
): LepusChunkCompiledAsset {
  const jsAssetNames = getLepusChunkJsAssetNames(compilation, chunkName);

  invariant(
    jsAssetNames.length === 1,
    `[ReactWebpackPlugin] Lepus chunk "${chunkName}" must emit exactly one JS asset, but got ${jsAssetNames.length}: ${
      jsAssetNames.length > 0 ? jsAssetNames.join(', ') : '(none)'
    }. Please disable split/runtime extraction for this chunk.`,
  );

  const jsAssetName = jsAssetNames[0]!;
  const asset = compilation.getAsset(jsAssetName);

  invariant(
    asset,
    `[ReactWebpackPlugin] Missing compiled asset "${jsAssetName}" for chunk "${chunkName}".`,
  );

  invariant(
    hasSourceAccessor(asset),
    `[ReactWebpackPlugin] Asset "${jsAssetName}" of chunk "${chunkName}" has no valid source accessor.`,
  );

  return asset;
}

function getLepusChunkGeneratedAssetNames(
  compilation: Compilation,
  chunkName: string,
): string[] {
  const jsAssetNames = getLepusChunkJsAssetNames(compilation, chunkName);
  const assetNames = new Set<string>(jsAssetNames);
  for (const jsAssetName of jsAssetNames) {
    const sourceMapName = `${jsAssetName}.map`;
    if (compilation.getAsset(sourceMapName)) {
      assetNames.add(sourceMapName);
    }
  }
  return [...assetNames];
}

function createIsolatedLepusChunkSource(source: string): string {
  // Lepus chunks run in the main-thread JS realm.
  // Keep compiled entry bootstrap out of global scope to avoid clobbering
  // root chunk runtime symbols (`__webpack_require__`, `__webpack_modules__`).
  return `(function(){${source}\n})();`;
}

function getLepusChunkJsAssetNames(
  compilation: Compilation,
  chunkName: string,
): string[] {
  const chunk = compilation.namedChunks.get(chunkName);
  if (!chunk) {
    return [];
  }

  const files = [...chunk.files];
  return files.filter((name: string) =>
    name.endsWith('.js') && !name.endsWith('.hot-update.js')
  );
}

function hasEntry(compiler: Compiler, name: string): boolean {
  const { entry } = compiler.options;
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return false;
  }
  return name in entry;
}

function hasSourceAccessor(value: unknown): value is LepusChunkCompiledAsset {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const source = (value as { source?: unknown }).source;
  if (!source || typeof source !== 'object') {
    return false;
  }
  const sourceGetter = (source as { source?: unknown }).source;
  return typeof sourceGetter === 'function';
}

export {
  createIsolatedLepusChunkSource,
  createLepusChunkPipeline,
  excludeLepusChunksFromTemplate,
  getLepusChunkGeneratedAssetNames,
  getLepusChunkPrimaryJsAsset,
  injectLepusChunkEntries,
};
export type { LepusChunkPipelineItem };
