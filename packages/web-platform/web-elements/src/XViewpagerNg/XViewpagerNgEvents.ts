/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  genDomGetter,
  registerAttributeHandler,
} from '@lynx-js/web-elements-reactive';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';
import type { XViewpagerNg } from './XViewpagerNg.js';
import { useScrollEnd } from '../common/constants.js';

export class XViewpagerNgEvents
  implements InstanceType<AttributeReactiveClass<typeof XViewpagerNg>>
{
  static observedAttributes = [
    'x-enable-change-event',
    'x-enable-offsetchange-event',
  ];
  readonly #dom: XViewpagerNg;
  #isDragging: boolean = false;
  #connected = false;
  #currentIndex = 0;
  #enableChange = false;
  #debounceScrollForMockingScrollEnd?: ReturnType<typeof setTimeout>;

  constructor(dom: XViewpagerNg) {
    this.#dom = dom;
  }

  #getScrollContainer = genDomGetter(() => this.#dom.shadowRoot!, '#content');

  #scrollHandler = () => {
    if (!this.#connected) return;

    const scrollContainer = this.#getScrollContainer();
    const oneItemWidth = this.#dom.clientWidth;
    const scrollLeft = scrollContainer.scrollLeft;
    const innerOffset = scrollLeft / oneItemWidth;

    if (this.#enableChange && !useScrollEnd) {
      // debounce
      clearTimeout(this.#debounceScrollForMockingScrollEnd);
      this.#debounceScrollForMockingScrollEnd = setTimeout(() => {
        this.#scrollEndHandler();
      }, 100);
    }

    this.#dom.dispatchEvent(
      new CustomEvent('offsetchange', {
        ...commonComponentEventSetting,
        detail: { offset: innerOffset },
      }),
    );
  };

  #scrollEndHandler = () => {
    if (this.#connected) {
      const scrollContainer = this.#getScrollContainer();
      const oneItemWidth = this.#dom.clientWidth;
      const scrollLeft = scrollContainer.scrollLeft;
      const currentIndex = Math.floor(scrollLeft / oneItemWidth);
      if (currentIndex !== this.#currentIndex) {
        this.#dom.dispatchEvent(
          new CustomEvent('change', {
            ...commonComponentEventSetting,
            detail: { index: currentIndex, isDragged: this.#isDragging },
          }),
        );
        this.#currentIndex = currentIndex;
      }
    }
  };

  #touchStartHandler = () => {
    this.#isDragging = true;
  };
  #touchEndHandler = () => {
    this.#isDragging = false;
  };

  @registerAttributeHandler('x-enable-change-event', true)
  @registerAttributeHandler('x-enable-offsetchange-event', true)
  #enableScrollEventListener() {
    this.#enableChange =
      this.#dom.getAttribute('x-enable-change-event') !== null;
    const enableOffsetChange =
      this.#dom.getAttribute('x-enable-offsetchange-event') !== null;

    const scrollContainer = this.#getScrollContainer();
    if (enableOffsetChange !== null || this.#enableChange) {
      scrollContainer.addEventListener(
        'scroll',
        this.#scrollHandler,
        {
          passive: true,
        },
      );
    } else {
      scrollContainer.removeEventListener(
        'scroll',
        this.#scrollHandler,
      );
    }

    if (useScrollEnd && this.#enableChange) {
      scrollContainer.addEventListener(
        'scrollend',
        this.#scrollEndHandler,
        {
          passive: true,
        },
      );
    } else {
      scrollContainer.removeEventListener(
        'scrollend',
        this.#scrollEndHandler,
      );
    }
  }

  connectedCallback(): void {
    this.#connected = true;
    const scrollContainer = this.#getScrollContainer();
    this.#dom.addEventListener('touchstart', this.#touchStartHandler, {
      passive: true,
    });
    scrollContainer.addEventListener('touchend', this.#touchEndHandler, {
      passive: true,
    });
    scrollContainer.addEventListener('touchcancel', this.#touchEndHandler, {
      passive: true,
    });
  }

  dispose(): void {
    const scrollContainer = this.#getScrollContainer();
    scrollContainer.removeEventListener('scroll', this.#scrollHandler);
    scrollContainer.removeEventListener('scrollend', this.#scrollEndHandler);
  }
}
