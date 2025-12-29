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
   * A map from `chunk.id` to entryName of the chunk.
   */
  lynxChunkEntries: 'lynx.__chunk_entries__',

  /**
   * A function to process the eval result of lazy bundle.
   */
  lynxProcessEvalResult: 'globalThis.processEvalResult',

  /**
   * A list of functions to setup the cache layer.
   */
  lynxCacheEventsSetupList: '__webpack_require__.lynx_ce.setupList',
  /**
   * A cache layer to cache the events until the chunk is fully loaded.
   */
  lynxCacheEvents: '__webpack_require__.lynx_ce',
} as const;
