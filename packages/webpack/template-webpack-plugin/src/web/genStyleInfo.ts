// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { CSSRule, OneInfo, StyleInfo } from './StyleInfo.js';
import * as CSS from '../css/index.js';

export function genStyleInfo(
  cssMap: Record<string, CSS.LynxStyleNode[]>,
): StyleInfo {
  return Object.fromEntries(
    Object.entries(cssMap).map(([cssId, nodes]) => {
      /**
       * note that "0" implies it's a common style
       */
      const contentsAtom: string[] = [];
      const imports: string[] = [];
      const rules: CSSRule[] = [];
      for (const node of nodes) {
        if (node.type === 'FontFaceRule') {
          contentsAtom.push(
            [
              '@font-face {',
              node.style.map((declaration) =>
                `${declaration.name}:${declaration.value}`
              ).join(';'),
              '}',
            ].join(''),
          );
        } else if (node.type === 'ImportRule') {
          imports.push(node.href);
        } else if (node.type === 'KeyframesRule') {
          contentsAtom.push(
            [
              `@keyframes ${node.name.value} {`,
              node.styles.map((keyframesStyle) =>
                `${keyframesStyle.keyText.value} {${
                  keyframesStyle.style.map((declaration) =>
                    `${declaration.name}:${declaration.value};`
                  ).join('')
                }}`
              ).join(' '),
              '}',
            ].join(''),
          );
        } else if (node.type === 'StyleRule') {
          const ast = CSS.csstree.parse(
            `${node.selectorText.value}{ --mocked-declaration:1;}`,
          ) as CSS.csstree.StyleSheet;
          const selectors = ((ast.children.first as CSS.csstree.Rule)
            .prelude as CSS.csstree.SelectorList).children
            .toArray() as CSS.csstree.Selector[];
          const groupedSelectors: CSSRule['sel'] = [];
          for (const selectorList of selectors) {
            let plainSelectors: string[] = [];
            let pseudoClassSelectors: string[] = [];
            let pseudoElementSelectors: string[] = [];
            const currentSplitSelectorInfo: string[][] = [];
            for (const selector of selectorList.children.toArray()) {
              if (
                selector.type === 'PseudoClassSelector'
                && selector.name === 'root'
              ) {
                /**
                 * [aa]:root {
                 * }
                 * ===>
                 * [aa][lynx-tag="page"] {
                 * }
                 */
                plainSelectors.push('[lynx-tag="page"]');
              } else if (selector.type === 'PseudoClassSelector') {
                pseudoClassSelectors.push(CSS.csstree.generate(selector));
              } else if (selector.type === 'PseudoElementSelector') {
                pseudoElementSelectors.push(CSS.csstree.generate(selector));
              } else if (selector.type === 'TypeSelector') {
                plainSelectors.push(`[lynx-tag="${selector.name}"]`);
              } else if (selector.type === 'Combinator') {
                currentSplitSelectorInfo.push(
                  plainSelectors,
                  pseudoClassSelectors,
                  pseudoElementSelectors,
                  [CSS.csstree.generate(selector)],
                );
                plainSelectors = [];
                pseudoClassSelectors = [];
                pseudoElementSelectors = [];
              } else {
                plainSelectors.push(CSS.csstree.generate(selector));
              }
            }
            currentSplitSelectorInfo.push(
              plainSelectors,
              pseudoClassSelectors,
              pseudoElementSelectors,
              [],
            );
            groupedSelectors.push(currentSplitSelectorInfo);
          }
          const decl = node.style.map<[string, string]>((
            declaration,
          ) => [
            declaration.name,
            declaration.value.replaceAll(/\{\{--([^}]+)\}\}/g, 'var(--$1)'),
          ]);

          decl.push(...(Object.entries(node.variables)));

          rules.push({
            sel: groupedSelectors,
            decl,
          });
        }
      }
      const info: OneInfo = {
        content: [contentsAtom.join('\n')],
        rules,
      };
      if (imports.length > 0) {
        info.imports = imports;
      }
      return [cssId, info];
    }),
  );
}
