// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RuntimeModule } from 'webpack';

import { RuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

type LynxAsyncChunksRuntimeModule = new(
  getChunkName: (chunkName: string | null | undefined) => string,
) => RuntimeModule;

export function createLynxAsyncChunksRuntimeModule(
  webpack: typeof import('webpack'),
): LynxAsyncChunksRuntimeModule {
  return class LynxAsyncChunksRuntimeModule extends webpack.RuntimeModule {
    constructor(
      public getChunkName: (chunkName: string | null | undefined) => string,
    ) {
      super('Lynx async chunks', webpack.RuntimeModule.STAGE_ATTACH);
    }

    override generate(): string {
      const chunk = this.chunk!;
      const compilation = this.compilation!;

      return `// lynx async chunks ids
${RuntimeGlobals.lynxAsyncChunkIds} = {${
        Array.from(chunk.getAllAsyncChunks()).map(
          c => {
            const filename = this.getChunkName(c.name);

            // Modified from https://github.com/webpack/webpack/blob/11449f02175f055a4540d76aa4478958c4cb297e/lib/runtime/GetChunkFilenameRuntimeModule.js#L154-L157
            const chunkPath = compilation.getPath(filename, {
              hash: `" + ${webpack.RuntimeGlobals.getFullHash}() + "`,
              // Rspack does not support `hashWithLength` for now.
              hashWithLength: length =>
                `" + ${webpack.RuntimeGlobals.getFullHash}().slice(0, ${length}) + "`,
              // TODO: support [contenthash]
            });

            return [c.id, chunkPath];
          },
          // Do not use `JSON.stringify` on `chunkPath`, it may contains `+` which will be treated as string concatenation.
        ).map(([id, path]) => `${JSON.stringify(id)}: "${path}"`).join(',\n')
      }}`;
    }
  };
}
