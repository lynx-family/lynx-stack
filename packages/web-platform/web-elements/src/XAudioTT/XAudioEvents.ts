/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  type AttributeReactiveClass,
  genDomGetter,
} from '@lynx-js/web-elements-reactive';
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

  __dom: XAudioTT;
  __intervalPlay?: NodeJS.Timeout;

  __getAudioElement = genDomGetter<HTMLAudioElement>(
    () => this.__dom.shadowRoot!,
    '__audio',
  );

  __playEvent = (event: Event) => {
    const attributeInterval = Number(this.__dom.getAttribute('interval'));
    const delay = Number.isNaN(attributeInterval) ? 0 : attributeInterval;

    this.__intervalPlay = setInterval(() => {
      this.__dom.dispatchEvent(
        new CustomEvent('timeupdate', {
          ...commonComponentEventSetting,
          detail: {
            currentTime: this.__getAudioElement().currentTime,
            currentSrcID: this.__dom[xAudioSrc]?.id,
          },
        }),
      );
    }, delay);

    const playbackState = audioPlaybackStateMap[event.type];
    this.__dom.dispatchEvent(
      new CustomEvent('playbackstatechanged', {
        ...commonComponentEventSetting,
        detail: {
          code: playbackState?.code,
          type: playbackState?.type,
          currentSrcID: this.__dom[xAudioSrc]?.id,
        },
      }),
    );
  };

  __pauseEvent = (event: Event) => {
    clearInterval(this.__intervalPlay);

    const playbackState = audioPlaybackStateMap[event.type];
    this.__dom.dispatchEvent(
      new CustomEvent('playbackstatechanged', {
        ...commonComponentEventSetting,
        detail: {
          code: playbackState?.code,
          type: playbackState?.type,
          currentSrcID: this.__dom[xAudioSrc]?.id,
        },
      }),
    );
  };

  __loadingEvent = (event: Event) => {
    const loadingState = audioLoadingStateMap[event.type];

    this.__dom.dispatchEvent(
      new CustomEvent('loadingstatechanged', {
        ...commonComponentEventSetting,
        detail: {
          code: loadingState?.code,
          type: loadingState?.type,
          currentSrcID: this.__dom[xAudioSrc]?.id,
        },
      }),
    );
  };

  __errorEvent = (event: Event) => {
    this.__loadingEvent(event);

    const mediaCode = (event.target as HTMLAudioElement)?.error?.code;
    let code = mediaCode === MediaError.MEDIA_ERR_DECODE
      ? XAudioErrorCode.PlayerLoadingError
      : XAudioErrorCode.PlayerPlaybackError;

    if (mediaCode === MediaError.MEDIA_ERR_DECODE) {
      code = XAudioErrorCode.PlayerLoadingError;
    }

    this.__dom.dispatchEvent(
      new CustomEvent('error', {
        ...commonComponentEventSetting,
        detail: {
          code,
          msg: '',
          from: 'player',
          currentSrcID: this.__dom[xAudioSrc]?.id,
        },
      }),
    );
  };

  __endedEvent = () => {
    const loop = this.__dom.getAttribute('loop') === null ? false : true;
    this.__dom.dispatchEvent(
      new CustomEvent('finished', {
        ...commonComponentEventSetting,
        detail: {
          loop,
          currentSrcID: this.__dom[xAudioSrc]?.id,
        },
      }),
    );
  };

  constructor(dom: XAudioTT) {
    this.__dom = dom;
  }

  connectedCallback() {
    const audioElement = this.__getAudioElement();
    audioElement.addEventListener('play', this.__playEvent, {
      passive: true,
    });
    audioElement.addEventListener('pause', this.__pauseEvent, {
      passive: true,
    });
    audioElement.addEventListener('ended', this.__endedEvent, {
      passive: true,
    });
    audioElement.addEventListener('loadstart', this.__loadingEvent, {
      passive: true,
    });
    audioElement.addEventListener('canplay', this.__loadingEvent, {
      passive: true,
    });
    audioElement.addEventListener('stalled', this.__loadingEvent, {
      passive: true,
    });
    audioElement.addEventListener('error', this.__errorEvent, {
      passive: true,
    });
  }
}
