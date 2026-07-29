// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Chunk, Compilation, RuntimeModule } from '@rspack/core';

export const MAIN_THREAD_DEFINES_BUILD_INFO = 'lynx:main-thread-defines';

export interface MainThreadDefine {
  kind: 'snapshot' | 'worklet';
  id: string;
  code: string;
}

const PROVIDED_RUNTIME_MEMBERS: ReadonlySet<string> = new Set([
  '__pageId',
  'createSnapshot',
  'snapshotCreatorMap',
  'snapshotCreateList',
  'updateSpread',
  'updateEvent',
  'updateRef',
  'updateWorkletEvent',
  'updateWorkletRef',
  'updateGesture',
  'updateListItemPlatformInfo',
  '__DynamicPartSlot',
  '__DynamicPartSlotV2',
  '__DynamicPartSlotV2_0',
  '__DynamicPartListSlotV2',
  '__DynamicPartChildren',
  '__DynamicPartChildren_0',
  '__DynamicPartListChildren',
]);

const RUNTIME_MEMBER_RE = /\bReactLynx\.([$A-Z_a-z][\w$]*)/g;

interface ModuleWithMainThreadDefines {
  identifier?: (() => string) | undefined;
  buildInfo?: Record<string, unknown> | undefined;
  modules?: Iterable<ModuleWithMainThreadDefines> | undefined;
}

function collectFromModule(
  module: ModuleWithMainThreadDefines,
  defines: MainThreadDefine[],
): void {
  const collected = module.buildInfo?.[MAIN_THREAD_DEFINES_BUILD_INFO];
  if (Array.isArray(collected)) {
    defines.push(...collected as MainThreadDefine[]);
  }

  if (module.modules) {
    for (const nestedModule of module.modules) {
      collectFromModule(nestedModule, defines);
    }
  }
}

export function collectMainThreadDefines<TChunk, TModule>(
  chunks: Iterable<TChunk>,
  getChunkModules: (chunk: TChunk) => Iterable<TModule>,
  getModuleIdentifier: (module: TModule) => string,
): MainThreadDefine[] {
  const collected: MainThreadDefine[] = [];
  const visitedModules = new Set<string>();

  for (const chunk of chunks) {
    for (const module of getChunkModules(chunk)) {
      const identifier = getModuleIdentifier(module);
      if (visitedModules.has(identifier)) {
        continue;
      }
      visitedModules.add(identifier);
      collectFromModule(module as ModuleWithMainThreadDefines, collected);
    }
  }

  const defines = new Map<string, MainThreadDefine>();
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
  `globalThis[Symbol.for('__REACT_LYNX_MAIN_THREAD_DEFINES_RUNTIME__')]`;

export function renderMainThreadDefines(
  defines: readonly MainThreadDefine[],
): string {
  const missing = new Set<string>();
  for (const { code } of defines) {
    for (const [, member] of code.matchAll(RUNTIME_MEMBER_RE)) {
      if (!PROVIDED_RUNTIME_MEMBERS.has(member!)) {
        missing.add(member!);
      }
    }
  }
  if (missing.size > 0) {
    throw new Error(
      `The collected main-thread definitions use runtime members that the main-thread entry does not provide: ${
        [...missing].sort().join(', ')
      }.`,
    );
  }

  const body = defines
    .map(({ kind, id, code }) => `// ${kind} ${id}\n{\n${code}\n}`)
    .join('\n');

  return `var __lynxMainThreadDefines = function (ReactLynx) {
  ${RUNTIME_HANDLE} = ReactLynx;
  var loadWorkletRuntime = ReactLynx.loadWorkletRuntime;
  var require = function () { return ReactLynx; };
${body}
};
`;
}

export function renderLazyMainThreadDefines(
  defines: readonly MainThreadDefine[],
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
        ${
    renderMainThreadDefines(defines)
  }        __lynxMainThreadDefines(runtime);
      }
    }
  };
})
`;
}

type MainThreadDefinesRuntimeModule = new(
  backgroundEntry: string,
) => RuntimeModule;

export function createMainThreadDefinesRuntimeModule(
  webpack: typeof import('@rspack/core').rspack,
): MainThreadDefinesRuntimeModule {
  return class MainThreadDefinesRuntimeModule extends webpack.RuntimeModule {
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
      const entrypoint = compilation?.entrypoints.get(this.backgroundEntry);
      if (!compilation || !entrypoint) {
        return renderMainThreadDefines([]);
      }

      const { chunkGraph } = compilation;

      return renderMainThreadDefines(
        collectMainThreadDefines(
          entrypoint.chunks,
          (chunk: Chunk) => chunkGraph.getChunkModules(chunk),
          (module) => module.identifier(),
        ),
      );
    }
  };
}
