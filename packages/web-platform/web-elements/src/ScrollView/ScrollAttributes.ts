/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  registerAttributeHandler,
} from '@lynx-js/web-elements-reactive';
import type { ScrollView } from './ScrollView.js';

export class ScrollAttributes
  implements InstanceType<AttributeReactiveClass<typeof ScrollView>>
{
  #dom: ScrollView;
  static observedAttributes = [
    'scroll-top',
    'scroll-left',
    'initial-scroll-offset',
    'scroll-to-index',
    'initial-scroll-to-index',
  ];

  constructor(dom: ScrollView) {
    this.#dom = dom;
  }

  @registerAttributeHandler('scroll-top', false)
  @registerAttributeHandler('scroll-left', false)
  @registerAttributeHandler('initial-scroll-offset', false)
  #handleInitialScrollOffset(
    newVal: string | null,
    _: string | null,
    attributeName: string,
  ) {
    if (newVal) {
      const scrollValue = parseFloat(newVal);
      const scrollOrientation = this.#dom.getAttribute('scroll-orientation');
      const scrollY = this.#dom.getAttribute('scroll-y');
      const scrollX = this.#dom.getAttribute('scroll-x');
      const topScrollDistance = (attributeName === 'scroll-top'
        || attributeName === 'initial-scroll-offset')
        && (scrollY === ''
          || scrollY === 'true'
          || scrollOrientation === 'vertical'
          || scrollOrientation === 'both');
      const leftScrollDistance = (attributeName === 'scroll-left'
        || attributeName === 'initial-scroll-offset')
        && (scrollX === ''
          || scrollX === 'true'
          || scrollOrientation === 'vertical'
          || scrollOrientation === 'both');
      requestAnimationFrame(() => {
        if (topScrollDistance) {
          this.#dom.scrollTo(0, scrollValue);
        }
        if (leftScrollDistance) {
          this.#dom.scrollLeft = scrollValue;
        }
      });
    }
  }

  @registerAttributeHandler('scroll-to-index', false)
  @registerAttributeHandler('initial-scroll-to-index', false)
  #handleInitialScrollIndex(newVal: string | null) {
    if (newVal) {
      const scrollValue = parseFloat(newVal);
      const childrenElement = this.#dom.children.item(scrollValue);
      if (childrenElement && childrenElement instanceof HTMLElement) {
        const scrollX = this.#dom.getAttribute('scroll-x') !== null;
        requestAnimationFrame(() => {
          if (scrollX) {
            this.#dom.scrollLeft = childrenElement.offsetLeft;
          } else {
            this.#dom.scrollTop = childrenElement.offsetTop;
          }
        });
      }
    }
  }

  dispose(): void {}
}
