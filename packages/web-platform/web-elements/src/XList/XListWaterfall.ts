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

const WATERFALL_CONTENT = 'waterfall-content';
const WATERFALL_SLOT = 'waterfall-slot';

export class XListWaterfall
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = [
    'list-type',
  ];

  #dom: XList;
  #childrenObserver: MutationObserver | undefined;

  #getListContainer = genDomGetter(() => this.#dom.shadowRoot!, '#content');
  #getWaterfallCOntent = genDomGetter(
    () => this.#dom.shadowRoot!,
    `#${WATERFALL_CONTENT}`,
  );

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
      slotContainer.setAttribute('style', `contain: layout;`);

      const slot = document.createElement('slot');
      slot.setAttribute('name', `${WATERFALL_SLOT}-${i}`);
      slotContainer.appendChild(slot);
      return slotContainer;
    });

    const waterfallContainer = document.createElement('div');
    waterfallContainer.setAttribute(
      'id',
      WATERFALL_CONTENT,
    );
    waterfallContainer.setAttribute(
      'part',
      WATERFALL_CONTENT,
    );
    waterfallContainer.append(...slotContainer);
    this.#dom.shadowRoot?.querySelector('[part=upper-threshold-observer]')
      ?.insertAdjacentElement('afterend', waterfallContainer);
  };
  #removeWaterfallContainer = () => {
    this.#getListContainer().removeChild(this.#getWaterfallCOntent());
  };

  #layoutListItem = (spanCount: number, isScrollVertical: boolean) => {
    // First, layout each track
    const listMeasurement = isScrollVertical
      ? this.#dom.getBoundingClientRect().height
      : this.#dom.getBoundingClientRect().width;
    const measurements = new Array(spanCount).fill(0);

    for (let i = 0; i < this.#dom.children.length; i++) {
      const listItem = this.#dom.children[i];
      // Find the shortest column
      let shortestColumnIndex = 0;
      for (let j = 1; j < spanCount; j++) {
        if (measurements[j] < measurements[shortestColumnIndex]) {
          shortestColumnIndex = j;
        }
      }
      // Add item to the shortest column and update its measurement
      measurements[shortestColumnIndex] += (isScrollVertical
        ? listItem?.getBoundingClientRect()
          .height
        : listItem?.getBoundingClientRect()
          .width)
        || listItem?.getAttribute('estimated-main-axis-size-px')
        || listMeasurement;
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
      const spanCount = parseFloat(
        this.#dom.getAttribute('span-count')
          || this.#dom.getAttribute('column-count')
          || '',
      ) || 1;
      const scrollOrientation = this.#dom.getAttribute('scroll-orientation')
        || 'vertical';

      requestAnimationFrame(() => {
        this.#createWaterfallContainer(spanCount);
        this.#layoutListItem(spanCount, scrollOrientation === 'vertical');

        this.#childrenObserver = new MutationObserver((mutationList) => {
          const mutation = mutationList?.[0]!;

          if (mutation.type === 'childList') {
            // let the inserted list-item rendered, otherwise its width and height are not determined yet.
            // requestAnimationFrame is called before inserted list-item is rendered, so setTimeout is used here
            setTimeout(() => {
              this.#layoutListItem(spanCount, scrollOrientation === 'vertical');
            });
          }
        });
        this.#childrenObserver.observe(this.#dom, {
          childList: true,
        });
      });
    } else {
      this.#removeWaterfallContainer();
      this.#childrenObserver?.disconnect();
      this.#childrenObserver = undefined;
    }
  }

  constructor(dom: XList) {
    this.#dom = dom;
  }
}
