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
  __dom: XSwiper;
  __isVertical = false;
  __pervTouchPosition?: number;
  __currentScrollDistance = 0;
  __getContentContainer = genDomGetter(
    () => this.__dom.shadowRoot!,
    '__content',
  ).bind(this);
  constructor(dom: XSwiper) {
    this.__dom = dom;
  }

  __getCircularFirstSlot = genDomGetter<HTMLSlotElement>(
    () => this.__dom.shadowRoot!,
    '__circular-start',
  ).bind(this);

  __getCircularLastSlot = genDomGetter<HTMLSlotElement>(
    () => this.__dom.shadowRoot!,
    '__circular-end',
  ).bind(this);

  __changeEventHandler(eventLikeObject: {
    detail: { current: number; isDragged: boolean; __isFirstLayout?: boolean };
  }) {
    const numberOfChlidren = this.__dom.childElementCount;
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
        const contentContainer = this.__getContentContainer();
        const elementsAtStart = this.__getCircularFirstSlot()
          .assignedElements();
        const elementsAtEnd = this.__getCircularLastSlot().assignedElements();
        const firstElement = this.__dom.firstElementChild! as HTMLElement;
        const lastElement = this.__dom.lastElementChild! as HTMLElement;
        const snapDistance = this.__dom.snapDistance;
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
          targetElement = this.__dom.children[current]! as HTMLElement;
        }
        // make sure the center offset of first element does not change.
        // make scrollleft + midWidth/2 = offsetLeft/2 + itemWidth - snapDistance
        if (this.__isVertical) {
          const midHeight = this.__dom.getAttribute('mode') === 'carousel'
            ? (contentContainer.clientHeight * 0.8) / 2
            : contentContainer.clientHeight / 2;
          this.__currentScrollDistance = targetElement.offsetTop
            + targetElement.offsetHeight / 2
            - snapDistance
            - midHeight;
          contentContainer.scrollTop = this.__currentScrollDistance;
        } else {
          const midWidth = this.__dom.getAttribute('mode') === 'carousel'
            ? (contentContainer.clientWidth * 0.8) / 2
            : contentContainer.clientWidth / 2;
          this.__currentScrollDistance = targetElement.offsetLeft
            + targetElement.offsetWidth / 2
            - snapDistance
            - midWidth;
          contentContainer.scrollLeft = this.__currentScrollDistance;
        }

        if (!isDragged) {
          const mode = this.__dom.getAttribute('mode');
          // first layout, the following mode position is the leftmost, no scrollToSnapPosition is needed
          if (
            __isFirstLayout
            && (mode === null || mode === 'normal' || mode === 'carousel'
              || mode === 'carry')
          ) {
            return;
          }
          // first layout should always scroll instant
          this.__scrollToSnapPosition(__isFirstLayout ? 'instant' : 'smooth');
        }
      }
    }
  }

  __scrollToSnapPosition(behavior?: ScrollBehavior) {
    const contentContainer = this.__getContentContainer();
    const snapDistance = this.__dom.snapDistance;
    contentContainer.scrollBy({
      top: this.__isVertical ? snapDistance : 0,
      left: this.__isVertical ? 0 : snapDistance,
      behavior: behavior ?? 'smooth',
    });
  }

  __listeners = [
    bindSwitchToEventListener(
      () => this.__dom,
      'change',
      this.__changeEventHandler.bind(this) as any as EventListener,
      { passive: true },
    ),
    bindSwitchToEventListener(
      () => this.__dom,
      'touchmove',
      this.__handleTouchEvent.bind(this) as EventListener,
      { passive: false },
    ),
    bindSwitchToEventListener(
      () => this.__dom,
      'touchend',
      this.__handleEndEvent.bind(this) as EventListener,
      { passive: false },
    ),
    bindSwitchToEventListener(
      () => this.__dom,
      'touchcancel',
      this.__handleEndEvent.bind(this) as EventListener,
      { passive: false },
    ),
  ];

  @registerAttributeHandler('circular', false)
  __handleCircular(newVal: string | null) {
    this.__listeners.forEach((l) => l(newVal != null));
    if (newVal !== null) {
      this.__changeEventHandler({
        detail: {
          current: this.__dom.current,
          isDragged: false,
          __isFirstLayout: true,
        },
      });
    }
  }

  __handleTouchEvent(event: TouchEvent) {
    const touch = event.touches.item(0);
    if (touch) {
      const currentTouchPosition = this.__isVertical
        ? touch.pageY
        : touch.pageX;
      if (this.__pervTouchPosition !== undefined) {
        this.__startScrolling();
        const scrollMoveDistance = this.__pervTouchPosition
          - currentTouchPosition;
        this.__currentScrollDistance += scrollMoveDistance;
      }
      this.__pervTouchPosition = currentTouchPosition;
    }
  }

  __handleEndEvent(_event: TouchEvent) {
    this.__stopScrolling();
    this.__scrollToSnapPosition();
    this.__pervTouchPosition = undefined;
  }

  @registerAttributeHandler('vertical', true)
  __handleVerticalChange(newVal: string | null) {
    const enable = newVal !== null;
    this.__isVertical = enable;
  }

  __scrollTimer?: ReturnType<typeof setInterval>;

  __startScrolling() {
    if (!this.__scrollTimer) {
      const contentContainer = this.__getContentContainer();
      this.__currentScrollDistance = this.__isVertical
        ? contentContainer.scrollTop
        : contentContainer.scrollLeft;
      this.__scrollTimer = setInterval(() => {
        if (this.__isVertical) {
          contentContainer.scrollTop = this.__currentScrollDistance;
        } else {
          contentContainer.scrollLeft = this.__currentScrollDistance;
        }
      }, 10);
    }
  }

  __stopScrolling() {
    if (this.__scrollTimer) {
      clearInterval(this.__scrollTimer);
      this.__scrollTimer = undefined;
    }
  }

  dispose(): void {
    this.__stopScrolling();
  }
}
