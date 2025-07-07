// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  type OneInfo,
  type StyleInfo,
  type CssOGInfo,
  type PageConfig,
  type CSSRule,
  cssIdAttribute,
  lynxTagAttribute,
  type LynxTemplate,
  lynxEntryNameAttribute,
  getLepusEntries,
  type MainThreadGlobalThis,
} from '@lynx-js/web-constants';
import { transformParsedStyles } from './tokenizer.js';
import type { MainThreadRuntimeConfig } from '../createMainThreadGlobalThis.js';

export function flattenStyleInfo(
  styleInfo: StyleInfo,
  enableCSSSelector: boolean,
): void {
  function flattenOneStyleInfo(cssId: string): OneInfo | undefined {
    const oneInfo = styleInfo[cssId];
    const imports = oneInfo?.imports;
    if (oneInfo && imports?.length) {
      for (const im of imports) {
        const flatInfo = flattenOneStyleInfo(im);
        if (flatInfo) {
          oneInfo.content.push(...flatInfo.content);
          // oneInfo.rules.push(...flatInfo.rules);
          oneInfo.rules.push(
            ...(enableCSSSelector
              ? flatInfo.rules
              // when enableCSSSelector is false, need to make a shallow copy of rules.sel
              // otherwise updating `oneCssInfo.sel` in `genCssOGInfo()` will affect other imported cssInfo
              : flatInfo.rules.map(i => ({ ...i }))),
          );
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
      const { transformedStyle, childStyle } = transformParsedStyles(
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
  isLazyComponent?: boolean,
): string {
  function getExtraSelectors(
    cssId?: string,
  ) {
    let prefix = '';
    if (!pageConfig.enableRemoveCSSScope) {
      if (cssId !== undefined) {
        prefix += `[${cssIdAttribute}="${cssId}"]`;
      } else {
        // To make sure the Specificity correct
        prefix += `[${lynxTagAttribute}]`;
      }
    } else {
      prefix += `[${lynxTagAttribute}]`;
    }
    return prefix;
  }
  const finalCssContent: string[] = [];
  for (const [cssId, cssInfos] of Object.entries(styleInfo)) {
    const prefix = getExtraSelectors(cssId);
    const declarationContent = cssInfos.rules.map((rule) => {
      const { sel: selectorList, decl: declarations } = rule;
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice
      const newSelectorList = isLazyComponent
        ? selectorList
        // card style needs to be added with :not([l-entry-name]) to filter non-lazy components
        : selectorList.map(([p, pc, pe, c, ...r]) => [
          p,
          [...pc, `:not([${lynxEntryNameAttribute}])`],
          pe,
          c,
          ...r,
        ]);
      const selectorString = newSelectorList.map(
        (selectors) => {
          return selectors.toSpliced(-4, 0, [prefix]).flat()
            .join('');
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
export function genCssOGInfo(styleInfo: StyleInfo): CssOGInfo {
  return Object.fromEntries(
    Object.entries(styleInfo).map(([cssId, cssInfos]) => {
      const oneCssOGInfo: Record<string, [string, string][]> = {};
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
            const currentDeclarations = oneCssOGInfo[selectorName];
            if (currentDeclarations) {
              currentDeclarations.push(...oneCssInfo.decl);
            } else {
              oneCssOGInfo[selectorName] = oneCssInfo.decl;
            }
            return false; // remove this selector from style info
          }
          return true;
        });
        return oneCssInfo.sel.length > 0;
      });
      return [cssId, oneCssOGInfo];
    }),
  );
}

type InsertStyleElementOptions =
  & Pick<
    MainThreadRuntimeConfig,
    'styleInfo' | 'pageConfig' | 'ssrHydrateInfo' | 'rootDom'
  >
  & {
    createElement: MainThreadRuntimeConfig['callbacks']['createElement'];
    isLazyComponent?: boolean;
  };

export function insertStyleElement(
  {
    styleInfo,
    pageConfig,
    ssrHydrateInfo,
    rootDom,
    createElement,
    isLazyComponent,
  }: InsertStyleElementOptions,
) {
  /**
   * now create the style content
   * 1. flatten the styleInfo
   * 2. transform the styleInfo to web css
   * 3. generate the css in js info
   * 4. create the style element
   * 5. append the style element to the root dom
   */
  flattenStyleInfo(
    styleInfo,
    pageConfig.enableCSSSelector,
  );
  transformToWebCss(styleInfo);
  const cssOGInfo: CssOGInfo = pageConfig.enableCSSSelector
    ? {}
    : genCssOGInfo(styleInfo);
  let cardStyleElement: HTMLStyleElement;
  if (ssrHydrateInfo?.cardStyleElement) {
    cardStyleElement = ssrHydrateInfo.cardStyleElement;
  } else {
    cardStyleElement = createElement(
      'style',
    ) as unknown as HTMLStyleElement;
    cardStyleElement.innerHTML = genCssContent(
      styleInfo,
      pageConfig,
      isLazyComponent,
    );
    rootDom.append(cardStyleElement);
  }
  const cardStyleElementSheet =
    (cardStyleElement as unknown as HTMLStyleElement).sheet!;

  return { cssOGInfo, cardStyleElementSheet };
}

interface ExecuteTemplateEntry {
  template: LynxTemplate;
  source: string;
  mtsGlobalThis: MainThreadGlobalThis;
  rootDom: MainThreadRuntimeConfig['rootDom'];
  createElement: MainThreadRuntimeConfig['callbacks']['createElement'];
}

export async function executeTemplateEntry(
  { template, rootDom, createElement, source, mtsGlobalThis }:
    ExecuteTemplateEntry,
) {
  const { lepusCode, styleInfo, pageConfig } = template;
  insertStyleElement({
    styleInfo,
    pageConfig,
    ssrHydrateInfo: undefined,
    rootDom,
    createElement,
    isLazyComponent: true,
  });
  const { entry } = await getLepusEntries(
    lepusCode,
    // The same template will only be executed once, and there is no async chunk yet, so caching the lazy component module is meaningless.
    {},
  );
  const lepusVal = entry!(mtsGlobalThis) as (schema: string) => void;
  mtsGlobalThis.globalThis?.processEvalResult?.(lepusVal, source);
}
