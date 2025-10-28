// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  type StyleInfo,
  type CssOGInfo,
  type PageConfig,
  type CSSRule,
  cssIdAttribute,
  lynxTagAttribute,
  type SSRHydrateInfo,
  lynxUniqueIdAttribute,
  lynxEntryNameAttribute,
  type FlattenedStyleInfo,
  type FlattenedOneInfo,
} from '@lynx-js/web-constants';
import { transformParsedStyles } from './tokenizer.js';
import { decodeCssOG } from './decodeCssOG.js';

function topologicalSort(
  styleInfo: StyleInfo,
): string[] {
  /**
   * kahn's algorithm
   * 1. The styleInfo is already equivalent to a adjacency list. (cssId, import)
   * 2. The styleInfo is a DAG therefore we don't need to do cyclic detection
   */
  const queue: string[] = [];
  const inDegreeMap = new Map<string, number>();
  for (const [cssId, oneStyleInfo] of Object.entries(styleInfo)) {
    !inDegreeMap.has(cssId) && inDegreeMap.set(cssId, 0); // initialize
    for (const importCssId of oneStyleInfo.imports ?? []) {
      const currentInDegree = inDegreeMap.get(importCssId) ?? 0;
      inDegreeMap.set(importCssId, currentInDegree + 1);
    }
  }
  for (const [cssId, inDegree] of inDegreeMap.entries()) {
    if (inDegree === 0) {
      queue.push(cssId);
    }
  }
  const sortedCssIds: string[] = [];
  while (queue.length > 0) {
    const currentCssId = queue.shift()!;
    sortedCssIds.push(currentCssId);
    const currentAdjunction = styleInfo[currentCssId]?.imports;
    if (currentAdjunction) {
      for (const importCssId of currentAdjunction) {
        const importInDegree = inDegreeMap.get(importCssId)! - 1;
        inDegreeMap.set(importCssId, importInDegree);
        if (importInDegree === 0) {
          queue.push(importCssId);
        }
      }
    }
  }
  return sortedCssIds;
}
function generateImportByMap(
  styleInfo: StyleInfo,
  sortedCssIds: string[],
): Map<string, Set<string>> {
  const cssIdToImportBy = new Map<string, Set<string>>();
  for (const cssId of sortedCssIds) {
    const currentAdjunction = styleInfo[cssId]?.imports;
    if (currentAdjunction) {
      const currentImportBy = cssIdToImportBy.get(cssId) ?? new Set([cssId]);
      for (const importCssId of currentAdjunction) {
        const importDeps = cssIdToImportBy.get(importCssId)
          ?? new Set([importCssId]);
        importDeps.add(cssId);
        cssIdToImportBy.set(importCssId, currentImportBy.union(importDeps));
      }
      cssIdToImportBy.set(cssId, currentImportBy);
    }
  }
  return cssIdToImportBy;
}
/**
 * get Transitive Closure of a Direct Acyclic Graph (DAG)
 * 1. for each css, find all the imported by css files (directly and indirectly)
 * 2. for each css, find all the importing css files (directly and indirectly)
 * 3. return the flattened style info, do not modify the content and rules
 */
export function flattenStyleInfo(
  styleInfo: StyleInfo,
): FlattenedStyleInfo {
  // Step 1. Topological sorting
  const sortedCssIds = topologicalSort(styleInfo);

  // Step 2. generate deps;
  const cssIdToImportBy = generateImportByMap(styleInfo, sortedCssIds);
  sortedCssIds.reverse();

  // Step 3. generate the flattened style info
  return sortedCssIds.map(cssId => {
    const oneInfo = styleInfo[cssId];
    const flattenedInfo: FlattenedOneInfo = oneInfo
      ? {
        content: oneInfo.content,
        rules: oneInfo.rules,
        importBy: Array.from(cssIdToImportBy.get(cssId) ?? [cssId]),
      }
      : {
        content: [],
        rules: [],
        importBy: [cssId],
      };
    return flattenedInfo;
  });
}

/**
 * apply the lynx css -> web css transformation
 */
