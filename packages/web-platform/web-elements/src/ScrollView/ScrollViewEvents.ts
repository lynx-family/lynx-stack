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

export class ScrollViewEvents
  implements InstanceType<AttributeReactiveClass<typeof ScrollView>>
{
  readonly #dom: ScrollView;
  #enableScrollEnd = false;
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
    'x-enable-scrolltoupper-event',
    'x-enable-scrolltolower-event',
    'x-enable-scroll-event',
    'x-enable-scrollend-event',
    'upper-threshold',
    'lower-threshold',
  ];

  @registerAttributeHandler('x-enable-scrolltoupper-event', true)
  #updateUpperIntersectionObserver = bindToIntersectionObserver(
    this.#getScrollContainer,
    this.#getUpperThresholdObserverDom,
    this.#handleObserver,
  );

  @registerAttributeHandler('x-enable-scrolltolower-event', true)
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
    if (this.#enableScrollEnd && !useScrollEnd) {
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

  @registerAttributeHandler('x-enable-scroll-event', true)
  @registerAttributeHandler('x-enable-scrollend-event', true)
  #handleScrollEventsSwitches() {
    const scroll = this.#dom.getAttribute('x-enable-scroll-event');
    this.#enableScrollEnd =
      this.#dom.getAttribute('x-enable-scrollend-event') !== null;
    if (scroll !== null || this.#enableScrollEnd) {
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
