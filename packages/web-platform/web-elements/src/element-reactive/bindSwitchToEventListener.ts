/**
// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { boostedQueueMicrotask } from './boostedQueueMicrotask.js';

export function bindSwitchToEventListener<T>(
  this: T,
  elementGetter: (this: T) => HTMLElement,
  eventName: keyof HTMLElementEventMap | string,
  eventListener: EventListener,
  options?: AddEventListenerOptions,
) {
  let listening = false;
  return function(this: T, enable: boolean) {
    if (enable !== listening) {
      const target = elementGetter.call(this);
      if (enable) {
        boostedQueueMicrotask(() =>
          target.addEventListener(eventName, eventListener, options)
        );
        listening = true;
      } else {
        boostedQueueMicrotask(() =>
          target.removeEventListener(eventName, eventListener)
        );
        listening = false;
      }
    }
  };
}
