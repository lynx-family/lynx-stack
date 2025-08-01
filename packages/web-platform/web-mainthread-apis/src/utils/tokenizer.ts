import { wasm } from '@lynx-js/web-style-transformer';
export function transformInlineStyleString(str: string): string {
  console.log(0, str);
  // const { ptr, len } = stringToUTF16(str);
  try {
    console.log('start parse', str);
    const res = wasm.transform_inline_style(str) ?? str;

    // const transformedStyle = wasm.transform_raw_u16_inline_style_ptr(ptr, len)
    //   ?? str;
    // wasm.free(ptr, len << 1);
    console.log('return-value', res);
    return res;
  } catch (e) {
    // wasm.free(ptr, len << 1);
    throw e;
  }
}

export function transformParsedStyles(
  styles: [string, string][],
): { childStyle: [string, string][]; transformedStyle: [string, string][] } {
  let childStyle: [string, string][] = [];
  let transformedStyle: [string, string][] = [];
  for (const [property, value] of styles) {
    // const { ptr: propertyPtr, len: propertyLen } = stringToUTF16(property);
    // const { ptr: valuePtr, len: valueLen } = stringToUTF16(value);
    try {
      const transformedResult = wasm
        .transform_raw_u16_inline_style_ptr_parsed(
          // propertyPtr,
          // propertyLen,
          property,
          property.length,
          // valuePtr,
          // valueLen,
          value,
          value.length,
        );
      // wasm.free(propertyPtr, propertyLen << 1);
      // wasm.free(valuePtr, valueLen << 1);
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
      // wasm.free(propertyPtr, propertyLen << 1);
      // wasm.free(valuePtr, valueLen << 1);
      throw e;
    }
  }
  return {
    childStyle,
    transformedStyle,
  };
}
