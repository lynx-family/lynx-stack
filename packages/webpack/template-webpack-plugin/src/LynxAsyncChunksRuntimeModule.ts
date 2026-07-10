// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Chunk, RuntimeModule } from '@rspack/core';

import { RuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

type LynxAsyncChunksRuntimeModule = new(
  getFilenameTemplate: (chunk: Chunk) => string,
) => RuntimeModule;

export function createLynxAsyncChunksRuntimeModule(
  webpack: typeof import('@rspack/core').rspack,
): LynxAsyncChunksRuntimeModule {
  return class LynxAsyncChunksRuntimeModule extends webpack.RuntimeModule {
    constructor(
      public getFilenameTemplate: (chunk: Chunk) => string,
    ) {
      super(
        'webpack/runtime/lynx async chunks',
        webpack.RuntimeModule.STAGE_ATTACH,
      );
    }

    override generate(): string {
      const chunk = this.chunk!;
      const compilation = this.compilation!;

      return `// lynx async chunks ids
${RuntimeGlobals.lynxAsyncChunkIds} = {${
        Array.from(chunk.getAllAsyncChunks())
          .filter(c => c.name !== null && c.name !== undefined)
          .map(c => {
            const filename = this.getFilenameTemplate(c);

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

            return [c.id, chunkPath];
          })
          // Do not use `JSON.stringify` on `chunkPath`, it may contains `+` which will be treated as string concatenation.
          .map(([id, path]) => `${JSON.stringify(id)}: "${path}"`).join(',\n')
      }}`;
    }
  };
}
