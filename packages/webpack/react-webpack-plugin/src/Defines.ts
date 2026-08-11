// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const DEFINES_FOR_SNAPSHOT_BUILD_INFO = 'lynx:defines-for-snapshot';
export const DEFINES_FOR_WORKLET_BUILD_INFO = 'lynx:defines-for-worklet';

export interface Define {
  id: string;
  code: string;
}

interface ModuleWithDefines {
  identifier?: (() => string) | undefined;
  buildInfo?: Record<string, unknown> | undefined;
  modules?: Iterable<ModuleWithDefines> | undefined;
}

function collectFromModule(
  module: ModuleWithDefines,
  buildInfoKey: string,
  defines: Define[],
): void {
  const collected = module.buildInfo?.[buildInfoKey];
  if (Array.isArray(collected)) {
    defines.push(...collected as Define[]);
  }

  if (module.modules) {
    for (const nestedModule of module.modules) {
      collectFromModule(nestedModule, buildInfoKey, defines);
    }
  }
}

export function collectDefines<TModule>(
  modules: Iterable<TModule>,
  buildInfoKey: string,
  getModuleIdentifier: (module: TModule) => string,
): Define[] {
  const collected: Define[] = [];
  const visitedModules = new Set<string>();

  for (const module of modules) {
    const identifier = getModuleIdentifier(module);
    if (visitedModules.has(identifier)) {
      continue;
    }
    visitedModules.add(identifier);
    collectFromModule(module as ModuleWithDefines, buildInfoKey, collected);
  }

  const defines = new Map<string, Define>();
  for (const define of collected) {
    const seen = defines.get(define.id);
    if (seen === undefined) {
      defines.set(define.id, define);
      continue;
    }
    if (seen.code !== define.code) {
      throw new Error(
        `Two different definitions share the id ${define.id}.`,
      );
    }
  }

  return [...defines.values()];
}

export function selectMissingDefines(
  candidates: readonly Define[],
  present: readonly Define[],
): Define[] {
  const defined = new Set(present.map(({ id }) => id));
  return candidates.filter(({ id }) => !defined.has(id));
}

export function renderDefines(defines: readonly Define[]): string {
  return defines
    .map(({ id, code }) => `// ${id}\n{\n${code}\n}`)
    .join('\n');
}

export function renderDefinesModule(
  definesForSnapshot: readonly Define[],
  definesForWorklet: readonly Define[],
): string {
  const prelude = [`import * as ReactLynx from '@lynx-js/react/internal';`];
  if (definesForWorklet.length > 0) {
    prelude.push(`var loadWorkletRuntime = ReactLynx.loadWorkletRuntime;`);
  }
  const defines = [...definesForWorklet, ...definesForSnapshot];
  if (defines.some(({ code }) => /\brequire\(/.test(code))) {
    prelude.push(`var require = function () { return ReactLynx; };`);
  }
  return `${prelude.join('\n')}
${renderDefines(defines)}
`;
}
