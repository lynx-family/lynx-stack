// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const DEFINES_FOR_SNAPSHOT_BUILD_INFO = 'lynx:defines-for-snapshot';
export const DEFINES_FOR_WORKLET_BUILD_INFO = 'lynx:defines-for-worklet';

export interface Define {
  id: string;
  code: string;
  unmergeable?: boolean;
  imports?: Array<{ source: string; imported: string; local: string }>;
  runtimeRequirements?: { mainThreadProgrammability: boolean };
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
    if (
      seen.code !== define.code
      || JSON.stringify(
          seen.imports?.map((
            { source, imported, local },
          ) => [source, imported, local]),
        )
        !== JSON.stringify(
          define.imports?.map((
            { source, imported, local },
          ) => [source, imported, local]),
        )
    ) {
      throw new Error(
        `Two different definitions share the id ${define.id}.`,
      );
    }
    // Equal code and dependencies identify one executable definition. Keep
    // semantic evidence from any copy instead of making it depend on order.
    if (define.runtimeRequirements !== undefined) {
      defines.set(define.id, {
        ...seen,
        runtimeRequirements: {
          mainThreadProgrammability:
            seen.runtimeRequirements?.mainThreadProgrammability === true
            || define.runtimeRequirements.mainThreadProgrammability,
        },
      });
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
  const defines = [...definesForWorklet, ...definesForSnapshot];
  const locals = new Set(
    defines.flatMap(define => define.imports?.map(({ local }) => local) ?? []),
  );
  const imports = new Map<string, string>();
  let nextImport = 0;
  const boundDefines = defines.map(define => {
    const bindings = (define.imports ?? []).map(
      ({ source, imported, local }) => {
        const key = JSON.stringify([source, imported]);
        let alias = imports.get(key);
        if (alias === undefined) {
          do {
            alias = `__lynxDefineImport${nextImport++}`;
          } while (locals.has(alias));
          imports.set(key, alias);
          prelude.push(
            `import { ${imported} as ${alias} } from ${
              JSON.stringify(source)
            };`,
          );
        }
        return `const ${local} = ${alias};`;
      },
    );
    return { ...define, code: [...bindings, define.code].join('\n') };
  });
  if (defines.some(({ code }) => /\brequire\(/.test(code))) {
    prelude.push(`var require = function () { return ReactLynx; };`);
  }
  return `${prelude.join('\n')}
${renderDefines(boundDefines)}
`;
}
