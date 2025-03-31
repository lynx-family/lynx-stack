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
  __parentScrollTop: number = 0;
  __childrenElemsntsScrollTop: WeakMap<Element, number> = new WeakMap();
  __childrenElemsntsScrollLeft: WeakMap<Element, number> = new WeakMap();
  __elements?: Element[];
  __previousPageY: number = 0;
  __previousPageX: number = 0;
  __dom: XFoldviewSlotNg;
  static observedAttributes = [];
  constructor(dom: XFoldviewSlotNg) {
    this.__dom = dom;

    this.__dom.addEventListener('touchmove', this.__scroller, {
      passive: false,
    });

    this.__dom.addEventListener('touchstart', this.__initPreviousScreen, {
      passive: true,
    });
    this.__dom.addEventListener('touchcancel', this.__initPreviousScreen, {
      passive: true,
    });
  }

  __getTheMostScrollableKid(delta: number, isVertical: boolean) {
    const scrollableKid = this.__elements?.find((element) => {
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

  __scrollKid(scrollableKid: Element, delta: number, isVertical: boolean) {
    let targetKidScrollDistance = (isVertical
      ? this.__childrenElemsntsScrollTop
      : this.__childrenElemsntsScrollLeft)
      .get(scrollableKid) ?? 0;
    targetKidScrollDistance += delta;
    this.__childrenElemsntsScrollTop.set(
      scrollableKid,
      targetKidScrollDistance,
    );
    isVertical
      ? (scrollableKid.scrollTop = targetKidScrollDistance)
      : (scrollableKid.scrollLeft = targetKidScrollDistance);
  }

  __scroller = (event: TouchEvent) => {
    const parentElement = this.__getParentElement();
    const touch = event.touches.item(0)!;
    const { pageY, pageX } = touch;
    const deltaY = this.__previousPageY! - pageY;
    const deltaX = this.__previousPageX! - pageX;
    const scrollableKidY = this.__getTheMostScrollableKid(deltaY, true);
    const scrollableKidX = this.__getTheMostScrollableKid(deltaX, false);
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
          this.__scrollKid(scrollableKidX, deltaX, false);
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
        this.__parentScrollTop += deltaY;
        parentElement.scrollTop = this.__parentScrollTop;
      } else if (scrollableKidY) {
        this.__scrollKid(scrollableKidY, deltaY, true);
      }
    }
    this.__previousPageY = pageY;
  };

  __getParentElement(): XFoldviewNg | void {
    const parentElement = this.__dom.parentElement;
    if (parentElement && parentElement.tagName === 'X-FOLDVIEW-NG') {
      return parentElement as XFoldviewNg;
    }
  }

  __initPreviousScreen = (event: TouchEvent) => {
    const { pageX, pageY } = event.touches.item(0)!;
    this.__elements = document.elementsFromPoint(pageX, pageY).filter(e =>
      this.__dom.contains(e)
    );
    this.__previousPageY = pageY;
    this.__previousPageX = pageX;
    this.__parentScrollTop = this.__getParentElement()?.scrollTop ?? 0;
    for (const element of this.__elements) {
      this.__childrenElemsntsScrollTop.set(element, element.scrollTop);
      this.__childrenElemsntsScrollLeft.set(element, element.scrollLeft);
    }
  };
}
