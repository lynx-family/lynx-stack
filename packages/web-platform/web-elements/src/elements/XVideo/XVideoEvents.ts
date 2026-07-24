/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/

import {
  type AttributeReactiveClass,
  genDomGetter,
} from '../../element-reactive/index.js';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';
import {
  mediaErrorMessageMap,
  XVideoErrorCode,
  xVideoLastTime,
} from './utils.js';
import type { XVideo } from './XVideo.js';

const DEFAULT_TIMEUPDATE_INTERVAL = 0.33;

export class XVideoEvents
  implements InstanceType<AttributeReactiveClass<typeof HTMLElement>>
{
  static observedAttributes = [];

  #dom: XVideo;
  #firstFrameDispatched = false;
  // Start in the distant past so the first `timeupdate` always passes the
  // throttle gate regardless of how soon after page load it fires.
  #lastTimeUpdateAt = Number.NEGATIVE_INFINITY;

  #getVideoElement = genDomGetter<HTMLVideoElement>(
    () => this.#dom.shadowRoot!,
    '#video',
  );

  constructor(dom: XVideo) {
    this.#dom = dom;
  }

  #getTimeUpdateInterval = () => {
    const raw = this.#dom.getAttribute('timeupdate-interval');
    const parsed = raw === null ? NaN : Number(raw);
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_TIMEUPDATE_INTERVAL;
  };

  #onLoadedData = () => {
    if (this.#firstFrameDispatched) return;
    this.#firstFrameDispatched = true;
    const video = this.#getVideoElement();
    this.#dom.dispatchEvent(
      new CustomEvent('firstframe', {
        ...commonComponentEventSetting,
        detail: {
          duration: Number.isFinite(video.duration) ? video.duration : 0,
        },
      }),
    );
  };

  #onPlaying = () => {
    this.#dom.dispatchEvent(
      new CustomEvent('playing', {
        ...commonComponentEventSetting,
        detail: {},
      }),
    );
  };

  #onPause = () => {
    // `stop()` UIMethod dispatches its own `stopped` event and pauses too;
    // suppress the redundant `paused` dispatch when triggered by stop.
    if (this.#dom._suppressNextPauseEvent) {
      this.#dom._suppressNextPauseEvent = false;
      return;
    }
    this.#dom.dispatchEvent(
      new CustomEvent('paused', {
        ...commonComponentEventSetting,
        detail: {},
      }),
    );
  };

  #onTimeUpdate = () => {
    const video = this.#getVideoElement();
    const interval = this.#getTimeUpdateInterval();
    const now = performance.now() / 1000;
    if (now - this.#lastTimeUpdateAt < interval) {
      this.#dom[xVideoLastTime] = video.currentTime;
      return;
    }
    this.#lastTimeUpdateAt = now;
    this.#dom[xVideoLastTime] = video.currentTime;
    this.#dom.dispatchEvent(
      new CustomEvent('timeupdate', {
        ...commonComponentEventSetting,
        detail: {
          current: video.currentTime,
          duration: Number.isFinite(video.duration) ? video.duration : 0,
        },
      }),
    );
  };

  #onEnded = () => {
    // With `loop` set, HTML5 video re-seeks to 0 and emits `seeked` instead of
    // `ended`; this branch only handles a real, terminal end.
    this.#dom.dispatchEvent(
      new CustomEvent('ended', {
        ...commonComponentEventSetting,
        detail: {},
      }),
    );
  };

  #onSeeked = () => {
    const video = this.#getVideoElement();
    const looping = this.#dom.getAttribute('loop') !== null;
    if (!looping) return;
    const previous = this.#dom[xVideoLastTime] ?? 0;
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    // Detect a loop wrap: jumped back near the start after being near the end.
    if (
      duration > 0
      && previous >= duration - 0.5
      && video.currentTime <= 0.5
    ) {
      this.#dom.dispatchEvent(
        new CustomEvent('looped', {
          ...commonComponentEventSetting,
          detail: {},
        }),
      );
    }
    this.#dom[xVideoLastTime] = video.currentTime;
  };

  #onError = () => {
    const video = this.#getVideoElement();
    const code = video.error?.code ?? XVideoErrorCode.Unknown;
    const errorMsg = video.error?.message
      || mediaErrorMessageMap[code]
      || 'unknown video error';
    this.#dom.dispatchEvent(
      new CustomEvent('error', {
        ...commonComponentEventSetting,
        detail: {
          errorCode: code,
          errorMsg,
        },
      }),
    );
  };

  #onBuffering = () => {
    const video = this.#getVideoElement();
    let buffering = 0;
    const buffered = video.buffered;
    if (buffered.length > 0) {
      buffering = buffered.end(buffered.length - 1);
    }
    this.#dom.dispatchEvent(
      new CustomEvent('buffering', {
        ...commonComponentEventSetting,
        detail: {
          buffering,
        },
      }),
    );
  };

  connectedCallback() {
    const video = this.#getVideoElement();
    video.addEventListener('loadeddata', this.#onLoadedData, { passive: true });
    video.addEventListener('playing', this.#onPlaying, { passive: true });
    video.addEventListener('pause', this.#onPause, { passive: true });
    video.addEventListener('timeupdate', this.#onTimeUpdate, { passive: true });
    video.addEventListener('ended', this.#onEnded, { passive: true });
    video.addEventListener('seeked', this.#onSeeked, { passive: true });
    video.addEventListener('error', this.#onError, { passive: true });
    video.addEventListener('waiting', this.#onBuffering, { passive: true });
    video.addEventListener('progress', this.#onBuffering, { passive: true });
  }
}
