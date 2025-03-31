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
  readonly __dom: ScrollView;
  __debounceScrollForMockingScrollEnd?: NodeJS.Timeout;
  __prevX: number = 0;
  __prevY: number = 0;
  constructor(dom: ScrollView) {
    this.__dom = dom;
  }

  __getScrollContainer = () => this.__dom;

  __getUpperThresholdObserverDom = genDomGetter(
    () => this.__dom.shadowRoot!,
    '__upper-threshold-observer',
  );

  __getLowerThresholdObserverDom = genDomGetter(
    () => this.__dom.shadowRoot!,
    '__lower-threshold-observer',
  );

  __handleObserver = (entries: IntersectionObserverEntry[]) => {
    const { isIntersecting, target } = entries[0]!;
    const id = target.id;
    if (isIntersecting) {
      if (id === 'upper-threshold-observer') {
        this.__dom.dispatchEvent(
          new CustomEvent('scrolltoupper', {
            ...commonComponentEventSetting,
            detail: this.__getScrollDetail(),
          }),
        );
      } else if (id === 'lower-threshold-observer') {
        this.__dom.dispatchEvent(
          new CustomEvent('scrolltolower', {
            ...commonComponentEventSetting,
            detail: this.__getScrollDetail(),
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
  __handleScrollUpperThresholdEventEnabled = (enabled: boolean) => {
    enabled
      ? this.__dom.setAttribute('x-enable-scrolltoupper-event', '')
      : this.__dom.removeAttribute('x-enable-scrolltoupper-event'); // css needs this;
    this.__updateUpperIntersectionObserver(enabled);
  };

  __updateUpperIntersectionObserver = bindToIntersectionObserver(
    this.__getScrollContainer,
    this.__getUpperThresholdObserverDom,
    this.__handleObserver,
  );

  @registerEventEnableStatusChangeHandler('scrolltolower')
  __handleScrollLowerThresholdEventEnabled = (enabled: boolean) => {
    enabled
      ? this.__dom.setAttribute('x-enable-scrolltolower-event', '')
      : this.__dom.removeAttribute('x-enable-scrolltolower-event'); // css needs this;
    this.__updateLowerIntersectionObserver(enabled);
  };

  __updateLowerIntersectionObserver = bindToIntersectionObserver(
    this.__getScrollContainer,
    this.__getLowerThresholdObserverDom,
    this.__handleObserver,
  );

  @registerAttributeHandler('upper-threshold', true)
  __updateUpperThreshold = bindToStyle(
    this.__getUpperThresholdObserverDom,
    'flex-basis',
    (v) => `${parseInt(v)}px`,
  );

  @registerAttributeHandler('lower-threshold', true)
  __updateLowerThreshold = bindToStyle(
    this.__getLowerThresholdObserverDom,
    'flex-basis',
    (v) => `${parseInt(v)}px`,
  );

  __getScrollDetail() {
    let { scrollTop, scrollLeft, scrollHeight, scrollWidth } = this
      .__getScrollContainer();
    if (scrollTop === 0) {
      scrollTop -= this.__dom.scrollHeight / 2 - this.__dom.scrollTop;
    }
    if (scrollLeft === 0) {
      scrollLeft -= this.__dom.scrollWidth / 2 - this.__dom.scrollLeft;
    }
    const detail = {
      scrollTop,
      scrollLeft,
      scrollHeight,
      scrollWidth,
      isDragging: false,
      deltaX: scrollLeft - this.__prevX,
      deltaY: scrollTop - this.__prevY,
    };
    this.__prevX = scrollLeft;
    this.__prevY = scrollTop;
    return detail;
  }

  __handleScroll = () => {
    if (this.__scrollEndEventEnabled && !useScrollEnd) {
      // debounce
      clearTimeout(this.__debounceScrollForMockingScrollEnd);
      this.__debounceScrollForMockingScrollEnd = setTimeout(() => {
        this.__handleScrollEnd();
      }, 100);
    }
    this.__dom.dispatchEvent(
      new CustomEvent('lynxscroll', {
        ...commonComponentEventSetting,
        detail: this.__getScrollDetail(),
      }),
    );
  };

  __handleScrollEnd = () => {
    this.__dom.dispatchEvent(
      new CustomEvent('lynxscrollend', {
        ...commonComponentEventSetting,
        detail: this.__getScrollDetail(),
      }),
    );
  };

  __scrollEventEnabled = false;
  @registerEventEnableStatusChangeHandler('lynxscroll')
  __handleScrollEventEnabled = (enabled: boolean) => {
    this.__scrollEventEnabled = enabled;
    this.__handleScrollEventsSwitches();
  };

  __scrollEndEventEnabled = false;
  @registerEventEnableStatusChangeHandler('lynxscrollend')
  __handleScrollEndEventEnabled = (enabled: boolean) => {
    this.__scrollEndEventEnabled = enabled;
    this.__handleScrollEventsSwitches();
  };

  __handleScrollEventsSwitches() {
    if (this.__scrollEventEnabled || this.__scrollEndEventEnabled) {
      this.__getScrollContainer().addEventListener(
        'scroll',
        this.__handleScroll,
      );
      this.__getScrollContainer().addEventListener(
        'scrollend',
        this.__handleScrollEnd,
      );
      this.__dom.addEventListener('scroll', this.__handleScroll);
      this.__dom.addEventListener('scrollend', this.__handleScrollEnd);
      this.__prevX = 0;
      this.__prevY = 0;
    } else {
      this.__dom.removeEventListener('scroll', this.__handleScroll);
      this.__dom.removeEventListener('scrollend', this.__handleScrollEnd);
    }
  }

  connectedCallback?(): void {}
  dispose(): void {}
}
