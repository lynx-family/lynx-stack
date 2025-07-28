export let wasm;
export async function initWasm() {
  wasm = await import('./standard.js');
}
