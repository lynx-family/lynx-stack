// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as CSS from '@lynx-js/css-serializer';

import type { CSSMediaRule, CSSRule, OneInfo, StyleInfo } from './StyleInfo.js';

function restoreCSSVarValue(declaration: CSS.Declaration): string {
  return declaration.value.replaceAll(
    /\{\{(--[^}]+)\}\}/g,
    (_, varName: string) => {
      const isCSSVarDecl = 'type' in declaration
        && declaration.type === 'css_var';

      if (!isCSSVarDecl) {
        return `var(${varName})`;
      }

      const fallback = declaration.defaultValueMap?.[varName];
      return fallback ? `var(${varName}, ${fallback})` : `var(${varName})`;
    },
  );
}

function genFontFaceContent(node: CSS.FontFaceRule): string {
  return [
    '@font-face {',
    node.style.map((declaration) => `${declaration.name}:${declaration.value}`)
      .join(';'),
    '}',
  ].join('');
}

function genKeyframesContent(node: CSS.KeyframesRule): string {
  return [
    `@keyframes ${node.name.value} {`,
    node.styles.map((keyframesStyle) =>
      `${keyframesStyle.keyText.value} {${
        keyframesStyle.style.map((declaration) =>
          `${declaration.name}:${declaration.value};`
        ).join('')
      }}`
    ).join(' '),
    '}',
  ].join('');
}

function genStyleRule(node: CSS.StyleRule): CSSRule {
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
        /**
         * [aa]::placeholder {
         * }
         * ===>
         * [aa]::part(input)::placeholder {
         * }
         */
        if (selector.name === 'placeholder') {
          pseudoClassSelectors.push('::part(input)::placeholder');
        } else {
          pseudoElementSelectors.push(CSS.csstree.generate(selector));
        }
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
    restoreCSSVarValue(declaration),
  ]);

  decl.push(...(Object.entries(node.variables)));

  return {
    sel: groupedSelectors,
    decl,
  };
}

/**
 * Collects `nodes` into `rules` and `contentsAtom`.
 *
 * `mediaQueries` are the preludes of the `@media` groups enclosing `nodes`,
 * outermost first. Style rules keep their nesting as {@link CSSMediaRule}s, so
 * the runtime can transform their selectors and values; `@font-face` and
 * `@keyframes` are plain text in `content`, so they are wrapped in their
 * enclosing groups there.
 */
function genRules(
  nodes: CSS.LynxStyleNode[],
  mediaQueries: string[],
  contentsAtom: string[],
  imports: string[],
): (CSSRule | CSSMediaRule)[] {
  const wrapInMedia = (content: string) =>
    mediaQueries.reduceRight(
      (inner, mediaQuery) => `@media ${mediaQuery} {${inner}}`,
      content,
    );
  const rules: (CSSRule | CSSMediaRule)[] = [];
  for (const node of nodes) {
    if (node.type === 'FontFaceRule') {
      contentsAtom.push(wrapInMedia(genFontFaceContent(node)));
    } else if (node.type === 'ImportRule') {
      // `@import` is only meaningful at the top level of a stylesheet.
      if (mediaQueries.length === 0) {
        imports.push(node.href);
      }
    } else if (node.type === 'KeyframesRule') {
      contentsAtom.push(wrapInMedia(genKeyframesContent(node)));
    } else if (node.type === 'StyleRule') {
      rules.push(genStyleRule(node));
    } else if (node.type === 'MediaRule') {
      rules.push({
        media: node.prelude.value,
        rules: genRules(
          node.rules,
          [...mediaQueries, node.prelude.value],
          contentsAtom,
          imports,
        ),
      });
    }
  }
  return rules;
}

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
      const rules = genRules(nodes, [], contentsAtom, imports);
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
