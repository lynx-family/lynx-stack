// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export function boundaryKey(
  layer: string | null | undefined,
  resourcePath: string,
): string {
  return `${layer ?? ''}|${resourcePath}`;
}

// Keyed by compiler: rsbuild compiles every environment in one process, and a
// boundary recorded by one compiler must not make another compiler's loader
// import a virtual module that only exists in the first compiler.
const definesImportsByCompiler = new WeakMap<object, Map<string, string>>();

export function definesImportByBoundary(compiler: object): Map<string, string> {
  let imports = definesImportsByCompiler.get(compiler);
  if (!imports) {
    imports = new Map();
    definesImportsByCompiler.set(compiler, imports);
  }
  return imports;
}
