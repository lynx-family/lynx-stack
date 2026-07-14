// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Compilation, Compiler } from '@rspack/core';

import { LynxTemplatePlugin } from './LynxTemplatePlugin.js';

const INTERMEDIATE = '.rspeedy';

/**
 * Route a lazy bundle's intermediate JS chunk to
 * `.rspeedy/async/<name>/<layer>.js`, co-located with the bundle's other
 * intermediate outputs (mirroring `.rspeedy/main/`). Non-lazy chunks keep the
 * default `output.chunkFilename`.
 *
 * @public
 */
export class LynxAsyncChunkLayoutPlugin {
  apply(compiler: Compiler): void {
    const original = compiler.options.output.chunkFilename;
    let compilation: Compilation | undefined;
    compiler.hooks.thisCompilation.tap(LynxAsyncChunkLayoutPlugin.name, c => {
      compilation = c;
    });

    compiler.options.output.chunkFilename = (pathData, assetInfo) => {
      const id = pathData.chunk?.id;
      if (compilation !== undefined && id !== undefined && id !== null) {
        const layoutName = LynxTemplatePlugin.getAsyncChunkLayoutName(
          compilation,
          id,
        );
        if (layoutName !== undefined) {
          return `${INTERMEDIATE}/async/${layoutName}.js`;
        }
      }
      return typeof original === 'function'
        ? original(pathData, assetInfo)
        : original ?? '[id].js';
    };
  }
}
