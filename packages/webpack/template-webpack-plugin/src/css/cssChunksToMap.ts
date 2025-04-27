// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type * as CSS from '@lynx-js/css-serializer';

import { cssToAst } from './ast.js';
import { debundleCSS } from './debundle.js';

export function cssChunksToMap(
  cssChunks: string[],
  plugins: CSS.Plugin[],
  enableCSSSelector: boolean,
): {
  cssMap: Record<string, CSS.LynxStyleNode[]>;
  cssSource: Record<string, string>;
  contentMap: Map<number, string[]>;
} {
  const cssMap = cssChunks
    .reduce<Map<number, string[]>>((cssMap, css) => {
      debundleCSS(css, cssMap, enableCSSSelector);
      return cssMap;
    }, new Map());

  return {
    cssMap: Object.fromEntries(
      Array.from(cssMap.entries()).map(([cssId, content]) => {
        const [root] = cssToAst(content.join('\n'), plugins);

        root.forEach(rule => {
          if (rule.type === 'ImportRule') {
            // For example: '/981029' -> '981029'
            rule.href = rule.href.replace('/', '');
          }
        });

        return [cssId, root];
      }),
    ),
    cssSource: Object.fromEntries(
      Array.from(cssMap.keys()).map(cssId => [
        cssId,
        `/cssId/${cssId}.css`,
      ]),
    ),
    contentMap: cssMap,
  };
}
