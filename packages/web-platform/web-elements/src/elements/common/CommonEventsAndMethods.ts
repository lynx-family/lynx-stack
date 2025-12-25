// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { commonComponentEventSetting } from './commonEventInitConfiguration.js';
import { registerEventEnableStatusChangeHandler } from '../../element-reactive/index.js';

export const layoutChangeTarget = Symbol('layoutChangeTarget');

export class CommonEventsAndMethods {
  static readonly observedAttributes = [];

  readonly #dom: HTMLElement & { [layoutChangeTarget]?: HTMLElement };

  constructor(
    currentElement: HTMLElement & { [layoutChangeTarget]?: HTMLElement },
  ) {
    this.#dom = currentElement;
  }

  #resizeObserving = false;
  #resizeObserver?: ResizeObserver;
  @registerEventEnableStatusChangeHandler('layoutchange')
  __handleScrollUpperThresholdEventEnabled = (enabled: boolean) => {
    if (enabled && this.#dom[layoutChangeTarget]) {
      if (!this.#resizeObserver) {
        this.#resizeObserver = new ResizeObserver(([entry]) => {
          if (entry) {
            const id = this.#dom.id;
            // Reuse getBoundingClientRect to get left and top, because ResizeObserver-contentRect is calculated based on padding box
            const { top, bottom, left, right, width, height } = entry.target
              .getBoundingClientRect();
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
        if (!this.#resizeObserving) {
          this.#resizeObserver.observe(this.#dom[layoutChangeTarget]);
          this.#resizeObserving = true;
        }
      }
    } else {
      this.#resizeObserver?.disconnect();
      this.#resizeObserver = undefined;
      this.#resizeObserving = false;
    }
  };

  dispose() {
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = undefined;
    this.#resizeObserving = false;
  }
}
