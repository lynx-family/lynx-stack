/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  boostedQueueMicrotask,
  Component,
  genDomGetter,
  html,
} from '@lynx-js/web-elements-reactive';
import { XListAttributes } from './XListAttributes.js';
import { XListEvents } from './XListEvents.js';
import { LynxExposure } from '../common/Exposure.js';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';

@Component<typeof XList>(
  'x-list',
  [LynxExposure, XListAttributes, XListEvents],
  html`<style>
  .placeholder-dom {
    display: none;
    flex: 0 0 0;
    align-self: stretch;
    min-height: 0;
    min-width: 0;
  }
  .observer-container {
    flex-direction: inherit;
    overflow: visible;
  }
  .observer {
    display: flex;
  }
  </style>
  <div id="content" part="content">
    <div
      class="observer-container placeholder-dom"
      part="upper-threshold-observer"
    >
      <div
        class="observer placeholder-dom"
        id="upper-threshold-observer"
      ></div>
    </div>
    <slot part="slot"></slot>
    <div
      class="observer-container placeholder-dom"
      part="lower-threshold-observer"
    >
      <div
        class="observer placeholder-dom"
        id="lower-threshold-observer"
      ></div>
    </div>
  </div>`,
)
export class XList extends HTMLElement {
  static readonly notToFilterFalseAttributes = new Set(['enable-scroll']);

  __getListContainer = genDomGetter(() => this.shadowRoot!, '__content');

  __autoScrollOptions = {
    rate: 0,
    lastTimestamp: 0,
    autoStop: true,
    isScrolling: false,
  };

  __cellsMap: Record<string, Element> = {};

  override get scrollTop() {
    return this.__getListContainer().scrollTop;
  }

  override set scrollTop(val: number) {
    this.__getListContainer().scrollTop = val;
  }

  override get scrollLeft() {
    return this.__getListContainer().scrollTop;
  }

  override set scrollLeft(val: number) {
    this.__getListContainer().scrollLeft = val;
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
        this.__getListContainer().scrollTop = 0;
        this.__getListContainer().scrollLeft = 0;
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
      this.__getListContainer().scrollTo({
        ...offset,
        behavior: params.smooth ? 'smooth' : 'auto',
      });
    }
  }

  __autoScroll = (timestamp: number) => {
    if (!this.__autoScrollOptions.isScrolling) {
      return;
    }

    if (!this.__autoScrollOptions.lastTimestamp) {
      this.__autoScrollOptions.lastTimestamp = timestamp;
    }

    const scrollContainer = this.__getListContainer();
    const deltaTime = timestamp - this.__autoScrollOptions.lastTimestamp;
    const tickDistance = (deltaTime / 1000) * this.__autoScrollOptions.rate;

    scrollContainer.scrollBy({
      left: tickDistance,
      top: tickDistance,
      behavior: 'smooth',
    });

    this.__autoScrollOptions.lastTimestamp = timestamp;
    if (
      scrollContainer.scrollTop + scrollContainer.clientHeight
        >= scrollContainer.scrollHeight && this.__autoScrollOptions.autoStop
    ) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight
        - scrollContainer.clientHeight;
      this.__autoScrollOptions.isScrolling = false;
    } else {
      requestAnimationFrame(this.__autoScroll);
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

      this.__autoScrollOptions = {
        rate,
        lastTimestamp: 0,
        isScrolling: true,
        autoStop: params.autoStop !== false ? true : false,
      };
      requestAnimationFrame(this.__autoScroll);
    } else {
      this.__autoScrollOptions.isScrolling = false;
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
    const cells = Object.values(this.__cellsMap);
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

  __getListItemInfo = () => {
    const cells = Object.values(this.__cellsMap);

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

  __contentVisibilityChange = (event: Event) => {
    if (!event.target || !(event.target instanceof HTMLElement)) {
      return;
    }

    const skipped = (event as ContentVisibilityAutoStateChangeEvent).skipped;

    const isContent =
      (event.target as Element)?.getAttribute('id') === 'content'
      && (event.target as Element)?.getAttribute('part') === 'content';
    const isListItem = (event.target as Element).tagName === 'LIST-ITEM';

    if (isContent && !skipped) {
      const visibleItemBeforeUpdate = this.__getListItemInfo();

      setTimeout(() => {
        this.dispatchEvent(
          new CustomEvent('layoutcomplete', {
            ...commonComponentEventSetting,
            detail: {
              visibleItemBeforeUpdate,
              visibleItemAfterUpdate: this.__getListItemInfo(),
            },
          }),
        );
        // Set 100 is because __content is the parent container of list-item, and content is always visible before list-item.
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
        this.__cellsMap[itemKey] && delete this.__cellsMap[itemKey];
      } else {
        this.__cellsMap[itemKey] = event.target as Element;
      }
      return;
    }
  };

  connectedCallback() {
    const listContainer = this.__getListContainer();

    listContainer.addEventListener(
      'contentvisibilityautostatechange',
      this.__contentVisibilityChange,
      {
        passive: true,
      },
    );
  }
}
