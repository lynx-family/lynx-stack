// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const MTS_DEFINES_BUILD_INFO = 'lynx:mts-defines';

export interface MTSDefine {
  kind: 'snapshot' | 'worklet';
  id: string;
  code: string;
}

interface ModuleWithMTSDefines {
  identifier?: (() => string) | undefined;
  layer?: string | null | undefined;
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

export function collectLayerMTSDefines<
  TModule extends { identifier(): string; layer?: string | null | undefined },
>(
  modules: Iterable<TModule>,
  layer: string,
): MTSDefine[] {
  const layerModules = [...modules].filter((module) => module.layer === layer);
  return collectMTSDefines(
    [layerModules],
    (chunk) => chunk,
    (module) => module.identifier(),
  );
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

/**
 * The source of the module injected into a main-thread entry to register the
 * definitions its bundle dropped. It is a regular module (added through
 * `compilation.addInclude` as a \`data:\` URI), so importing the runtime here
 * keeps exactly what the definitions need alive — a bundle with nothing
 * missing gets no module and pays nothing.
 */
export function renderMTSDefinesModule(
  defines: readonly MTSDefine[],
): string {
  return `import * as ReactLynx from '@lynx-js/react/internal';
${renderMTSDefines(defines)}__initMTSDefines(ReactLynx);
`;
}

export function renderMTSDefinesModuleURI(
  defines: readonly MTSDefine[],
): string {
  return `data:text/javascript,${
    encodeURIComponent(renderMTSDefinesModule(defines))
  }`;
}
