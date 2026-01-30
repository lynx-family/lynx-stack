import { referenceTypes, simd } from 'wasm-feature-detect';
export let wasm;
export async function initWasm() {
  const [supportsReferenceTypes, supportsSimd] = await Promise.all([
    referenceTypes(),
    simd(),
  ]);
  if (supportsReferenceTypes && supportsSimd) {
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
await initWasm();
