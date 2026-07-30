// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Chunk, Compilation, RuntimeModule } from '@rspack/core';

export const MTS_DEFINES_BUILD_INFO = 'lynx:mts-defines';
export const MTS_IN_PLACE_DEFINES_BUILD_INFO = 'lynx:mts-in-place-defines';

/**
 * The kind of a main-thread definition. Kept open-ended on the collection
 * side: everything below treats it as an opaque namespace segment of the
 * `kind:id` key, so new definition sources only extend this union.
 */
export type MTSDefineKind = 'snapshot' | 'worklet';

export interface MTSDefine {
  kind: MTSDefineKind;
  id: string;
  code: string;
}

/**
 * The identity of a definition a main-thread module registers in place.
 */
export interface MTSDefineIdentity {
  kind: MTSDefineKind;
  id: string;
}

interface ModuleWithMTSDefines {
  identifier?: (() => string) | undefined;
  buildInfo?: Record<string, unknown> | undefined;
  modules?: Iterable<ModuleWithMTSDefines> | undefined;
}

function collectFromModule(
  module: ModuleWithMTSDefines,
  defines: MTSDefine[],
): void {
  const collected = module.buildInfo?.[MTS_DEFINES_BUILD_INFO];
  if (Array.isArray(collected)) {
    defines.push(...collected as MTSDefine[]);
  }

  if (module.modules) {
    for (const nestedModule of module.modules) {
      collectFromModule(nestedModule, defines);
    }
  }
}

function collectInPlaceFromModule(
  module: ModuleWithMTSDefines,
  identities: Set<string>,
): void {
  const recorded = module.buildInfo?.[MTS_IN_PLACE_DEFINES_BUILD_INFO];
  if (Array.isArray(recorded)) {
    for (const { kind, id } of recorded as MTSDefineIdentity[]) {
      identities.add(`${kind}:${id}`);
    }
  }

  if (module.modules) {
    for (const nestedModule of module.modules) {
      collectInPlaceFromModule(nestedModule, identities);
    }
  }
}

/**
 * The `kind:id` identities of every definition the given chunks register in
 * place — the subtrahend of the assembled section.
 *
 * @internal
 */
export function collectMTSInPlaceDefineIds<TChunk, TModule>(
  chunks: Iterable<TChunk>,
  getChunkModules: (chunk: TChunk) => Iterable<TModule>,
  getModuleIdentifier: (module: TModule) => string,
): Set<string> {
  const identities = new Set<string>();
  const visitedModules = new Set<string>();

  for (const chunk of chunks) {
    for (const module of getChunkModules(chunk)) {
      const identifier = getModuleIdentifier(module);
      if (visitedModules.has(identifier)) {
        continue;
      }
      visitedModules.add(identifier);
      collectInPlaceFromModule(module as ModuleWithMTSDefines, identities);
    }
  }

  return identities;
}

export function collectMTSDefines<TChunk, TModule>(
  chunks: Iterable<TChunk>,
  getChunkModules: (chunk: TChunk) => Iterable<TModule>,
  getModuleIdentifier: (module: TModule) => string,
  omit?: ReadonlySet<string>,
): MTSDefine[] {
  const collected: MTSDefine[] = [];
  const visitedModules = new Set<string>();

  for (const chunk of chunks) {
    for (const module of getChunkModules(chunk)) {
      const identifier = getModuleIdentifier(module);
      if (visitedModules.has(identifier)) {
        continue;
      }
      visitedModules.add(identifier);
      collectFromModule(module as ModuleWithMTSDefines, collected);
    }
  }

  const defines = new Map<string, MTSDefine>();
  for (const define of collected) {
    const key = `${define.kind}:${define.id}`;
    const seen = defines.get(key);
    if (seen === undefined) {
      defines.set(key, define);
      continue;
    }
    if (seen.code !== define.code) {
      throw new Error(
        `Two different main-thread definitions share the id ${define.id}.`,
      );
    }
  }

  // Subtract after the collision check above, so an id that drifts between
  // two collected sources still fails the build even when the main thread
  // also registers it in place.
  if (omit !== undefined) {
    for (const key of omit) {
      defines.delete(key);
    }
  }

  return [...defines.values()];
}

