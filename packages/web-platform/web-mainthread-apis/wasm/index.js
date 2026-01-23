import { referenceTypes, simd } from 'wasm-feature-detect';
export let wasm;
const loadLegacy = () =>
  import(
    /* webpackMode: "lazy" */
    /* webpackChunkName: "legacy-wasm-chunk" */
    /* webpackPrefetch: false */
    './legacy.js'
  );
export async function initWasm() {
  const supportsSimd = simd();
  const supportsReferenceTypes = referenceTypes();
  if (!(await supportsSimd)) {
    wasm = await loadLegacy();
    return;
  }
  if (!(await supportsReferenceTypes)) {
    wasm = await loadLegacy();
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
