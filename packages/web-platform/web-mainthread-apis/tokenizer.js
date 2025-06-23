import init from './pkg/web_mainthread_apis.js';
let wasm;
var ENVIRONMENT_IS_NODE = typeof process == 'object'
  && typeof process.versions == 'object'
  && typeof process.versions.node == 'string';
const start = async () => {
  // initialize wasm module in node.js environment
  if (ENVIRONMENT_IS_NODE) {
    const path = await import(/* webpackIgnore:true */ 'node:path');
    const fs = await import(/* webpackIgnore:true */ 'node:fs/promises');
    const wasmModuleBuffer = await fs.readFile(
      path.join(import.meta.dirname, 'pkg', 'web_mainthread_apis_bg.wasm'),
    );
    wasm = await init(wasmModuleBuffer);
  } else {
    wasm = await init();
  }
};
export default start;
let HEAPU16;
const stringToUTF16 = (ptr, str, len) => {
  if (!HEAPU16 || HEAPU16.byteLength == 0) {
    HEAPU16 = new Uint16Array(wasm.memory.buffer);
  }
  for (let i = 0; i < len; i++) {
    HEAPU16[(ptr >> 1) + i] = str.charCodeAt(i);
  }
};
const UTF16ToString = (ptr, len) => {
  if (!HEAPU16 || HEAPU16.byteLength == 0) {
    HEAPU16 = new Uint16Array(wasm.memory.buffer);
  }
  return String.fromCharCode(...HEAPU16.subarray(ptr >> 1, (ptr >> 1) + len));
};
export function transformInlineStyle(str) {
  const len = str.length;
  const ptr = wasm.malloc(len * 2);
  let result = str;
  stringToUTF16(ptr, str, len);
  globalThis._on_transformed_callback = (ptr, len) => {
    const transformed = UTF16ToString(ptr, len);
    result = transformed;
  };
  wasm.accept_raw_uint16_ptr(ptr, len);
  globalThis._tokenizer_on_token_callback = null;
  wasm.free(ptr, len * 2);
  return result;
}
