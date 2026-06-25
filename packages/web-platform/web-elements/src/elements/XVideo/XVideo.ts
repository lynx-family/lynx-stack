/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { Component, genDomGetter } from '../../element-reactive/index.js';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';
import { templateXVideo } from '../htmlTemplates.js';
import { XVideoAttribute } from './XVideoAttribute.js';
import { XVideoEvents } from './XVideoEvents.js';
import { xVideoLastTime } from './utils.js';

@Component<typeof XVideo>(
  'x-video',
  [CommonEventsAndMethods, XVideoAttribute, XVideoEvents],
  templateXVideo,
)
export class XVideo extends HTMLElement {
  #getVideo = genDomGetter<HTMLVideoElement>(() => this.shadowRoot!, '#video');

  [xVideoLastTime]?: number;
  _suppressNextPauseEvent = false;

  play() {
    const video = this.#getVideo();
    const playResult = video.play();
    if (playResult && typeof playResult.catch === 'function') {
      playResult.catch(() => {
        // Browser autoplay policies may reject `play()`; the resulting `error`
        // event is already dispatched via the media element error handler.
      });
    }
    return { success: true };
  }

  pause() {
    const video = this.#getVideo();
    video.pause();
    return { success: true };
  }

  stop() {
    const video = this.#getVideo();
    this._suppressNextPauseEvent = !video.paused;
    video.pause();
    video.currentTime = 0;
    this.dispatchEvent(
      new CustomEvent('stopped', {
        ...commonComponentEventSetting,
        detail: {},
      }),
    );
    return { success: true };
  }

  seek(params: { position?: number } | undefined) {
    const video = this.#getVideo();
    const position = Number(params?.position);
    if (!Number.isFinite(position) || position < 0) {
      return {
        success: false,
        errorCode: 1,
        msg: 'invalid position',
        errorMsg: 'invalid position',
      };
    }
    video.currentTime = position;
    return { success: true };
  }
}
