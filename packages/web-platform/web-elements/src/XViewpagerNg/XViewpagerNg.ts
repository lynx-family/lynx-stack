/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  boostedQueueMicrotask,
  Component,
} from '@lynx-js/web-elements-reactive';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';
import { XViewpagerNgEvents } from './XViewpagerNgEvents.js';
import { scrollContainerDom } from '../common/constants.js';
import { templateXViewpageNg } from '@lynx-js/web-elements-template';

@Component<typeof XViewpagerNg>(
  'x-viewpager-ng',
  [CommonEventsAndMethods, XViewpagerNgEvents],
  templateXViewpageNg,
)
export class XViewpagerNg extends HTMLElement {
  static notToFilterFalseAttributes = new Set([
    'allow-horizontal-gesture',
    'enable-scroll',
  ]);
  selectTab(params: { index: number; smooth?: boolean }) {
    let { index, smooth } = params;
    if (typeof smooth === 'undefined') smooth = true;
    const scrollContainer = this.shadowRoot!.children.item(2)!;
    const scrollLeft = scrollContainer.clientWidth * index;
    scrollContainer.scrollTo({
      left: scrollLeft,
      behavior: smooth ? 'smooth' : 'instant',
    });
  }

  connectedCallback() {
    const initialSelectIndex = this.getAttribute('select-index')
      || this.getAttribute('initial-select-index');

    if (initialSelectIndex !== null) {
      const selectIndex = Number(initialSelectIndex);
      const scrollContainer = this.shadowRoot!.children.item(2)!;
      const scrollToInitialIndex = () => {
        if (scrollContainer.clientWidth === 0) {
          // In Safari, there is the potential race condition between the browser's layout and clientWidth calculate.
          // So, we have to use requestAnimationFrame to ensure that the code runs after the browser's layout.
          requestAnimationFrame(scrollToInitialIndex);
        } else {
          this.selectTab({ index: selectIndex, smooth: false });
        }
      };

      // The reason for using microtasks is that the width and height of the child element may not be rendered at this time, so it will not be able to scroll.
      boostedQueueMicrotask(scrollToInitialIndex);
    }
  }

  get [scrollContainerDom]() {
    return this;
  }
}
