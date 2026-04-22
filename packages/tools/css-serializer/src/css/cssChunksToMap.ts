// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { cssToAst } from './ast.js';
import { debundleCSS } from './debundle.js';
import type { LynxStyleNode } from '../types/LynxStyleNode.js';
import type { Plugin } from '../types/Plugin.js';

interface CSSChunkAsset {
  content: string;
}

/**
 * Convert CSS chunks into `cssMap` / `cssSource`.
 *
 * `loc` fields remain in bundle CSS coordinates so they can be resolved later
 * via `main.css.map`.
 *
 * `cssSource` intentionally keeps the historical `/cssId/<id>.css` shape.
 */
export function cssChunksToMap(
  cssChunks: Array<string | CSSChunkAsset>,
  plugins: Plugin[],
  enableCSSSelector: boolean,
): {
  cssMap: Record<string, LynxStyleNode[]>;
  cssSource: Record<string, string>;
  contentMap: Map<number, string[]>;
} {
  const cssMap = cssChunks
    .reduce<Map<number, string[]>>((cssMap, cssChunk) => {
      const normalizedCSSChunk = normalizeCSSChunk(cssChunk);
      const debundledMap = new Map<number, string[]>();

      debundleCSS(
        normalizedCSSChunk.content,
        debundledMap,
        enableCSSSelector,
        true,
      );

      debundledMap.forEach((content, cssId) => {
        if (!cssMap.has(cssId)) {
          cssMap.set(cssId, []);
        }

        cssMap.get(cssId)!.push(...content);
      });

      return cssMap;
    }, new Map());

  const stylesheets = Array.from(cssMap.entries()).map(
    ([cssId, content]) => {
      const [root] = cssToAst(content.join('\n'), plugins);

      root.forEach(rule => {
        if (rule.type === 'ImportRule') {
          // For example: '/981029' -> '981029'
          rule.href = rule.href.replace('/', '');
        }
      });

      return {
        cssId,
        root,
        cssSource: `/cssId/${cssId}.css`,
        content,
      };
    },
  );

  return {
    cssMap: Object.fromEntries(
      stylesheets.map(({ cssId, root }) => [cssId, root]),
    ),
    cssSource: Object.fromEntries(
      stylesheets.map(({ cssId, cssSource }) => [cssId, cssSource]),
    ),
    contentMap: cssMap,
  };
}

function normalizeCSSChunk(cssChunk: string | CSSChunkAsset): CSSChunkAsset {
  if (typeof cssChunk === 'string') {
    return {
      content: cssChunk,
    };
  }

  return cssChunk;
}
