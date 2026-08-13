// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createHash } from 'node:crypto';
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

export interface EntryPair {
  mainThread: string;
  background: string;
}

const MAIN_THREAD_OBJECT_DEFINITION_REQUEST =
  '@lynx-js/react/internal/main-thread-object-definition';

interface MainThreadObjectMarker {
  type: string;
  create: string;
  dispose?: string;
}

function decodeHex(value: string): string {
  if (!/^(?:[0-9a-f]{2})*$/i.test(value)) {
    throw new Error(`Invalid MainThreadObject definition marker: ${value}`);
  }
  return Buffer.from(value, 'hex').toString('utf8');
}

export function parseMainThreadObjectMarker(
  request: string | undefined,
): MainThreadObjectMarker | undefined {
  if (!request?.startsWith(`${MAIN_THREAD_OBJECT_DEFINITION_REQUEST}?`)) {
    return undefined;
  }
  const query = new URLSearchParams(
    request.slice(MAIN_THREAD_OBJECT_DEFINITION_REQUEST.length + 1),
  );
  const type = query.get('type');
  const create = query.get('create');
  const dispose = query.get('dispose');
  if (type === null || create === null || dispose === null) {
    throw new Error(`Invalid MainThreadObject definition marker: ${request}`);
  }
  return {
    type: decodeHex(type),
    create: decodeHex(create),
    ...(dispose === '' ? {} : { dispose: decodeHex(dispose) }),
  };
}

function markerIdentity(marker: MainThreadObjectMarker): string {
  return `${marker.type}\0${marker.create}\0${marker.dispose ?? ''}`;
}

function markerStateKey(
  moduleIdentifier: string,
  runtime: string,
  request: string,
): string {
  return `${moduleIdentifier}\0${runtime}\0${request}`;
}

function setsEqual(left: Set<string>, right: Set<string>): boolean {
  return left.size === right.size && [...left].every(value => right.has(value));
}

