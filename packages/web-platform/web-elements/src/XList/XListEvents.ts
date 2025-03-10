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
import { registerEventEnableStatusChangeHandler } from '@lynx-js/web-elements-reactive';

export class XListEvents
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = [
    'upper-threshold-item-count',
    'lower-threshold-item-count',
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
    const { isIntersecting } = entries[0]!;

    if (isIntersecting) {
      this.#dom.dispatchEvent(
        new CustomEvent('scrolltoupper', {
          ...commonComponentEventSetting,
          detail: this.#getScrollDetail(),
        }),
      );
    }
  };

  @registerEventEnableStatusChangeHandler('scrolltoupper')
  #updateEventSwitches = (enableScrollToUpper: boolean) => {
    enableScrollToUpper
      ? this.#dom.setAttribute('x-enable-scrolltoupper-event', '')
      : this.#dom.removeAttribute('x-enable-scrolltoupper-event'); // css needs this;
    this.#eventSwitches.scrolltoupper = enableScrollToUpper;

    if (!enableScrollToUpper) {
      // if x-enable-scrolltoupper-event null, no need to handle upper-threshold-item-count
      if (this.#upperObserver) {
        this.#upperObserver.disconnect();
        this.#upperObserver = undefined;
      }
      if (this.#childrenObserver) {
        this.#childrenObserver.disconnect();
        this.#childrenObserver = undefined;
      }
    } else {
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
  };

  @registerAttributeHandler('upper-threshold-item-count', true)
  #handleUpperThresholdItemCountChange(
    newValue: string | null,
    oldValue: string | null,
  ) {
    const oldItemCount = oldValue !== null
      ? parseFloat(oldValue)
      : 0;
    const oldObserverDom = oldItemCount === 0
      ? this.#getUpperThresholdObserverDom()
      : this.#dom.children[
        oldItemCount - 1
      ];
    oldObserverDom && this.#upperObserver?.unobserve(oldObserverDom);

    const itemCount = newValue !== null
      ? parseFloat(newValue)
      : 0;
    const observerDom = itemCount === 0
      ? this.#getUpperThresholdObserverDom()
      : this.#dom.children[
        itemCount - 1
      ];
    observerDom && this.#upperObserver?.observe(observerDom);
  }

  #handleLowerObserver = (entries: IntersectionObserverEntry[]) => {
    const { isIntersecting } = entries[0]!;
    if (isIntersecting) {
      this.#dom.dispatchEvent(
        new CustomEvent('scrolltolower', {
          ...commonComponentEventSetting,
          detail: this.#getScrollDetail(),
        }),
      );
    }
  };

  #eventSwitches = {
    lynxscroll: false,
    lynxscrollend: false,
    snap: false,
    scrolltolower: false,
    scrolltoupper: false,
  };

  @registerEventEnableStatusChangeHandler('scrolltolower')
  #updateScrollToLowerEventSwitches = (enableScrollToLower: boolean) => {
    this.#eventSwitches.scrolltolower = enableScrollToLower;
    enableScrollToLower
      ? this.#dom.setAttribute('x-enable-scrolltolower-event', '')
      : this.#dom.removeAttribute('x-enable-scrolltolower-event'); // css needs this;

    if (!enableScrollToLower) {
      if (this.#lowerObserver) {
        this.#lowerObserver.disconnect();
        this.#lowerObserver = undefined;
      }
      if (this.#childrenObserver) {
        this.#childrenObserver.disconnect();
        this.#childrenObserver = undefined;
      }
    } else {
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
  };

  @registerAttributeHandler('lower-threshold-item-count', true)
  #handleLowerThresholdItemCountChange(
    newValue: string | null,
    oldValue: string | null,
  ) {
    const oldItemCount = oldValue !== null
      ? parseFloat(oldValue)
      : 0;
    const oldObserverDom = oldItemCount === 0
      ? this.#getLowerThresholdObserverDom()
      : this.#dom.children[this.#dom.children.length - oldItemCount];
    oldObserverDom && this.#lowerObserver?.unobserve(oldObserverDom);

    const itemCount = newValue !== null
      ? parseFloat(newValue)
      : 0;
    const observerDom = itemCount === 0
      ? this.#getLowerThresholdObserverDom()
      : this.#dom.children[
        this.#dom.children.length
        - itemCount
      ];
    observerDom && this.#lowerObserver?.observe(observerDom);
  }

  #handleChildrenObserver = (mutationList: MutationRecord[]) => {
    const mutation = mutationList?.[0]!;

    // reset upper and lower observers
    if (mutation?.type === 'childList') {
      if (
        this.#eventSwitches.scrolltolower
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

  @registerEventEnableStatusChangeHandler('lynxscroll')
  @registerEventEnableStatusChangeHandler('lynxscrollend')
  @registerEventEnableStatusChangeHandler('snap')
  #handleScrollEventsSwitches = (enabled: boolean, name: string) => {
    this.#eventSwitches[name as 'lynxscroll' | 'lynxscrollend' | 'snap'] =
      enabled;
    const { lynxscroll, lynxscrollend, snap } = this.#eventSwitches;
    const scrollEventThrottle = this.#dom.getAttribute('scroll-event-throttle');
    this.#enableScrollEnd = lynxscrollend !== null || snap !== null;
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
  };

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

  @registerEventEnableStatusChangeHandler('scrolltoupperedge')
  #handleScrollToUpperEdgeEventEnable = (enabled: boolean) => {
    enabled
      ? this.#dom.setAttribute('x-enable-scrolltoupperedge-event', '')
      : this.#dom.removeAttribute('x-enable-scrolltoupperedge-event'); // css needs this;
    this.#updateUpperEdgeIntersectionObserver(enabled);
  };

  #updateUpperEdgeIntersectionObserver = bindToIntersectionObserver(
    this.#getListContainer,
    this.#getUpperThresholdObserverDom,
    this.#handleObserver,
  );

  @registerEventEnableStatusChangeHandler('scrolltoloweredge')
  #handleScrollToLowerEdgeEventEnable = (enabled: boolean) => {
    enabled
      ? this.#dom.setAttribute('x-enable-scrolltoloweredge-event', '')
      : this.#dom.removeAttribute('x-enable-scrolltoloweredge-event'); // css needs this;
    this.#updateLowerEdgeIntersectionObserver(enabled);
  };

  #updateLowerEdgeIntersectionObserver = bindToIntersectionObserver(
    this.#getListContainer,
    this.#getLowerThresholdObserverDom,
    this.#handleObserver,
  );

  #handleScrollEnd = () => {
    const itemSnap = this.#dom.getAttribute('item-snap');

    this.#dom.dispatchEvent(
      new CustomEvent('lynxscrollend', {
        ...commonComponentEventSetting,
      }),
    );

    if (itemSnap !== null) {
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
