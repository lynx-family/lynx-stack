/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  registerAttributeHandler,
} from '@lynx-js/web-elements-reactive';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';
import type { XFoldviewNg } from './XFoldviewNg.js';

export class XFoldviewNgEvents
  implements InstanceType<AttributeReactiveClass<typeof XFoldviewNg>>
{
  __dom: XFoldviewNg;
  __granularity = 0.01;
  __pervScroll = 0;
  constructor(dom: XFoldviewNg) {
    this.__dom = dom;
    this.__dom.addEventListener('scroll', this.__handleScroll, {
      passive: true,
    });
  }
  static observedAttributes = ['granularity'];

  @registerAttributeHandler('granularity', true)
  __handleGranularity(newVal: string | null) {
    if (newVal && newVal !== '') this.__granularity = parseFloat(newVal);
    else this.__granularity = 0.01;
  }

  __handleScroll = () => {
    const curentScrollTop = this.__dom.scrollTop;
    const scrollLength = Math.abs(this.__pervScroll - curentScrollTop);
    if (
      scrollLength > this.__granularity
      || this.__dom.scrollTop === 0
      || Math.abs(
          this.__dom.scrollHeight - this.__dom.clientHeight
            - this.__dom.scrollTop,
        ) <= 1
    ) {
      this.__pervScroll = curentScrollTop;
      this.__dom.dispatchEvent(
        new CustomEvent('offset', {
          ...commonComponentEventSetting,
          detail: {
            offset: curentScrollTop,
            height: this.__dom.__scrollableLength,
          },
        }),
      );
    }
  };
}
