/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  bindSwitchToEventListener,
  genDomGetter,
} from '@lynx-js/web-elements-reactive';
import type { XSwiper } from './XSwiper.js';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';
import { useScrollEnd } from '../common/constants.js';
import { registerEventEnableStatusChangeHandler } from '@lynx-js/web-elements-reactive';

export class XSwipeEvents
  implements InstanceType<AttributeReactiveClass<typeof XSwiper>>
{
  static observedAttributes = [];
  readonly __dom: XSwiper;
  __current: number = 0;
  __pervScrollPosition: number = 0;
  __dragging = false;
  __debounceScrollForMockingScrollEnd?: ReturnType<typeof setTimeout>;
  __scrollStarted = false;
  constructor(dom: XSwiper) {
    this.__dom = dom;
  }
  __getContentContainer = genDomGetter(
    () => this.__dom.shadowRoot!,
    '__content',
  ).bind(this);

  @registerEventEnableStatusChangeHandler('transition')
  __handleEnableTransitionEvent = bindSwitchToEventListener(
    this.__getContentContainer,
    'scroll',
    this.__scrollEventListenerForTransition,
    { passive: true },
  );

  __handleScroll() {
    if (!useScrollEnd) {
      // debounce
      clearTimeout(this.__debounceScrollForMockingScrollEnd);
      this.__debounceScrollForMockingScrollEnd = setTimeout(() => {
        this.__handleScrollEnd();
      }, 100);
    }
    if (!this.__scrollStarted) {
      this.__dom.dispatchEvent(
        new CustomEvent('scrollstart', {
          ...commonComponentEventSetting,
          detail: {
            current: this.__current,
            isDragged: this.__dragging,
          },
        }),
      );
      this.__scrollStarted = true;
    }
    const contentContainer = this.__getContentContainer();
    const isVertical = this.__dom.isVertical;
    /* already scrolled distance */
    const currentScrollDistance = isVertical
      ? contentContainer.scrollTop
      : contentContainer.scrollLeft;
    const pageLength = isVertical
      ? contentContainer.clientHeight
      : contentContainer.clientWidth;
    const totalScrollDistance = isVertical
      ? contentContainer.scrollHeight
      : contentContainer.scrollWidth;
    if (
      Math.abs(this.__pervScrollPosition - currentScrollDistance)
        > pageLength / 4
      || currentScrollDistance < 10
      || Math.abs(currentScrollDistance - totalScrollDistance) <= pageLength
    ) {
      const current = this.__dom.current;
      if (current !== this.__current) {
        this.__dom.dispatchEvent(
          new CustomEvent('change', {
            ...commonComponentEventSetting,
            detail: {
              current,
              isDragged: this.__dragging,
            },
          }),
        );
        this.__current = current;
      }
      this.__pervScrollPosition = currentScrollDistance;
    }
  }

  __handleScrollEnd() {
    this.__dom.dispatchEvent(
      new CustomEvent('lynxscrollend', {
        ...commonComponentEventSetting,
        detail: {
          current: this.__current,
        },
      }),
    );
    this.__scrollStarted = false;
  }

  __handleTouchStart() {
    this.__dragging = true;
  }

  __handleTouchEndAndCancel() {
    this.__dragging = false;
  }

  __scrollEventListenerForTransition() {
    this.__dom.dispatchEvent(
      new CustomEvent('transition', {
        ...commonComponentEventSetting,
        detail: {
          dx: this.__getContentContainer().scrollLeft,
          dy: this.__getContentContainer().scrollTop,
        },
      }),
    );
  }

  __listeners = [
    bindSwitchToEventListener(
      this.__getContentContainer,
      'scroll',
      this.__handleScroll.bind(this),
      { passive: true },
    ),
    bindSwitchToEventListener(
      this.__getContentContainer,
      'touchstart',
      this.__handleTouchStart.bind(this),
      { passive: true },
    ),
    bindSwitchToEventListener(
      this.__getContentContainer,
      'touchend',
      this.__handleTouchEndAndCancel.bind(this),
      { passive: true },
    ),
    bindSwitchToEventListener(
      this.__getContentContainer,
      'touchcancel',
      this.__handleTouchEndAndCancel.bind(this),
      { passive: true },
    ),
    bindSwitchToEventListener(
      this.__getContentContainer,
      'scrollend',
      this.__handleScrollEnd.bind(this),
      { passive: true },
    ),
  ];

  __eventSwitches = {
    scrollstart: false,
    lynxscrollend: false,
    change: false,
    'change-event-for-indicator': false,
  };

  @registerEventEnableStatusChangeHandler('scrollstart')
  @registerEventEnableStatusChangeHandler('lynxscrollend')
  @registerEventEnableStatusChangeHandler('change')
  @registerEventEnableStatusChangeHandler('change-event-for-indicator')
  __enableScrollEventProcessor(value: boolean, eventName: string) {
    this
      .__eventSwitches[
        eventName as
          | 'scrollstart'
          | 'lynxscrollend'
          | 'change'
          | 'change-event-for-indicator'
      ] = value;
    const { lynxscrollend, scrollstart, change } = this.__eventSwitches;
    const changeEventEnabled = change || lynxscrollend || scrollstart
      || this.__eventSwitches['change-event-for-indicator'];
    this.__listeners.forEach((l) => l(changeEventEnabled));
  }

  connectedCallback(): void {
    this.__current = parseFloat(this.__dom.getAttribute('current') ?? '0');
    const isVertical = this.__dom.isVertical;
    this.__pervScrollPosition = isVertical
      ? this.__getContentContainer().scrollTop
      : this.__getContentContainer().scrollLeft;
  }
}
