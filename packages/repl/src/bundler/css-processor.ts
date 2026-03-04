// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as csstree from 'css-tree';

import type { CSSRule, OneInfo, StyleInfo } from '@lynx-js/web-constants';

// --- Simplified parse (adapted from css-serializer/parse.ts) ---

interface Declaration {
  name: string;
  value: string;
}

interface VariableDeclaration extends Declaration {
  type: 'css_var';
  defaultValue?: string;
  defaultValueMap?: Record<string, string>;
}

type CSSDeclaration = Declaration | VariableDeclaration;

interface StyleRule {
  type: 'StyleRule';
  selectorText: { value: string };
  variables: Record<string, string>;
  style: CSSDeclaration[];
}

interface FontFaceRule {
  type: 'FontFaceRule';
  style: CSSDeclaration[];
}

interface KeyframesRule {
  type: 'KeyframesRule';
  name: { value: string };
  styles: { keyText: { value: string }; style: CSSDeclaration[] }[];
}

type LynxStyleNode = StyleRule | FontFaceRule | KeyframesRule;

function transformDeclaration(node: csstree.Declaration): CSSDeclaration {
  let hasVarFunction = false;

  csstree.walk(node, (n) => {
    if (n.type === 'Function' && n.name === 'var') {
      hasVarFunction = true;
    }
  });

  if (hasVarFunction) {
    const defaultValueMap: Record<string, string> = {};
    let hasDefaultValue = true;

    const valueNode = csstree.clone(node) as csstree.Declaration;
    csstree.walk(valueNode, (n, item) => {
      if (n.type === 'Function' && n.name === 'var') {
        const varFunctionValues = n.children.toArray();
        const varName = varFunctionValues[0]?.type === 'Identifier'
          ? varFunctionValues[0].name
          : undefined;
        item.data = {
          ...n,
          type: 'Raw',
          value: ` {{${varName}}}${item.next === null ? '' : ' '}`,
        };
      }
    });

    csstree.walk(node, (n, item) => {
      if (n.type === 'Function' && n.name === 'var') {
        const varFunctionValues = n.children.toArray();
        const varName = varFunctionValues[0]?.type === 'Identifier'
          ? varFunctionValues[0].name
          : undefined;
        const firstOperator = varFunctionValues[1]?.type === 'Operator'
          ? varFunctionValues[1].value
          : undefined;
        const varDefaultValueNodes = varFunctionValues.slice(2);

        if (!varName || (firstOperator && firstOperator !== ',')) {
          throw new Error(`illegal css value ${csstree.generate(n)}`);
        }
        if (varDefaultValueNodes.length > 0) {
          const currentDefaultValueText = varDefaultValueNodes
            .map(node => csstree.generate(node))
            .join('');
          defaultValueMap[varName] = currentDefaultValueText;
          item.data = {
            ...n,
            type: 'Raw',
            value: currentDefaultValueText,
          };
        } else {
          hasDefaultValue = false;
          defaultValueMap[varName] = '';
        }
      }
    });

    return {
      type: 'css_var',
      name: node.property,
      value: csstree.generate(valueNode.value).trim()
        + (node.important ? ' !important' : ''),
      defaultValue: hasDefaultValue
        ? csstree.generate(node.value).trim()
        : '',
      defaultValueMap,
    };
  }

  return {
    name: node.property,
    value: csstree.generate(node.value) + (node.important ? ' !important' : ''),
  };
}

function transformBlock(block: csstree.Block): CSSDeclaration[] {
  const declarations = block.children.toArray().filter(
    (node) => node.type === 'Declaration' && !node.property.startsWith('--'),
  ) as csstree.Declaration[];
  return declarations.map((e) => transformDeclaration(e));
}

