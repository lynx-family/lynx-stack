// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  type OneInfo,
  type StyleInfo,
  type CssInJsInfo,
  type PageConfig,
  type CSSRule,
  cssIdAttribute,
  lynxTagAttribute,
} from '@lynx-js/web-constants';
import { transformLynxStyles } from '@lynx-js/web-style-transformer';

export function flattenStyleInfo(
  styleInfo: StyleInfo,
): void {
  function flattenOneStyleInfo(cssId: string): OneInfo | undefined {
    const oneInfo = styleInfo[cssId];
    const imports = oneInfo?.imports;
    if (oneInfo && imports?.length) {
      for (const im of imports) {
        const flatInfo = flattenOneStyleInfo(im);
        if (flatInfo) {
          oneInfo.content.push(...flatInfo.content);
          oneInfo.rules.push(...flatInfo.rules);
        }
      }
      oneInfo.imports = undefined;
    }
    return oneInfo;
  }
  Object.keys(styleInfo).map((cssId) => {
    flattenOneStyleInfo(cssId);
  });
}

/**
 * apply the lynx css -> web css transformation
 */
export function transformToWebCss(styleInfo: StyleInfo) {
  for (const cssInfos of Object.values(styleInfo)) {
    for (const rule of cssInfos.rules) {
      const { sel: selectors, decl: declarations } = rule;
      const { transformedStyle, childStyle } = transformLynxStyles(
        declarations,
      );
      rule.decl = transformedStyle;
      if (childStyle.length > 0) {
        cssInfos.rules.push({
          sel: selectors.map(selector =>
            selector.toSpliced(
              -2,
              1,
              /* replace the last combinator and insert at the end */
              ['>'],
              ['*'],
              [],
              [],
              [],
            )
          ) as CSSRule['sel'],
          decl: childStyle,
        });
      }
    }
  }
}

/**
 * generate those styles applied by <style>...</style>
 */
export function genCssContent(
  styleInfo: StyleInfo,
  pageConfig: PageConfig,
): string {
  function getExtraSelectors(
    cssId?: string,
  ) {
    let suffix = '';
    if (!pageConfig.enableRemoveCSSScope) {
      if (cssId !== undefined) {
        suffix += `[${cssIdAttribute}="${cssId}"]`;
      } else {
        // To make sure the Specificity correct
        suffix += `[${lynxTagAttribute}]`;
      }
    } else {
      suffix += `[${lynxTagAttribute}]`;
    }
    return suffix;
  }
  const finalCssContent: string[] = [];
  for (const [cssId, cssInfos] of Object.entries(styleInfo)) {
    const suffix = getExtraSelectors(cssId);
    const declarationContent = cssInfos.rules.map((rule) => {
      const { sel: selectorList, decl: declarations } = rule;
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice
      const selectorString = selectorList.map(
        (selectors) => {
          return selectors.toSpliced(-4, 0, [suffix]).join('');
        },
      ).join(',');
      const declarationString = declarations.map(([k, v]) => `${k}:${v};`).join(
        '',
      );
      return `${selectorString}{${declarationString}}`;
    }).join('');
    finalCssContent.push(...cssInfos.content, declarationContent);
  }
  return finalCssContent.join('\n');
}

/**
 * generate the css-in-js data
 */
export function genCssInJsInfo(styleInfo: StyleInfo): CssInJsInfo {
  return Object.fromEntries(
    Object.entries(styleInfo).map(([cssId, cssInfos]) => {
      const oneCssInJsInfo: Record<string, [string, string][]> = {};
      cssInfos.rules = cssInfos.rules.filter(oneCssInfo => {
        oneCssInfo.sel = oneCssInfo.sel.filter(selectorList => {
          const [
            classSelectors,
            pseudoClassSelectors,
            pseudoElementSelectors,
            combinator,
          ] = selectorList;
          if (
            // only one class selector
            classSelectors.length === 1 && classSelectors[0]![0] === '.'
            && pseudoClassSelectors.length === 0
            && pseudoElementSelectors.length === 0
            && combinator.length === 0
          ) {
            const selectorName = classSelectors[0]!.substring(1);
            const currentDeclarations = oneCssInJsInfo[selectorName];
            if (currentDeclarations) {
              currentDeclarations.push(...oneCssInfo.decl);
            } else {
              oneCssInJsInfo[selectorName] = oneCssInfo.decl;
            }
            return false; // remove this selector from style info
          }
          return true;
        });
        return oneCssInfo.sel.length > 0;
      });
      return [cssId, oneCssInJsInfo];
    }),
  );
}
