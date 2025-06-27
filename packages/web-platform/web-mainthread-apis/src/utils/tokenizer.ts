// @ts-ignore the wasm module built later than the ts code
import init from '../../pkg/web_mainthread_apis.js';
let wasm: Awaited<ReturnType<typeof init>>;
let HEAPU16: Uint16Array | undefined;
let HEAPU32: Uint32Array | undefined;
var ENVIRONMENT_IS_NODE = typeof process == 'object'
  && typeof process.versions == 'object'
  && typeof process.versions.node == 'string';
export const initTokenizer = async () => {
  // initialize wasm module in node.js environment
  if (ENVIRONMENT_IS_NODE) {
    const path = await import(/* webpackIgnore:true */ 'node:path');
    const fs = await import(/* webpackIgnore:true */ 'node:fs/promises');
    const wasmModuleBuffer = await fs.readFile(
      path.join(
        import.meta.dirname,
        '..',
        '..',
        'pkg',
        'web_mainthread_apis_bg.wasm',
      ),
    );
    wasm = await init(wasmModuleBuffer);
  } else {
    wasm = await init();
  }
};
const stringToUTF16 = (ptr: number, str: string, len: number) => {
  if (!HEAPU16 || HEAPU16.byteLength == 0) {
    HEAPU16 = new Uint16Array(wasm.memory.buffer);
  }
  for (let i = 0; i < len; i++) {
    HEAPU16[(ptr >> 1) + i] = str.charCodeAt(i);
  }
};
const UTF16ToString = (ptr: number, len: number) => {
  if (!HEAPU16 || HEAPU16.byteLength == 0) {
    HEAPU16 = new Uint16Array(wasm.memory.buffer);
  }
  return String.fromCharCode(...HEAPU16.subarray(ptr >> 1, (ptr >> 1) + len));
};
export function transformInlineStyleString(str: string): string {
  const len = str.length;
  const ptr = wasm.malloc(len * 2);
  let inlineStyle = str;
  stringToUTF16(ptr, str, len);
  // @ts-ignore
  globalThis._on_transformed_callback = (ptr, len) => {
    const transformed = UTF16ToString(ptr, len);
    inlineStyle = transformed;
  };
  wasm.transform_raw_u16_inline_style_ptr(ptr, len);
  // @ts-ignore
  globalThis._on_transformed_callback = undefined;
  wasm.free(ptr, len * 2);
  return inlineStyle;
}

export function transformParsedStyles(
  styles: [string, string][],
): [string, string] {
  const str = styles.map(([name, value]) => `${name}:${value};`).join('');
  let offset = 0;
  let declarations_positions_ptr = wasm.malloc(styles.length * 5 * 4);
  let source_ptr = wasm.malloc(str.length * 2);
  stringToUTF16(source_ptr, str, str.length);
  if (!HEAPU32 || HEAPU32.byteLength == 0) {
    HEAPU32 = new Uint32Array(wasm.memory.buffer);
  }
  for (let ii = 0; ii < styles.length; ii += 5) {
    const [name, value] = styles[ii]!;
    let nameLength = name.length;
    let valueLength = value.length;
    HEAPU32[(declarations_positions_ptr >> 2) + ii] = offset;
    HEAPU32[(declarations_positions_ptr >> 2) + ii + 1] = offset += nameLength;
    HEAPU32[(declarations_positions_ptr >> 2) + ii + 2] = offset += 1;
    HEAPU32[(declarations_positions_ptr >> 2) + ii + 3] = offset += valueLength;
    // placeholder for !important
    HEAPU32[(declarations_positions_ptr >> 2) + ii + 4] = 0;
    offset += 1; // for the semicolon
  }
  let inlineStyle = str;
  let chilrenStyle = '';
  // @ts-ignore
  globalThis._on_transformed_callback = (ptr, len) => {
    const transformed = UTF16ToString(ptr, len);
    inlineStyle = transformed;
  };

  // @ts-ignore
  globalThis._on_extra_children_style_callback = (ptr, len) => {
    const transformed = UTF16ToString(ptr, len);
    chilrenStyle = transformed;
  };
  wasm.free(declarations_positions_ptr, styles.length * 5 * 4);
  wasm.free(source_ptr, str.length * 2);
  return [inlineStyle, chilrenStyle];
}
