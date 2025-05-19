// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { HtmlRspackPlugin } from '@rsbuild/core';
import path from 'path';
import type { Compiler, Compilation } from '@rspack/core';

export class PrefetchWorkerPlugin {
  resourceHints: HtmlRspackPlugin.HtmlTagObject[] = [];
  chunkIds: Set<string> = new Set();

  HtmlPlugin: HtmlRspackPlugin;

  constructor(
    options: { HtmlPlugin: HtmlRspackPlugin },
  ) {
    this.HtmlPlugin = options.HtmlPlugin;
  }

  apply(compiler: Compiler) {
    if (
      compiler.options.mode !== 'production'
      || typeof compiler.options.output?.publicPath === 'function'
    ) {
      console.warn(
        'PrefetchWorkerPlugin only works in production mode and when publicPath is a string',
      );
      return;
    }

    compiler.hooks.compilation.tap(
      'PrefetchWorkerPlugin',
      (compilation: Compilation) => {
        if (!this.HtmlPlugin) {
          console.warn('HtmlWebpackPlugin not found');
          return;
        }

        const htmlPluginHooks = (this.HtmlPlugin as any).getCompilationHooks(
          compilation,
        );
        htmlPluginHooks.alterAssetTags.tap(
          'PrefetchWorkerPlugin',
          (data: any) => {
            this.chunkIds.values().forEach(id => {
              // [name] is replaced with [id] in chunkFilename(detail: https://rspack.dev/config/output#outputchunkfilename)
              const outputRelativePath = compilation.getPath(
                (compilation.options.output.chunkFilename as string)!.replace(
                  /\[name\]/g,
                  '[id]',
                ),
                {
                  chunk: Array.from(compilation.chunks).find(i => i.id === id),
                },
              );
              const finalPath = path.join(
                (compilation.options.output.publicPath as string) === 'auto'
                  ? ''
                  : (compilation.options.output.publicPath as string),
                outputRelativePath,
              );
              data.assetTags.scripts = [
                {
                  tagName: 'link',
                  voidTag: true,
                  attributes: {
                    rel: 'prefetch',
                    href: finalPath,
                  },
                },
                ...data.assetTags.scripts,
              ];
            });
            return data;
          },
        );

        compilation.hooks.processAssets.tapAsync(
          'PrefetchWorkerPlugin',
          (_, callback) => {
            // Since webpack will not add chunks by new URL() to chunkGraph, the target worker-chunk needs to be filtered out
            // 1. Not referenced by other chunks
            const chunkIds = new Set<string>(
              Array.from(compilation.chunks).filter(Boolean).map(i =>
                String(i.id)
              ),
            );
            for (const chunk of compilation.chunks) {
              if (
                chunk.isOnlyInitial()
                || chunk.canBeInitial()
              ) {
                chunkIds.delete(String(chunk.id));
              }

              const chunkMaps = chunk.getChunkMaps(true);
              const importedChunk = Object.keys(chunkMaps.hash);
              importedChunk.forEach(i => {
                chunkIds.delete(i);
              });
            }

            // 2. Containing the worker-runtime key module
            for (const chunk of compilation.chunks) {
              if (chunkIds.has(String(chunk.id))) {
                const matchedWorkerResource = compilation.chunkGraph
                  .getChunkModules(chunk).some(
                    module =>
                      /mainThread[/\\]startMainThread\.js$/.test(
                        (module as unknown as { userRequest: string })
                          .userRequest,
                      ),
                  );

                if (!matchedWorkerResource) {
                  chunkIds.delete(String(chunk.id));
                }
              }
            }

            Array.from(chunkIds).forEach(i => this.chunkIds.add(i));
            callback();
          },
        );
      },
    );
  }
}
