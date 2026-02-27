/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  genDomGetter,
} from '../../element-reactive/index.js';
import {
  audioLoadingStateMap,
  audioPlaybackStateMap,
  XAudioErrorCode,
  xAudioSrc,
} from './utils.js';
import type { XAudioTT } from './XAudioTT.js';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';

export class XAudioEvents
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = [];

  #dom: XAudioTT;
  #intervalPlay?: NodeJS.Timeout;

  #getAudioElement = genDomGetter<HTMLAudioElement>(
    () => this.#dom.shadowRoot!,
    '#audio',
  );

  #playEvent = (event: Event) => {
    const attributeInterval = Number(this.#dom.getAttribute('interval'));
    const delay = Number.isNaN(attributeInterval) ? 0 : attributeInterval;

    this.#intervalPlay = setInterval(() => {
      this.#dom.dispatchEvent(
        new CustomEvent('timeupdate', {
          ...commonComponentEventSetting,
          detail: {
            currentTime: this.#getAudioElement().currentTime,
            currentSrcID: this.#dom[xAudioSrc]?.id,
          },
        }),
      );
    }, delay);

    const playbackState = audioPlaybackStateMap[event.type];
    this.#dom.dispatchEvent(
      new CustomEvent('playbackstatechanged', {
        ...commonComponentEventSetting,
        detail: {
          code: playbackState?.code,
          type: playbackState?.type,
          currentSrcID: this.#dom[xAudioSrc]?.id,
        },
      }),
    );
  };

  #pauseEvent = (event: Event) => {
    clearInterval(this.#intervalPlay);

    const playbackState = audioPlaybackStateMap[event.type];
    this.#dom.dispatchEvent(
      new CustomEvent('playbackstatechanged', {
        ...commonComponentEventSetting,
        detail: {
          code: playbackState?.code,
          type: playbackState?.type,
          currentSrcID: this.#dom[xAudioSrc]?.id,
        },
      }),
    );
  };

  #loadingEvent = (event: Event) => {
    const loadingState = audioLoadingStateMap[event.type];

    this.#dom.dispatchEvent(
      new CustomEvent('loadingstatechanged', {
        ...commonComponentEventSetting,
        detail: {
          code: loadingState?.code,
          type: loadingState?.type,
          currentSrcID: this.#dom[xAudioSrc]?.id,
        },
      }),
    );
  };

  #errorEvent = (event: Event) => {
    this.#loadingEvent(event);

    const mediaCode = (event.target as HTMLAudioElement)?.error?.code;
    let code = mediaCode === MediaError.MEDIA_ERR_DECODE
      ? XAudioErrorCode.PlayerLoadingError
      : XAudioErrorCode.PlayerPlaybackError;

    if (mediaCode === MediaError.MEDIA_ERR_DECODE) {
      code = XAudioErrorCode.PlayerLoadingError;
    }

    this.#dom.dispatchEvent(
      new CustomEvent('error', {
        ...commonComponentEventSetting,
        detail: {
          code,
          msg: '',
          from: 'player',
          currentSrcID: this.#dom[xAudioSrc]?.id,
        },
      }),
    );
  };

  #endedEvent = () => {
    const loop = this.#dom.getAttribute('loop') === null ? false : true;
    this.#dom.dispatchEvent(
      new CustomEvent('finished', {
        ...commonComponentEventSetting,
        detail: {
          loop,
          currentSrcID: this.#dom[xAudioSrc]?.id,
        },
      }),
    );
  };

  constructor(dom: XAudioTT) {
    this.#dom = dom;
  }

  connectedCallback() {
    const audioElement = this.#getAudioElement();
    audioElement.addEventListener('play', this.#playEvent, {
      passive: true,
    });
    audioElement.addEventListener('pause', this.#pauseEvent, {
      passive: true,
    });
    audioElement.addEventListener('ended', this.#endedEvent, {
      passive: true,
    });
    audioElement.addEventListener('loadstart', this.#loadingEvent, {
      passive: true,
    });
    audioElement.addEventListener('canplay', this.#loadingEvent, {
      passive: true,
    });
    audioElement.addEventListener('stalled', this.#loadingEvent, {
      passive: true,
    });
    audioElement.addEventListener('error', this.#errorEvent, {
      passive: true,
    });
  }
}
