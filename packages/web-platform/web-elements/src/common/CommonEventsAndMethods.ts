// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { commonComponentEventSetting } from './commonEventInitConfiguration.js';
import { registerEventEnableStatusChangeHandler } from '@lynx-js/web-elements-reactive';

export class CommonEventsAndMethods {
  static readonly observedAttributes = [];

  readonly #dom: HTMLElement;

  #observing = false;
  #resizeObserver?: ResizeObserver;

  constructor(currentElement: HTMLElement) {
    this.#dom = currentElement;
  }

  @registerEventEnableStatusChangeHandler('layoutchange')
  __handleScrollUpperThresholdEventEnabled = (enabled: boolean) => {
    if (enabled) {
      if (!this.#resizeObserver) {
        this.#resizeObserver = new ResizeObserver(([entry]) => {
          if (entry) {
            // The layoutchange event is the border box of the element
            const { width, height, left, right, top, bottom } =
              entry.contentRect;
            const id = this.#dom.id;
            this.#dom.dispatchEvent(
              new CustomEvent('layoutchange', {
                detail: {
                  width,
                  height,
                  left,
                  right,
                  top,
                  bottom,
                  id,
                },
                ...commonComponentEventSetting,
              }),
            );
          }
        });
        if (!this.#observing) {
          this.#resizeObserver.observe(this.#dom);
          this.#observing = true;
        }
      }
    } else {
      this.#resizeObserver?.disconnect();
    }
  };
}
