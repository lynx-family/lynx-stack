/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import * as csstree from 'css-tree';

import { generateHref } from './generateHref.js';
import { toLoc } from './toLoc.js';
import { toString } from './toString.js';
import type { Declaration, LynxStyleNode } from './types/LynxStyleNode.js';
import { Severity } from './types/Plugin.js';
import type { ParserError, Plugin } from './types/Plugin.js';

function transformDeclaration(
  node: csstree.Declaration,
  errors: ParserError[],
): Declaration {
  let hasVarFunction = false;
  const defaultValueMap: Record<string, string> = {};

  csstree.walk(node, (node) => {
    if (node.type === 'Function' && node.name === 'var') {
      hasVarFunction = true;
    }
  });
  if (hasVarFunction) {
    let hasDefaultValue = true;
    const valueNode = csstree.clone(node) as csstree.Declaration;
    csstree.walk(valueNode, (node, item) => {
      if (node.type === 'Function' && node.name === 'var') {
        hasVarFunction = true;
        const varFunctionValues = node.children.toArray();
        const varName = varFunctionValues[0]?.type === 'Identifier'
          ? varFunctionValues[0].name
          : undefined;
        item.data = {
          ...node,
          type: 'Raw',
          value: ` {{${varName}}}${item.next !== null ? ' ' : ''}`,
        };
      }
    });
    csstree.walk(node, (node, item) => {
      if (node.type === 'Function' && node.name === 'var') {
        hasVarFunction = true;
        const varFunctionValues = node.children.toArray();
        const varName = varFunctionValues[0]?.type === 'Identifier'
          ? varFunctionValues[0].name
          : undefined;
        const firstOperator = varFunctionValues[1]?.type === 'Operator'
          ? varFunctionValues[1].value
          : undefined;
        const varDefaultValueNode = varFunctionValues[2];
        /**
         * check if it is nested var
         */
        const location = `${node.loc!.source}@${node.loc!.end.line}:${
          node.loc!.end.column
        }`;

        if (varDefaultValueNode) {
          let hasNestedVar = false;
          csstree.walk(varDefaultValueNode, (node) => {
            if (node.type === 'Function' && node.name === 'var') {
              hasNestedVar = true;
            }
          });
          if (hasNestedVar) {
            errors.push({
              name: 'nested var',
              severity: Severity.Error,
              message: `nested var() is not allowed in Lynx`,
              range: node.loc!,
            });
          }
        }
        if (!varName || (firstOperator && firstOperator !== ',')) {
          throw new Error(`illegal css value ${toString(node)} ${location}`);
        }
        if (varDefaultValueNode) {
          const currentDefaultValueText = toString(varDefaultValueNode);
          defaultValueMap[varName] = currentDefaultValueText;
          item.data = {
            ...node,
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
      value: toString(valueNode.value).trim()
        + (node.important ? ' !important' : ''),
      defaultValue: hasDefaultValue ? toString(node.value).trim() : '',
      defaultValueMap,
      keyLoc: toLoc(node.loc!.start, node.property.length),
      valLoc: toLoc(node.value.loc!.end, 1),
    };
  } else {
    return {
      name: node.property,
      value: toString(node.value) + (node.important ? ' !important' : ''),
      keyLoc: toLoc(node.loc!.start, node.property.length),
      valLoc: toLoc(node.value.loc!.end, 1),
    };
  }
}

export function transformBlock(
  block: csstree.Block,
  errors: ParserError[],
): Declaration[] {
  const declarations: csstree.Declaration[] = block.children.toArray().filter(
    (node) => {
      return node.type === 'Declaration' && !node.property.startsWith('--');
    },
  ) as csstree.Declaration[];
  return declarations.map((e) => transformDeclaration(e, errors));
}

export function parse(content: string, options: {
  enableCSSSelector?: boolean;
  plugins?: Plugin[];
  filename?: string;
  projectRoot?: string;
} = { enableCSSSelector: true }): {
  root: LynxStyleNode[];
  errors: ParserError[];
} {
  const errors: ParserError[] = [];
  const result: LynxStyleNode[] = [];
  const report = (error: ParserError) => errors.push(error);
  const { filename = './index.css', projectRoot = '/', plugins = [] } = options;
  const ast = csstree.parse(content, {
    parseValue: true,
    parseAtrulePrelude: true,
    parseCustomProperty: true,
    parseRulePrelude: true,
    positions: true,
    filename,
  }) as csstree.StyleSheet;
  for (const plugin of plugins) {
    plugin.phaseStandard?.(ast, {
      report,
    });
  }
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
                item.next
                  ? list.insert(subParseChildItem, item.next)
                  : list.append(subParseChildItem);
              }
            });
          },
        );
      }
    },
  });
  csstree.walk(ast, {
    enter: function(
      this: csstree.WalkContext,
      node: csstree.CssNode,
    ): symbol | void {
      if (node.type === 'Atrule') {
        if (node.name === 'font-face') {
          result.push({
            type: 'FontFaceRule',
            style: transformBlock(node.block!, errors),
          });
          return this.skip;
        } else if (node.name === 'keyframes') {
          if (!node.block) {
            report({
              severity: Severity.Error,
              name: 'illegal',
              message: `illegal keyframes at ${options.filename}`,
              range: {
                start: toLoc(node.loc!.start),
                end: toLoc(node.loc!.end),
              },
            });
            return;
          }
          result.push({
            type: 'KeyframesRule',
            name: {
              value: node.prelude ? toString(node.prelude) : '',
              loc: node.prelude
                ? toLoc(node.prelude.loc!.end)
                : toLoc(node.loc!.start),
            },
            styles: node.block.children.toArray().filter(node =>
              node.type === 'Rule'
            ).map(rule => {
              const preludeText = toString(rule.prelude);
              return {
                keyText: {
                  value: preludeText,
                  loc: toLoc(rule.prelude.loc!.start, preludeText.length),
                },
                style: transformBlock(rule.block, errors),
              };
            }),
          });
          return this.skip;
        } else if (node.name === 'import') {
          let origin = '';
          if (node.prelude) {
            if (
              node.prelude.type === 'AtrulePrelude'
              && node.prelude.children.first?.type === 'Url'
            ) {
              origin = node.prelude.children.first.value;
            } else {
              const str = toString(node.prelude);
              if (str.startsWith('url(')) {
                origin = str.substring(5, str.length - 2);
              } else {
                origin = JSON.parse(str);
              }
            }
          }
          result.push({
            type: 'ImportRule',
            origin,
            href: generateHref(projectRoot, filename, origin),
          });
          return this.skip;
        }
        return this.skip;
      } else if (node.type === 'Rule') {
        const preludeText = toString(node.prelude);
        result.push({
          type: 'StyleRule',
          style: transformBlock(node.block, errors),
          selectorText: {
            value: options.enableCSSSelector
              ? preludeText
              // When enableCSSSelector is disabled, remove backslash escapes to ensure CSS selector compatibility.
              // For example, TailwindCSS generates selectors like `.h-\\[370px\\]` which require unescaping.
              : preludeText
                .replaceAll('\\[', '[')
                .replaceAll('\\]', ']')
                .replaceAll('\\#', '#'),
            loc: toLoc(node.prelude.loc!.end),
          },
          variables: Object.fromEntries(
            node.block.children.toArray().filter(node =>
              node.type === 'Declaration' && node.property.startsWith('--')
            ).map((node) => {
              return [
                (node as csstree.Declaration).property,
                toString((node as csstree.Declaration).value)
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
  return {
    root: result,
    errors,
  };
}
