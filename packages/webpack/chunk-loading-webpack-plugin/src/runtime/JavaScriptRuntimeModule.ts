/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import rspack from '@rspack/core';

import installChunkRuntime from './javascript/install-chunk.js';
import chunkLoadingRuntime from './javascript/chunk-loading.js';
import syncChunkLoadingRuntime from './javascript/sync-chunk-loading.js';
import chunkOnloadRuntime from './javascript/chunk-onload.js';
import hmrLoadChunkRuntime from './javascript/hmr-load-chunk.js';
import hmrLoadManifestRuntime from './javascript/hmr-load-manifest.js';
import hmrRuntime from './javascript/hmr-runtime.js';
import { generateFromTemplate } from './helper.js';

const { Template } = rspack;
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
  static generateInstallChunkRuntime(withOnload: boolean): string {
    return generateFromTemplate(installChunkRuntime)
      .replace(/\$WITH_ONLOAD\$/g, `${withOnload}`);
  }

  /**
   * @internal
   * @returns JavaScript chunk onload runtime code
   */
  static generateChunkOnloadRuntime(): string {
    return generateFromTemplate(chunkOnloadRuntime);
  }

  /**
   * @internal
   * @param matcher filter initial chunk
   * @returns JavaScript chunk loading Runtime Code
   */
  static generateChunkLoadingRuntime(matcher: string): string {
    return generateFromTemplate(chunkLoadingRuntime)
      .replace(/\$JS_MATCHER\$/g, `"${matcher}"`);
  }

  /**
   * @internal
   * @param matcher filter initial chunk
   * @returns JavaScript sync chunk loading Runtime Code
   */
  static generateSyncChunkLoadingRuntime(matcher: string): string {
    return generateFromTemplate(syncChunkLoadingRuntime)
      .replace(/\$JS_MATCHER\$/g, `"${matcher}"`);
  }

  /**
   * @internal
   * @returns JavaScript HMR runtime code
   */
  static generateHMRRuntime(): string {
    return Template.asString([
      '',
      generateFromTemplate(hmrLoadChunkRuntime),
      '',
      generateFromTemplate(hmrRuntime)
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
  static generateHMRManifestRuntime(): string {
    return Template.asString([
      '',
      generateFromTemplate(hmrLoadManifestRuntime),
    ]);
  }
}