function parseCSS(content: string): LynxStyleNode[] {
  const result: LynxStyleNode[] = [];
  const ast = csstree.parse(content, {
    parseValue: true,
    parseAtrulePrelude: true,
    parseCustomProperty: true,
    parseRulePrelude: true,
    positions: true,
    filename: './index.css',
  }) as csstree.StyleSheet;

  // First pass: flatten nested rules and handle URLs/comments
  csstree.walk(ast, {
    enter: function(
      this: csstree.WalkContext,
      node: csstree.CssNode,
      item: csstree.ListItem<csstree.CssNode>,
      list: csstree.List<csstree.CssNode>,
    ) {
      if (node.type === 'Url') {
        item.data = {
          ...node,
          type: 'Raw',
          value: `url('${node.value}')`,
        };
      } else if (node.type === 'Comment') {
        list.remove(item);
      } else if (node.type === 'Rule') {
        const parent = node;
        node.block?.children.filter(node => node.type === 'Raw').forEach(
          (child, childItem, childList) => {
            childList.remove(childItem);
            const childAst = csstree.parse(child.value, {
              positions: true,
              ...child.loc?.start,
            });
            csstree.walk(childAst, (subParseChild, subParseChildItem) => {
              if (subParseChild.type === 'Rule') {
                if (
                  subParseChild.prelude.type === 'SelectorList'
                  && parent.prelude.type === 'SelectorList'
                ) {
                  const parentSelectorList = parent.prelude
                    .children as csstree.List<csstree.Selector>;
                  (subParseChild.prelude.children as csstree.List<
                    csstree.Selector
                  >).forEach((selector) => {
                    selector.children.prependData({
                      ...selector,
                      type: 'WhiteSpace',
                      value: ' ',
                    });
                    selector.children.prependList(parentSelectorList.copy());
                  });
                }
                if (item.next) {
                  list.insert(subParseChildItem, item.next);
                } else {
                  list.append(subParseChildItem);
                }
              }
            });
          },
        );
      }
    },
  });

  // Second pass: extract style nodes
  csstree.walk(ast, {
    enter: function(
      this: csstree.WalkContext,
      node: csstree.CssNode,
    ): symbol | undefined {
      if (node.type === 'Atrule') {
        if (node.name === 'font-face') {
          result.push({
            type: 'FontFaceRule',
            style: transformBlock(node.block!),
          });
          return this.skip;
        } else if (node.name === 'keyframes') {
          if (!node.block) return;
          result.push({
            type: 'KeyframesRule',
            name: {
              value: node.prelude ? csstree.generate(node.prelude) : '',
            },
            styles: node.block.children.toArray().filter(node =>
              node.type === 'Rule'
            ).map(rule => {
              return {
                keyText: {
                  value: csstree.generate(rule.prelude),
                },
                style: transformBlock(rule.block),
              };
            }),
          });
          return this.skip;
        }
        // Skip @import and other at-rules (not supported in REPL)
        return this.skip;
      } else if (node.type === 'Rule') {
        const preludeText = csstree.generate(node.prelude);
        result.push({
          type: 'StyleRule',
          style: transformBlock(node.block),
          selectorText: { value: preludeText },
          variables: Object.fromEntries(
            node.block.children.toArray().filter(node =>
              node.type === 'Declaration' && node.property.startsWith('--')
            ).map((node) => {
              return [
                (node as csstree.Declaration).property,
                csstree.generate((node as csstree.Declaration).value)
                + ((node as csstree.Declaration).important
                  ? ' !important'
                  : ''),
              ];
            }),
          ),
        });
        return this.skip;
      }
    },
  });

  return result;
}

// --- genStyleInfo (adapted from template-webpack-plugin/src/web/genStyleInfo.ts) ---

function genStyleInfo(
  cssMap: Record<string, LynxStyleNode[]>,
): StyleInfo {
  return Object.fromEntries(
    Object.entries(cssMap).map(([cssId, nodes]) => {
      const contentsAtom: string[] = [];
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
          const ast = csstree.parse(
            `${node.selectorText.value}{ --mocked-declaration:1;}`,
          ) as csstree.StyleSheet;
          const selectors = ((ast.children.first as csstree.Rule)
            .prelude as csstree.SelectorList).children
            .toArray() as csstree.Selector[];
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
                plainSelectors.push('[lynx-tag="page"]');
              } else if (selector.type === 'PseudoClassSelector') {
                pseudoClassSelectors.push(csstree.generate(selector));
              } else if (selector.type === 'PseudoElementSelector') {
                if (selector.name === 'placeholder') {
                  pseudoClassSelectors.push('::part(input)::placeholder');
                } else {
                  pseudoElementSelectors.push(csstree.generate(selector));
                }
              } else if (selector.type === 'TypeSelector') {
                plainSelectors.push(`[lynx-tag="${selector.name}"]`);
              } else if (selector.type === 'Combinator') {
                currentSplitSelectorInfo.push(
                  plainSelectors,
                  pseudoClassSelectors,
                  pseudoElementSelectors,
                  [csstree.generate(selector)],
                );
                plainSelectors = [];
                pseudoClassSelectors = [];
                pseudoElementSelectors = [];
              } else {
                plainSelectors.push(csstree.generate(selector));
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
      return [cssId, info];
    }),
  );
}

// --- Public API ---

export function processCSS(cssString: string): StyleInfo {
  const nodes = parseCSS(cssString);
  return genStyleInfo({ '0': nodes });
}
