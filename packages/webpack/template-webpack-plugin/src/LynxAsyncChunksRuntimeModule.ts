// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  AsyncDependenciesBlock,
  Compilation,
  RuntimeModule,
} from '@rspack/core';

import { RuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

type LynxAsyncChunksRuntimeModule = new(
  getChunkName: (chunkName: string) => string,
) => RuntimeModule;

type ChunkGraph = Compilation['chunkGraph'];

const LAZY_BUNDLE_MODE_ATTRIBUTE = 'mode';

// Building the `chunk.id -> mode` map walks the whole module graph, so memoize
// it per compilation: `generate()` runs once per runtime chunk and the result
// is identical for all of them.
const modeCache = new WeakMap<
  Compilation,
  Map<string | number, string>
>();

function collectLazyBundleModes(
  compilation: Compilation,
  chunkGraph: ChunkGraph,
): Map<string | number, string> {
  const cached = modeCache.get(compilation);
  if (cached) {
    return cached;
  }

  const modeByChunkId = new Map<string | number, string>();
  const visitBlock = (block: AsyncDependenciesBlock): void => {
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
      for (const chunk of chunkGroup.chunks) {
        if (chunk.id !== undefined) {
          modeByChunkId.set(chunk.id, mode);
        }
      }
    }
    for (const nested of block.blocks) {
      visitBlock(nested);
    }
  };

  for (const module of compilation.modules) {
    for (const block of module.blocks) {
      visitBlock(block);
    }
  }

  modeCache.set(compilation, modeByChunkId);
  return modeByChunkId;
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
