/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  bindToStyle,
  genDomGetter,
  registerAttributeHandler,
} from '@lynx-js/web-elements-reactive';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';
import type { ScrollView } from './ScrollView.js';
import { bindToIntersectionObserver } from '../common/bindToIntersectionObserver.js';
import { useScrollEnd } from '../common/constants.js';
import { registerEventEnableStatusChangeHandler } from '@lynx-js/web-elements-reactive';

export class ScrollViewEvents
  implements InstanceType<AttributeReactiveClass<typeof ScrollView>>
{
  readonly #dom: ScrollView;
  #debounceScrollForMockingScrollEnd?: NodeJS.Timeout;
  #prevX: number = 0;
  #prevY: number = 0;
  constructor(dom: ScrollView) {
    this.#dom = dom;
  }

  #getScrollContainer = () => this.#dom;

  #getUpperThresholdObserverDom = genDomGetter(
    () => this.#dom.shadowRoot!,
    '#upper-threshold-observer',
  );

  #getLowerThresholdObserverDom = genDomGetter(
    () => this.#dom.shadowRoot!,
    '#lower-threshold-observer',
  );

  #handleObserver = (entries: IntersectionObserverEntry[]) => {
    const { isIntersecting, target } = entries[0]!;
    const id = target.id;
    if (isIntersecting) {
      if (id === 'upper-threshold-observer') {
        this.#dom.dispatchEvent(
          new CustomEvent('scrolltoupper', {
            ...commonComponentEventSetting,
            detail: this.#getScrollDetail(),
          }),
        );
      } else if (id === 'lower-threshold-observer') {
        this.#dom.dispatchEvent(
          new CustomEvent('scrolltolower', {
            ...commonComponentEventSetting,
            detail: this.#getScrollDetail(),
          }),
        );
      }
    }
  };

  static observedAttributes = [
    'upper-threshold',
    'lower-threshold',
  ];

  @registerEventEnableStatusChangeHandler('scrolltoupper')
  #handleScrollUpperThresholdEventEnabled = (enabled: boolean) => {
    enabled
      ? this.#dom.setAttribute('x-enable-scrolltoupper-event', '')
      : this.#dom.removeAttribute('x-enable-scrolltoupper-event'); // css needs this;
    this.#updateUpperIntersectionObserver(enabled);
  };

  #updateUpperIntersectionObserver = bindToIntersectionObserver(
    this.#getScrollContainer,
    this.#getUpperThresholdObserverDom,
    this.#handleObserver,
  );

  @registerEventEnableStatusChangeHandler('scrolltolower')
  #handleScrollLowerThresholdEventEnabled = (enabled: boolean) => {
    enabled
      ? this.#dom.setAttribute('x-enable-scrolltolower-event', '')
      : this.#dom.removeAttribute('x-enable-scrolltolower-event'); // css needs this;
    this.#updateLowerIntersectionObserver(enabled);
  };

  #updateLowerIntersectionObserver = bindToIntersectionObserver(
    this.#getScrollContainer,
    this.#getLowerThresholdObserverDom,
    this.#handleObserver,
  );

  @registerAttributeHandler('upper-threshold', true)
  #updateUpperThreshold = bindToStyle(
    this.#getUpperThresholdObserverDom,
    'flex-basis',
    (v) => `${parseInt(v)}px`,
  );

  @registerAttributeHandler('lower-threshold', true)
  #updateLowerThreshold = bindToStyle(
    this.#getLowerThresholdObserverDom,
    'flex-basis',
    (v) => `${parseInt(v)}px`,
  );

  #getScrollDetail() {
    let { scrollTop, scrollLeft, scrollHeight, scrollWidth } = this
      .#getScrollContainer();
    if (scrollTop === 0) {
      scrollTop -= this.#dom.scrollHeight / 2 - this.#dom.scrollTop;
    }
    if (scrollLeft === 0) {
      scrollLeft -= this.#dom.scrollWidth / 2 - this.#dom.scrollLeft;
    }
    const detail = {
      scrollTop,
      scrollLeft,
      scrollHeight,
      scrollWidth,
      isDragging: false,
      deltaX: scrollLeft - this.#prevX,
      deltaY: scrollTop - this.#prevY,
    };
    this.#prevX = scrollLeft;
    this.#prevY = scrollTop;
    return detail;
  }

  #handleScroll = () => {
    if (this.#scrollEndEventEnabled && !useScrollEnd) {
      // debounce
      clearTimeout(this.#debounceScrollForMockingScrollEnd);
      this.#debounceScrollForMockingScrollEnd = setTimeout(() => {
        this.#handleScrollEnd();
      }, 100);
    }
    this.#dom.dispatchEvent(
      new CustomEvent('lynxscroll', {
        ...commonComponentEventSetting,
        detail: this.#getScrollDetail(),
      }),
    );
  };

  #handleScrollEnd = () => {
    this.#dom.dispatchEvent(
      new CustomEvent('lynxscrollend', {
        ...commonComponentEventSetting,
        detail: this.#getScrollDetail(),
      }),
    );
  };

  #scrollEventEnabled = false;
  @registerEventEnableStatusChangeHandler('lynxscroll')
  #handleScrollEventEnabled = (enabled: boolean) => {
    this.#scrollEventEnabled = enabled;
    this.#handleScrollEventsSwitches();
  };

  #scrollEndEventEnabled = false;
  @registerEventEnableStatusChangeHandler('lynxscrollend')
  #handleScrollEndEventEnabled = (enabled: boolean) => {
    this.#scrollEndEventEnabled = enabled;
    this.#handleScrollEventsSwitches();
  };

  #handleScrollEventsSwitches() {
    if (this.#scrollEventEnabled || this.#scrollEndEventEnabled) {
      this.#getScrollContainer().addEventListener('scroll', this.#handleScroll);
      this.#getScrollContainer().addEventListener(
        'scrollend',
        this.#handleScrollEnd,
      );
      this.#dom.addEventListener('scroll', this.#handleScroll);
      this.#dom.addEventListener('scrollend', this.#handleScrollEnd);
      this.#prevX = 0;
      this.#prevY = 0;
    } else {
      this.#dom.removeEventListener('scroll', this.#handleScroll);
      this.#dom.removeEventListener('scrollend', this.#handleScrollEnd);
    }
  }

  connectedCallback?(): void {}
  dispose(): void {}
}
