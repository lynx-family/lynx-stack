/**
// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { boostedQueueMicrotask } from './boostedQueueMicrotask.js';

export type BindToStyleProxy<T> = ReturnType<typeof bindToStyle<T>>;

export function bindToStyle<T>(
  this: T,
  elementGetter: (this: T) => HTMLElement,
  styleName: string,
  valProcessor?: (value: string) => string,
  important?: boolean,
) {
  return function(this: T, newVal: string | null) {
    if (newVal) {
      if (valProcessor) newVal = valProcessor(newVal);
      boostedQueueMicrotask(() =>
        elementGetter
          .call(this)
          .style.setProperty(
            styleName,
            newVal,
            important ? 'important' : undefined,
          )
      );
    } else {
      boostedQueueMicrotask(() =>
        elementGetter.call(this).style.removeProperty(styleName)
      );
    }
  };
}
