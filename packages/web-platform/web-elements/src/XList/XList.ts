/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component, genDomGetter } from '@lynx-js/web-elements-reactive';
import { XListAttributes } from './XListAttributes.js';
import { XListEvents } from './XListEvents.js';
import { XListWaterfall } from './XListWaterfall.js';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';
import { templateXList } from '@lynx-js/web-elements-template';

@Component<typeof XList>(
  'x-list',
  [CommonEventsAndMethods, XListAttributes, XListEvents, XListWaterfall],
  templateXList,
)
export class XList extends HTMLElement {
  static readonly notToFilterFalseAttributes = new Set(['enable-scroll']);

  #getListContainer = genDomGetter(() => this.shadowRoot!, '#content');

  #autoScrollOptions = {
    rate: 0,
    lastTimestamp: 0,
    autoStop: true,
    isScrolling: false,
  };

  #cellsMap: Record<string, Element> = {};

  override get scrollTop() {
    return this.#getListContainer().scrollTop;
  }

  override set scrollTop(val: number) {
    this.#getListContainer().scrollTop = val;
  }

  override get scrollLeft() {
    return this.#getListContainer().scrollTop;
  }

  override set scrollLeft(val: number) {
    this.#getListContainer().scrollLeft = val;
  }

  get __scrollTop() {
    return super.scrollTop;
  }

  get __scrollLeft() {
    return super.scrollTop;
  }

  scrollToPosition(
    params: {
      index: number;
      smooth?: boolean;
      /**
       * @description The offset of the content
       * @defaultValue 0
       */
      offset?: `${number}px` | `${number}rpx` | `${number}ppx` | number;
    },
  ) {
    let offset: { left: number; top: number } | undefined;
    if (typeof params.offset === 'string') {
      const offsetValue = parseFloat(params.offset);
      offset = { left: offsetValue, top: offsetValue };
    } else if (typeof params.offset === 'number') {
      offset = { left: params.offset, top: params.offset };
    }

    if (typeof params.index === 'number') {
      if (params.index === 0) {
        this.#getListContainer().scrollTop = 0;
        this.#getListContainer().scrollLeft = 0;
      } else if (params.index > 0 && params.index < this.childElementCount) {
        const targetKid = this.children.item(params.index);
        if (targetKid instanceof HTMLElement) {
          if (offset) {
            offset = {
              left: targetKid.offsetLeft + offset.left,
              top: targetKid.offsetTop + offset.top,
            };
          } else {
            offset = { left: targetKid.offsetLeft, top: targetKid.offsetTop };
          }
        }
      }
    }

    if (offset) {
      this.#getListContainer().scrollTo({
        ...offset,
        behavior: params.smooth ? 'smooth' : 'auto',
      });
    }
  }

  #autoScroll = (timestamp: number) => {
    if (!this.#autoScrollOptions.isScrolling) {
      return;
    }

    if (!this.#autoScrollOptions.lastTimestamp) {
      this.#autoScrollOptions.lastTimestamp = timestamp;
    }

    const scrollContainer = this.#getListContainer();
    const deltaTime = timestamp - this.#autoScrollOptions.lastTimestamp;
    const tickDistance = (deltaTime / 1000) * this.#autoScrollOptions.rate;

    scrollContainer.scrollBy({
      left: tickDistance,
      top: tickDistance,
      behavior: 'smooth',
    });

    this.#autoScrollOptions.lastTimestamp = timestamp;
    if (
      scrollContainer.scrollTop + scrollContainer.clientHeight
        >= scrollContainer.scrollHeight && this.#autoScrollOptions.autoStop
    ) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight
        - scrollContainer.clientHeight;
      this.#autoScrollOptions.isScrolling = false;
    } else {
      requestAnimationFrame(this.#autoScroll);
    }
  };

  autoScroll(
    params: {
      /**
       * @description The scrolling interval per second, supports positive and negative
       * @defaultValue null
       */
      rate: `${number}px` | `${number}rpx` | `${number}ppx` | number;
      /**
       * @description start/pause autoScroll
       * @defaultValue true
       */
      start: boolean;
      /**
       * @description Whether to stop automatically when sliding to the bottom
       * @defaultValue true
       */
      autoStop: boolean;
    },
  ) {
    if (params.start) {
      const rate = typeof params.rate === 'number'
        ? params.rate
        : parseFloat(params.rate);

      this.#autoScrollOptions = {
        rate,
        lastTimestamp: 0,
        isScrolling: true,
        autoStop: params.autoStop !== false ? true : false,
      };
      requestAnimationFrame(this.#autoScroll);
    } else {
      this.#autoScrollOptions.isScrolling = false;
    }
  }

  getScrollContainerInfo() {
    return {
      scrollTop: this.scrollTop,
      scrollLeft: this.scrollLeft,
      scrollHeight: this.scrollHeight,
      scrollWidth: this.scrollWidth,
    };
  }

  getVisibleCells = () => {
    const cells = Object.values(this.#cellsMap);
    const children = Array.from(this.children).filter(node => {
      return node.tagName === 'LIST-ITEM';
    });

    return cells.map(cell => {
      const rect = cell.getBoundingClientRect();

      return {
        id: cell.getAttribute('id'),
        itemKey: cell.getAttribute('item-key'),
        bottom: rect.bottom,
        top: rect.top,
        left: rect.left,
        right: rect.right,
        index: children.indexOf(cell),
      };
    });
  };

  #getListItemInfo = () => {
    const cells = Object.values(this.#cellsMap);

    return cells.map(cell => {
      const rect = cell.getBoundingClientRect();

      return {
        height: rect.height,
        width: rect.width,
        itemKey: cell.getAttribute('item-key'),
        originX: rect.x,
        originY: rect.y,
      };
    });
  };

  #contentVisibilityChange = (event: Event) => {
    if (!event.target || !(event.target instanceof HTMLElement)) {
      return;
    }

    const skipped = (event as ContentVisibilityAutoStateChangeEvent).skipped;

    const isContent =
      (event.target as Element)?.getAttribute('id') === 'content'
      && (event.target as Element)?.getAttribute('part') === 'content';
    const isListItem = (event.target as Element).tagName === 'LIST-ITEM';

    if (isContent && !skipped) {
      const visibleItemBeforeUpdate = this.#getListItemInfo();

      setTimeout(() => {
        this.dispatchEvent(
          new CustomEvent('layoutcomplete', {
            ...commonComponentEventSetting,
            detail: {
              visibleItemBeforeUpdate,
              visibleItemAfterUpdate: this.#getListItemInfo(),
            },
          }),
        );
        // Set 100 is because #content is the parent container of list-item, and content is always visible before list-item.
        // We cannot obtain the timing of all the successfully visible list-items on the screen, so 100ms is used to delay this behavior.
      }, 100);
      return;
    }

    if (isListItem) {
      const itemKey = (event.target as Element)?.getAttribute('item-key')!;

      if (!itemKey) {
        return;
      }

      if (skipped) {
        this.#cellsMap[itemKey] && delete this.#cellsMap[itemKey];
      } else {
        this.#cellsMap[itemKey] = event.target as Element;
      }
      return;
    }
  };

  connectedCallback() {
    const listContainer = this.#getListContainer();

    listContainer.addEventListener(
      'contentvisibilityautostatechange',
      this.#contentVisibilityChange,
      {
        passive: true,
      },
    );
  }
}
