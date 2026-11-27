// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const tag = (value: unknown) => Object.prototype.toString.call(value);

const types = {
  isPromise: (value: unknown) => value instanceof Promise,
  isRegExp: (value: unknown) => tag(value) === '[object RegExp]',
  isDate: (value: unknown) => tag(value) === '[object Date]',
  isMap: (value: unknown) => value instanceof Map,
  isSet: (value: unknown) => value instanceof Set,
  isNativeError: (value: unknown) => value instanceof Error,
  isAsyncFunction: (value: unknown) => tag(value) === '[object AsyncFunction]',
  isGeneratorFunction: (value: unknown) =>
    tag(value) === '[object GeneratorFunction]'
    || tag(value) === '[object AsyncGeneratorFunction]',
  isTypedArray: (value: unknown) =>
    ArrayBuffer.isView(value) && !(value instanceof DataView),
  isUint8Array: (value: unknown) => value instanceof Uint8Array,
  isArrayBuffer: (value: unknown) => value instanceof ArrayBuffer,
  isAnyArrayBuffer: (value: unknown) =>
    value instanceof ArrayBuffer
    || (typeof SharedArrayBuffer !== 'undefined'
      && value instanceof SharedArrayBuffer),
  isProxy: () => false,
} satisfies Partial<Record<keyof typeof import('node:util/types'), unknown>>;

export const {
  isPromise,
  isRegExp,
  isDate,
  isMap,
  isSet,
  isNativeError,
  isAsyncFunction,
  isGeneratorFunction,
  isTypedArray,
  isUint8Array,
  isArrayBuffer,
  isAnyArrayBuffer,
  isProxy,
} = types;
export default types;
