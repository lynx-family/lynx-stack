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
import type { XList } from './XList.js';

const WATERFALL_SLOT = 'waterfall-slot';

export class XListWaterfall
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = [
    'list-type',
  ];

  #dom: XList;

  #childrenObserver: MutationObserver | undefined;

  /**  *
   * @param spanCount
   * create slots based on span-count
   */
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

  #layoutListItem = (spanCount: number) => {
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
        .height
        || listItem?.getAttribute('estimated-main-axis-size-px')
        || listHeight;
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
  };

  @registerAttributeHandler('list-type', false)
  #handlerListType(newVal: string | null) {
    if (newVal === 'waterfall') {
      requestAnimationFrame(() => {
        const spanCount = parseFloat(
          this.#dom.getAttribute('span-count')
            || this.#dom.getAttribute('column-count')
            || '',
        ) || 1;
        this.#createWaterfallContainer(spanCount);
        this.#layoutListItem(spanCount);

        this.#childrenObserver = new MutationObserver((mutationList) => {
          const mutation = mutationList?.[0]!;

          if (mutation.type === 'childList') {
            // let the inserted list-item rendered, otherwise its width and height are not determined yet.
            // requestAnimationFrame is called before inserted list-item is rendered, so setTimeout is used here
            setTimeout(() => {
              this.#layoutListItem(spanCount);
            });
          }
        });
        this.#childrenObserver.observe(this.#dom, {
          childList: true,
        });
      });
    } else {
      this.#childrenObserver?.disconnect();
      this.#childrenObserver = undefined;
    }
  }

  constructor(dom: XList) {
    this.#dom = dom;
  }
}
