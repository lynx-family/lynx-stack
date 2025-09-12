// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { referenceTypes } from 'wasm-feature-detect';

export let wasm;

export async function initWasm() {
  const supportsReferenceTypes = await referenceTypes();
  if (supportsReferenceTypes) {
    wasm = await import(
      /* webpackMode: "eager" */
      /* webpackFetchPriority: "high" */
      /* webpackChunkName: "standard-wasm-chunk" */
      /* webpackPrefetch: true */
      /* webpackPreload: true */
      './standard.js'
    );
  } else {
    wasm = await import(
      /* webpackMode: "lazy" */
      /* webpackChunkName: "legacy-wasm-chunk" */
      /* webpackPrefetch: false */
      /* webpackPreload: false */
      './legacy.js'
    );
  }
}

// Re-export main functions for backwards compatibility
export { prepareMainThreadAPIs } from './src/prepareMainThreadAPIs.js';
export * from './src/createMainThreadGlobalThis.js';
