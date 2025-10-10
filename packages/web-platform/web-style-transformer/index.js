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
      './legacy.js'
    );
  }
}
