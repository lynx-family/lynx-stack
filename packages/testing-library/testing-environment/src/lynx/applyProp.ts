// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { LynxElement } from './ElementPAPI.js';

// Element PAPI 方法在测试环境初始化后全局可用（由 __injectElementApi() 注入）
// 签名直接对应 ElementPAPI.ts 中 ElementTree class 的方法定义
declare var __SetClasses: (e: LynxElement, cls: string) => void;
declare var __SetInlineStyles: (
  e: LynxElement,
  styles: string | Record<string, string>,
) => void;
declare var __SetID: (e: LynxElement, id: string) => void;
declare var __SetAttribute: (e: LynxElement, key: string, value: any) => void;
declare var __AddDataset: (e: LynxElement, key: string, value: string) => void;

/**
 * Dispatch a string-keyed prop to the correct Element PAPI method.
 *
 * Mirrors the updateSpread() dispatch logic in the runtime. Used by framework
 * adapters operating in non-compiled mode, where the renderer writes raw DOM
 * properties (className, style, id, data-*, etc.) to Lynx elements.
 *
 * @public
 */
export function applyProp(el: LynxElement, key: string, value: unknown): void {
  // Style: shimBSI generates 'style:cssText' and 'style:<prop>' keys
  if (key === 'style:cssText' || key === 'style') {
    __SetInlineStyles(el, (value ?? '') as string | Record<string, string>);
    return;
  }
  if (key.startsWith('style:')) {
    const prop = key.slice(6);
    __SetInlineStyles(el, { [prop]: (value ?? '') as string });
    return;
  }
  if (key === 'className' || key === 'class') {
    __SetClasses(el, (value ?? '') as string);
    return;
  }
  if (key === 'id') {
    __SetID(el, (value ?? '') as string);
    return;
  }
  if (key === 'htmlFor') {
    __SetAttribute(el, 'for', value as string | null);
    return;
  }
  if (key.startsWith('data-')) {
    __AddDataset(el, key.slice(5), (value ?? '') as string);
    return;
  }
  // Skip event/internal/ref keys — forbidden by __SetAttribute
  if (key.startsWith('on') || key.startsWith('__') || key === '_listeners') {
    return;
  }
  if (key === 'ref' || key === 'key') return;
  // Boolean → string conversion
  if (key === 'translate') {
    __SetAttribute(el, key, value ? 'yes' : 'no');
    return;
  }
  if (value === true) {
    __SetAttribute(el, key, '');
    return;
  }
  if (value == null || value === false) {
    __SetAttribute(el, key, null);
    return;
  }
  __SetAttribute(el, key, typeof value === 'string' ? value : String(value));
}
