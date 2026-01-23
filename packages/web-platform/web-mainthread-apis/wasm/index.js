import { referenceTypes, simd } from 'wasm-feature-detect';
export let wasm;
export async function initWasm() {
  if (!(await simd())) {
    wasm = await import(
      /* webpackMode: "lazy" */
      /* webpackChunkName: "legacy-wasm-chunk" */
      /* webpackPrefetch: false */
      './legacy.js'
    );
    return;
  }
  if (!(await referenceTypes())) {
    wasm = await import(
      /* webpackMode: "lazy" */
      /* webpackChunkName: "legacy-wasm-chunk" */
      /* webpackPrefetch: false */
      './legacy.js'
    );
    return;
  }
  wasm = await import(
    /* webpackMode: "eager" */
    /* webpackFetchPriority: "high" */
    /* webpackChunkName: "standard-wasm-chunk" */
    /* webpackPrefetch: true */
    /* webpackPreload: true */
    './standard.js'
  );
}
await initWasm();
