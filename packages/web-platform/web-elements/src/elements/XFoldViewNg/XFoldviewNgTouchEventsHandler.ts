/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import type { AttributeReactiveClass } from '../../element-reactive/index.js';
import { isHeaderShowing, type XFoldviewNg } from './XFoldviewNg.js';
export class XFoldviewNgTouchEventsHandler
  implements InstanceType<AttributeReactiveClass<typeof XFoldviewNg>>
{
  #childrenElemsntsScrollTop: WeakMap<Element, number> = new WeakMap();
  #elements?: Element[];
  #previousClientY: number = 0;
  #previousClientX: number = 0;
  #scrollingVertically: boolean | null = null;
  #currentScrollingElement?: Element;
  #deltaY: number = 0;
  #dom: XFoldviewNg;
  static observedAttributes = [];
  constructor(dom: XFoldviewNg) {
    this.#dom = dom;

    this.#dom.addEventListener('touchmove', this.#handleTouch, {
      passive: false,
    });

    this.#dom.addEventListener('touchstart', this.#touchStart, {
      passive: true,
    });
    this.#dom.addEventListener('touchend', this.#touchEnd, {
      passive: true,
    });
    this.#dom.addEventListener('wheel', this.#handleWheel, {
      passive: false,
    });
  }

  #isScrollContainer(element: Element): boolean {
    let overflowY: string;
    if (typeof element.computedStyleMap === 'function') {
      try {
        overflowY = element.computedStyleMap().get('overflow-y')?.toString()
          ?? 'visible';
      } catch {
        overflowY = getComputedStyle(element).overflowY || 'visible';
      }
    } else {
      overflowY = getComputedStyle(element).overflowY || 'visible';
    }
    return overflowY === 'auto' || overflowY === 'scroll'
      || overflowY === 'hidden' || overflowY === 'overlay';
  }

  #getTheMostScrollableKid(delta: number) {
    const scrollableKid = this.#elements?.find((element) => {
      if (
        this.#isScrollContainer(element)
        && element.scrollHeight > element.clientHeight
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

  #handleTouch = (event: TouchEvent) => {
    if (this.#dom.getAttribute('scroll-enable') === 'false') {
      return;
    }

    const touch = event.touches.item(0)!;
    const { clientX, clientY } = touch;
    const deltaY = this.#previousClientY! - clientY;
    if (this.#scrollingVertically === null) {
      const deltaX = this.#previousClientX! - clientX;
      this.#scrollingVertically = Math.abs(deltaY) > Math.abs(deltaX);
    }
    if (this.#scrollingVertically === false) {
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    this.#handleScrollDelta(deltaY);
    this.#previousClientY = clientY;
  };

  #handleWheel = (event: WheelEvent) => {
    if (this.#dom.getAttribute('scroll-enable') === 'false') {
      return;
    }
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
      return;
    }
    const pathElements = event.composedPath().filter((
      element,
    ): element is Element =>
      element instanceof Element && this.#dom.contains(element)
      && element !== this.#dom
    );
    const { clientX, clientY } = event;
    const pointElements = document.elementsFromPoint(clientX, clientY).filter(
      e => this.#dom.contains(e),
    );
    this.#elements = [...new Set([...pathElements, ...pointElements])];
    if (this.#elements) {
      for (const element of this.#elements) {
        this.#childrenElemsntsScrollTop.set(element, element.scrollTop);
      }
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    this.#handleScrollDelta(event.deltaY);
  };

  // Removed #getParentElement

  #touchStart = (event: TouchEvent) => {
    const { clientX, clientY } = event.touches.item(0)!;
    // For nested foldviews, we only handle if this foldview is the closest one
    const pathElements = event.composedPath();
    const closestFoldview = pathElements.find(el =>
      el instanceof Element && el.tagName === 'X-FOLDVIEW-NG'
    );
    if (closestFoldview !== this.#dom) {
      this.#elements = [];
      return;
    }

    this.#elements = document.elementsFromPoint(clientX, clientY).filter(e =>
      this.#dom.contains(e) && this.#dom !== e
    );
    this.#previousClientY = clientY;
    this.#previousClientX = clientX;
    for (const element of this.#elements) {
      this.#childrenElemsntsScrollTop.set(element, element.scrollTop);
    }
    this.#scrollingVertically = null;
    this.#currentScrollingElement = undefined;
  };

  #touchEnd = () => {
    this.#scrollingVertically = null;
    if (this.#currentScrollingElement) {
      if (
        this.#currentScrollingElement === this.#dom
        && !this.#dom[isHeaderShowing]
      ) {
        return;
      }
      this.#currentScrollingElement.scrollBy({
        top: this.#deltaY * 4,
        behavior: 'smooth',
      });
    }
  };

  #handleScrollDelta(
    deltaY: number,
  ) {
    const scrollableKidY = this.#getTheMostScrollableKid(deltaY);
    if (
      (this.#dom[isHeaderShowing] && deltaY > 0
        || (deltaY < 0 && !scrollableKidY))
      // deltaY > 0: swipe up (folding header)
      // scroll the foldview if its scrollable
      || (!this.#dom[isHeaderShowing] && !scrollableKidY)
      // all sub doms are scrolled
    ) {
      this.#dom.scrollTop += deltaY;
      this.#currentScrollingElement = this.#dom;
    } else if (scrollableKidY) {
      this.#currentScrollingElement = scrollableKidY;
      this.#scrollKid(scrollableKidY, deltaY);
    }
    this.#deltaY = deltaY;
  }
}
