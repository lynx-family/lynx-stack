/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  registerAttributeHandler,
} from '@lynx-js/web-elements-reactive';
import type { XSwiper } from './XSwiper.js';

export class XSwiperAutoScroll
  implements InstanceType<AttributeReactiveClass<typeof XSwiper>>
{
  static observedAttributes = ['current', 'interval', 'autoplay'];
  __dom: XSwiper;

  constructor(dom: XSwiper) {
    this.__dom = dom;
  }

  @registerAttributeHandler('current', false)
  __handleCurrentChange(newVal: string | null) {
    const newval = Number(newVal);
    if (!Number.isNaN(newval)) {
      this.__dom.current = newval;
    }
  }

  __autoPlayTimer?: ReturnType<typeof setInterval>;

  __autoPlayTick = (() => {
    this.__dom.scrollToNext();
  }).bind(this);

  __startAutoplay(interval: number) {
    this.__stopAutoplay();
    this.__autoPlayTimer = setInterval(this.__autoPlayTick, interval);
  }

  __stopAutoplay() {
    if (this.__autoPlayTimer) {
      clearInterval(this.__autoPlayTimer);
    }
  }

  @registerAttributeHandler('interval', false)
  @registerAttributeHandler('autoplay', false)
  __handleAutoplay() {
    const enableAutoPlay = this.__dom.getAttribute('autoplay') !== null;
    if (enableAutoPlay) {
      const interval = this.__dom.getAttribute('interval');
      let intervalValue = interval ? parseFloat(interval) : 5000;
      if (Number.isNaN(intervalValue)) intervalValue = 5000;
      this.__startAutoplay(intervalValue);
    }
  }

  dispose(): void {
    this.__stopAutoplay();
  }
}
