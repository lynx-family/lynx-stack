import { wasm } from '@lynx-js/web-style-transformer';
let HEAPU16: Uint16Array | undefined;

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
