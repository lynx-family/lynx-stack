/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  genDomGetter,
} from '@lynx-js/web-elements-reactive';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';
import type { XViewpagerNg } from './XViewpagerNg.js';
import { useScrollEnd } from '../common/constants.js';
import { registerEventEnableStatusChangeHandler } from '@lynx-js/web-elements-reactive';

export class XViewpagerNgEvents
  implements InstanceType<AttributeReactiveClass<typeof XViewpagerNg>>
{
  static observedAttributes = [];
  readonly __dom: XViewpagerNg;
  __isDragging: boolean = false;
  __connected = false;
  __currentIndex = 0;
  __debounceScrollForMockingScrollEnd?: ReturnType<typeof setTimeout>;

  constructor(dom: XViewpagerNg) {
    this.__dom = dom;
  }

  __getScrollContainer = genDomGetter(
    () => this.__dom.shadowRoot!,
    '__content',
  );

  __scrollHandler = () => {
    if (!this.__connected) return;

    const scrollContainer = this.__getScrollContainer();
    const oneItemWidth = this.__dom.clientWidth;
    const scrollLeft = scrollContainer.scrollLeft;
    const innerOffset = scrollLeft / oneItemWidth;

    if (this.__enableChange && !useScrollEnd) {
      // debounce
      clearTimeout(this.__debounceScrollForMockingScrollEnd);
      this.__debounceScrollForMockingScrollEnd = setTimeout(() => {
        this.__scrollEndHandler();
      }, 100);
    }

    this.__dom.dispatchEvent(
      new CustomEvent('offsetchange', {
        ...commonComponentEventSetting,
        detail: { offset: innerOffset },
      }),
    );
  };

  __scrollEndHandler = () => {
    if (this.__connected) {
      const scrollContainer = this.__getScrollContainer();
      const oneItemWidth = this.__dom.clientWidth;
      const scrollLeft = scrollContainer.scrollLeft;
      const currentIndex = Math.floor(scrollLeft / oneItemWidth);
      if (currentIndex !== this.__currentIndex) {
        this.__dom.dispatchEvent(
          new CustomEvent('change', {
            ...commonComponentEventSetting,
            detail: { index: currentIndex, isDragged: this.__isDragging },
          }),
        );
        this.__currentIndex = currentIndex;
      }
    }
  };

  __touchStartHandler = () => {
    this.__isDragging = true;
  };
  __touchEndHandler = () => {
    this.__isDragging = false;
  };

  __enableChange = false;
  @registerEventEnableStatusChangeHandler('change')
  __enableChangeEvent(status: boolean) {
    this.__enableChange = status;
    this.__enableScrollEventListener();
  }

  __enableOffsetChange: boolean = false;
  @registerEventEnableStatusChangeHandler('offsetchange')
  __enableOffsetChangeEvent(status: boolean) {
    this.__enableChange = status;
    this.__enableScrollEventListener();
  }
  __enableScrollEventListener() {
    const scrollContainer = this.__getScrollContainer();
    if (this.__enableOffsetChange || this.__enableChange) {
      scrollContainer.addEventListener(
        'scroll',
        this.__scrollHandler,
        {
          passive: true,
        },
      );
    } else {
      scrollContainer.removeEventListener(
        'scroll',
        this.__scrollHandler,
      );
    }

    if (useScrollEnd && this.__enableChange) {
      scrollContainer.addEventListener(
        'scrollend',
        this.__scrollEndHandler,
        {
          passive: true,
        },
      );
    } else {
      scrollContainer.removeEventListener(
        'scrollend',
        this.__scrollEndHandler,
      );
    }
  }

  connectedCallback(): void {
    this.__connected = true;
    const scrollContainer = this.__getScrollContainer();
    this.__dom.addEventListener('touchstart', this.__touchStartHandler, {
      passive: true,
    });
    scrollContainer.addEventListener('touchend', this.__touchEndHandler, {
      passive: true,
    });
    scrollContainer.addEventListener('touchcancel', this.__touchEndHandler, {
      passive: true,
    });
  }

  dispose(): void {
    const scrollContainer = this.__getScrollContainer();
    scrollContainer.removeEventListener('scroll', this.__scrollHandler);
    scrollContainer.removeEventListener('scrollend', this.__scrollEndHandler);
  }
}
