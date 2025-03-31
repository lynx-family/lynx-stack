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

  __dom: XList;

  __getListContainer = genDomGetter(() => this.__dom.shadowRoot!, '__content');

  // The reason for using two observers is:
  // Using upper-threshold-item-count and lower-threshold-item-count configurations, it is possible that upper and lower observers monitor the same list-item.
  // Using the same observer, invoking callback event, it is impossible to confirm whether its source is upper or lower
  __upperObserver: IntersectionObserver | undefined;
  __lowerObserver: IntersectionObserver | undefined;
  // When list-item counts changes, Observer needs to be regenerated. Applicable to: Load More scenario
  __childrenObserver: MutationObserver | undefined;

  __prevX: number = 0;
  __prevY: number = 0;

  __enableScrollEnd = false;
  __debounceScrollForMockingScrollEnd?: ReturnType<typeof setTimeout>;

  __getUpperThresholdObserverDom = genDomGetter(
    () => this.__dom.shadowRoot!,
    '__upper-threshold-observer',
  );

  __getLowerThresholdObserverDom = genDomGetter(
    () => this.__dom.shadowRoot!,
    '__lower-threshold-observer',
  );
  __getScrollDetail() {
    const { scrollTop, scrollLeft, scrollHeight, scrollWidth } = this
      .__getListContainer();
    const detail = {
      scrollTop,
      scrollLeft,
      scrollHeight,
      scrollWidth,
      deltaX: scrollLeft - this.__prevX,
      deltaY: scrollTop - this.__prevY,
    };
    this.__prevX = scrollLeft;
    this.__prevY = scrollTop;
    return detail;
  }

  __handleUpperObserver = (entries: IntersectionObserverEntry[]) => {
    const { isIntersecting } = entries[0]!;

    if (isIntersecting) {
      this.__dom.dispatchEvent(
        new CustomEvent('scrolltoupper', {
          ...commonComponentEventSetting,
          detail: this.__getScrollDetail(),
        }),
      );
    }
  };

  @registerEventEnableStatusChangeHandler('scrolltoupper')
  __updateEventSwitches = (enableScrollToUpper: boolean) => {
    enableScrollToUpper
      ? this.__dom.setAttribute('x-enable-scrolltoupper-event', '')
      : this.__dom.removeAttribute('x-enable-scrolltoupper-event'); // css needs this;
    this.__eventSwitches.scrolltoupper = enableScrollToUpper;

    if (!enableScrollToUpper) {
      // if x-enable-scrolltoupper-event null, no need to handle upper-threshold-item-count
      if (this.__upperObserver) {
        this.__upperObserver.disconnect();
        this.__upperObserver = undefined;
      }
      if (this.__childrenObserver) {
        this.__childrenObserver.disconnect();
        this.__childrenObserver = undefined;
      }
    } else {
      if (!this.__upperObserver) {
        this.__upperObserver = new IntersectionObserver(
          this.__handleUpperObserver,
          {
            root: this.__getListContainer(),
          },
        );
      }
      if (!this.__childrenObserver) {
        this.__childrenObserver = new MutationObserver(
          this.__handleChildrenObserver,
        );
      }
      const upperThresholdItemCount = this.__dom.getAttribute(
        'upper-threshold-item-count',
      );
      const itemCount = upperThresholdItemCount !== null
        ? parseFloat(upperThresholdItemCount)
        : 0;
      const observerDom = itemCount === 0
        ? this.__getUpperThresholdObserverDom()
        : this.__dom.children[
          itemCount - 1
        ];
      observerDom && this.__upperObserver.observe(observerDom);

      this.__childrenObserver.observe(this.__dom, {
        childList: true,
      });
    }
  };

  @registerAttributeHandler('upper-threshold-item-count', true)
  __handleUpperThresholdItemCountChange(
    newValue: string | null,
    oldValue: string | null,
  ) {
    const oldItemCount = oldValue !== null
      ? parseFloat(oldValue)
      : 0;
    const oldObserverDom = oldItemCount === 0
      ? this.__getUpperThresholdObserverDom()
      : this.__dom.children[
        oldItemCount - 1
      ];
    oldObserverDom && this.__upperObserver?.unobserve(oldObserverDom);

    const itemCount = newValue !== null
      ? parseFloat(newValue)
      : 0;
    const observerDom = itemCount === 0
      ? this.__getUpperThresholdObserverDom()
      : this.__dom.children[
        itemCount - 1
      ];
    observerDom && this.__upperObserver?.observe(observerDom);
  }

  __handleLowerObserver = (entries: IntersectionObserverEntry[]) => {
    const { isIntersecting } = entries[0]!;
    if (isIntersecting) {
      this.__dom.dispatchEvent(
        new CustomEvent('scrolltolower', {
          ...commonComponentEventSetting,
          detail: this.__getScrollDetail(),
        }),
      );
    }
  };

  __eventSwitches = {
    lynxscroll: false,
    lynxscrollend: false,
    snap: false,
    scrolltolower: false,
    scrolltoupper: false,
  };

  @registerEventEnableStatusChangeHandler('scrolltolower')
  __updateScrollToLowerEventSwitches = (enableScrollToLower: boolean) => {
    this.__eventSwitches.scrolltolower = enableScrollToLower;
    enableScrollToLower
      ? this.__dom.setAttribute('x-enable-scrolltolower-event', '')
      : this.__dom.removeAttribute('x-enable-scrolltolower-event'); // css needs this;

    if (!enableScrollToLower) {
      if (this.__lowerObserver) {
        this.__lowerObserver.disconnect();
        this.__lowerObserver = undefined;
      }
      if (this.__childrenObserver) {
        this.__childrenObserver.disconnect();
        this.__childrenObserver = undefined;
      }
    } else {
      if (!this.__lowerObserver) {
        this.__lowerObserver = new IntersectionObserver(
          this.__handleLowerObserver,
          {
            root: this.__getListContainer(),
          },
        );
      }
      if (!this.__childrenObserver) {
        this.__childrenObserver = new MutationObserver(
          this.__handleChildrenObserver,
        );
      }
      const lowerThresholdItemCount = this.__dom.getAttribute(
        'lower-threshold-item-count',
      );
      const itemCount = lowerThresholdItemCount !== null
        ? parseFloat(lowerThresholdItemCount)
        : 0;
      const observerDom = itemCount === 0
        ? this.__getLowerThresholdObserverDom()
        : this.__dom.children[
          this.__dom.children.length
          - itemCount
        ];
      observerDom && this.__lowerObserver.observe(observerDom);

      this.__childrenObserver.observe(this.__dom, {
        childList: true,
      });
    }
  };

  @registerAttributeHandler('lower-threshold-item-count', true)
  __handleLowerThresholdItemCountChange(
    newValue: string | null,
    oldValue: string | null,
  ) {
    const oldItemCount = oldValue !== null
      ? parseFloat(oldValue)
      : 0;
    const oldObserverDom = oldItemCount === 0
      ? this.__getLowerThresholdObserverDom()
      : this.__dom.children[this.__dom.children.length - oldItemCount];
    oldObserverDom && this.__lowerObserver?.unobserve(oldObserverDom);

    const itemCount = newValue !== null
      ? parseFloat(newValue)
      : 0;
    const observerDom = itemCount === 0
      ? this.__getLowerThresholdObserverDom()
      : this.__dom.children[
        this.__dom.children.length
        - itemCount
      ];
    observerDom && this.__lowerObserver?.observe(observerDom);
  }

  __handleChildrenObserver = (mutationList: MutationRecord[]) => {
    const mutation = mutationList?.[0]!;

    // reset upper and lower observers
    if (mutation?.type === 'childList') {
      if (
        this.__eventSwitches.scrolltolower
      ) {
        // The reason why unobserve cannot be used is that the structure of list-item has changed,
        // and the list-item before the change cannot be obtained.
        // so disconnect and reconnect is required.
        if (this.__lowerObserver) {
          this.__lowerObserver.disconnect();
          this.__lowerObserver = undefined;
        }

        this.__lowerObserver = new IntersectionObserver(
          this.__handleLowerObserver,
          {
            root: this.__getListContainer(),
          },
        );

        const lowerThresholdItemCount = this.__dom.getAttribute(
          'lower-threshold-item-count',
        );
        const itemCount = lowerThresholdItemCount !== null
          ? parseFloat(lowerThresholdItemCount)
          : 0;
        const observerDom = itemCount === 0
          ? this.__getLowerThresholdObserverDom()
          : this.__dom.children[
            this.__dom.children.length
            - itemCount
          ];
        observerDom && this.__lowerObserver.observe(observerDom);
      }

      if (
        this.__dom.getAttribute(
          'x-enable-scrolltoupper-event',
        ) !== null
      ) {
        // The reason why unobserve cannot be used is that the structure of list-item has changed,
        // and the list-item before the change cannot be obtained.
        // so disconnect and reconnect is required.
        if (this.__upperObserver) {
          this.__upperObserver.disconnect();
          this.__upperObserver = undefined;
        }

        this.__upperObserver = new IntersectionObserver(
          this.__handleUpperObserver,
          {
            root: this.__getListContainer(),
          },
        );

        const upperThresholdItemCount = this.__dom.getAttribute(
          'upper-threshold-item-count',
        );
        const itemCount = upperThresholdItemCount !== null
          ? parseFloat(upperThresholdItemCount)
          : 0;
        const observerDom = itemCount === 0
          ? this.__getUpperThresholdObserverDom()
          : this.__dom.children[
            itemCount - 1
          ];
        observerDom && this.__upperObserver.observe(observerDom);
      }
    }
  };

  __throttledScroll: null | (() => void) = null;

  __handleScroll = () => {
    if (this.__enableScrollEnd && !useScrollEnd) {
      // debounce
      clearTimeout(this.__debounceScrollForMockingScrollEnd);
      this.__debounceScrollForMockingScrollEnd = setTimeout(() => {
        this.__handleScrollEnd();
      }, 100);
    }
    this.__dom.dispatchEvent(
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
  __handleScrollEventsSwitches = (enabled: boolean, name: string) => {
    this.__eventSwitches[name as 'lynxscroll' | 'lynxscrollend' | 'snap'] =
      enabled;
    const { lynxscroll, lynxscrollend, snap } = this.__eventSwitches;
    const scrollEventThrottle = this.__dom.getAttribute(
      'scroll-event-throttle',
    );
    this.__enableScrollEnd = lynxscrollend !== null || snap !== null;
    const listContainer = this.__getListContainer();

    // cancel the previous listener first
    this.__throttledScroll
      && listContainer.removeEventListener('scroll', this.__throttledScroll);
    if (scroll !== null || this.__enableScrollEnd) {
      const wait = scrollEventThrottle !== null
        ? parseFloat(scrollEventThrottle)
        : 0;
      const throttledScroll = throttle(this.__handleScroll, wait, {
        leading: true,
        trailing: false,
      });
      this.__throttledScroll = throttledScroll;

      listContainer.addEventListener(
        'scroll',
        this.__throttledScroll!,
      );
      this.__prevX = 0;
      this.__prevY = 0;
    }

    if (useScrollEnd && this.__enableScrollEnd) {
      listContainer.addEventListener('scrollend', this.__handleScrollEnd);
    } else {
      listContainer.removeEventListener('scrollend', this.__handleScrollEnd);
    }
  };

  __handleObserver = (entries: IntersectionObserverEntry[]) => {
    const { isIntersecting, target } = entries[0]!;
    const id = target.id;
    if (isIntersecting) {
      if (id === 'upper-threshold-observer') {
        this.__dom.dispatchEvent(
          new CustomEvent('scrolltoupperedge', {
            ...commonComponentEventSetting,
            detail: this.__getScrollDetail(),
          }),
        );
      } else if (id === 'lower-threshold-observer') {
        this.__dom.dispatchEvent(
          new CustomEvent('scrolltoloweredge', {
            ...commonComponentEventSetting,
            detail: this.__getScrollDetail(),
          }),
        );
      }
    }
  };

  @registerEventEnableStatusChangeHandler('scrolltoupperedge')
  __handleScrollToUpperEdgeEventEnable = (enabled: boolean) => {
    enabled
      ? this.__dom.setAttribute('x-enable-scrolltoupperedge-event', '')
      : this.__dom.removeAttribute('x-enable-scrolltoupperedge-event'); // css needs this;
    this.__updateUpperEdgeIntersectionObserver(enabled);
  };

  __updateUpperEdgeIntersectionObserver = bindToIntersectionObserver(
    this.__getListContainer,
    this.__getUpperThresholdObserverDom,
    this.__handleObserver,
  );

  @registerEventEnableStatusChangeHandler('scrolltoloweredge')
  __handleScrollToLowerEdgeEventEnable = (enabled: boolean) => {
    enabled
      ? this.__dom.setAttribute('x-enable-scrolltoloweredge-event', '')
      : this.__dom.removeAttribute('x-enable-scrolltoloweredge-event'); // css needs this;
    this.__updateLowerEdgeIntersectionObserver(enabled);
  };

  __updateLowerEdgeIntersectionObserver = bindToIntersectionObserver(
    this.__getListContainer,
    this.__getLowerThresholdObserverDom,
    this.__handleObserver,
  );

  __handleScrollEnd = () => {
    const itemSnap = this.__dom.getAttribute('item-snap');

    this.__dom.dispatchEvent(
      new CustomEvent('lynxscrollend', {
        ...commonComponentEventSetting,
      }),
    );

    if (itemSnap !== null) {
      const children = Array.from(this.__dom.children).filter(node => {
        return node.tagName === 'LIST-ITEM';
      });
      const scrollTop = this.__getListContainer().scrollTop;
      const scrollLeft = this.__getListContainer().scrollLeft;
      const snapItem = children.find((ele: any) => {
        return scrollTop >= ele.offsetTop
          && scrollTop < ele.offsetTop + ele.offsetHeight;
      });

      this.__dom.dispatchEvent(
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
    this.__dom = dom;
  }
}
