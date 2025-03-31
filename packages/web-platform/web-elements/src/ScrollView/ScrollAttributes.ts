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
  __dom: ScrollView;
  static observedAttributes = [
    'scroll-top',
    'scroll-left',
    'initial-scroll-offset',
    'scroll-to-index',
    'initial-scroll-index',
  ];

  constructor(dom: ScrollView) {
    this.__dom = dom;
  }

  @registerAttributeHandler('scroll-top', false)
  @registerAttributeHandler('scroll-left', false)
  @registerAttributeHandler('nitial-scroll-offset', false)
  __handleInitialScrollOffset(
    newVal: string | null,
    _: string | null,
    attributeName: string,
  ) {
    if (newVal) {
      const scrollValue = parseFloat(newVal);
      const scrollOrientation = this.__dom.getAttribute('scroll-orientation');
      const scrollY = this.__dom.getAttribute('scroll-y');
      const scrollX = this.__dom.getAttribute('scroll-x');
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
          this.__dom.scrollTo(0, scrollValue);
        }
        if (leftScrollDistance) {
          this.__dom.scrollLeft = scrollValue;
        }
      });
    }
  }

  @registerAttributeHandler('scroll-to-index', false)
  @registerAttributeHandler('initial-scroll-index', false)
  __handleInitialScrollIndex(newVal: string | null) {
    if (newVal) {
      const scrollValue = parseFloat(newVal);
      const childrenElement = this.__dom.children.item(scrollValue);
      if (childrenElement && childrenElement instanceof HTMLElement) {
        const scrollX = !!this.__dom.getAttribute('scroll-x');
        requestAnimationFrame(() => {
          if (scrollX) {
            this.__dom.scrollLeft = childrenElement.offsetLeft;
          } else {
            this.__dom.scrollTop = childrenElement.offsetTop;
          }
        });
      }
    }
  }

  dispose(): void {}
}
