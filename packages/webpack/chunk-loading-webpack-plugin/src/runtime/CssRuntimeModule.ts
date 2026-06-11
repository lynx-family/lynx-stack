/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { generateFromTemplate } from './helper.js';
import loadStyleRuntime from './css/load-style.js';
import chunkLoadingRuntime from './css/chunk-loading.js';
import hmrLoadChunkRuntime from './css/hmr-load-chunk.js';

/**
 * @internal
 *
 * The base class to generate runtime of JavaScript. It should be use both in webpack and rspack.
 */
export class CssRuntimeModule {
  /**
   * @internal
   * @returns CSS load style runtime code
   */
  static generateLoadStyleRuntime(
    webpack: typeof import('@rspack/core').rspack,
  ): string {
    return generateFromTemplate(webpack, loadStyleRuntime);
  }

  /**
   * @internal
   * @param chunkMap chunks that have css
   * @returns CSS load style runtime code
   */
  static generateChunkLoadingRuntime(
    webpack: typeof import('@rspack/core').rspack,
    chunkMap: Object,
    installedCssChunks: readonly (string | number)[],
  ): string {
    return generateFromTemplate(webpack, chunkLoadingRuntime)
      .replace(
        /\$INSTALLED_CHUNKS\$/g,
        `${
          installedCssChunks.map((id) => `${JSON.stringify(id)}: 0`).join(',\n')
        }`,
      )
      .replace(/\$CHUNK_MAP\$/g, `${JSON.stringify(chunkMap)}`);
  }

  /**
   * @internal
   * @returns CSS hmr load chunk runtime code
   */
  static generateHMRLoadChunkRuntime(
    webpack: typeof import('@rspack/core').rspack,
  ): string {
    return generateFromTemplate(webpack, hmrLoadChunkRuntime);
  }
}
