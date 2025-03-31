/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { type AttributeReactiveClass } from '@lynx-js/web-elements-reactive';
import type { ScrollView } from './ScrollView.js';

export class ScrollIntoView
  implements InstanceType<AttributeReactiveClass<typeof ScrollView>>
{
  static eventName = '__scrollIntoView' as const;
  static observedAttributes = [];
  __dom: ScrollView;
  __handleScrollIntoView = ((
    event: CustomEvent<{
      block?: 'center' | 'start' | 'end';
      inline?: 'start' | 'center' | 'end';
      behavior?: 'smooth' | 'none';
    }>,
  ) => {
    event.stopPropagation();
    const compusedPath = event
      .composedPath()
      .filter((e) => e instanceof HTMLElement) as HTMLElement[];
    const eventPath: HTMLElement[] = [];
    const scrollContainer = this.__dom;
    for (const target of compusedPath) {
      if (target === scrollContainer) break;
      eventPath.push(target);
    }
    const scrollOrientation = this.__dom.getAttribute('scroll-orientation');
    const scrollX = this.__dom.getAttribute('scroll-x') !== null
      || scrollOrientation === 'both'
      || scrollOrientation === 'horizontal';
    const scrollY = this.__dom.getAttribute('scroll-y') !== null
      || scrollOrientation === 'both'
      || scrollOrientation === 'vertical';
    let top = 0,
      left = 0;
    for (const { offsetTop, offsetLeft } of eventPath) {
      if (scrollX) left += offsetLeft;
      if (scrollY) top += offsetTop;
    }
    if (scrollX) {
      switch (event.detail.inline) {
        case 'center':
          left += ((event.target as HTMLElement).clientWidth
            - this.__dom.clientWidth)
            / 2;
          break;
        case 'end':
          left += (event.target as HTMLElement).clientWidth
            - this.__dom.clientWidth;
          break;
      }
    }
    if (scrollY) {
      switch (event.detail.block) {
        case 'center':
          top += ((event.target as HTMLElement).clientHeight
            - this.__dom.clientHeight)
            / 2;
          break;
        case 'end':
          top += (event.target as HTMLElement).clientHeight
            - this.__dom.clientHeight;
          break;
      }
    }
    scrollContainer.scrollTo({
      behavior: event.detail.behavior === 'smooth' ? 'smooth' : 'instant',
      left,
      top,
    });
  }) as EventListener;

  constructor(dom: ScrollView) {
    this.__dom = dom;
    this.__dom.addEventListener(
      ScrollIntoView.eventName,
      this.__handleScrollIntoView,
      { passive: false },
    );
  }
  dispose(): void {
    this.__dom.removeEventListener(
      ScrollIntoView.eventName,
      this.__handleScrollIntoView,
    );
  }
}
