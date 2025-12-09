/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
import { referenceTypes } from 'wasm-feature-detect';
const WASMInstance = await ((async function initWasm() {
  const supportsReferenceTypes = await referenceTypes();
  if (supportsReferenceTypes) {
    return await import(
      /* webpackMode: "eager" */
      /* webpackFetchPriority: "high" */
      /* webpackChunkName: "standard-wasm-chunk" */
      /* webpackPrefetch: true */
      /* webpackPreload: true */
      // @ts-ignore
      '../../binary/client/client.js'
    );
  } else {
    // wasm = await import(
    //   /* webpackMode: "lazy" */
    //   /* webpackChunkName: "legacy-wasm-chunk" */
    //   /* webpackPrefetch: false */
    //   './legacy.js'
    // );
    throw new Error('WASM not supported');
  }
})())!;
export const templateManager = new WASMInstance!.TemplateManager();
export const { MainThreadWasmContext, TemplateManager } = WASMInstance!;
