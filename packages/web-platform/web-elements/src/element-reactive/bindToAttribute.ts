/**
// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { boostedQueueMicrotask } from './boostedQueueMicrotask.js';

export type BindToAttributeProxy<T> = ReturnType<typeof bindToAttribute<T>>;

export function bindToAttribute<T>(
  this: T,
  elementGetter: (this: T) => HTMLElement,
  attributeName: string,
  valProcessor?: (value: string | null) => string | null,
) {
  return function(this: T, newVal: string | null) {
    if (valProcessor) newVal = valProcessor(newVal);
    const target = elementGetter.call(this);
    const currentAttribute = target.getAttribute(attributeName);
    if (currentAttribute !== newVal) {
      if (newVal !== null) {
        boostedQueueMicrotask(() => {
          target.setAttribute(attributeName, newVal);
        });
      } else {
        boostedQueueMicrotask(() => {
          target.removeAttribute(attributeName);
        });
      }
    }
  };
}
