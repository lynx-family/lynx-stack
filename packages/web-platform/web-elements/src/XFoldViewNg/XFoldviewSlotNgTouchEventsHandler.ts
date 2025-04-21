/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import type { AttributeReactiveClass } from '@lynx-js/web-elements-reactive';
import { isHeaderShowing, type XFoldviewNg } from './XFoldviewNg.js';
import type { XFoldviewSlotNg } from './XFoldviewSlotNg.js';
import { isChromium } from '../common/constants.js';
export class XFoldviewSlotNgTouchEventsHandler
  implements InstanceType<AttributeReactiveClass<typeof XFoldviewSlotNg>>
{
  #parentScrollTop: number = 0;
  #childrenElemsntsScrollTop: WeakMap<Element, number> = new WeakMap();
  #elements?: Element[];
  #previousPageY: number = 0;
  #previousPageX: number = 0;
  #scrollingVertically: boolean | null = null;
  #currentScrollingElement?: Element;
  #deltaY: number = 0;
  #dom: XFoldviewSlotNg;
  static observedAttributes = [];
  constructor(dom: XFoldviewSlotNg) {
    this.#dom = dom;

    this.#dom.addEventListener('touchmove', this.#scroller, {
      passive: false,
    });

    this.#dom.addEventListener('touchstart', this.#touchStart, {
      passive: true,
    });
    this.#dom.addEventListener('touchend', this.#touchEnd, {
      passive: true,
    });
  }

  #getTheMostScrollableKid(delta: number) {
    const scrollableKid = this.#elements?.find((element) => {
      if (
        element.scrollHeight > element.clientHeight
      ) {
        const couldScrollNear = delta < 0
          && element.scrollTop !== 0;
        const couldScrollFar = delta > 0
          && Math.abs(
              element.scrollHeight - element.clientHeight
                - element.scrollTop,
            ) > 1;
        return couldScrollNear || couldScrollFar;
      }
      return false;
    });
    return scrollableKid;
  }

  #scrollKid(scrollableKid: Element, delta: number) {
    let targetKidScrollDistance =
      this.#childrenElemsntsScrollTop.get(scrollableKid) ?? 0;
    targetKidScrollDistance += delta;
    this.#childrenElemsntsScrollTop.set(scrollableKid, targetKidScrollDistance);
    scrollableKid.scrollTop = targetKidScrollDistance;
  }

  #scroller = (event: TouchEvent) => {
    const parentElement = this.#getParentElement();
    const touch = event.touches.item(0)!;
    const { pageY, pageX } = touch;
    const deltaY = this.#previousPageY! - pageY;
    if (this.#scrollingVertically === null) {
      const deltaX = this.#previousPageX! - pageX;
      this.#scrollingVertically = Math.abs(deltaY) > Math.abs(deltaX);
    }
    if (this.#scrollingVertically === false) {
      return;
    }
    const scrollableKidY = this.#getTheMostScrollableKid(deltaY);
    if (
      parentElement
    ) {
      if (event.cancelable) {
        event.preventDefault();
      }
      if (
        (parentElement[isHeaderShowing] && deltaY > 0
          || (deltaY < 0 && !scrollableKidY))
        // deltaY > 0: swipe up (folding header)
        // scroll the foldview if its scrollable
        || (!parentElement[isHeaderShowing] && !scrollableKidY)
        // all sub doms are scrolled
      ) {
        parentElement.scrollBy({
          top: deltaY,
          behavior: 'smooth',
        });
        this.#parentScrollTop += deltaY;
        parentElement.scrollTop = this.#parentScrollTop;
        this.#currentScrollingElement = parentElement;
      } else if (scrollableKidY) {
        this.#currentScrollingElement = scrollableKidY;
        this.#scrollKid(scrollableKidY, deltaY);
      }
    }
    this.#previousPageY = pageY;
    this.#deltaY = deltaY;
  };

  #getParentElement(): XFoldviewNg | void {
    const parentElement = this.#dom.parentElement;
    if (parentElement && parentElement.tagName === 'X-FOLDVIEW-NG') {
      return parentElement as XFoldviewNg;
    }
  }

  #touchStart = (event: TouchEvent) => {
    const { pageX, pageY } = event.touches.item(0)!;
    this.#elements = document.elementsFromPoint(pageX, pageY).filter(e =>
      this.#dom.contains(e)
    );
    this.#previousPageY = pageY;
    this.#previousPageX = pageX;
    this.#parentScrollTop = this.#getParentElement()?.scrollTop ?? 0;
    for (const element of this.#elements) {
      this.#childrenElemsntsScrollTop.set(element, element.scrollTop);
    }
    this.#scrollingVertically = null;
    this.#currentScrollingElement = undefined;
  };

  #touchEnd = () => {
    this.#scrollingVertically = null;
    if (this.#currentScrollingElement) {
      const parentElement = this.#getParentElement();
      if (
        this.#currentScrollingElement === parentElement
        && !parentElement[isHeaderShowing]
      ) {
        return;
      }
      this.#currentScrollingElement.scrollBy({
        top: this.#deltaY * 4,
        behavior: 'smooth',
      });
    }
  };
}
