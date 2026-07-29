// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Chunk, Compilation, RuntimeModule } from '@rspack/core';

/**
 * The `buildInfo` key the background loader stores its collected definitions
 * under.
 */
export const MAIN_THREAD_DEFINES_BUILD_INFO = 'lynx:main-thread-defines';

/**
 * A definition the main thread needs, as collected by
 * `@lynx-js/react/transform` while the background compiled the module.
 */
export interface MainThreadDefine {
  kind: 'snapshot' | 'worklet';
  id: string;
  code: string;
}

/**
 * The runtime members the main-thread entry hands to the assembled definitions.
 * A definition calling anything else would reference an export that has been
 * tree-shaken away, so the assembly fails the build instead.
 */
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

// The namespace name the transform binds the runtime to.
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

  // Concatenated modules keep the original modules (and their `buildInfo`) as
  // children.
  if (module.modules) {
    for (const nestedModule of module.modules) {
      collectFromModule(nestedModule, defines);
    }
  }
}

/**
 * Collect the definitions of every module in `chunks`. Async chunks are not
 * included: a lazy bundle registers its own definitions, under its own entry
 * name, when the host evaluates its main-thread section.
 *
 * @internal
 */
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

  // Definitions are identified by their content hash, so the same one reached
  // through several modules is registered once. Two definitions sharing an id
  // but not their code would mean the id no longer identifies the content, and
  // dropping either of them would silently change what the main thread runs.
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

/**
 * Where a card that can host a lazy bundle publishes its runtime members for
 * the lazy bundle's section to read, mirroring how
 * `@lynx-js/react/experimental/lazy/import` hands the host's exports to a lazy
 * bundle.
 *
 * A symbol on `globalThis`, not a property on the bundler's require function:
 * the main-thread entry ships in `@lynx-js/react`, so the channel has to be one
 * a non-webpack pipeline can also provide.
 */
const RUNTIME_HANDLE =
  `globalThis[Symbol.for('__REACT_LYNX_MAIN_THREAD_DEFINES_RUNTIME__')]`;

/**
 * Wrap the collected definitions into the function the main-thread entry calls.
 * Each module keeps its own block scope: definitions are printed per module and
 * declare same-named locals (e.g. the `__workletRuntimeLoaded` guard).
 *
 * @internal
 */
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

  // Each definition declares its own locals (a snapshot id, a worklet runtime
  // guard), so it gets its own block scope.
  const body = defines
    .map(({ kind, id, code }) => `// ${kind} ${id}\n{\n${code}\n}`)
    .join('\n');

  return `var __lynxMainThreadDefines = function (ReactLynx, loadWorkletRuntime, require) {
  ${RUNTIME_HANDLE} = ReactLynx;
${body}
};
`;
}

/**
 * Assemble a lazy bundle's main-thread section: a chunk that the host card
 * installs into its own main-thread runtime, so the definitions run with the
 * lazy bundle's `globDynamicComponentEntry` (its CSS scope) and reuse the
 * host's ReactLynx runtime instance.
 *
 * @internal
 */
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
  }        __lynxMainThreadDefines(runtime, runtime.loadWorkletRuntime, function () {
          return runtime;
        });
      }
    }
  };
})
`;
}

type MainThreadDefinesRuntimeModule = new(
  backgroundEntry: string,
) => RuntimeModule;

/**
 * Registers the background's collected snapshot and worklet definitions in the
 * main-thread bundle. Emitted into the bundle runtime (not isolated, so the
 * main-thread entry can call it) after the module graph is sealed, which is the
 * earliest point where every module's definitions are known.
 *
 * @internal
 */
export function createMainThreadDefinesRuntimeModule(
  webpack: typeof import('@rspack/core').rspack,
): MainThreadDefinesRuntimeModule {
  return class MainThreadDefinesRuntimeModule extends webpack.RuntimeModule {
    constructor(private readonly backgroundEntry: string) {
      super(
        'lynx main thread defines',
        webpack.RuntimeModule.STAGE_NORMAL,
      );
      // The generated code comes from the background's modules, which this
      // chunk does not depend on, so a rebuild that only touches the background
      // would otherwise keep the previous definitions.
      this.fullHash = true;
    }

    // Not isolated: the main-thread entry calls `__lynxMainThreadDefines`, so it
    // has to be declared in the bundle scope the modules close over.
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
