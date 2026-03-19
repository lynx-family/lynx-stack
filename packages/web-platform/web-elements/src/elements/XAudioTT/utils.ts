/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
export const xAudioSrc = Symbol('__src');
export const xAudioBlob = Symbol('__src');

export const audioLoadingStateMap: Record<
  string,
  { code: number; type: string }
> = {
  loadstart: {
    code: 0,
    type: 'init',
  },
  canplay: {
    code: 1,
    type: 'playable',
  },
  // Code 2 refers to the audio loading jam, which is a resource decoding problem
  // cannot be implemented at present, use stalled replaced
  stalled: {
    code: 2,
    type: 'stalled',
  },
  error: {
    code: 3,
    type: 'error',
  },
};

export const audioPlaybackStateMap: Record<
  string,
  { code: number; type: string }
> = {
  stop: {
    code: 0,
    type: 'stopped',
  },
  play: {
    code: 1,
    type: 'playing',
  },
  pause: {
    code: 2,
    type: 'paused',
  },
};

export const getAudioState = (audioElement: HTMLAudioElement) => {
  if (!audioElement) {
    return -1;
  }

  if (audioElement.paused) {
    if (audioElement.ended) {
      return 0;
    }
    return 2;
  }

  if (audioElement.currentTime > 0) {
    return 1;
  }

  return 3;
};

export const enum XAudioErrorCode {
  SrcError = -1,
  SrcJsonError = -2,
  DownloadError = -3,
  PlayerFinishedError = -4,
  PlayerLoadingError = -5,
  PlayerPlaybackError = -6,
}
