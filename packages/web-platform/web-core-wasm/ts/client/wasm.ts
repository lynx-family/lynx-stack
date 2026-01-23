/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
import { referenceTypes, simd } from 'wasm-feature-detect';
const isWorker = typeof WorkerGlobalScope !== 'undefined'
  && self instanceof WorkerGlobalScope;
const supportsSimd = simd();
const supportsReferenceTypes = referenceTypes();
const wasmLoaded = supportsSimd.then((hasSimd) => {
  if (!hasSimd) {
    throw new Error('WASM SIMD support required but not available');
  }
  return supportsReferenceTypes.then((hasReferenceTypes) => {
    if (!hasReferenceTypes) {
      throw new Error(
        'WASM reference types support required but not available',
      );
    }
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
  });
});
export const [wasmInstance, wasmModule] = await wasmLoaded;
if (!isWorker) {
  wasmInstance.initSync({ module: wasmModule! });
}

export class DecodedStyle {
  static webWorkerDecode(
    data: Uint8Array,
    configEnableCssSelector: boolean,
    entryName?: string,
  ) {
    return wasmInstance.DecodedStyleData.decode_into(
      data,
      entryName,
      configEnableCssSelector,
    );
  }
  readonly #styleData: InstanceType<
    typeof wasmInstance.DecodedStyleData
  >;
  readonly style_content: string;
  readonly font_face_content: string;
  constructor(
    data: Uint8Array,
  ) {
    this.#styleData = new wasmInstance.DecodedStyleData(
      data,
    );
    // cache the string result to avoid multiple utf8 -> utf16 string transformation
    this.style_content = this.#styleData.style_content;
    this.font_face_content = this.#styleData.font_face_content;
    this.query_css_og_declarations_by_css_id = this.#styleData
      .query_css_og_declarations_by_css_id.bind(this.#styleData);
  }
  query_css_og_declarations_by_css_id: InstanceType<
    typeof wasmInstance.DecodedStyleData
  >['query_css_og_declarations_by_css_id'];
}

export type MainThreadWasmContext =
  typeof import('../../binary/client/client.js').MainThreadWasmContext;
export type ElementTemplateSection =
  typeof import('../../binary/client/client.js').ElementTemplateSection;
