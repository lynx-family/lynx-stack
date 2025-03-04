/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  genDomGetter,
  registerAttributeHandler,
} from '@lynx-js/web-elements-reactive';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';
import type { XList } from './XList.js';
import { throttle } from '../common/throttle.js';
import { bindToIntersectionObserver } from '../common/bindToIntersectionObserver.js';
import { useScrollEnd } from '../common/constants.js';

export class XListEvents
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = [
    'x-enable-scroll-event',
    'x-enable-scrollend-event',
    'upper-threshold-item-count',
    'lower-threshold-item-count',
    'x-enable-scrolltoupper-event',
    'x-enable-scrolltolower-event',
    'x-enable-scrolltoupperedge-event',
    'x-enable-scrolltoloweredge-event',
    'x-enable-snap-event',
    'scroll-event-throttle',
  ];

  #dom: XList;

  #getListContainer = genDomGetter(() => this.#dom.shadowRoot!, '#content');

  // The reason for using two observers is:
  // Using upper-threshold-item-count and lower-threshold-item-count configurations, it is possible that upper and lower observers monitor the same list-item.
  // Using the same observer, invoking callback event, it is impossible to confirm whether its source is upper or lower
  #upperObserver: IntersectionObserver | undefined;
  #lowerObserver: IntersectionObserver | undefined;
  // When list-item counts changes, Observer needs to be regenerated. Applicable to: Load More scenario
  #childrenObserver: MutationObserver | undefined;

  #prevX: number = 0;
  #prevY: number = 0;

  #enableScrollEnd = false;
  #debounceScrollForMockingScrollEnd?: ReturnType<typeof setTimeout>;

  #getUpperThresholdObserverDom = genDomGetter(
    () => this.#dom.shadowRoot!,
    '#upper-threshold-observer',
  );

  #getLowerThresholdObserverDom = genDomGetter(
    () => this.#dom.shadowRoot!,
    '#lower-threshold-observer',
  );
  #getScrollDetail() {
    const { scrollTop, scrollLeft, scrollHeight, scrollWidth } = this
      .#getListContainer();
    const detail = {
      scrollTop,
      scrollLeft,
      scrollHeight,
      scrollWidth,
      deltaX: scrollLeft - this.#prevX,
      deltaY: scrollTop - this.#prevY,
    };
    this.#prevX = scrollLeft;
    this.#prevY = scrollTop;
    return detail;
  }

  #handleUpperObserver = (entries: IntersectionObserverEntry[]) => {
    const { isIntersecting, target } = entries[0]!;
    const scrolltoupper = this.#dom.getAttribute(
      'x-enable-scrolltoupper-event',
    );

    if (isIntersecting) {
      scrolltoupper !== null && this.#dom.dispatchEvent(
        new CustomEvent('scrolltoupper', {
          ...commonComponentEventSetting,
          detail: this.#getScrollDetail(),
        }),
      );
    }
  };

  @registerAttributeHandler('upper-threshold-item-count', true)
  @registerAttributeHandler('x-enable-scrolltoupper-event', true)
  #updateUpperIntersectionObserver(
    newValue: string | null,
    oldValue: string | null,
    name: string,
  ) {
    const enableScrollToUpper = this.#dom.getAttribute(
      'x-enable-scrolltoupper-event',
    );

    if (enableScrollToUpper === null) {
      // if x-enable-scrolltoupper-event null, no need to handle upper-threshold-item-count
      if (this.#upperObserver) {
        this.#upperObserver.disconnect();
        this.#upperObserver = undefined;
      }
      if (this.#childrenObserver) {
        this.#childrenObserver.disconnect();
        this.#childrenObserver = undefined;
      }
      return;
    }

    if (!this.#upperObserver) {
      this.#upperObserver = new IntersectionObserver(
        this.#handleUpperObserver,
        {
          root: this.#getListContainer(),
        },
      );
    }
    if (!this.#childrenObserver) {
      this.#childrenObserver = new MutationObserver(
        this.#handleChildrenObserver,
      );
    }

    if (name === 'x-enable-scrolltoupper-event') {
      const upperThresholdItemCount = this.#dom.getAttribute(
        'upper-threshold-item-count',
      );
      const itemCount = upperThresholdItemCount !== null
        ? parseFloat(upperThresholdItemCount)
        : 0;
      const observerDom = itemCount === 0
        ? this.#getUpperThresholdObserverDom()
        : this.#dom.children[
          itemCount - 1
        ];
      observerDom && this.#upperObserver.observe(observerDom);

      this.#childrenObserver.observe(this.#dom, {
        childList: true,
      });
    }

    if (name === 'upper-threshold-item-count') {
      const oldItemCount = oldValue !== null
        ? parseFloat(oldValue)
        : 0;
      const oldObserverDom = oldItemCount === 0
        ? this.#getUpperThresholdObserverDom()
        : this.#dom.children[
          oldItemCount - 1
        ];
      oldObserverDom && this.#upperObserver.unobserve(oldObserverDom);

      const itemCount = newValue !== null
        ? parseFloat(newValue)
        : 0;
      const observerDom = itemCount === 0
        ? this.#getUpperThresholdObserverDom()
        : this.#dom.children[
          itemCount - 1
        ];
      observerDom && this.#upperObserver.observe(observerDom);
    }
  }

  #handleLowerObserver = (entries: IntersectionObserverEntry[]) => {
    const { isIntersecting } = entries[0]!;
    const scrolltolower = this.#dom.getAttribute(
      'x-enable-scrolltolower-event',
    );

    if (isIntersecting) {
      scrolltolower !== null && this.#dom.dispatchEvent(
        new CustomEvent('scrolltolower', {
          ...commonComponentEventSetting,
          detail: this.#getScrollDetail(),
        }),
      );
    }
  };

  @registerAttributeHandler('lower-threshold-item-count', true)
  @registerAttributeHandler('x-enable-scrolltolower-event', true)
  #updateLowerIntersectionObserver(
    newValue: string | null,
    oldValue: string | null,
    name: string,
  ) {
    const enableScrollToLower = this.#dom.getAttribute(
      'x-enable-scrolltolower-event',
    );

    if (enableScrollToLower === null) {
      if (this.#lowerObserver) {
        this.#lowerObserver.disconnect();
        this.#lowerObserver = undefined;
      }
      if (this.#childrenObserver) {
        this.#childrenObserver.disconnect();
        this.#childrenObserver = undefined;
      }
      return;
    }

    if (!this.#lowerObserver) {
      this.#lowerObserver = new IntersectionObserver(
        this.#handleLowerObserver,
        {
          root: this.#getListContainer(),
        },
      );
    }
    if (!this.#childrenObserver) {
      this.#childrenObserver = new MutationObserver(
        this.#handleChildrenObserver,
      );
    }

    if (name === 'x-enable-scrolltolower-event') {
      const lowerThresholdItemCount = this.#dom.getAttribute(
        'lower-threshold-item-count',
      );
      const itemCount = lowerThresholdItemCount !== null
        ? parseFloat(lowerThresholdItemCount)
        : 0;
      const observerDom = itemCount === 0
        ? this.#getLowerThresholdObserverDom()
        : this.#dom.children[
          this.#dom.children.length
          - itemCount
        ];
      observerDom && this.#lowerObserver.observe(observerDom);

      this.#childrenObserver.observe(this.#dom, {
        childList: true,
      });
    }

    if (name === 'lower-threshold-item-count') {
      const oldItemCount = oldValue !== null
        ? parseFloat(oldValue)
        : 0;
      const oldObserverDom = oldItemCount === 0
        ? this.#getLowerThresholdObserverDom()
        : this.#dom.children[this.#dom.children.length - oldItemCount];
      oldObserverDom && this.#lowerObserver.unobserve(oldObserverDom);

      const itemCount = newValue !== null
        ? parseFloat(newValue)
        : 0;
      const observerDom = itemCount === 0
        ? this.#getLowerThresholdObserverDom()
        : this.#dom.children[
          this.#dom.children.length
          - itemCount
        ];
      observerDom && this.#lowerObserver.observe(observerDom);
    }
  }

  #handleChildrenObserver = (mutationList: MutationRecord[]) => {
    const mutation = mutationList?.[0]!;

    // reset upper and lower observers
    if (mutation?.type === 'childList') {
      if (
        this.#dom.getAttribute(
          'x-enable-scrolltolower-event',
        ) !== null
      ) {
        // The reason why unobserve cannot be used is that the structure of list-item has changed,
        // and the list-item before the change cannot be obtained.
        // so disconnect and reconnect is required.
        if (this.#lowerObserver) {
          this.#lowerObserver.disconnect();
          this.#lowerObserver = undefined;
        }

        this.#lowerObserver = new IntersectionObserver(
          this.#handleLowerObserver,
          {
            root: this.#getListContainer(),
          },
        );

        const lowerThresholdItemCount = this.#dom.getAttribute(
          'lower-threshold-item-count',
        );
        const itemCount = lowerThresholdItemCount !== null
          ? parseFloat(lowerThresholdItemCount)
          : 0;
        const observerDom = itemCount === 0
          ? this.#getLowerThresholdObserverDom()
          : this.#dom.children[
            this.#dom.children.length
            - itemCount
          ];
        observerDom && this.#lowerObserver.observe(observerDom);
      }

      if (
        this.#dom.getAttribute(
          'x-enable-scrolltoupper-event',
        ) !== null
      ) {
        // The reason why unobserve cannot be used is that the structure of list-item has changed,
        // and the list-item before the change cannot be obtained.
        // so disconnect and reconnect is required.
        if (this.#upperObserver) {
          this.#upperObserver.disconnect();
          this.#upperObserver = undefined;
        }

        this.#upperObserver = new IntersectionObserver(
          this.#handleUpperObserver,
          {
            root: this.#getListContainer(),
          },
        );

        const upperThresholdItemCount = this.#dom.getAttribute(
          'upper-threshold-item-count',
        );
        const itemCount = upperThresholdItemCount !== null
          ? parseFloat(upperThresholdItemCount)
          : 0;
        const observerDom = itemCount === 0
          ? this.#getUpperThresholdObserverDom()
          : this.#dom.children[
            itemCount - 1
          ];
        observerDom && this.#upperObserver.observe(observerDom);
      }
    }
  };

  #throttledScroll: null | (() => void) = null;

  #handleScroll = () => {
    if (this.#enableScrollEnd && !useScrollEnd) {
      // debounce
      clearTimeout(this.#debounceScrollForMockingScrollEnd);
      this.#debounceScrollForMockingScrollEnd = setTimeout(() => {
        this.#handleScrollEnd();
      }, 100);
    }
    this.#dom.dispatchEvent(
      new CustomEvent('lynxscroll', {
        ...commonComponentEventSetting,
        detail: {
          type: 'scroll',
        },
      }),
    );
  };

  @registerAttributeHandler('x-enable-scroll-event', true)
  @registerAttributeHandler('scroll-event-throttle', true)
  @registerAttributeHandler('x-enable-scrollend-event', true)
  @registerAttributeHandler('x-enable-snap-event', true)
  #handleScrollEvents() {
    const scroll = this.#dom.getAttribute('x-enable-scroll-event') !== null;
    const scrollEventThrottle = this.#dom.getAttribute('scroll-event-throttle');
    const scrollend = this.#dom.getAttribute('x-enable-scrollend-event');
    const snap = this.#dom.getAttribute('x-enable-snap-event');
    this.#enableScrollEnd = scrollend !== null || snap !== null;
    const listContainer = this.#getListContainer();

    // cancel the previous listener first
    this.#throttledScroll
      && listContainer.removeEventListener('scroll', this.#throttledScroll);
    if (scroll !== null || this.#enableScrollEnd) {
      const wait = scrollEventThrottle !== null
        ? parseFloat(scrollEventThrottle)
        : 0;
      const throttledScroll = throttle(this.#handleScroll, wait, {
        leading: true,
        trailing: false,
      });
      this.#throttledScroll = throttledScroll;

      listContainer.addEventListener(
        'scroll',
        this.#throttledScroll!,
      );
      this.#prevX = 0;
      this.#prevY = 0;
    }

    if (useScrollEnd && this.#enableScrollEnd) {
      listContainer.addEventListener('scrollend', this.#handleScrollEnd);
    } else {
      listContainer.removeEventListener('scrollend', this.#handleScrollEnd);
    }
  }

  #handleObserver = (entries: IntersectionObserverEntry[]) => {
    const { isIntersecting, target } = entries[0]!;
    const id = target.id;
    if (isIntersecting) {
      if (id === 'upper-threshold-observer') {
        this.#dom.dispatchEvent(
          new CustomEvent('scrolltoupperedge', {
            ...commonComponentEventSetting,
            detail: this.#getScrollDetail(),
          }),
        );
      } else if (id === 'lower-threshold-observer') {
        this.#dom.dispatchEvent(
          new CustomEvent('scrolltoloweredge', {
            ...commonComponentEventSetting,
            detail: this.#getScrollDetail(),
          }),
        );
      }
    }
  };

  @registerAttributeHandler('x-enable-scrolltoupperedge-event', true)
  #updateUpperEdgeIntersectionObserver = bindToIntersectionObserver(
    this.#getListContainer,
    this.#getUpperThresholdObserverDom,
    this.#handleObserver,
  );

  @registerAttributeHandler('x-enable-scrolltoloweredge-event', true)
  #updateLowerEdgeIntersectionObserver = bindToIntersectionObserver(
    this.#getListContainer,
    this.#getLowerThresholdObserverDom,
    this.#handleObserver,
  );

  #handleScrollEnd = () => {
    const scrollend = this.#dom.getAttribute('x-enable-scrollend-event');
    const itemSnap = this.#dom.getAttribute('item-snap');
    const snap = this.#dom.getAttribute('x-enable-snap-event');

    if (scrollend !== null) {
      this.#dom.dispatchEvent(
        new CustomEvent('lynxscrollend', {
          ...commonComponentEventSetting,
        }),
      );
    }

    if (itemSnap !== null && snap !== null) {
      const children = Array.from(this.#dom.children).filter(node => {
        return node.tagName === 'LIST-ITEM';
      });
      const scrollTop = this.#getListContainer().scrollTop;
      const scrollLeft = this.#getListContainer().scrollLeft;
      const snapItem = children.find((ele: any) => {
        return scrollTop >= ele.offsetTop
          && scrollTop < ele.offsetTop + ele.offsetHeight;
      });

      this.#dom.dispatchEvent(
        new CustomEvent('snap', {
          ...commonComponentEventSetting,
          detail: {
            position: snapItem && children.indexOf(snapItem),
            scrollTop,
            scrollLeft,
          },
        }),
      );
    }
  };

  constructor(dom: XList) {
    this.#dom = dom;
  }
}
