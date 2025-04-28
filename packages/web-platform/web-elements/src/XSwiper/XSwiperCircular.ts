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

export class XSwiperCircular
  implements InstanceType<AttributeReactiveClass<typeof XSwiper>>
{
  static observedAttributes = ['circular', 'vertical'];
  #dom: XSwiper;
  #isVertical = false;
  #pervTouchPosition?: number;
  #currentScrollDistance = 0;
  #getContentContainer = genDomGetter(
    () => this.#dom.shadowRoot!,
    '#content',
  ).bind(this);
  constructor(dom: XSwiper) {
    this.#dom = dom;
  }

  #getCircularFirstSlot = genDomGetter<HTMLSlotElement>(
    () => this.#dom.shadowRoot!,
    '#circular-start',
  ).bind(this);

  #getCircularLastSlot = genDomGetter<HTMLSlotElement>(
    () => this.#dom.shadowRoot!,
    '#circular-end',
  ).bind(this);

  #changeEventHandler(eventLikeObject: {
    detail: { current: number; isDragged: boolean; __isFirstLayout?: boolean };
  }) {
    const numberOfChlidren = this.#dom.childElementCount;
    if (numberOfChlidren > 2) {
      const { current, isDragged, __isFirstLayout } = eventLikeObject.detail;
      if (
        current === 0
        || current === numberOfChlidren - 1
        || current === 2
        || current === numberOfChlidren - 2
      ) {
        /**
         * for current = 0
         * start:[lastElement]
         * main: [firstElement, ....]
         * end: []
         *
         * for current = EOF
         *
         * start: []
         * main: [..., lastElement],
         * end: [firstElement]
         */
        const contentContainer = this.#getContentContainer();
        const elementsAtStart = this.#getCircularFirstSlot().assignedElements();
        const elementsAtEnd = this.#getCircularLastSlot().assignedElements();
        const firstElement = this.#dom.firstElementChild! as HTMLElement;
        const lastElement = this.#dom.lastElementChild! as HTMLElement;
        const snapDistance = this.#dom.snapDistance;
        let targetElement: HTMLElement;
        if (current === 0) {
          elementsAtEnd.forEach((e) => e.removeAttribute('slot'));
          lastElement.setAttribute('slot', 'circular-start');
          targetElement = firstElement;
        } else if (current === numberOfChlidren - 1) {
          elementsAtStart.forEach((e) => e.removeAttribute('slot'));
          firstElement.setAttribute('slot', 'circular-end');
          targetElement = lastElement;
        } else {
          elementsAtStart.forEach((e) => e.removeAttribute('slot'));
          elementsAtEnd.forEach((e) => e.removeAttribute('slot'));
          targetElement = this.#dom.children[current]! as HTMLElement;
        }
        // make sure the center offset of first element does not change.
        // make scrollleft + midWidth/2 = offsetLeft/2 + itemWidth - snapDistance
        if (this.#isVertical) {
          const midHeight = this.#dom.getAttribute('mode') === 'carousel'
            ? (contentContainer.clientHeight * 0.8) / 2
            : contentContainer.clientHeight / 2;
          this.#currentScrollDistance = targetElement.offsetTop
            + targetElement.offsetHeight / 2
            - snapDistance
            - midHeight;
          contentContainer.scrollTop = this.#currentScrollDistance;
        } else {
          const midWidth = this.#dom.getAttribute('mode') === 'carousel'
            ? (contentContainer.clientWidth * 0.8) / 2
            : contentContainer.clientWidth / 2;
          this.#currentScrollDistance = targetElement.offsetLeft
            + targetElement.offsetWidth / 2
            - snapDistance
            - midWidth;
          contentContainer.scrollLeft = this.#currentScrollDistance;
        }

        if (!isDragged) {
          const mode = this.#dom.getAttribute('mode');
          // first layout, the following mode position is the leftmost, no scrollToSnapPosition is needed
          if (
            __isFirstLayout
            && (mode === null || mode === 'normal' || mode === 'carousel'
              || mode === 'carry')
          ) {
            return;
          }
          // first layout should always scroll instant
          this.#scrollToSnapPosition(__isFirstLayout ? 'instant' : 'smooth');
        }
      }
    }
  }

  #scrollToSnapPosition(behavior?: ScrollBehavior) {
    const contentContainer = this.#getContentContainer();
    const snapDistance = this.#dom.snapDistance;
    contentContainer.scrollBy({
      top: this.#isVertical ? snapDistance : 0,
      left: this.#isVertical ? 0 : snapDistance,
      behavior: behavior ?? 'smooth',
    });
  }

  #listeners = [
    bindSwitchToEventListener(
      () => this.#dom,
      'change',
      this.#changeEventHandler.bind(this) as any as EventListener,
      { passive: true },
    ),
    bindSwitchToEventListener(
      () => this.#dom,
      'touchmove',
      this.#handleTouchEvent.bind(this) as EventListener,
      { passive: false },
    ),
    bindSwitchToEventListener(
      () => this.#dom,
      'touchend',
      this.#handleEndEvent.bind(this) as EventListener,
      { passive: false },
    ),
    bindSwitchToEventListener(
      () => this.#dom,
      'touchcancel',
      this.#handleEndEvent.bind(this) as EventListener,
      { passive: false },
    ),
  ];

  @registerAttributeHandler('circular', false)
  #handleCircular(newVal: string | null) {
    this.#listeners.forEach((l) => l(newVal != null));
    if (newVal !== null) {
      this.#changeEventHandler({
        detail: {
          current: this.#dom.currentIndex,
          isDragged: false,
          __isFirstLayout: true,
        },
      });
    }
  }

  #handleTouchEvent(event: TouchEvent) {
    const touch = event.touches.item(0);
    if (touch) {
      const currentTouchPosition = this.#isVertical ? touch.pageY : touch.pageX;
      if (this.#pervTouchPosition !== undefined) {
        this.#startScrolling();
        const scrollMoveDistance = this.#pervTouchPosition
          - currentTouchPosition;
        this.#currentScrollDistance += scrollMoveDistance;
      }
      this.#pervTouchPosition = currentTouchPosition;
    }
  }

  #handleEndEvent(_event: TouchEvent) {
    this.#stopScrolling();
    this.#scrollToSnapPosition();
    this.#pervTouchPosition = undefined;
  }

  @registerAttributeHandler('vertical', true)
  #handleVerticalChange(newVal: string | null) {
    const enable = newVal !== null;
    this.#isVertical = enable;
  }

  #scrollTimer?: ReturnType<typeof setInterval>;

  #startScrolling() {
    if (!this.#scrollTimer) {
      const contentContainer = this.#getContentContainer();
      this.#currentScrollDistance = this.#isVertical
        ? contentContainer.scrollTop
        : contentContainer.scrollLeft;
      this.#scrollTimer = setInterval(() => {
        if (this.#isVertical) {
          contentContainer.scrollTop = this.#currentScrollDistance;
        } else {
          contentContainer.scrollLeft = this.#currentScrollDistance;
        }
      }, 10);
    }
  }

  #stopScrolling() {
    if (this.#scrollTimer) {
      clearInterval(this.#scrollTimer);
      this.#scrollTimer = undefined;
    }
  }

  dispose(): void {
    this.#stopScrolling();
  }
}
