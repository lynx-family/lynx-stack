// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  AsyncDependenciesBlock,
  Compilation,
  Module,
  RuntimeModule,
} from '@rspack/core';

import { RuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

type LynxAsyncChunksRuntimeModule = new(
  getChunkName: (chunkName: string) => string,
) => RuntimeModule;

type ChunkGraph = Compilation['chunkGraph'];
type Webpack = typeof import('@rspack/core').rspack;

const LAZY_BUNDLE_MODE_ATTRIBUTE = 'mode';

// The importing module's readable path (e.g. `./src/App.tsx`), used to point at
// conflicting `import()` sites. rspack's `Dependency.loc` is `null` for these
// dependencies even pre-seal, so a line:column is not available — the module
// path plus the import request is the most precise pointer we can give.
// `readableIdentifier`/`requestShortener` are runtime-supported but not on the
// public rspack types, hence the loose casts.
function describeImportingModule(
  module: Module,
  compilation: Compilation,
): string {
  const mod = module as {
    readableIdentifier?: (requestShortener: unknown) => string;
    identifier?: () => string;
  };
  const requestShortener =
    (compilation as { requestShortener?: unknown }).requestShortener;
  return typeof mod.readableIdentifier === 'function'
    ? mod.readableIdentifier(requestShortener)
    : String(mod.identifier?.() ?? 'unknown module');
}

// Building the maps walks the whole module graph, so memoize per compilation:
// `generate()` runs once per runtime chunk and the result is identical for all.
const modeCache = new WeakMap<Compilation, Map<string | number, string>>();

function collectLazyBundleModes(
  compilation: Compilation,
  chunkGraph: ChunkGraph,
  webpack: Webpack,
): Map<string | number, string> {
  const cached = modeCache.get(compilation);
  if (cached) {
    return cached;
  }

  // chunk.id -> modes seen (for the runtime `lynx_acm` map).
  const modesByChunkId = new Map<string | number, Set<string>>();
  // request -> mode -> importing module paths (for conflict reporting), so a
  // component that splits into main-thread + background chunks is reported once,
  // not once per chunk.
  const usagesByRequest = new Map<string, Map<string, Set<string>>>();

  const visitBlock = (module: Module, block: AsyncDependenciesBlock): void => {
    for (const dependency of block.dependencies) {
      // `import(..., { with: { mode } })` surfaces here as a dependency import
      // attribute (rspack >= 2.0.3, web-infra-dev/rspack#13947).
      const mode = dependency.attributes?.[LAZY_BUNDLE_MODE_ATTRIBUTE];
      if (mode === undefined) {
        continue;
      }
      const chunkGroup = chunkGraph.getBlockChunkGroup(block);
      if (chunkGroup === null) {
        continue;
      }
      const request = (dependency as { request?: string }).request
        ?? '<unknown request>';
      let byMode = usagesByRequest.get(request);
      if (byMode === undefined) {
        byMode = new Map();
        usagesByRequest.set(request, byMode);
      }
      let locations = byMode.get(mode);
      if (locations === undefined) {
        locations = new Set();
        byMode.set(mode, locations);
      }
      locations.add(describeImportingModule(module, compilation));

      for (const chunk of chunkGroup.chunks) {
        if (chunk.id === undefined) {
          continue;
        }
        let modes = modesByChunkId.get(chunk.id);
        if (modes === undefined) {
          modes = new Set();
          modesByChunkId.set(chunk.id, modes);
        }
        modes.add(mode);
      }
    }
    for (const nested of block.blocks) {
      visitBlock(module, nested);
    }
  };

  for (const module of compilation.modules) {
    for (const block of module.blocks) {
      visitBlock(module, block);
    }
  }

  const modeByChunkId = new Map<string | number, string>();
  for (const [chunkId, modes] of modesByChunkId) {
    if (modes.size === 1) {
      modeByChunkId.set(chunkId, modes.values().next().value!);
    }
    // A chunk with conflicting modes is left out -> chunk-loading falls back to
    // its non-blocking `async` default, so the output stays deterministic. The
    // conflict itself is reported once per request below.
  }

  for (const [request, byMode] of usagesByRequest) {
    if (byMode.size > 1) {
      compilation.errors.push(
        createModeConflictError(webpack, request, byMode),
      );
    }
  }

  modeCache.set(compilation, modeByChunkId);
  return modeByChunkId;
}

function createModeConflictError(
  webpack: Webpack,
  request: string,
  byMode: Map<string, Set<string>>,
): Error {
  const details = Array.from(byMode, ([mode, modules]) =>
    [
      `  mode: '${mode}'`,
      ...Array.from(modules, module => `    imported in ${module}`),
    ].join('\n')).join('\n');
  const modeList = Array.from(byMode.keys(), mode => `'${mode}'`).join(' and ');
  const error = new webpack.WebpackError(
    `Conflicting lazy bundle \`mode\` for "${request}".\n`
      + `It is imported with ${modeList}, but a lazy bundle can only load one `
      + `way:\n${details}\n`
      + `Use the same \`mode\` at every `
      + `\`import("${request}", { with: { mode } })\` site. `
      + `Until fixed, this bundle falls back to \`mode: 'async'\`.`,
  ) as Error & { hideStack?: boolean };
  error.hideStack = true;
  return error;
}

export function createLynxAsyncChunksRuntimeModule(
  webpack: typeof import('@rspack/core').rspack,
): LynxAsyncChunksRuntimeModule {
  return class LynxAsyncChunksRuntimeModule extends webpack.RuntimeModule {
    constructor(
      public getChunkName: (chunkName: string) => string,
    ) {
      super(
        'webpack/runtime/lynx async chunks',
        webpack.RuntimeModule.STAGE_ATTACH,
      );
    }

    override generate(): string {
      const chunk = this.chunk!;
      const compilation = this.compilation!;

      const modeByChunkId = collectLazyBundleModes(
        compilation,
        this.chunkGraph!,
        webpack,
      );

      const asyncChunks = Array.from(chunk.getAllAsyncChunks())
        .filter(c => c.name !== null && c.name !== undefined);

      const ids = asyncChunks
        .map(c => {
          const filename = this.getChunkName(c.name!);

          // Modified from https://github.com/webpack/webpack/blob/11449f02175f055a4540d76aa4478958c4cb297e/lib/runtime/GetChunkFilenameRuntimeModule.js#L154-L157
          // Rspack currently ignores `hashWithLength` (also missing from its
          // `PathData` type, hence the cast); kept for when it gains support.
          const pathData = {
            hash: `" + ${webpack.RuntimeGlobals.getFullHash}() + "`,
            hashWithLength: (length: number) =>
              `" + ${webpack.RuntimeGlobals.getFullHash}().slice(0, ${length}) + "`,
            // TODO: support [contenthash]
          } as Parameters<typeof compilation.getPath>[1];
          const chunkPath = compilation.getPath(filename, pathData);

          // Do not use `JSON.stringify` on `chunkPath`, it may contains `+` which will be treated as string concatenation.
          return `${JSON.stringify(c.id)}: "${chunkPath}"`;
        })
        .join(',\n');

      const modes = asyncChunks
        .filter(c => modeByChunkId.has(c.id!))
        .map(c =>
          `${JSON.stringify(c.id)}: ${JSON.stringify(modeByChunkId.get(c.id!))}`
        )
        .join(',\n');

      const idsBlock = `// lynx async chunks ids
${RuntimeGlobals.lynxAsyncChunkIds} = {${ids}}`;
      if (modes.length === 0) {
        return idsBlock;
      }
      return `${idsBlock}
// lynx async chunks modes
${RuntimeGlobals.lynxAsyncChunkMode} = {${modes}}`;
    }
  };
}
