// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Chunk, Compilation, RuntimeModule } from '@rspack/core';

export const MTS_DEFINES_BUILD_INFO = 'lynx:mts-defines';

/**
 * The `kind:id` keys a main-thread module already carries as real code.
 *
 * A `<Background>` fallback is compiled for the main thread, so its module
 * lands in both graphs: the background collects its definitions like any
 * other module's, and the main thread emits them itself. Assembling both
 * would describe the same definition twice — once per island — so the
 * assembly subtracts what the main-thread bundle already owns.
 */
export const MTS_DEFINES_OWNED_BUILD_INFO = 'lynx:mts-defines-owned';

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

/**
 * The `kind:id` keys the given modules already carry as real main-thread code.
 */
export function collectOwnedMTSDefineKeys<TChunk, TModule>(
  chunks: Iterable<TChunk>,
  getChunkModules: (chunk: TChunk) => Iterable<TModule>,
): Set<string> {
  const owned = new Set<string>();

  const walk = (module: ModuleWithMTSDefines): void => {
    const keys = module.buildInfo?.[MTS_DEFINES_OWNED_BUILD_INFO];
    if (Array.isArray(keys)) {
      for (const key of keys as string[]) {
        owned.add(key);
      }
    }
    if (module.modules) {
      for (const nested of module.modules) {
        walk(nested);
      }
    }
  };

  for (const chunk of chunks) {
    for (const module of getChunkModules(chunk)) {
      walk(module as ModuleWithMTSDefines);
    }
  }

  return owned;
}

export function collectMTSDefines<TChunk, TModule>(
  chunks: Iterable<TChunk>,
  getChunkModules: (chunk: TChunk) => Iterable<TModule>,
  getModuleIdentifier: (module: TModule) => string,
  owned?: ReadonlySet<string>,
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
    if (owned?.has(key)) {
      // Already in the main-thread bundle as real code — an island's own
      // definition. Describing it again would only grow the assembly.
      continue;
    }
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
) => RuntimeModule;

export function createMTSDefinesRuntimeModule(
  webpack: typeof import('@rspack/core').rspack,
): MTSDefinesRuntimeModule {
  return class MTSDefinesRuntimeModule extends webpack.RuntimeModule {
    constructor(private readonly backgroundEntry: string) {
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
      const getModules = (chunk: Chunk) => chunkGraph.getChunkModules(chunk);

      // What this main-thread chunk already carries as real code — the
      // fallbacks it compiles — so the assembly describes only the deferred
      // subtrees it does not.
      const owned = this.chunk
        ? collectOwnedMTSDefineKeys([this.chunk as Chunk], getModules)
        : new Set<string>();

      return renderMTSDefines(
        collectMTSDefines(
          entrypoint.chunks,
          getModules,
          (module) => module.identifier(),
          owned,
        ),
      );
    }
  };
}
