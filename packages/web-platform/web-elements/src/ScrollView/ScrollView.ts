/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';
import { FadeEdgeLengthAttribute } from './FadeEdgeLengthAttribute.js';
import { ScrollAttributes } from './ScrollAttributes.js';
import { ScrollViewEvents } from './ScrollViewEvents.js';
import { ScrollIntoView } from './ScrollIntoView.js';
import { Component, html } from '@lynx-js/web-elements-reactive';
import { scrollContainerDom } from '../common/constants.js';

@Component<typeof ScrollView>(
  'scroll-view',
  [
    CommonEventsAndMethods,
    ScrollAttributes,
    FadeEdgeLengthAttribute,
    ScrollViewEvents,
    ScrollIntoView,
  ],
  html` <style>
      .placeholder-dom {
        display: none;
        flex: 0 0 0;
        align-self: stretch;
        min-height: 0;
        min-width: 0;
      }
      .mask {
        z-index: 1;
        position: sticky;
      }
      .observer-container {
        flex-direction: inherit;
        overflow: visible;
      }
      .observer {
        display: flex;
      }
      ::-webkit-scrollbar {
        display: none;
      }

      @keyframes topFading {
        0% {
          box-shadow: transparent 0px 0px 0px 0px;
        }
        5% {
          box-shadow: var(--scroll-view-bg-color) 0px 0px
            var(--scroll-view-fading-edge-length)
            var(--scroll-view-fading-edge-length);
        }
        100% {
          box-shadow: var(--scroll-view-bg-color) 0px 0px
            var(--scroll-view-fading-edge-length)
            var(--scroll-view-fading-edge-length);
        }
      }
      @keyframes botFading {
        0% {
          box-shadow: var(--scroll-view-bg-color) 0px 0px
            var(--scroll-view-fading-edge-length)
            var(--scroll-view-fading-edge-length);
        }
        95% {
          box-shadow: var(--scroll-view-bg-color) 0px 0px
            var(--scroll-view-fading-edge-length)
            var(--scroll-view-fading-edge-length);
        }
        100% {
          box-shadow: transparent 0px 0px 0px 0px;
        }
      }
    </style>
      <div
        class="mask placeholder-dom"
        id="top-fade-mask"
        part="top-fade-mask"
      ></div>
      <div
        class="observer-container placeholder-dom"
        part="upper-threshold-observer"
      >
        <div
          class="observer placeholder-dom"
          id="upper-threshold-observer"
        ></div>
      </div>
      <slot></slot>
      <div
        class="observer-container placeholder-dom"
        part="lower-threshold-observer"
      >
        <div
          class="observer placeholder-dom"
          id="lower-threshold-observer"
        ></div>
      </div>
      <div
        class="mask placeholder-dom"
        id="bot-fade-mask"
        part="bot-fade-mask"
      ></div>`,
)
export class ScrollView extends HTMLElement {
  static readonly notToFilterFalseAttributes = new Set(['enable-scroll']);
  static readonly scrollInterval = 100;
  #autoScrollTimer?: NodeJS.Timeout;
  override scrollTo(options: {
    /**
     * @description The offset of the content
     * @defaultValue 0
     */
    offset?: `${number}px` | `${number}rpx` | `${number}ppx` | number;
    /**
     * @description target node
     */
    index: number;
    smooth?: boolean;
  }): void;
  override scrollTo(options?: ScrollToOptions | undefined): void;
  override scrollTo(x: number, y: number): void;
  override scrollTo(...args: any[]): void {
    let offset: { left: number; top: number } | undefined;
    if (typeof args[0].offset === 'string') {
      const offsetValue = parseFloat(args[0].offset);
      offset = { left: offsetValue, top: offsetValue };
    } else if (typeof args[0].offset === 'number') {
      offset = { left: args[0].offset, top: args[0].offset };
    }

    if (typeof args[0].index === 'number') {
      const index = args[0].index;
      if (index === 0) {
        this.scrollTop = 0;
        this.scrollLeft = 0;
      } else if (index > 0 && index < this.childElementCount) {
        const targetKid = this.children.item(index);
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
      this.scrollTo({
        ...offset,
        behavior: args[0].smooth ? 'smooth' : 'auto',
      });
    } else {
      super.scrollTo(...args);
    }
  }
  autoScroll(options: {
    /**
     * @description scrolling speed
     */
    rate: `${number}px` | number;
    /**
     * @description could be stop by this parameter
     */
    start: boolean;
  }) {
    clearInterval(this.#autoScrollTimer);
    if (options.start) {
      const rate = typeof options.rate === 'number'
        ? options.rate
        : parseFloat(options.rate);
      const tickDistance = (rate * ScrollView.scrollInterval) / 1000;
      this.#autoScrollTimer = setInterval(
        (dom) => {
          dom.scrollBy({
            left: tickDistance,
            top: tickDistance,
            behavior: 'smooth',
          });
        },
        ScrollView.scrollInterval,
        this,
      );
    }
  }
  get [scrollContainerDom]() {
    return this;
  }
}
