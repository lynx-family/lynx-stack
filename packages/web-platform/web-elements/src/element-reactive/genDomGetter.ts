/**
// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
export type InternalDomGetter<T extends HTMLElement> = () => T;
export type PlainDomGetter<T extends HTMLElement> = () => T | null;

export function genDomGetter<T extends HTMLElement>(
  queryableElementGetter: () => ShadowRoot,
  selector: string,
): InternalDomGetter<T>;
export function genDomGetter<T extends HTMLElement>(
  queryableElementGetter: () => HTMLElement,
  selector: string,
): PlainDomGetter<T>;
export function genDomGetter<T extends HTMLElement>(
  queryableElementGetter: () => HTMLElement | ShadowRoot,
  selector: string,
): InternalDomGetter<T> | PlainDomGetter<T> {
  let dom: T | undefined;
  let queryTarget: HTMLElement | ShadowRoot;
  return () => {
    if (!queryTarget) queryTarget = queryableElementGetter();
    if (queryTarget.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      if (!dom) {
        dom = queryTarget.querySelector(selector) as T;
      }
    } else {
      dom = queryTarget.querySelector(selector) as T;
    }
    return dom!;
  };
}
