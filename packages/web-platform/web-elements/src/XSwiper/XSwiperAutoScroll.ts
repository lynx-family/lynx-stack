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
  #dom: XSwiper;

  constructor(dom: XSwiper) {
    this.#dom = dom;
  }

  @registerAttributeHandler('current', false)
  #handleCurrentChange(newVal: string | null) {
    const newval = Number(newVal);
    if (!Number.isNaN(newval)) {
      this.#dom.currentIndex = newval;
    }
  }

  #autoPlayTimer?: ReturnType<typeof setInterval>;

  #autoPlayTick = (() => {
    this.#dom.scrollToNext();
  }).bind(this);

  #startAutoplay(interval: number) {
    this.#stopAutoplay();
    this.#autoPlayTimer = setInterval(this.#autoPlayTick, interval);
  }

  #stopAutoplay() {
    if (this.#autoPlayTimer) {
      clearInterval(this.#autoPlayTimer);
    }
  }

  @registerAttributeHandler('interval', false)
  @registerAttributeHandler('autoplay', false)
  #handleAutoplay() {
    const enableAutoPlay = this.#dom.getAttribute('autoplay') !== null;
    if (enableAutoPlay) {
      const interval = this.#dom.getAttribute('interval');
      let intervalValue = interval ? parseFloat(interval) : 5000;
      if (Number.isNaN(intervalValue)) intervalValue = 5000;
      this.#startAutoplay(intervalValue);
    }
  }

  dispose(): void {
    this.#stopAutoplay();
  }
}
