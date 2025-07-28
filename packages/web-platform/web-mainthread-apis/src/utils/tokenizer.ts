// @ts-ignore the wasm module built later than the ts code
import init from '@lynx-js/web-style-transformer';
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
        'node_modules',
        '@lynx-js',
        'web-style-transformer',
        'dist',
        'index_bg.wasm',
      ),
    );
    wasm = await init(wasmModuleBuffer);
  } else {
    wasm = await init();
  }
};
const stringToUTF16 = (str: string) => {
  const len = str.length;
  const ptr = wasm.malloc(len << 1);
  if (!HEAPU16 || HEAPU16.byteLength == 0) {
    HEAPU16 = new Uint16Array(wasm.memory.buffer);
  }
  for (let i = 0; i < len; i++) {
    HEAPU16[(ptr >> 1) + i] = str.charCodeAt(i);
  }
  return { ptr, len };
};
export function transformInlineStyleString(str: string): string {
  const { ptr, len } = stringToUTF16(str);
  try {
    const transformedStyle = wasm.transform_raw_u16_inline_style_ptr(ptr, len)
      ?? str;
    wasm.free(ptr, len << 1);
    return transformedStyle;
  } catch (e) {
    wasm.free(ptr, len << 1);
    throw e;
  }
}

export function transformParsedStyles(
  styles: [string, string][],
): { childStyle: [string, string][]; transformedStyle: [string, string][] } {
  let childStyle: [string, string][] = [];
  let transformedStyle: [string, string][] = [];
  for (const [property, value] of styles) {
    const { ptr: propertyPtr, len: propertyLen } = stringToUTF16(property);
    const { ptr: valuePtr, len: valueLen } = stringToUTF16(value);
    try {
      const transformedResult = wasm
        .transform_raw_u16_inline_style_ptr_parsed(
          propertyPtr,
          propertyLen,
          valuePtr,
          valueLen,
        );
      wasm.free(propertyPtr, propertyLen << 1);
      wasm.free(valuePtr, valueLen << 1);
      if (transformedResult) {
        const [transformedStyleForCurrent, childStyleForCurrent] =
          transformedResult;
        transformedStyle = transformedStyle.concat(transformedStyleForCurrent);
        if (childStyleForCurrent) {
          childStyle = childStyle.concat(childStyleForCurrent);
        }
      } else {
        // If the transformation fails, we keep the original style
        transformedStyle.push([property, value]);
      }
    } catch (e) {
      wasm.free(propertyPtr, propertyLen << 1);
      wasm.free(valuePtr, valueLen << 1);
      throw e;
    }
  }
  return {
    childStyle,
    transformedStyle,
  };
}
