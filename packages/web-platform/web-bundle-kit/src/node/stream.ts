// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// `node:stream` has no browser equivalent: every member throws on use.
// The named exports are the keys of the Node.js 24 module.

import { trap } from './trap.js';

const stream = trap<typeof import('node:stream')>('node:stream');

export const {
  isDestroyed,
  isDisturbed,
  isErrored,
  isReadable,
  isWritable,
  Readable,
  Writable,
  Duplex,
  Transform,
  PassThrough,
  duplexPair,
  pipeline,
  addAbortSignal,
  finished,
  destroy,
  compose,
  setDefaultHighWaterMark,
  getDefaultHighWaterMark,
  promises,
  Stream,
  _isArrayBufferView,
  _isUint8Array,
  _uint8ArrayToBuffer,
} = stream;
export default stream;
