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

  return [...defines.values()];
}

export function renderMTSDefines(
  defines: readonly MTSDefine[],
): string {
  const body = defines
    .map(({ kind, id, code }) => `// ${kind} ${id}\n{\n${code}\n}`)
    .join('\n');

  return `var __initMTSDefines = function (ReactLynx) {
  var loadWorkletRuntime = ReactLynx.loadWorkletRuntime;
  var require = function () { return ReactLynx; };
${body}
};
`;
}

export function selectMissingMTSDefines(
  backgroundDefines: readonly MTSDefine[],
  mainThreadDefines: readonly MTSDefine[],
): MTSDefine[] {
  const defined = new Set(
    mainThreadDefines.map(({ kind, id }) => `${kind}:${id}`),
  );
  return backgroundDefines.filter(({ kind, id }) =>
    !defined.has(`${kind}:${id}`)
  );
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
        return '';
      }
      const { chunkGraph } = compilation;
      const collect = (entryName: string) => {
        const entrypoint = compilation.entrypoints.get(entryName);
        if (!entrypoint) {
          throw new Error(
            `No entrypoint named ${
              JSON.stringify(entryName)
            } to collect the main-thread definitions from.`,
          );
        }
        return collectMTSDefines(
          entrypoint.chunks,
          (chunk: Chunk) => chunkGraph.getChunkModules(chunk),
          (module) => module.identifier(),
        );
      };

      const missing = selectMissingMTSDefines(
        collect(this.backgroundEntry),
        collect(this.mainThreadEntry),
      );
      if (missing.length === 0) {
        return '';
      }
      return renderMTSDefines(missing);
    }
  };
}
