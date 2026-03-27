/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
import { referenceTypes, simd } from 'wasm-feature-detect';
const isWorker = typeof WorkerGlobalScope !== 'undefined'
  && self instanceof WorkerGlobalScope;
const wasmLoaded = Promise.all([referenceTypes(), simd()]).then(
  ([supportsReferenceTypes, supportsSimd]) => {
    if (supportsReferenceTypes && supportsSimd) {
      return Promise.all([
        import(
          /* webpackMode: "eager" */
          /* webpackFetchPriority: "high" */
          /* webpackPrefetch: true */
          /* webpackPreload: true */
          '../../binary/client/client.js'
        ),
        isWorker ? undefined : WebAssembly.compileStreaming(
          fetch(
            new URL(
              /* webpackChunkName: "standard-wasm" */
              /* webpackMode: "eager" */
              /* webpackFetchPriority: "high" */
              /* webpackPrefetch: true */
              /* webpackPreload: true */
              '../../binary/client/client_bg.wasm',
              import.meta.url,
            ),
          ),
        ),
      ]);
    } else {
      return Promise.all([
        import(
          /* webpackChunkName: "legacy-wasm-js" */
          /* webpackMode: "lazy" */
          /* webpackFetchPriority: "low" */
          /* webpackPrefetch: false */
          /* webpackPreload: false */
          '../../binary/client_legacy/client.js'
        ) as any,
        isWorker ? undefined : WebAssembly.compileStreaming(
          fetch(
            new URL(
              /* webpackChunkName: "legacy-wasm" */
              /* webpackMode: "lazy" */
              /* webpackFetchPriority: "low" */
              /* webpackPrefetch: false */
              /* webpackPreload: false */
              '../../binary/client_legacy/client_bg.wasm',
              import.meta.url,
            ),
          ),
        ),
      ]);
    }
  },
);
export const [wasmInstance, wasmModule] = await wasmLoaded;
if (!isWorker) {
  wasmInstance.initSync({ module: wasmModule! });
}

export type MainThreadWasmContext =
  typeof import('../../binary/client/client.js').MainThreadWasmContext;
