// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * All the runtime requirements that Lynx uses.
 *
 * @public
 */
export const RuntimeGlobals = {
  /**
   * An array of all the async chunk ids.
   */
  lynxAsyncChunkIds: '__webpack_require__.lynx_aci',

  /**
   * A map from `chunk.id` to the lazy-bundle loading mode (`'sync'` | `'async'`)
   * derived from the `import(..., { with: { mode } })` import attribute.
   * Only async chunks carrying a `mode` attribute appear here.
   */
  lynxAsyncChunkMode: '__webpack_require__.lynx_acm',

  /**
   * The compile-time host id of this runtime chunk's entry
   * (`uniqueName#entryName`). Chunk loading passes it as the `host` of a
   * nested lazy-bundle import so the main-thread prepare routes the chunk's
   * eval result to `processEvalResultByHost[host]`, which the host's runtime
   * registered under the same literal.
   */
  lynxHostId: '__webpack_require__.lynx_hid',

  /**
   * A map from `chunk.id` to entryName of the chunk.
   */
  lynxChunkEntries: 'lynx.__chunk_entries__',

  /**
   * A function to process the eval result of a lazy bundle.
   *
   * @deprecated Unreliable when multiple lazy bundles load — each overwrites it.
   * Prefer {@link RuntimeGlobals.lynxProcessEvalResultByHost}.
   */
  lynxProcessEvalResult: 'globalThis.processEvalResult',

  /**
   * A map from a lazy bundle's own url to the function that processes its eval
   * result, closing over that bundle's `__webpack_require__`.
   */
  lynxProcessEvalResultByHost: 'globalThis.processEvalResultByHost',

  /**
   * A list of functions to setup the cache layer.
   */
  lynxCacheEventsSetupList: '__webpack_require__.lynx_ce.setupList',
  /**
   * A cache layer to cache the events until the chunk is fully loaded.
   */
  lynxCacheEvents: '__webpack_require__.lynx_ce',
} as const;
