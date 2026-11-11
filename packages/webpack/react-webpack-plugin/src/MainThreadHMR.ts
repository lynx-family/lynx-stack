// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Chunk, Compiler, Module } from '@rspack/core';

import type { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';
import { RuntimeGlobals as LynxRuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

import { DEFINES_FOR_WORKLET_BUILD_INFO } from './Defines.js';
import type { EntryPair } from './DefinesInjection.js';
import { MAIN_THREAD_HMR } from './hmr/enabled.js';
import { LAYERS } from './layer.js';
import backgroundRuntime from './runtime/hmr-background.js';
import loadRuntime from './runtime/hmr-load.js';
import mainThreadRuntime from './runtime/hmr-main-thread.js';

type ResourceModule = Module & { resource?: string };

export function applyMainThreadHMR(
  compiler: Compiler,
  entryPairs: EntryPair[],
  acceptEntryModules: boolean,
  templatePlugin: typeof LynxTemplatePlugin,
): void {
  const name = 'ReactMainThreadHMR';
  (compiler as unknown as Record<symbol, unknown>)[MAIN_THREAD_HMR] = true;
  const { RuntimeGlobals, RuntimeModule, Template, sources } = compiler.webpack;
  let previousHash: string | undefined;
  let previousModules = new Map<string, string | null>();

  compiler.hooks.thisCompilation.tap(name, compilation => {
    const currentModules = new Map<string, string | null>();
    const getFilename = (
      chunk: Chunk,
      manifest: boolean,
      id = chunk.id,
    ): string =>
      compilation.getPath(
        manifest
          ? compilation.outputOptions.hotUpdateMainFilename!
          : compilation.outputOptions.hotUpdateChunkFilename!,
        {
          hash: previousHash!,
          chunk: { id: id!, name: chunk.name! },
          runtime: [...chunk.runtime].sort().join('~'),
        },
      );

    compilation.hooks.additionalTreeRuntimeRequirements.tap(
      name,
      (chunk, requirements) => {
        for (const pair of entryPairs) {
          const main = compilation.entrypoints.get(pair.mainThread);
          const background = compilation.entrypoints.get(pair.background);
          const isMain = main?.getRuntimeChunk() === chunk;
          if (!isMain && background?.getRuntimeChunk() !== chunk) continue;
          requirements.add(RuntimeGlobals.moduleCache);
          requirements.add(RuntimeGlobals.interceptModuleExecution);
          requirements.add(RuntimeGlobals.getFullHash);
          requirements.add(RuntimeGlobals.publicPath);

          class DualThreadHMRRuntimeModule extends RuntimeModule {
            constructor() {
              super(name, RuntimeModule.STAGE_ATTACH);
            }

            override generate(): string {
              const dependency = compilation.entries.get(pair.mainThread)!
                .dependencies[0]!;
              const module = compilation.moduleGraph.getModule(dependency)!;
              return [
                Template.getFunctionContent(loadRuntime),
                Template.getFunctionContent(
                  isMain ? mainThreadRuntime : backgroundRuntime,
                ),
              ].join('\n')
                .replaceAll('$BACKGROUND$', JSON.stringify(!isMain))
                .replaceAll(
                  '$RuntimeGlobals_lynxHMR$',
                  LynxRuntimeGlobals.lynxHMR,
                )
                .replaceAll(
                  '$RuntimeGlobals_lynxHMRLoad$',
                  LynxRuntimeGlobals.lynxHMRLoad,
                )
                .replaceAll(
                  '$ENTRY_MODULES$',
                  JSON.stringify(
                    acceptEntryModules
                      ? [
                        ...new Set(compilation.entries.get(pair.mainThread)!
                          .dependencies.map(dependency =>
                            compilation.chunkGraph.getModuleId(
                              compilation.moduleGraph.getModule(dependency)!,
                            )
                          )),
                      ]
                      : [],
                  ),
                )
                .replaceAll(
                  '$METHOD$',
                  JSON.stringify(`__lynxHMR_${pair.mainThread}`),
                )
                .replaceAll(
                  '$EVENT$',
                  JSON.stringify(`LynxHMR:${pair.background}`),
                )
                .replaceAll(
                  '$HOT_MODULE$',
                  JSON.stringify(compilation.chunkGraph.getModuleId(module)),
                );
            }
          }
          compilation.addRuntimeModule(chunk, new DualThreadHMRRuntimeModule());
        }
      },
    );

    compilation.hooks.processAssets.tap({
      name,
      stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
    }, () => {
      const { chunkGraph, moduleGraph } = compilation;
      for (const pair of entryPairs) {
        const main = compilation.entrypoints.get(pair.mainThread)!;
        const background = compilation.entrypoints.get(pair.background)!;
        const mainChunk = main.getRuntimeChunk()!;
        const backgroundChunk = background.getRuntimeChunk()!;
        const mainModules = new Set(
          [...mainChunk.getAllReferencedChunks()].flatMap(
            chunk => [...chunkGraph.getChunkModulesIterable(chunk)],
          ),
        );
        const backgroundModules = new Map<string, Module>();
        for (const chunk of backgroundChunk.getAllReferencedChunks()) {
          for (const module of chunkGraph.getChunkModulesIterable(chunk)) {
            const resource = (module as ResourceModule).resource;
            if (resource && module.layer === LAYERS.BACKGROUND) {
              backgroundModules.set(resource, module);
            }
          }
        }

        const changed: Module[] = [];
        for (const module of mainModules) {
          if (module.layer !== LAYERS.MAIN_THREAD) continue;
          const key = `${pair.mainThread}:${module.identifier()}`;
          const hash = chunkGraph.getModuleHash(
            module,
            new Set(mainChunk.runtime),
          );
          currentModules.set(key, hash);
          if (previousHash && previousModules.get(key) !== hash) {
            changed.push(module);
          }
        }

        // Follow actual MTS dependencies to their worklet-owning BTS modules.
        // Replaying their existing factories preserves Fast Refresh's own
        // acceptance boundary; invalidating a self-accepted owner would not.
        const owners = new Set<string | number>();
        const visited = new Set<Module>();
        while (changed.length > 0) {
          const module = changed.pop()!;
          if (visited.has(module)) continue;
          visited.add(module);
          const resource = (module as ResourceModule).resource;
          const owner = resource ? backgroundModules.get(resource) : undefined;
          const defines: unknown = owner?.buildInfo
            ?.[DEFINES_FOR_WORKLET_BUILD_INFO];
          if (owner && Array.isArray(defines) && defines.length > 0) {
            owners.add(chunkGraph.getModuleId(owner)!);
          }
          for (const connection of moduleGraph.getIncomingConnections(module)) {
            if (
              connection.originModule
              && mainModules.has(connection.originModule)
            ) {
              changed.push(connection.originModule);
            }
          }
        }

        if (!previousHash) continue;
        const manifestAsset = compilation.getAsset(
          getFilename(mainChunk, true),
        );
        if (!manifestAsset) continue;
        const manifest = JSON.parse(
          manifestAsset.source.source().toString(),
        ) as { c: (string | number)[] };
        for (const id of manifest.c) {
          const target = [...compilation.chunks].find(chunk =>
            chunk.id === id
          )!;
          const file = getFilename(target, false);
          const asset = compilation.getAsset(file)!;
          compilation.updateAsset(file, asset.source, {
            ...asset.info,
            'lynx:main-thread': true,
          });
        }
        if (owners.size > 0) {
          const file = getFilename(backgroundChunk, false);
          const asset = compilation.getAsset(file)!;
          compilation.updateAsset(
            file,
            new sources.ConcatSource(
              asset.source,
              `\nexports.lynxRefreshModules=${JSON.stringify([...owners])};`,
            ),
          );
        }
      }
    });

    const emitted = new Set<string>();
    const hooks = templatePlugin.getLynxTemplatePluginHooks(compilation);
    hooks.beforeEmit.tapPromise(name, async args => {
      if (!previousHash) return args;
      for (const pair of entryPairs) {
        if (!args.chunkGroups.some(group => group.name === pair.mainThread)) {
          continue;
        }
        for (const entry of [pair.mainThread, pair.background]) {
          const isMain = entry === pair.mainThread;
          const chunk = compilation.entrypoints.get(entry)!.getRuntimeChunk()!;
          const filename = getFilename(chunk, true);
          const manifest = compilation.getAsset(filename);
          if (!manifest || emitted.has(filename)) continue;
          emitted.add(filename);
          const manifestSource = manifest.source.source().toString();
          const sections: Record<string, { content: string }> = {
            // BTS loadScript must initialize the same app scope as normal JS
            // chunks. This wrapper also detects hosts predating that support.
            manifest: {
              content: isMain
                ? `(${manifestSource})`
                : `({init:function(){return (${manifestSource});}})`,
            },
          };
          const { c: ids } = JSON.parse(manifestSource) as {
            c: (string | number)[];
          };
          for (const id of ids) {
            const target = [...compilation.chunks].find(chunk =>
              chunk.id === id
            )!;
            const file = getFilename(target, false);
            const source = compilation.getAsset(file)!.source.source()
              .toString();
            // BTS assets already carry the runtime wrapper and its host scope.
            // MTS chunks expose CommonJS exports without that SDK wrapper.
            sections[file] = {
              content: isMain
                ? `(function(){var exports={};${source}\nreturn exports;})()`
                : source,
            };
          }
          const encodeOptions = {
            ...args.finalEncodeOptions,
            sourceContent: {
              ...(args.finalEncodeOptions['sourceContent'] as Record<
                string,
                unknown
              >),
              appType: 'DynamicComponent',
            },
            lepusCode: undefined,
            manifest: {},
            customSections: sections,
          };
          const { buffer } = await hooks.encode.promise({ encodeOptions });
          compilation.emitAsset(
            filename.replace(/\.json$/, '.bundle'),
            new sources.RawSource(buffer),
          );
        }
      }
      return args;
    });

    compilation.hooks.afterSeal.tap(name, () => {
      // Rspack advances its HMR records even when the build has diagnostics.
      previousHash = compilation.hash ?? undefined;
      previousModules = currentModules;
    });
  });
}