const RUNTIME_HANDLE =
  `globalThis[Symbol.for('__REACT_LYNX_MTS_DEFINES_RUNTIME__')]`;

export function renderMTSDefines(
  defines: readonly MTSDefine[],
): string {
  const body = defines
    .map(({ kind, id, code }) => `// ${kind} ${id}\n{\n${code}\n}`)
    .join('\n');

  return `var __initMTSDefines = function (ReactLynx) {
  ${RUNTIME_HANDLE} = ReactLynx;
  var loadWorkletRuntime = ReactLynx.loadWorkletRuntime;
  var require = function () { return ReactLynx; };
${body}
};
`;
}

export function renderLazyMTSDefines(
  defines: readonly MTSDefine[],
  moduleId: string,
): string {
  return `(function (globDynamicComponentEntry) {
  return {
    ids: [${JSON.stringify(moduleId)}],
    modules: {
      ${
    JSON.stringify(moduleId)
  }: function (module, exports, __webpack_require__) {
        var runtime = ${RUNTIME_HANDLE};
        ${renderMTSDefines(defines)}        __initMTSDefines(runtime);
      }
    }
  };
})
`;
}

type MTSDefinesRuntimeModule = new(
  backgroundEntry: string,
  subtractMainThreadEntry?: string,
) => RuntimeModule;

export function createMTSDefinesRuntimeModule(
  webpack: typeof import('@rspack/core').rspack,
): MTSDefinesRuntimeModule {
  return class MTSDefinesRuntimeModule extends webpack.RuntimeModule {
    /**
     * @param backgroundEntry - the background entrypoint to collect the
     * main-thread definitions from.
     * @param subtractMainThreadEntry - when the main thread still compiles
     * business code (the `'background only'` assembly mode), the main-thread
     * entrypoint whose in-place definitions must be subtracted so nothing
     * registers twice.
     */
    constructor(
      private readonly backgroundEntry: string,
      private readonly subtractMainThreadEntry?: string,
    ) {
      super(
        'lynx main thread defines',
        webpack.RuntimeModule.STAGE_NORMAL,
      );
      this.fullHash = true;
    }

    override shouldIsolate(): boolean {
      return false;
    }

    override generate(): string {
      const compilation = this.compilation as Compilation | null;
      if (!compilation) {
        return renderMTSDefines([]);
      }
      const entrypoint = compilation.entrypoints.get(this.backgroundEntry);
      if (!entrypoint) {
        throw new Error(
          `No entrypoint named ${
            JSON.stringify(this.backgroundEntry)
          } to collect the main-thread definitions from.`,
        );
      }

      const { chunkGraph } = compilation;

      let inPlaceDefineIds: Set<string> | undefined;
      if (this.subtractMainThreadEntry !== undefined) {
        const mainThreadEntrypoint = compilation.entrypoints.get(
          this.subtractMainThreadEntry,
        );
        if (!mainThreadEntrypoint) {
          throw new Error(
            `No entrypoint named ${
              JSON.stringify(this.subtractMainThreadEntry)
            } to subtract the in-place main-thread definitions of.`,
          );
        }
        inPlaceDefineIds = collectMTSInPlaceDefineIds(
          mainThreadEntrypoint.chunks,
          (chunk: Chunk) => chunkGraph.getChunkModules(chunk),
          (module) => module.identifier(),
        );
      }

      return renderMTSDefines(
        collectMTSDefines(
          entrypoint.chunks,
          (chunk: Chunk) => chunkGraph.getChunkModules(chunk),
          (module) => module.identifier(),
          inPlaceDefineIds,
        ),
      );
    }
  };
}
