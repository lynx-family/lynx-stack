export let wasm;
export function initWasm() {
  return import('./standard.js').then((module) => {
    wasm = module;
  });
}
