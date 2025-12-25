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

  #dom: XAudioTT;

  #getAudioElement = genDomGetter(() => this.#dom.shadowRoot!, '#audio');

  @registerAttributeHandler('src', true)
  _handleSrc(newValue: string | null) {
    let parsedSrc;
    try {
      parsedSrc = JSON.parse(newValue || '') || {};
    } catch (error) {
      console.error(`JSON.parse src error: ${error}`);
      parsedSrc = {};
    }

    if (newValue === null) {
      this.#dom.dispatchEvent(
        new CustomEvent('error', {
          ...commonComponentEventSetting,
          detail: {
            code: XAudioErrorCode.SrcError,
            msg: '',
            from: 'res loader',
            currentSrcID: this.#dom[xAudioSrc]?.id,
          },
        }),
      );
    } else if (
      parsedSrc?.id === undefined || parsedSrc?.play_url === undefined
    ) {
      this.#dom.dispatchEvent(
        new CustomEvent('error', {
          ...commonComponentEventSetting,
          detail: {
            code: XAudioErrorCode.SrcJsonError,
            msg: '',
            from: 'res loader',
            currentSrcID: this.#dom[xAudioSrc]?.id,
          },
        }),
      );
    }

    this.#dom[xAudioSrc] = parsedSrc;
    this.#dom[xAudioBlob] = undefined;
    this.#dom.stop();
  }

  @registerAttributeHandler('loop', true)
  _handleLoop = bindToAttribute(this.#getAudioElement, 'loop');

  #documentVisibilitychange = () => {
    if (document.visibilityState === 'hidden') {
      this.#dom.pause();
    }
  };

  @registerAttributeHandler('pause-on-hide', true)
  _handlePauseOnHide(newValue: string | null) {
    if (newValue !== null) {
      document.addEventListener(
        'visibilitychange',
        this.#documentVisibilitychange,
        { passive: true },
      );
    } else {
      document.removeEventListener(
        'visibilitychange',
        this.#documentVisibilitychange,
      );
    }
  }

  constructor(dom: XAudioTT) {
    this.#dom = dom;
  }
}
