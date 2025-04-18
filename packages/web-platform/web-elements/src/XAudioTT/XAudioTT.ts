/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import {
  Component,
  html,
  genDomGetter,
  bindToAttribute,
} from '@lynx-js/web-elements-reactive';
import { XAudioAttribute } from './XAudioAttribute.js';
import { XAudioEvents } from './XAudioEvents.js';
import { CommonEventsAndMethods } from '../common/CommonEventsAndMethods.js';
import { commonComponentEventSetting } from '../common/commonEventInitConfiguration.js';
import {
  XAudioErrorCode,
  audioPlaybackStateMap,
  getAudioState,
  xAudioBlob,
  xAudioSrc,
} from './utils.js';

@Component<typeof XAudioTT>(
  'x-audio-tt',
  [CommonEventsAndMethods, XAudioAttribute, XAudioEvents],
  html`<audio id="audio"></audio>`,
)
export class XAudioTT extends HTMLElement {
  #getAudio = genDomGetter<HTMLAudioElement>(() => this.shadowRoot!, '#audio');
  #getAudioElement = genDomGetter(() => this.shadowRoot!, '#audio');

  #setAudioSrc = bindToAttribute(this.#getAudioElement, 'src');

  [xAudioSrc]?: { id: string; play_url: string };
  [xAudioBlob]?: Promise<void>;

  #fetchAudio = () => {
    const parsedSrc = this[xAudioSrc];

    if (!parsedSrc || !parsedSrc.id || !parsedSrc.play_url) {
      return;
    }

    let parsedHeaders: Record<string, string>;
    try {
      parsedHeaders = JSON.parse(this.getAttribute('headers') || '{}')
        || {};
    } catch (error) {
      console.error(`JSON.parse headers error: ${error}`);
      parsedHeaders = {};
    }

    this[xAudioBlob] = new Promise(async (resolve, reject) => {
      this.dispatchEvent(
        new CustomEvent('srcloadingstatechanged', {
          ...commonComponentEventSetting,
          detail: {
            code: 0,
            type: 'loading',
            currentSrcID: parsedSrc.id,
          },
        }),
      );

      const response = await fetch(parsedSrc.play_url, {
        headers: parsedHeaders,
      });

      if (!response.ok) {
        this.dispatchEvent(
          new CustomEvent('error', {
            ...commonComponentEventSetting,
            detail: {
              code: XAudioErrorCode.DownloadError,
              msg: '',
              from: 'res loader',
              currentSrcID: parsedSrc.id,
            },
          }),
        );
        reject();
      }

      this.dispatchEvent(
        new CustomEvent('srcloadingstatechanged', {
          ...commonComponentEventSetting,
          detail: {
            code: 1,
            type: 'success',
            currentSrcID: parsedSrc.id,
          },
        }),
      );

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      this.#setAudioSrc(blobUrl);
      resolve();
    });
  };

  play() {
    // If prepare method is not called, needs to fetch first
    if (!this[xAudioBlob]) {
      this.#fetchAudio();
    }

    this[xAudioBlob]?.then(() => {
      const audio = this.#getAudio();

      audio.currentTime = 0;
      audio.play();
    });

    return {
      currentSrcID: this[xAudioSrc]?.id,
      loadingSrcID: '',
    };
  }

  stop() {
    const audio = this.#getAudio();

    const playbackState = audioPlaybackStateMap['stop'];
    this.dispatchEvent(
      new CustomEvent('playbackstatechanged', {
        ...commonComponentEventSetting,
        detail: {
          code: playbackState?.code,
          type: playbackState?.type,
          currentSrcID: this[xAudioSrc]?.id,
        },
      }),
    );
    audio.currentTime = 0;
    audio.pause();
    return {
      currentSrcID: this[xAudioSrc]?.id,
    };
  }

  pause() {
    const audio = this.#getAudio();

    audio.pause();
    return {
      currentSrcID: this[xAudioSrc]?.id,
    };
  }

  resume() {
    const audio = this.#getAudio();

    audio.play();
    return {
      currentSrcID: this[xAudioSrc]?.id,
      loadingSrcID: '',
    };
  }

  seek(params: { currentTime: number }) {
    const audio = this.#getAudio();

    audio.currentTime = (params.currentTime || 0) / 1000;
    this.dispatchEvent(
      new CustomEvent('seek', {
        ...commonComponentEventSetting,
        detail: {
          seekresult: 1,
          currentSrcID: this[xAudioSrc]?.id,
        },
      }),
    );

    return {
      currentSrcID: this[xAudioSrc]?.id,
    };
  }

  mute(params: { mute: boolean }) {
    const audio = this.#getAudio();

    audio.muted = params.mute;
    return {
      currentSrcID: this[xAudioSrc]?.id,
    };
  }

  playerInfo() {
    const audioElement = this.#getAudio();
    const buffered = audioElement.buffered;
    const cacheTime = buffered.end(buffered.length - 1);

    return {
      currentSrcID: this[xAudioSrc]?.id,
      duration: audioElement.duration * 1000,
      playbackState: getAudioState(audioElement),
      // playBitrate can not support now
      currentTime: audioElement.currentTime,
      cacheTime,
    };
  }

  prepare() {
    // if has fetched, no need to fetch again
    if (!this[xAudioBlob]) {
      this.#fetchAudio();
    }
  }

  setVolume(params: { volume: number }) {
    const audio = this.#getAudio();

    audio.volume = params.volume;
    return {
      code: 1,
    };
  }
}
