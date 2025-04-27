/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  registerAttributeHandler,
  registerEventEnableStatusChangeHandler,
} from '@lynx-js/web-elements-reactive';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';
import { scrollableLength, type XFoldviewNg } from './XFoldviewNg.js';

export class XFoldviewNgEvents
  implements InstanceType<AttributeReactiveClass<typeof XFoldviewNg>>
{
  #dom: XFoldviewNg;
  #granularity = 0.01;
  #pervScroll = 0;
  constructor(dom: XFoldviewNg) {
    this.#dom = dom;
  }
  static observedAttributes = ['granularity'];

  @registerAttributeHandler('granularity', true)
  #handleGranularity(newVal: string | null) {
    if (newVal && newVal !== '') this.#granularity = parseFloat(newVal);
    else this.#granularity = 0.01;
  }

  @registerEventEnableStatusChangeHandler('offset')
  #enableOffsetEvent(enable: boolean) {
    if (enable) {
      this.#dom.addEventListener('scroll', this.#handleScroll, {
        passive: true,
      });
    } else {
      this.#dom.removeEventListener('scroll', this.#handleScroll);
    }
  }

  #handleScroll = () => {
    const curentScrollTop = this.#dom.scrollTop;
    const scrollLength = Math.abs(this.#pervScroll - curentScrollTop);
    if (
      scrollLength > this.#granularity
      || this.#dom.scrollTop === 0
      || Math.abs(
          this.#dom.scrollHeight - this.#dom.clientHeight - this.#dom.scrollTop,
        ) <= 1
    ) {
      this.#pervScroll = curentScrollTop;
      this.#dom.dispatchEvent(
        new CustomEvent('offset', {
          ...commonComponentEventSetting,
          detail: {
            offset: curentScrollTop,
            height: this.#dom[scrollableLength],
          },
        }),
      );
    }
  };
}