export function transformToWebCss(styleInfo: FlattenedStyleInfo) {
  for (const cssInfos of styleInfo) {
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
  styleInfo: FlattenedStyleInfo,
  pageConfig: PageConfig,
  entryName?: string,
): string {
  function getExtraSelectors(
    cssId: string,
  ) {
    let suffix;
    if (!pageConfig.enableRemoveCSSScope) {
      suffix = `[${cssIdAttribute}="${cssId}"]`;
    } else {
      suffix = `[${lynxTagAttribute}]`;
    }
    if (entryName) {
      suffix = `${suffix}[${lynxEntryNameAttribute}=${
        JSON.stringify(entryName)
      }]`;
    } else {
      suffix = `${suffix}:not([${lynxEntryNameAttribute}])`;
    }
    return suffix;
  }
  const finalCssContent: string[] = [];
  for (const cssInfos of styleInfo) {
    const declarationContent = cssInfos.rules.map((rule) => {
      const { sel: selectorList, decl: declarations } = rule;
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice
      const selectorString = cssInfos.importBy.map(cssId => {
        const suffix = getExtraSelectors(cssId);
        return selectorList.map(
          (selectors) => {
            return selectors.toSpliced(-4, 0, [suffix]).flat().join('');
          },
        ).join(',');
      }).join(',');
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
export function genCssOGInfo(styleInfo: FlattenedStyleInfo): CssOGInfo {
  const cssOGInfo: CssOGInfo = {};
  for (const oneInfo of styleInfo) {
    oneInfo.rules = oneInfo.rules.filter(oneRule => {
      oneRule.sel = oneRule.sel.filter(selectorList => {
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
          for (const cssId of oneInfo.importBy) {
            if (!cssOGInfo[cssId]) {
              cssOGInfo[cssId] = {};
            }
            const currentDeclarations = cssOGInfo[cssId][selectorName];
            if (currentDeclarations) {
              currentDeclarations.push(...oneRule.decl);
            } else {
              cssOGInfo[cssId][selectorName] = oneRule.decl;
            }
          }

          return false; // remove this selector from style info
        }
        return true;
      });
      return oneRule.sel.length > 0;
    });
  }
  return cssOGInfo;
}

export function appendStyleElement(
  styleInfo: StyleInfo,
  pageConfig: PageConfig,
  rootDom: Node,
  document: Document,
  ssrHydrateInfo?: SSRHydrateInfo,
) {
  const lynxUniqueIdToStyleRulesIndex: number[] =
    ssrHydrateInfo?.lynxUniqueIdToStyleRulesIndex ?? [];
  /**
   * now create the style content
   * 1. flatten the styleInfo
   * 2. transform the styleInfo to web css
   * 3. generate the css in js info
   * 4. create the style element
   * 5. append the style element to the root dom
   */
  const flattenedStyleInfo = flattenStyleInfo(
    styleInfo,
  );
  transformToWebCss(flattenedStyleInfo);
  const cssOGInfo: CssOGInfo = pageConfig.enableCSSSelector
    ? {}
    : genCssOGInfo(flattenedStyleInfo);
  const lazyCSSOGInfo: Record<string, CssOGInfo> = {};
  let cardStyleElement: HTMLStyleElement;
  if (ssrHydrateInfo?.cardStyleElement) {
    cardStyleElement = ssrHydrateInfo.cardStyleElement;
  } else {
    cardStyleElement = document.createElement(
      'style',
    ) as unknown as HTMLStyleElement;
    cardStyleElement.textContent = genCssContent(
      flattenedStyleInfo,
      pageConfig,
      undefined,
    );
    rootDom.appendChild(cardStyleElement);
  }
  const updateCssOGStyle: (
    uniqueId: number,
    newClassName: string,
    cssID: string | null,
    entryName: string | null,
  ) => void = (uniqueId, newClassName, cssID, entryName) => {
    const cardStyleElementSheet =
      (cardStyleElement as unknown as HTMLStyleElement).sheet!;
    const styleMap = entryName && lazyCSSOGInfo[entryName]
      ? lazyCSSOGInfo[entryName]
      : cssOGInfo;
    const newStyles = decodeCssOG(newClassName, styleMap, cssID);
    if (lynxUniqueIdToStyleRulesIndex[uniqueId] !== undefined) {
      const rule = cardStyleElementSheet
        .cssRules[lynxUniqueIdToStyleRulesIndex[uniqueId]] as CSSStyleRule;
      rule.style.cssText = newStyles;
    } else {
      const index = cardStyleElementSheet.insertRule(
        `[${lynxUniqueIdAttribute}="${uniqueId}"]{${newStyles}}`,
        cardStyleElementSheet.cssRules.length,
      );
      lynxUniqueIdToStyleRulesIndex[uniqueId] = index;
    }
  };
  const updateLazyComponentStyle = (
    styleInfo: StyleInfo,
    entryName: string,
  ) => {
    const flattenedStyleInfo = flattenStyleInfo(styleInfo);
    transformToWebCss(flattenedStyleInfo);
    if (!pageConfig.enableCSSSelector) {
      lazyCSSOGInfo[entryName] = genCssOGInfo(flattenedStyleInfo);
    }
    const newStyleSheet = genCssContent(
      flattenedStyleInfo,
      pageConfig,
      entryName,
    );
    cardStyleElement.textContent += newStyleSheet;
  };
  return { updateCssOGStyle, updateLazyComponentStyle };
}
