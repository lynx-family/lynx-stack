// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { cssIdAttribute, type CssInJsInfo } from '@lynx-js/web-constants';
import hyphenateStyleName from 'hyphenate-style-name';
import { queryCSSProperty } from './cssPropertyMap.js';
import { decodeCssInJs } from '../../utils/decodeCssInJs.js';
import {
  transformInlineStyleString,
  transfromParsedStyles,
} from './transformInlineStyle.js';
import {
  elementToRuntimeInfoMap,
  updateCSSInJsStyle,
  type MainThreadRuntime,
} from '../../MainThreadRuntime.js';

export function createStyleFunctions(
  runtime: MainThreadRuntime,
  cssInJsInfo: CssInJsInfo,
) {
  function __AddClass(
    element: HTMLElement,
    className: string,
  ) {
    const newClassName = ((element.className ?? '') + ' ' + className)
      .trim();
    element.setAttribute('class', newClassName);
    if (!runtime.config.pageConfig.enableCSSSelector) {
      const newStyleStr = decodeCssInJs(
        newClassName,
        cssInJsInfo,
        element.getAttribute(cssIdAttribute),
      );
      runtime[updateCSSInJsStyle](
        runtime[elementToRuntimeInfoMap].get(element)!.uniqueId,
        newStyleStr,
      );
    }
  }
  function __SetClasses(
    element: HTMLElement,
    classNames: string | null,
  ): void {
    classNames
      ? element.setAttribute('class', classNames)
      : element.removeAttribute('class');
    if (!runtime.config.pageConfig.enableCSSSelector) {
      const newStyleStr = decodeCssInJs(
        classNames ?? '',
        cssInJsInfo,
        element.getAttribute(cssIdAttribute),
      );
      runtime[updateCSSInJsStyle](
        runtime[elementToRuntimeInfoMap].get(element)!.uniqueId,
        newStyleStr ?? '',
      );
    }
  }

  function __GetClasses(element: HTMLElement) {
    return (element.className ?? '').split(' ').filter(e => e);
  }
  function __AddInlineStyle(
    element: HTMLElement,
    key: number | string,
    value: string | number | null | undefined,
  ): void {
    let dashName: string | undefined;
    if (typeof key === 'number') {
      const queryResult = queryCSSProperty(key);
      dashName = queryResult.dashName;
      if (queryResult.isX) {
        console.error(
          `[lynx-web] css property: ${dashName} is not supported.`,
        );
      }
    } else {
      dashName = key;
    }
    const valueStr = typeof value === 'number' ? value.toString() : value;
    if (!valueStr) { // null or undefined
      element.style.removeProperty(dashName);
    } else {
      const { transformedStyle } = transfromParsedStyles([[
        dashName,
        valueStr,
      ]]);
      for (const [property, value] of transformedStyle) {
        element.style.setProperty(property, value);
      }
    }
  }

  function __SetInlineStyles(
    element: HTMLElement,
    value: string | Record<string, string> | undefined,
  ) {
    if (!value) return;
    const { transformedStyle } = typeof value === 'string'
      ? transformInlineStyleString(value)
      : transfromParsedStyles(
        Object.entries(value).map(([k, value]) => [
          hyphenateStyleName(k),
          value,
        ]),
      );
    const style = element.style;
    style.cssText = '';
    for (const [property, value] of transformedStyle) {
      const important = value.includes('!important');
      const cleanValue = important
        ? value.replace('!important', '').trim()
        : value;
      style.setProperty(property, cleanValue, important ? 'important' : '');
    }
  }

  function __SetCSSId(
    elements: (HTMLElement)[],
    cssId: string | number,
  ) {
    cssId = cssId.toString();
    for (const element of elements) {
      element.setAttribute(cssIdAttribute, cssId);
      if (!runtime.config.pageConfig.enableCSSSelector) {
        const cls = element.getAttribute('class');
        cls && __SetClasses(element, cls);
      }
    }
  }

  return {
    __AddClass,
    __SetClasses,
    __GetClasses,
    __AddInlineStyle,
    __SetInlineStyles,
    __SetCSSId,
  };
}
