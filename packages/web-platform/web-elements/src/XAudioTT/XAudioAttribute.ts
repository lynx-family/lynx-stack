/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/

import {
  type AttributeReactiveClass,
  bindToAttribute,
  genDomGetter,
  registerAttributeHandler,
} from '@lynx-js/web-elements-reactive';
import type { XAudioTT } from './XAudioTT.js';
import { XAudioErrorCode, xAudioBlob, xAudioSrc } from './utils.js';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';

export class XAudioAttribute
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = [
    'src',
    'loop',
    'pause-on-hide',
  ];

  __dom: XAudioTT;

  __getAudioElement = genDomGetter(() => this.__dom.shadowRoot!, '__audio');

  __setAudioSrc = bindToAttribute(this.__getAudioElement, 'src');

  @registerAttributeHandler('src', true)
  __handleSrc(newValue: string | null) {
    let parsedSrc;
    try {
      parsedSrc = JSON.parse(newValue || '') || {};
    } catch (error) {
      console.error(`JSON.parse src error: ${error}`);
      parsedSrc = {};
    }

    if (newValue === null) {
      this.__dom.dispatchEvent(
        new CustomEvent('error', {
          ...commonComponentEventSetting,
          detail: {
            code: XAudioErrorCode.SrcError,
            msg: '',
            from: 'res loader',
            currentSrcID: this.__dom[xAudioSrc]?.id,
          },
        }),
      );
    } else if (
      parsedSrc?.id === undefined || parsedSrc?.play_url === undefined
    ) {
      this.__dom.dispatchEvent(
        new CustomEvent('error', {
          ...commonComponentEventSetting,
          detail: {
            code: XAudioErrorCode.SrcJsonError,
            msg: '',
            from: 'res loader',
            currentSrcID: this.__dom[xAudioSrc]?.id,
          },
        }),
      );
    }

    this.__dom[xAudioSrc] = parsedSrc;
    this.__dom[xAudioBlob] = undefined;
    this.__dom.stop();
  }

  @registerAttributeHandler('loop', true)
  __handleLoop = bindToAttribute(this.__getAudioElement, 'loop');

  __documentVisibilitychange = () => {
    if (document.visibilityState === 'hidden') {
      this.__dom.pause();
    }
  };

  @registerAttributeHandler('pause-on-hide', true)
  __handlePauseOnHide(newValue: string | null) {
    if (newValue !== null) {
      document.addEventListener(
        'visibilitychange',
        this.__documentVisibilitychange,
        { passive: true },
      );
    } else {
      document.removeEventListener(
        'visibilitychange',
        this.__documentVisibilitychange,
      );
    }
  }

  constructor(dom: XAudioTT) {
    this.__dom = dom;
  }
}
