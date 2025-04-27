/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  boostedQueueMicrotask,
  genDomGetter,
  type AttributeReactiveClass,
} from '@lynx-js/web-elements-reactive';
import type { XList } from './XList.js';

const WATERFALL_SLOT = 'waterfall-slot';
const WATERFALL_STYLE = 'waterfall-style';

export class XListWaterfall
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = [];

  #dom: XList;
  #getListContainer = genDomGetter(() => this.#dom.shadowRoot!, '#content');
  #getLowerThresholdObserver = genDomGetter(
    () => this.#dom.shadowRoot!,
    'div[part="lower-threshold-observer"]',
  );

  #resizeObserver?: ResizeObserver;
  #childrenObserver: MutationObserver | undefined;

  #createWaterfallContainer = () => {
    const waterfallSlot = document.createElement('slot');
    waterfallSlot.setAttribute('name', `${WATERFALL_SLOT}`);
    this.#dom.shadowRoot?.querySelector('[part=upper-threshold-observer]')
      ?.insertAdjacentElement('afterend', waterfallSlot);
  };

  #layoutListItem = (spanCount: number, isScrollVertical: boolean) => {
    const measurements = new Array(spanCount).fill(0);

    for (let i = 0; i < this.#dom.children.length; i++) {
      const listItem = this.#dom.children[i] as Element;
      const mainAxisGap = getComputedStyle(listItem).getPropertyValue(
        '--list-main-axis-gap',
      );
      const crossAxisGap = getComputedStyle(listItem).getPropertyValue(
        '--list-cross-axis-gap',
      );

      const increasedMeasurement = isScrollVertical
        ? listItem.getBoundingClientRect().height + parseFloat(mainAxisGap)
        : listItem.getBoundingClientRect().width + parseFloat(mainAxisGap);

      if (listItem.getAttribute('full-span') !== null) {
        let longestMeasurement = measurements[0];
        // Find the longest track.
        for (let j = 1; j < spanCount; j++) {
          if (measurements[j] > longestMeasurement) {
            longestMeasurement = measurements[j];
          }
        }
        for (let j = 0; j < spanCount; j++) {
          measurements[j] = longestMeasurement + increasedMeasurement;
        }
        if (isScrollVertical) {
          listItem.setAttribute(
            `${WATERFALL_STYLE}-left`,
            '0',
          );
          listItem.setAttribute(
            `${WATERFALL_STYLE}-top`,
            `${longestMeasurement}px`,
          );
        } else {
          listItem.setAttribute(
            `${WATERFALL_STYLE}-left`,
            `${longestMeasurement}px`,
          );
          listItem.setAttribute(
            `${WATERFALL_STYLE}-top`,
            '0',
          );
        }
      } else {
        let shortestIndex = 0;
        let shortestMeasurement = measurements[0];

        // Find the shortest track.
        for (let j = 1; j < spanCount; j++) {
          if (measurements[j] < shortestMeasurement) {
            shortestIndex = j;
            shortestMeasurement = measurements[j];
          }
        }

        const crossOffset =
          `calc(${shortestIndex} * (100% - ${crossAxisGap} * (${spanCount} - 1))/ ${spanCount} + ${
            Math.max(0, shortestIndex)
          } * ${crossAxisGap})`;
        if (isScrollVertical) {
          listItem.setAttribute(
            `${WATERFALL_STYLE}-left`,
            crossOffset,
          );
          listItem.setAttribute(
            `${WATERFALL_STYLE}-top`,
            `${shortestMeasurement}px`,
          );
        } else {
          listItem.setAttribute(
            `${WATERFALL_STYLE}-left`,
            `${shortestMeasurement}px`,
          );
          listItem.setAttribute(
            `${WATERFALL_STYLE}-top`,
            crossOffset,
          );
        }

        measurements[shortestIndex] += increasedMeasurement;
      }
    }

    for (let i = 0; i < this.#dom.children.length; i++) {
      const listItem = this.#dom.children[i] as HTMLElement;
      listItem.style.setProperty(
        'left',
        listItem.getAttribute(`${WATERFALL_STYLE}-left`),
      );
      listItem.style.setProperty(
        'top',
        listItem.getAttribute(`${WATERFALL_STYLE}-top`),
      );
      listItem.setAttribute('slot', WATERFALL_SLOT);
    }

    // The reasons why it is not unified in #updateScrollToLowerEventSwitches is:
    // It is impossible to ensure that list-item is not rendered, so it will cause incorrect listContent.scrollHeight/scrollWidth as height/width.
    const enableScrollToLower = this.#dom.getAttribute(
      'x-enable-scrolltolower-event',
    );
    if (enableScrollToLower !== null && enableScrollToLower !== 'false') {
      const lower = this.#getLowerThresholdObserver();
      const scrollOrientation = this.#dom.getAttribute('scroll-orientation')
        || 'vertical';
      const listContent = this.#getListContainer();

      if (scrollOrientation === 'vertical') {
        lower.style.setProperty(
          'top',
          // Firefox cannot trigger the bottom IntersectionObserver
          `${String(listContent.scrollHeight - 1)}px`,
          'important',
        );
        // Firefox needs this
        lower.style.setProperty(
          'bottom',
          'unset',
          'important',
        );
      } else {
        lower.style.setProperty(
          'left',
          // Firefox cannot trigger the bottom IntersectionObserver
          `${String(listContent.scrollHeight - 1)}px`,
        );
        // Firefox needs this
        lower.style.setProperty(
          'right',
          'unset',
        );
      }
    }
  };

  constructor(dom: XList) {
    this.#dom = dom;
  }

  #resizeObserverInit = (spanCount: number, isScrollVertical: boolean) => {
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = new ResizeObserver(() => {
      // may cause: Resizeobserver loop completed with undelivered notifications
      // https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver#observation_errors
      boostedQueueMicrotask(() => {
        this.#layoutListItem(
          spanCount,
          isScrollVertical,
        );
      });
    });
    Array.from(this.#dom.children).forEach(element => {
      this.#resizeObserver?.observe(element);
    });
  };

  connectedCallback() {
    if (this.#dom.getAttribute('list-type') === 'waterfall') {
      const spanCount = parseFloat(
        this.#dom.getAttribute('span-count')
          || this.#dom.getAttribute('column-count')
          || '',
      ) || 1;
      const scrollOrientation = this.#dom.getAttribute('scroll-orientation')
        || 'vertical';

      this.#createWaterfallContainer();

      if (!this.#resizeObserver) {
        this.#resizeObserverInit(spanCount, scrollOrientation === 'vertical');
      }

      if (!this.#childrenObserver) {
        this.#childrenObserver = new MutationObserver(
          (mutationList: MutationRecord[]) => {
            const mutation = mutationList?.[0]!;

            if (mutation?.type === 'childList') {
              this.#resizeObserverInit(
                spanCount,
                scrollOrientation === 'vertical',
              );
            }
          },
        );
        this.#childrenObserver.observe(this.#dom, {
          childList: true,
        });
      }
    }
  }
}
