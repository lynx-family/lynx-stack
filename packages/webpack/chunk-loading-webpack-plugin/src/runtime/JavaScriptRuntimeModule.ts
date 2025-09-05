/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import installChunkRuntime from './javascript/install-chunk.js';
import chunkLoadingRuntime from './javascript/chunk-loading.js';
import chunkOnloadRuntime from './javascript/chunk-onload.js';
import hmrLoadChunkRuntime from './javascript/hmr-load-chunk.js';
import hmrLoadManifestRuntime from './javascript/hmr-load-manifest.js';
import hmrRuntime from './javascript/hmr-runtime.js';
import { generateFromTemplate } from './helper.js';

/**
 * @internal
 *
 * The base class to generate runtime of JavaScript. It should be use both in webpack and rspack.
 */
export class JavaScriptRuntimeModule {
  /**
   * @internal
   * @param withOnload need call onload callback
   * @returns JavaScript install chunk runtime code
   */
  static generateInstallChunkRuntime(
    webpack: typeof import('webpack'),
    withOnload: boolean,
  ): string {
    return generateFromTemplate(webpack, installChunkRuntime)
      .replace(/\$WITH_ONLOAD\$/g, `${withOnload}`);
  }

  /**
   * @internal
   * @returns JavaScript chunk onload runtime code
   */
  static generateChunkOnloadRuntime(webpack: typeof import('webpack')): string {
    return generateFromTemplate(webpack, chunkOnloadRuntime);
  }

  /**
   * @internal
   * @param matcher filter initial chunk
   * @returns JavaScript chunk loading Runtime Code
   */
  static generateChunkLoadingRuntime(
    webpack: typeof import('webpack'),
    matcher: string,
  ): string {
    return generateFromTemplate(webpack, chunkLoadingRuntime)
      .replace(/\$JS_MATCHER\$/g, `"${matcher}"`);
  }

  /**
   * @internal
   * @returns JavaScript HMR runtime code
   */
  static generateHMRRuntime(webpack: typeof import('webpack')): string {
    const { Template } = webpack;
    return Template.asString([
      '',
      generateFromTemplate(webpack, hmrLoadChunkRuntime),
      '',
      generateFromTemplate(webpack, hmrRuntime)
        // The key here has to be `require`(the same as RequireChunkLoadingRuntimeModule)
        // since we are concatenating this runtime module after the rspack runtime module.
        // So we have to **override** the exactly same function(e.g.: `__webpack_require__.hmrC.require`).
        .replace(/\$key\$/g, 'require')
        .replace(/\$installedChunks\$/g, 'installedChunks')
        .replace(/\$loadUpdateChunk\$/g, 'loadUpdateChunk'),
    ]);
  }

  /**
   * @internal
   * @returns The HMR manifest runtime code(`RuntimeGlobals.hmrDownloadManifest`, aka `__webpack_require__.hmrM`)
   */
  static generateHMRManifestRuntime(webpack: typeof import('webpack')): string {
    const { Template } = webpack;
    return Template.asString([
      '',
      generateFromTemplate(webpack, hmrLoadManifestRuntime),
    ]);
  }
}
