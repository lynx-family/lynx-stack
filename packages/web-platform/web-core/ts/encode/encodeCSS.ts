import * as CSS from '@lynx-js/css-serializer';
import {
  RawStyleInfo,
  Rule,
  RulePrelude,
  Selector,
  // @ts-ignore
} from '../../binary/encode/encode.js';
// @ts-ignore
export * from '../../binary/encode/encode.js';
import { pushStyleNodes } from '../common/css/buildRawStyleInfo.js';

export function encodeCSS(
  cssMap: Record<string, CSS.LynxStyleNode[]>,
): Uint8Array {
  const rawStyleInfo = new RawStyleInfo();
  const wasm = { Rule, RulePrelude, Selector };

  for (const [cssId, nodes] of Object.entries(cssMap)) {
    const parsedCssId = Number(cssId);
    if (isNaN(parsedCssId)) {
      throw new Error(
        `Invalid cssId: ${cssId}. cssId should be a valid number string.`,
      );
    }

    pushStyleNodes(rawStyleInfo, wasm, parsedCssId, nodes, {
      // `@media` / `@supports` / `@layer` have no counterpart in the binary
      // format and have always been skipped here.
      onGroupAtRule: () => {},
      onNonNumericImport: (node) => {
        throw new Error(
          `Invalid importCssId: ${node.href}. importCssId should be a valid number string.`,
        );
      },
    });
  }

  return rawStyleInfo.encode();
}
