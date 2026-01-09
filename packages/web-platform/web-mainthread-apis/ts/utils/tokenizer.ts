import { wasm } from '../../wasm/index.js';
export function transformInlineStyleString(str: string): string {
  return wasm.transform_raw_u16_inline_style_ptr(str) ?? str;
}

export function transformParsedStyles(
  styles: [string, string][],
): { childStyle: [string, string][]; transformedStyle: [string, string][] } {
  let childStyle: [string, string][] = [];
  let transformedStyle: [string, string][] = [];
  for (const [property, value] of styles) {
    const transformedResult = wasm
      .transform_raw_u16_inline_style_ptr_parsed(
        property,
        value,
      );
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
  }
  return {
    childStyle,
    transformedStyle,
  };
}