export function applyDefinesInjection(
  compiler: Compiler,
  entryPairs: EntryPair[],
  pluginName: string,
): void {
  const { EntryPlugin, experiments } = compiler.webpack;
  const virtualModules = new experiments.VirtualModulesPlugin({});
  virtualModules.apply(compiler);
  let inactiveMainThreadObjectMarkers = new Set<string>();

  compiler.hooks.thisCompilation.tap(pluginName, compilation => {
    let mainThreadObjectLivenessChanged = false;
    compilation.hooks.afterOptimizeModules.tap(pluginName, modules => {
      const nextInactiveMarkers = new Set<string>();
      for (const module of modules) {
        for (
          const connection of compilation.moduleGraph.getOutgoingConnections(
            module,
          )
        ) {
          const dependency = connection.dependency as
            | { request?: string; type?: string; ids?: string[] }
            | undefined;
          const marker = parseMainThreadObjectMarker(dependency?.request);
          if (
            !marker || dependency?.type !== 'esm import specifier'
            || !dependency.ids?.includes('mainThreadObjectDefinition')
          ) {
            continue;
          }
          for (const { background, mainThread } of entryPairs) {
            for (const runtime of [background, mainThread]) {
              if (connection.getActiveState(runtime) !== false) {
                continue;
              }
              nextInactiveMarkers.add(
                markerStateKey(
                  module.identifier(),
                  runtime,
                  dependency.request!,
                ),
              );
            }
          }
        }
      }
      mainThreadObjectLivenessChanged = !setsEqual(
        inactiveMainThreadObjectMarkers,
        nextInactiveMarkers,
      );
      inactiveMainThreadObjectMarkers = nextInactiveMarkers;
    });
    compilation.hooks.needAdditionalPass.tap(
      pluginName,
      () => mainThreadObjectLivenessChanged,
    );
  });

  compiler.hooks.finishMake.tapPromise(
    pluginName,
    async (compilation) => {
      const { moduleGraph } = compilation;
      type Module = NonNullable<ReturnType<typeof moduleGraph.getModule>>;
      type ModuleWithMeta = Module & {
        resource?: string;
        layer?: string | null;
      };
      definesImportByBoundary.clear();

      const traverse = (roots: Module[], runtime: string) => {
        const visited = new Set<Module>();
        const asyncBoundaries = new Map<string, Module>();
        const mainThreadObjectMarkers = new Map<
          string,
          { marker: MainThreadObjectMarker; active: boolean }
        >();
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
            const marker = parseMainThreadObjectMarker(
              (connection.dependency as { request?: string } | undefined)
                ?.request,
            );
            if (marker) {
              const dependency = connection.dependency as
                | { request?: string; type?: string; ids?: string[] }
                | undefined;
              const identity = markerIdentity(marker);
              if (
                dependency?.type === 'esm import specifier'
                && dependency.request !== undefined
                && dependency.ids?.includes('mainThreadObjectDefinition')
              ) {
                const active = !inactiveMainThreadObjectMarkers.has(
                  markerStateKey(
                    module.identifier(),
                    runtime,
                    dependency.request,
                  ),
                );
                const previous = mainThreadObjectMarkers.get(identity);
                mainThreadObjectMarkers.set(identity, {
                  marker,
                  active: active || previous?.active === true,
                });
              }
            }
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
          mainThreadObjectMarkers,
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
        inheritedPresent: {
          snapshot: string[];
          worklet: string[];
          mainThreadObject: string[];
        },
        runtimes: { background: string; mainThread: string },
        request: string,
        inject: (request: string) => Promise<void>,
      ): Promise<void> => {
        const background = traverse(backgroundRoots, runtimes.background);
        const mainThread = traverse(mainThreadRoots, runtimes.mainThread);
        const mainThreadObjectMarkers = new Map(
          background.mainThreadObjectMarkers,
        );
        for (
          const [identity, value] of mainThread.mainThreadObjectMarkers
        ) {
          const previous = mainThreadObjectMarkers.get(identity);
          mainThreadObjectMarkers.set(identity, {
            marker: value.marker,
            active: value.active || previous?.active === true,
          });
        }
        const mainThreadObjectWorkletIds = new Set<string>();
        for (const { marker } of mainThreadObjectMarkers.values()) {
          mainThreadObjectWorkletIds.add(marker.create);
          if (marker.dispose) {
            mainThreadObjectWorkletIds.add(marker.dispose);
          }
        }
        const present = {
          snapshot: [
            ...inheritedPresent.snapshot,
            ...mainThread.defines.snapshot.map(({ id }) => id),
          ],
          worklet: [
            ...inheritedPresent.worklet,
            ...mainThread.defines.worklet
              .map(({ id }) => id)
              .filter(id => !mainThreadObjectWorkletIds.has(id)),
          ],
          mainThreadObject: [...inheritedPresent.mainThreadObject],
        };
        const activeMainThreadObjects = [...mainThreadObjectMarkers.values()]
          .filter(({ active, marker }) =>
            active && !present.mainThreadObject.includes(markerIdentity(marker))
          )
          .map(({ marker }) => marker);
        present.mainThreadObject.push(
          ...activeMainThreadObjects.map(marker => markerIdentity(marker)),
        );
        const missingSnapshot = selectMissingDefines(
          background.defines.snapshot,
          present.snapshot.map((id) => ({ id, code: '' })),
        );
        const missingWorklet = selectMissingDefines(
          background.defines.worklet,
          present.worklet.map((id) => ({ id, code: '' })),
        ).filter(({ id }) => !mainThreadObjectWorkletIds.has(id));
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
        const workletDefinitions = new Map([
          ...mainThread.defines.worklet.map(define =>
            [define.id, define] as const
          ),
          ...background.defines.worklet.map(define =>
            [define.id, define] as const
          ),
        ]);
        const registrationImports: string[] = [];
        for (const marker of activeMainThreadObjects) {
          for (const id of [marker.create, marker.dispose]) {
            if (id === undefined || present.worklet.includes(id)) {
              continue;
            }
            const definition = workletDefinitions.get(id);
            if (!definition) {
              throw new Error(
                `MainThreadObject type ${
                  JSON.stringify(marker.type)
                } references missing lifecycle definition ${
                  JSON.stringify(id)
                }. Rebuild the library with a compatible ReactLynx compiler.`,
              );
            }
            if (!definition.resource) {
              throw new Error(
                `MainThreadObject lifecycle definition ${
                  JSON.stringify(id)
                } has no owning module path. Rebuild the library with a compatible ReactLynx webpack plugin.`,
              );
            }
            const digest = createHash('sha1').update(id).digest('hex').slice(
              0,
              12,
            );
            const lifecycleRequest =
              `${definition.resource}.__lynx-main-thread-object-${digest}.js`;
            virtualModules.writeModule(lifecycleRequest, definition.code);
            registrationImports.push(
              `import ${JSON.stringify(lifecycleRequest)};`,
            );
            present.worklet.push(id);
          }
        }

        if (
          missingSnapshot.length > 0 || missingWorklet.length > 0
          || activeMainThreadObjects.length > 0
        ) {
          const registrations = activeMainThreadObjects.map(marker =>
            `ReactLynx.registerMainThreadObjectDefinition({ type: ${
              JSON.stringify(marker.type)
            }, create: { _wkltId: ${
              JSON.stringify(marker.create)
            } }, dispose: ${
              marker.dispose
                ? `{ _wkltId: ${JSON.stringify(marker.dispose)} }`
                : 'undefined'
            } });`
          );
          virtualModules.writeModule(
            request,
            `${registrationImports.join('\n')}
${renderDefinesModule(missingSnapshot, missingWorklet)}
${registrations.join('\n')}
`,
          );
          await inject(request);
        }
        for (
          const [resource, backgroundBoundary] of background.asyncBoundaries
        ) {
          const mainThreadBoundary = mainThread.asyncBoundaries.get(
            resource,
          );
          if (!mainThreadBoundary) {
            continue;
          }
          await processScope(
            [backgroundBoundary],
            [mainThreadBoundary],
            present,
            runtimes,
            `${resource}.__lynx-react-defines.js`,
            async (boundaryRequest) => {
              definesImportByBoundary.set(
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
            { snapshot: [], worklet: [], mainThreadObject: [] },
            { background, mainThread },
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
    },
  );
}
