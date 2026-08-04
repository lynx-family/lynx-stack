// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Chunk, Compilation, RuntimeModule } from '@rspack/core';

export const MTS_DEFINES_BUILD_INFO = 'lynx:mts-defines';

export interface MTSDefine {
  kind: 'snapshot' | 'worklet';
  id: string;
  code: string;
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

export function collectMTSDefines<TChunk, TModule>(
  chunks: Iterable<TChunk>,
  getChunkModules: (chunk: TChunk) => Iterable<TModule>,
  getModuleIdentifier: (module: TModule) => string,
  /**
   * The modules already compiled into the main-thread layer — the island
   * modules the build pulled in, and everything they import.
   *
   * Their definitions are registered by their own module code, so assembling
   * them again would register every snapshot and worklet twice: same ids,
   * same behavior, wasted bytes. Skipping them here is what lets an island
   * coexist with the assembled bundle.
   */
  isCompiledOnMainThread: (module: TModule) => boolean = () => false,
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
      if (isCompiledOnMainThread(module)) {
        continue;
      }
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
  mainThreadEntry: string,
) => RuntimeModule;

export function createMTSDefinesRuntimeModule(
  webpack: typeof import('@rspack/core').rspack,
): MTSDefinesRuntimeModule {
  return class MTSDefinesRuntimeModule extends webpack.RuntimeModule {
    constructor(
      private readonly backgroundEntry: string,
      private readonly mainThreadEntry: string,
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

      // Every resource the main-thread chunk compiles for itself. An island
      // module lands here, and so does everything it imports, so the
      // assembled definitions can leave all of them out.
      const mainThreadResources = new Set<string>();
      for (
        const chunk of compilation.entrypoints.get(this.mainThreadEntry)?.chunks
          ?? []
      ) {
        for (const module of chunkGraph.getChunkModules(chunk)) {
          const resource = (module as { resource?: string }).resource;
          if (typeof resource === 'string') {
            mainThreadResources.add(resource);
          }
        }
      }

      return renderMTSDefines(
        collectMTSDefines(
          entrypoint.chunks,
          (chunk: Chunk) => chunkGraph.getChunkModules(chunk),
          (module) => module.identifier(),
          (module) => {
            const resource = (module as { resource?: string }).resource;
            return typeof resource === 'string'
              && mainThreadResources.has(resource);
          },
        ),
      );
    }
  };
}
