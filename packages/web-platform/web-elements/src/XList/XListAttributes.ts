/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  bindToStyle,
  boostedQueueMicrotask,
  registerAttributeHandler,
} from '@lynx-js/web-elements-reactive';
import type { XList } from './XList.js';

const WATERFALL_SLOT = 'waterfall-slot';

export class XListAttributes
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = [
    'sticky-offset',
    'initial-scroll-index',
    'span-count',
    'column-count',
    'list-type',
  ];

  #dom: XList;

  @registerAttributeHandler('sticky-offset', true)
  #handlerStickyOffset = bindToStyle(
    () => this.#dom,
    '--list-item-sticky-offset',
    (v) => `${parseFloat(v)}px`,
  );

  @registerAttributeHandler('span-count', true)
  @registerAttributeHandler('column-count', true)
  #handlerCount = bindToStyle(
    () => this.#dom,
    '--list-item-span-count',
    (v) => `${parseFloat(v)}`,
  );

  #createWaterfallContainer = (spanCount: number) => {
    const slotContainer = new Array(spanCount).fill(0).map((_, i) => {
      const slotContainer = document.createElement('div');
      slotContainer.setAttribute(
        'part',
        `${WATERFALL_SLOT}-container`,
      );
      slotContainer.setAttribute('id', `${WATERFALL_SLOT}-${i}-container`);
      const slot = document.createElement('slot');
      slot.setAttribute('name', `${WATERFALL_SLOT}-${i}`);
      slot.setAttribute('style', `contain: strict;`);
      slotContainer.appendChild(slot);
      return slotContainer;
    });

    const waterfallContainer = document.createElement('div');
    waterfallContainer.setAttribute(
      'part',
      'waterfall-content',
    );
    waterfallContainer.append(...slotContainer);
    this.#dom.shadowRoot?.querySelector('[part=upper-threshold-observer]')
      ?.insertAdjacentElement('afterend', waterfallContainer);
  };

  @registerAttributeHandler('list-type', false)
  #handlerListType(newVal: string | null) {
    // return;
    if (newVal === 'waterfall') {
      const spanCount = parseFloat(
        this.#dom.getAttribute('span-count')
          || this.#dom.getAttribute('column-count')
          || '',
      ) || 1;
      this.#createWaterfallContainer(spanCount);

      // First, layout each track
      const heights = new Array(spanCount).fill(0);
      const listHeight = this.#dom.getBoundingClientRect().height;
      for (let i = 0; i < this.#dom.children.length; i++) {
        const listItem = this.#dom.children[i];
        // Find the shortest column
        let shortestColumnIndex = 0;
        for (let j = 1; j < spanCount; j++) {
          if (heights[j] < heights[shortestColumnIndex]) {
            shortestColumnIndex = j;
          }
        }
        // Add item to the shortest column and update its height
        heights[shortestColumnIndex] += listItem?.getBoundingClientRect()
          .height || listItem?.getAttribute('estimated-height') || listHeight;
        listItem?.setAttribute(
          WATERFALL_SLOT,
          `${WATERFALL_SLOT}-${shortestColumnIndex}`,
        );
      }
      // Second, move the item to the corresponding slot
      for (let i = 0; i < this.#dom.children.length; i++) {
        const listItem = this.#dom.children[i];
        listItem?.setAttribute(
          'slot',
          listItem?.getAttribute(WATERFALL_SLOT)!,
        );
      }
    }
  }

  constructor(dom: XList) {
    this.#dom = dom;
  }

  connectedCallback() {
    const initialScrollIndex = this.#dom.getAttribute('initial-scroll-index');

    if (initialScrollIndex !== null) {
      const index = parseFloat(initialScrollIndex);
      const scrollToInitialIndex = () => {
        if (this.#dom.clientHeight === 0) {
          // In Safari, there is the potential race condition between the browser's layout and clientWidth calculate.
          // So, we have to use requestAnimationFrame to ensure that the code runs after the browser's layout.
          requestAnimationFrame(scrollToInitialIndex);
        } else {
          this.#dom.scrollToPosition({ index });
        }
      };

      // The reason for using microtasks is that the width and height of the child element may not be rendered at this time, so it will not be able to scroll.
      boostedQueueMicrotask(scrollToInitialIndex);
    }
  }
}
