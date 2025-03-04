/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import type { AttributeReactiveClass } from '@lynx-js/web-elements-reactive';
import type { XFoldviewNg } from './XFoldviewNg.js';
import type { XFoldviewSlotNg } from './XFoldviewSlotNg.js';
import { isChromium } from '../common/constants.js';
export class XFoldviewSlotNgTouchEventsHandler
  implements InstanceType<AttributeReactiveClass<typeof XFoldviewSlotNg>>
{
  #parentScrollTop: number = 0;
  #childrenElemsntsScrollTop: WeakMap<Element, number> = new WeakMap();
  #childrenElemsntsScrollLeft: WeakMap<Element, number> = new WeakMap();
  #elements?: Element[];
  #previousPageY: number = 0;
  #previousPageX: number = 0;
  #dom: XFoldviewSlotNg;
  static observedAttributes = [];
  constructor(dom: XFoldviewSlotNg) {
    this.#dom = dom;

    this.#dom.addEventListener('touchmove', this.#scroller, {
      passive: false,
    });

    this.#dom.addEventListener('touchstart', this.#initPreviousScreen, {
      passive: true,
    });
    this.#dom.addEventListener('touchcancel', this.#initPreviousScreen, {
      passive: true,
    });
  }

  #getTheMostScrollableKid(delta: number, isVertical: boolean) {
    const scrollableKid = this.#elements?.find((element) => {
      if (
        (isVertical && element.scrollHeight > element.clientHeight)
        || (!isVertical && element.scrollWidth > element.clientWidth)
      ) {
        const couldScrollNear = delta < 0
          && (isVertical ? element.scrollTop !== 0 : element.scrollLeft !== 0);
        const couldScrollFar = delta > 0
          && Math.abs(
              isVertical
                ? (element.scrollHeight - element.clientHeight
                  - element.scrollTop)
                : (element.scrollWidth - element.clientWidth
                  - element.scrollLeft),
            ) > 1;
        return couldScrollNear || couldScrollFar;
      }
      return false;
    });
    return scrollableKid;
  }

  #scrollKid(scrollableKid: Element, delta: number, isVertical: boolean) {
    let targetKidScrollDistance = (isVertical
      ? this.#childrenElemsntsScrollTop
      : this.#childrenElemsntsScrollLeft)
      .get(scrollableKid) ?? 0;
    targetKidScrollDistance += delta;
    this.#childrenElemsntsScrollTop.set(scrollableKid, targetKidScrollDistance);
    isVertical
      ? (scrollableKid.scrollTop = targetKidScrollDistance)
      : (scrollableKid.scrollLeft = targetKidScrollDistance);
  }

  #scroller = (event: TouchEvent) => {
    const parentElement = this.#getParentElement();
    const touch = event.touches.item(0)!;
    const { pageY, pageX } = touch;
    const deltaY = this.#previousPageY! - pageY;
    const deltaX = this.#previousPageX! - pageX;
    const scrollableKidY = this.#getTheMostScrollableKid(deltaY, true);
    const scrollableKidX = this.#getTheMostScrollableKid(deltaX, false);
    /**
     * on chromium browsers, the y-axis js scrolling won't interrupt the pan-x gestures
     * we make sure the x-axis scrolling will block the y-axis scrolling
     */
    if (
      deltaY && parentElement && Math.abs(deltaX / 4) < Math.abs(deltaY)
    ) {
      if (event.cancelable && !isChromium) {
        event.preventDefault();
        if (scrollableKidX) {
          this.#scrollKid(scrollableKidX, deltaX, false);
        }
      }
      if (
        (parentElement.__headershowing && deltaY > 0
          || (deltaY < 0 && !scrollableKidY))
        // deltaY > 0: swipe up (folding header)
        // scroll the foldview if its scrollable
        || (!parentElement.__headershowing && !scrollableKidY)
        // all sub doms are scrolled
      ) {
        this.#parentScrollTop += deltaY;
        parentElement.scrollTop = this.#parentScrollTop;
      } else if (scrollableKidY) {
        this.#scrollKid(scrollableKidY, deltaY, true);
      }
    }
    this.#previousPageY = pageY;
  };

  #getParentElement(): XFoldviewNg | void {
    const parentElement = this.#dom.parentElement;
    if (parentElement && parentElement.tagName === 'X-FOLDVIEW-NG') {
      return parentElement as XFoldviewNg;
    }
  }

  #initPreviousScreen = (event: TouchEvent) => {
    const { pageX, pageY } = event.touches.item(0)!;
    this.#elements = document.elementsFromPoint(pageX, pageY).filter(e =>
      this.#dom.contains(e)
    );
    this.#previousPageY = pageY;
    this.#previousPageX = pageX;
    this.#parentScrollTop = this.#getParentElement()?.scrollTop ?? 0;
    for (const element of this.#elements) {
      this.#childrenElemsntsScrollTop.set(element, element.scrollTop);
      this.#childrenElemsntsScrollLeft.set(element, element.scrollLeft);
    }
  };
}
