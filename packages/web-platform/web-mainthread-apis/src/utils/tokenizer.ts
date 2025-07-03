// @ts-ignore the wasm module built later than the ts code
import init from '../../pkg/web_mainthread_apis.js';
let wasm: Awaited<ReturnType<typeof init>>;
let HEAPU16: Uint16Array | undefined;
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
const stringToUTF16 = (str: string) => {
  const len = str.length;
  const ptr = wasm.malloc(len * 2);
  if (!HEAPU16 || HEAPU16.byteLength == 0) {
    HEAPU16 = new Uint16Array(wasm.memory.buffer);
  }
  for (let i = 0; i < len; i++) {
    HEAPU16[(ptr >> 1) + i] = str.charCodeAt(i);
  }
  return { ptr, len: len * 2 };
};
const UTF16ToString = (ptr: number, len: number) => {
  if (!HEAPU16 || HEAPU16.byteLength == 0) {
    HEAPU16 = new Uint16Array(wasm.memory.buffer);
  }
  return String.fromCharCode(...HEAPU16.subarray(ptr >> 1, (ptr >> 1) + len));
};
export function transformInlineStyleString(str: string): string {
  let inlineStyle = str;
  const { ptr, len } = stringToUTF16(str);
  // @ts-ignore
  globalThis._on_transformed_callback = (ptr, len) => {
    const transformed = UTF16ToString(ptr, len);
    inlineStyle = transformed;
  };
  wasm.transform_raw_u16_inline_style_ptr(ptr, len);
  // @ts-ignore
  globalThis._on_transformed_callback = undefined;
  wasm.free(ptr, len);
  return inlineStyle;
}

export function transformParsedStyles(
  styles: [string, string][],
): { childStyle: [string, string][]; transformedStyle: [string, string][] } {
  let childStyle: [string, string][] = [];
  let transformedStyle: [string, string][] = [];
  for (const [property, value] of styles) {
    const { ptr: propertyPtr, len: propertyLen } = stringToUTF16(property);
    const { ptr: valuePtr, len: valueLen } = stringToUTF16(value);
    const [transformedStyleForCurrent, childStyleForCurrent] = wasm
      .transform_raw_u16_inline_style_ptr_parsed(
        propertyPtr,
        propertyLen,
        valuePtr,
        valueLen,
      );
    transformedStyle = transformedStyle.concat(transformedStyleForCurrent);
    if (childStyleForCurrent) {
      childStyle = childStyle.concat(childStyleForCurrent);
    }
    wasm.free(propertyPtr, propertyLen);
    wasm.free(valuePtr, valueLen);
  }
  return {
    childStyle,
    transformedStyle,
  };
}
