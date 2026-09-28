// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as path from 'node:path';

import type { Compiler } from '@rspack/core';

import {
  DEFINES_FOR_SNAPSHOT_BUILD_INFO,
  DEFINES_FOR_WORKLET_BUILD_INFO,
  collectDefines,
  renderDefinesModule,
  selectMissingDefines,
} from './Defines.js';
import { LAYERS } from './layer.js';
import {
  boundaryKey,
  definesImportByBoundary,
} from './loaders/defines-import-by-boundary.js';
import { REACT_RUNTIME_REQUIREMENTS_BUILD_INFO } from './loaders/main-thread.js';

export interface EntryPair {
  mainThread: string;
  background: string;
}

export function applyDefinesInjection(
  compiler: Compiler,
  entryPairs: EntryPair[],
  pluginName: string,
): void {
  const { EntryPlugin, experiments } = compiler.webpack;
  const virtualModules = new experiments.VirtualModulesPlugin({});
  virtualModules.apply(compiler);

  compiler.hooks.finishMake.tapPromise(
    pluginName,
    async (compilation) => {
      const { moduleGraph } = compilation;
      type Module = NonNullable<ReturnType<typeof moduleGraph.getModule>>;
      type ModuleWithMeta = Module & {
        resource?: string;
        layer?: string | null;
      };
      const definesImports = definesImportByBoundary(compiler);
      const previousDefinesImports = new Map(definesImports);
      definesImports.clear();
      const requirementsByRequest = new Map<
        string,
        { mainThreadProgrammability: boolean }
      >();
      compilation.hooks.finishModules.tap(pluginName, modules => {
        // Rebuilding an async boundary does not finish its new dependencies.
        // Transfer compiler metadata only after all injected modules are built.
        for (const module of modules) {
          const resource = (module as ModuleWithMeta).resource;
          const requirements = resource && requirementsByRequest.get(resource);
          if (requirements) {
            module.buildInfo![REACT_RUNTIME_REQUIREMENTS_BUILD_INFO] =
              requirements;
          }
        }
      });

      const traverse = (roots: Module[]) => {
        const visited = new Set<Module>();
        const asyncBoundaries = new Map<string, Module>();
        const queue = [...roots];
        while (queue.length > 0) {
          const module = queue.pop()!;
          if (visited.has(module)) {
            continue;
          }
          visited.add(module);
          for (
            const connection of moduleGraph.getOutgoingConnections(module)
          ) {
            const next = connection.module;
            if (!next) {
              continue;
            }
            if (connection.dependency?.type?.startsWith('import()')) {
              const resource = (next as ModuleWithMeta).resource;
              if (resource) {
                asyncBoundaries.set(resource, next);
              }
              continue;
            }
            if (!visited.has(next)) {
              queue.push(next);
            }
          }
        }
        return {
          defines: {
            snapshot: collectDefines(
              visited,
              DEFINES_FOR_SNAPSHOT_BUILD_INFO,
              (module) => module.identifier(),
            ),
            worklet: collectDefines(
              visited,
              DEFINES_FOR_WORKLET_BUILD_INFO,
              (module) => module.identifier(),
            ),
          },
          asyncBoundaries,
        };
      };

      const rebuildModule = (module: Module) =>
        new Promise<void>((resolve, reject) => {
          compilation.rebuildModule(
            module,
            (err) => err ? reject(err) : resolve(),
          );
        });

      const entryRoots = (entryName: string) => {
        const entry = compilation.entries.get(entryName);
        if (!entry) {
          throw new Error(
            `No entry named ${
              JSON.stringify(entryName)
            } to collect the definitions from.`,
          );
        }
        return [...entry.dependencies, ...entry.includeDependencies]
          .flatMap((dependency) => {
            const module = moduleGraph.getModule(dependency);
            return module ? [module] : [];
          });
      };

      const processScope = async (
        backgroundRoots: Module[],
        mainThreadRoots: Module[],
        inheritedPresent: { snapshot: string[]; worklet: string[] },
        ancestors: ReadonlySet<string>,
        request: string,
        inject: (request: string) => Promise<void>,
      ): Promise<void> => {
        const background = traverse(backgroundRoots);
        const mainThread = traverse(mainThreadRoots);
        const present = {
          snapshot: [
            ...inheritedPresent.snapshot,
            ...mainThread.defines.snapshot.map(({ id }) => id),
          ],
          worklet: [
            ...inheritedPresent.worklet,
            ...mainThread.defines.worklet.map(({ id }) => id),
          ],
        };
        const missingSnapshot = selectMissingDefines(
          background.defines.snapshot,
          present.snapshot.map((id) => ({ id, code: '' })),
        );
        const missingWorklet = selectMissingDefines(
          background.defines.worklet,
          present.worklet.map((id) => ({ id, code: '' })),
        );
        const unmergeable = missingWorklet.filter(
          (define) => define.unmergeable,
        );
        if (unmergeable.length > 0) {
          throw new Error(
            `The main thread lacks the worklet definition(s) ${
              unmergeable.map(({ id }) => id).join(', ')
            } and they cannot be merged: they close over shared-runtime imports. Make the owning module reachable from the main thread, or avoid closing over a shared import inside the worklet.`,
          );
        }
        if (missingSnapshot.length > 0 || missingWorklet.length > 0) {
          virtualModules.writeModule(
            request,
            renderDefinesModule(missingSnapshot, missingWorklet),
          );
          await inject(request);
          const requirements = missingWorklet.flatMap(define =>
            define.runtimeRequirements ? [define.runtimeRequirements] : []
          );
          if (requirements.length > 0) {
            requirementsByRequest.set(request, {
              mainThreadProgrammability: requirements.some(
                requirement => requirement.mainThreadProgrammability,
              ),
            });
          }
        }
        for (
          const [resource, backgroundBoundary] of background.asyncBoundaries
        ) {
          const mainThreadBoundary = mainThread.asyncBoundaries.get(
            resource,
          );
          if (!mainThreadBoundary || ancestors.has(resource)) {
            continue;
          }
          await processScope(
            [backgroundBoundary],
            [mainThreadBoundary],
            present,
            new Set([...ancestors, resource]),
            `${resource}.__lynx-react-defines.js`,
            async (boundaryRequest) => {
              definesImports.set(
                boundaryKey(
                  (mainThreadBoundary as ModuleWithMeta).layer,
                  resource,
                ),
                boundaryRequest,
              );
              await rebuildModule(mainThreadBoundary);
            },
          );
        }
      };

      await Promise.all(
        entryPairs.map(async ({ mainThread, background }) => {
          await processScope(
            entryRoots(background),
            entryRoots(mainThread),
            { snapshot: [], worklet: [] },
            new Set(),
            path.join(
              compiler.context,
              `__lynx-react-defines.${mainThread}.js`,
            ),
            async (request) => {
              const addEntry = (entryRequest: string) =>
                new Promise<void>((resolve, reject) => {
                  compilation.addEntry(
                    compiler.context,
                    EntryPlugin.createDependency(entryRequest),
                    { name: mainThread, layer: LAYERS.MAIN_THREAD },
                    (err) => err ? reject(err) : resolve(),
                  );
                });
              const originalRequests = compilation.entries.get(mainThread)!
                .dependencies.flatMap((dependency) =>
                  typeof dependency.request === 'string'
                    ? [dependency.request]
                    : []
                );
              await addEntry(request);
              for (const originalRequest of originalRequests) {
                await addEntry(originalRequest);
              }
            },
          );
        }),
      );
      // A background boundary can lose its last definition or disappear
      // entirely while its main-thread module remains cached and reachable.
      // Rebuild every former owner that no longer needs a synthetic import.
      await Promise.all([...compilation.modules].flatMap(module => {
        const { resource, layer } = module as ModuleWithMeta;
        if (!resource) {
          return [];
        }
        const key = boundaryKey(layer, resource);
        return previousDefinesImports.has(key) && !definesImports.has(key)
          ? [rebuildModule(module)]
          : [];
      }));
    },
  );
}
