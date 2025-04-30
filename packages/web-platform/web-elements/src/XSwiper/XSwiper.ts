/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component, genDomGetter, html } from '@lynx-js/web-elements-reactive';

import { XSwipeEvents } from './XSwiperEvents.js';
import { XSwiperAutoScroll } from './XSwiperAutoScroll.js';
import { XSwiperCircular } from './XSwiperCircular.js';
import { XSwiperIndicator } from './XSwiperIndicator.js';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';
import { scrollContainerDom } from '../common/constants.js';

@Component<typeof XSwiper>(
  'x-swiper',
  [
    CommonEventsAndMethods,
    XSwiperIndicator,
    XSwipeEvents,
    XSwiperCircular,
    XSwiperAutoScroll,
  ],
  html` <style>
      #bounce-padding {
        display: none;
        flex: 0 0 0;
        align-self: stretch;
        scroll-snap-align: none;
        flex-basis: 100%;
      }
      #content {
        position: relative;
        display: flex;
        flex: 0 0 100%;
        flex-direction: inherit;
        flex-wrap: inherit;
        align-self: stretch;
        justify-content: inherit;
        align-items: inherit;
        overflow: inherit;
        scrollbar-width: none;
        scroll-snap-align: start;
        scroll-snap-type: inherit;
      }
      div::-webkit-scrollbar {
        display: none;
      }
      #indicator-container {
        display: none;
      }
      @keyframes indicator-dot {
        30%,
        70% {
          background-color: var(--indicator-color);
        }
        31%,
        69% {
          background-color: var(--indicator-active-color);
        }
      }
    </style>
    <style id="indicator-style"></style>
    <div id="bounce-padding" part="bounce-padding"></div>
    <div id="indicator-container" part="indicator-container"></div>
    <div id="content" part="content">
      <slot part="slot-start" name="circular-start" id="circular-start"></slot>
      <slot part="slot"></slot>
      <slot part="slot-end" name="circular-end" id="circular-end"></slot>
    </div>`,
)
export class XSwiper extends HTMLElement {
  static notToFilterFalseAttributes = new Set([
    'smooth-scroll',
    'indicator-dots',
  ]);

  #getContentContainer = genDomGetter(() => this.shadowRoot!, '#content').bind(
    this,
  );

  #getNeatestElementIndexAndDistanceToMid() {
    let current = 0;
    let minDistanceToMid = Number.MAX_SAFE_INTEGER;
    let minOffsetToMid = 0;
    if (this.childElementCount > 0) {
      const contentContainer = this.#getContentContainer();
      const isVertical = this.isVertical;
      const numberOfChildren = this.childElementCount;
      /* already scrolled distance */
      const currentScrollDistance = isVertical
        ? contentContainer.scrollTop
        : contentContainer.scrollLeft;
      const pageLength = isVertical
        ? contentContainer.clientHeight
        : contentContainer.clientWidth;
      const itemLength = isVertical
        ? (this.firstElementChild as HTMLElement).offsetHeight
        : (this.firstElementChild as HTMLElement).offsetWidth;
      /**
       * ============================
       * |                          |
       * |                          |
       * |    <-> scroll container  |
       * |                          |
       * |                          |
       * ============================
       *              ^___ mid
       */
      // mode carousel width is 80% of pageLength
      const midWidth = this.getAttribute('mode') === 'carousel'
        ? (pageLength * 0.8) / 2
        : pageLength / 2;
      const midOffset = currentScrollDistance + midWidth;
      for (let ii = 0; ii < numberOfChildren; ii++) {
        const swiperItem = this.children[ii] as HTMLElement;
        if (swiperItem) {
          const scrollOffset =
            (isVertical ? swiperItem.offsetTop : swiperItem.offsetLeft)
            + itemLength / 2;
          const offsetToMid = scrollOffset - midOffset;
          const distanceToMid = Math.abs(offsetToMid);
          if (distanceToMid < minDistanceToMid) {
            current = ii;
            minDistanceToMid = distanceToMid;
            minOffsetToMid = offsetToMid;
          }
        }
      }
    }
    return {
      current,
      minDistanceToMid,
      minOffsetToMid,
    };
  }
  get currentIndex() {
    return this.#getNeatestElementIndexAndDistanceToMid().current;
  }
  set currentIndex(newval: number) {
    // When current is specified and current is updated in bindchange, there is no need to respond to the update of current
    if (this.currentIndex === newval) {
      return;
    }

    const smooth = this.getAttribute('smooth-scroll') === null; // smooth-scroll default true, it is set to be false
    this.#scrollToIndex(newval, smooth ? 'smooth' : 'instant');
  }
  #scrollToIndex(index: number, behavior: ScrollBehavior) {
    const target = this.children.item(index) as HTMLElement;
    if (target) {
      const isVertical = this.isVertical;
      let offset = 0;
      // flat-coverflow mode, should scroll to the mid, 20% of left, 1/3 of width.
      if (this.getAttribute('mode') === 'flat-coverflow') {
        if (isVertical) {
          offset = target.offsetTop - target.offsetHeight / 3;
        } else {
          offset = target.offsetLeft - target.offsetWidth / 3;
        }
      } else {
        if (isVertical) {
          offset = target.offsetTop;
        } else {
          offset = target.offsetLeft;
        }
      }
      this.#getContentContainer().scrollTo({
        left: isVertical ? 0 : offset,
        top: isVertical ? offset : 0,
        behavior,
      });
    }
  }
  get snapDistance() {
    return this.#getNeatestElementIndexAndDistanceToMid().minOffsetToMid;
  }

  get isVertical() {
    return this.getAttribute('vertical') !== null;
  }

  get circularPlay() {
    return this.getAttribute('circular') !== null;
  }

  scrollToNext() {
    const current = this.currentIndex;
    const count = this.childElementCount;
    if (current === count - 1) {
      const circularPlay = this.circularPlay;
      if (circularPlay) {
        this.currentIndex = 0;
      }
    } else {
      this.currentIndex += 1;
    }
  }

  scrollToPrevious() {
    const current = this.currentIndex;
    const count = this.childElementCount;
    if (current === 0) {
      const circularPlay = this.circularPlay;
      if (circularPlay) {
        this.currentIndex = count - 1;
      }
    } else {
      this.currentIndex = count - 1;
    }
  }

  connectedCallback() {
    const current = this.getAttribute('current');
    if (current !== null) {
      // first layout should always scroll instant
      this.#scrollToIndex(Number(current), 'instant');
    }
  }
  get [scrollContainerDom]() {
    return this;
  }
}
