// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const tag = (value) => Object.prototype.toString.call(value);

module.exports = {
  isPromise: (value) => value instanceof Promise,
  isRegExp: (value) => tag(value) === '[object RegExp]',
  isDate: (value) => tag(value) === '[object Date]',
  isMap: (value) => value instanceof Map,
  isSet: (value) => value instanceof Set,
  isNativeError: (value) => value instanceof Error,
  isAsyncFunction: (value) => tag(value) === '[object AsyncFunction]',
  isGeneratorFunction: (value) =>
    tag(value) === '[object GeneratorFunction]'
    || tag(value) === '[object AsyncGeneratorFunction]',
  isTypedArray: (value) =>
    ArrayBuffer.isView(value) && !(value instanceof DataView),
  isUint8Array: (value) => value instanceof Uint8Array,
  isArrayBuffer: (value) => value instanceof ArrayBuffer,
  isAnyArrayBuffer: (value) =>
    value instanceof ArrayBuffer
    || (typeof SharedArrayBuffer !== 'undefined'
      && value instanceof SharedArrayBuffer),
  isProxy: () => false,
};
