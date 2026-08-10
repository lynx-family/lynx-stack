// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const DEFINES_FOR_MAIN_THREAD_BUILD_INFO = 'lynx:defines-for-main-thread';

export interface MainThreadDefine {
  kind: 'snapshot' | 'worklet';
  id: string;
  code: string;
}

interface ModuleWithDefinesForMainThread {
  identifier?: (() => string) | undefined;
  buildInfo?: Record<string, unknown> | undefined;
  modules?: Iterable<ModuleWithDefinesForMainThread> | undefined;
}

function collectFromModule(
  module: ModuleWithDefinesForMainThread,
  defines: MainThreadDefine[],
): void {
  const collected = module.buildInfo?.[DEFINES_FOR_MAIN_THREAD_BUILD_INFO];
  if (Array.isArray(collected)) {
    defines.push(...collected as MainThreadDefine[]);
  }

  if (module.modules) {
    for (const nestedModule of module.modules) {
      collectFromModule(nestedModule, defines);
    }
  }
}

export function collectDefinesForMainThread<TModule>(
  modules: Iterable<TModule>,
  getModuleIdentifier: (module: TModule) => string,
): MainThreadDefine[] {
  const collected: MainThreadDefine[] = [];
  const visitedModules = new Set<string>();

  for (const module of modules) {
    const identifier = getModuleIdentifier(module);
    if (visitedModules.has(identifier)) {
      continue;
    }
    visitedModules.add(identifier);
    collectFromModule(module as ModuleWithDefinesForMainThread, collected);
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

export function selectMissingDefinesForMainThread(
  definesFromBackground: readonly MainThreadDefine[],
  definesFromMainThread: readonly MainThreadDefine[],
): MainThreadDefine[] {
  const defined = new Set(
    definesFromMainThread.map(({ kind, id }) => `${kind}:${id}`),
  );
  return definesFromBackground.filter(({ kind, id }) =>
    !defined.has(`${kind}:${id}`)
  );
}

export function renderDefinesForMainThread(
  defines: readonly MainThreadDefine[],
): string {
  return defines
    .map(({ kind, id, code }) => `// ${kind} ${id}\n{\n${code}\n}`)
    .join('\n');
}

export function renderDefinesForMainThreadModule(
  defines: readonly MainThreadDefine[],
): string {
  const prelude = [`import * as ReactLynx from '@lynx-js/react/internal';`];
  if (defines.some(({ code }) => /\bloadWorkletRuntime\b/.test(code))) {
    prelude.push(`var loadWorkletRuntime = ReactLynx.loadWorkletRuntime;`);
  }
  if (defines.some(({ code }) => /\brequire\(/.test(code))) {
    prelude.push(`var require = function () { return ReactLynx; };`);
  }
  return `${prelude.join('\n')}
${renderDefinesForMainThread(defines)}
`;
}
