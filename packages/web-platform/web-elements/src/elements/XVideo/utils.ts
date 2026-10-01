/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/

export const xVideoLastTime = Symbol('__xVideoLastTime');

export const enum XVideoErrorCode {
  Unknown = -1,
  MediaErrAborted = 1,
  MediaErrNetwork = 2,
  MediaErrDecode = 3,
  MediaErrSrcNotSupported = 4,
}

export const mediaErrorMessageMap: Record<number, string> = {
  [XVideoErrorCode.MediaErrAborted]: 'fetching process aborted by user',
  [XVideoErrorCode.MediaErrNetwork]: 'network error while loading',
  [XVideoErrorCode.MediaErrDecode]: 'error decoding media',
  [XVideoErrorCode.MediaErrSrcNotSupported]: 'media source not supported',
};
