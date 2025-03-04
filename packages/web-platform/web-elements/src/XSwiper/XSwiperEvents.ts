/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  bindSwitchToEventListener,
  genDomGetter,
  registerAttributeHandler,
} from '@lynx-js/web-elements-reactive';
import type { XSwiper } from './XSwiper.js';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';
import { useScrollEnd } from '../common/constants.js';

export class XSwipeEvents
  implements InstanceType<AttributeReactiveClass<typeof XSwiper>>
{
  static observedAttributes = [
    'x-enable-scrollstart-event',
    'x-enable-scrollend-event',
    'x-enable-change-event',
    'x-enable-change-event-for-indicator',
    'x-enable-transition-event',
  ];
  readonly #dom: XSwiper;
  #current: number = 0;
  #pervScrollPosition: number = 0;
  #dragging = false;
  #debounceScrollForMockingScrollEnd?: ReturnType<typeof setTimeout>;
  #scrollStarted = false;
  constructor(dom: XSwiper) {
    this.#dom = dom;
  }
  #getContentContainer = genDomGetter(
    () => this.#dom.shadowRoot!,
    '#content',
  ).bind(this);

  @registerAttributeHandler('x-enable-transition-event', true)
  #handleEnableTransitionEvent = bindSwitchToEventListener(
    this.#getContentContainer,
    'scroll',
    this.#scrollEventListenerForTransition,
    { passive: true },
  );

  #handleScroll() {
    if (!useScrollEnd) {
      // debounce
      clearTimeout(this.#debounceScrollForMockingScrollEnd);
      this.#debounceScrollForMockingScrollEnd = setTimeout(() => {
        this.#handleScrollEnd();
      }, 100);
    }
    if (!this.#scrollStarted) {
      this.#dom.dispatchEvent(
        new CustomEvent('scrollstart', {
          ...commonComponentEventSetting,
          detail: {
            current: this.#current,
            isDragged: this.#dragging,
          },
        }),
      );
      this.#scrollStarted = true;
    }
    const contentContainer = this.#getContentContainer();
    const isVertical = this.#dom.isVertical;
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
      Math.abs(this.#pervScrollPosition - currentScrollDistance)
        > pageLength / 4
      || currentScrollDistance < 10
      || Math.abs(currentScrollDistance - totalScrollDistance) <= pageLength
    ) {
      const current = this.#dom.current;
      if (current !== this.#current) {
        this.#dom.dispatchEvent(
          new CustomEvent('change', {
            ...commonComponentEventSetting,
            detail: {
              current,
              isDragged: this.#dragging,
            },
          }),
        );
        this.#current = current;
      }
      this.#pervScrollPosition = currentScrollDistance;
    }
  }

  #handleScrollEnd() {
    this.#dom.dispatchEvent(
      new CustomEvent('lynxscrollend', {
        ...commonComponentEventSetting,
        detail: {
          current: this.#current,
        },
      }),
    );
    this.#scrollStarted = false;
  }

  #handleTouchStart() {
    this.#dragging = true;
  }

  #handleTouchEndAndCancel() {
    this.#dragging = false;
  }

  #scrollEventListenerForTransition() {
    this.#dom.dispatchEvent(
      new CustomEvent('transition', {
        ...commonComponentEventSetting,
        detail: {
          dx: this.#getContentContainer().scrollLeft,
          dy: this.#getContentContainer().scrollTop,
        },
      }),
    );
  }

  #listeners = [
    bindSwitchToEventListener(
      this.#getContentContainer,
      'scroll',
      this.#handleScroll.bind(this),
      { passive: true },
    ),
    bindSwitchToEventListener(
      this.#getContentContainer,
      'touchstart',
      this.#handleTouchStart.bind(this),
      { passive: true },
    ),
    bindSwitchToEventListener(
      this.#getContentContainer,
      'touchend',
      this.#handleTouchEndAndCancel.bind(this),
      { passive: true },
    ),
    bindSwitchToEventListener(
      this.#getContentContainer,
      'touchcancel',
      this.#handleTouchEndAndCancel.bind(this),
      { passive: true },
    ),
    bindSwitchToEventListener(
      this.#getContentContainer,
      'scrollend',
      this.#handleScrollEnd.bind(this),
      { passive: true },
    ),
  ];

  @registerAttributeHandler('x-enable-scrollstart-event', false)
  @registerAttributeHandler('x-enable-scrollend-event', false)
  @registerAttributeHandler('x-enable-change-event', false)
  @registerAttributeHandler('x-enable-change-event-for-indicator', false)
  #enableScrollEventProcessor() {
    const enableScrollstartEvent =
      this.#dom.getAttribute('x-enable-scrollstart-event') !== null;
    const enableScrollendEvent =
      this.#dom.getAttribute('x-enable-scrollend-event') !== null;
    const enableChangeEvent =
      this.#dom.getAttribute('x-enable-change-event') !== null;
    const enableChangeforindicatorEvent =
      this.#dom.getAttribute('x-enable-change-event-for-indicator') !== null;
    const enableEvent = enableChangeEvent
      || enableScrollendEvent
      || enableScrollstartEvent
      || enableChangeforindicatorEvent;
    this.#listeners.forEach((l) => l(enableEvent ? '' : null));
  }

  connectedCallback(): void {
    this.#current = parseFloat(this.#dom.getAttribute('current') ?? '0');
    const isVertical = this.#dom.isVertical;
    this.#pervScrollPosition = isVertical
      ? this.#getContentContainer().scrollTop
      : this.#getContentContainer().scrollLeft;
  }
}
