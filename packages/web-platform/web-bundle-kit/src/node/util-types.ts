// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// `node:util/types`: `types` of the npm `util` package. Its `isProxy` throws,
// because a proxy cannot be told from JavaScript; here it returns false.

/// <reference path="./packages.d.ts" />

import npmUtil from 'util/util.js';

const types = { ...npmUtil.types, isProxy: (_value: unknown) => false };

export const {
  isArgumentsObject,
  isGeneratorFunction,
  isTypedArray,
  isPromise,
  isArrayBufferView,
  isUint8Array,
  isUint8ClampedArray,
  isUint16Array,
  isUint32Array,
  isInt8Array,
  isInt16Array,
  isInt32Array,
  isFloat32Array,
  isFloat64Array,
  isBigInt64Array,
  isBigUint64Array,
  isMap,
  isSet,
  isWeakMap,
  isWeakSet,
  isArrayBuffer,
  isDataView,
  isSharedArrayBuffer,
  isAsyncFunction,
  isMapIterator,
  isSetIterator,
  isGeneratorObject,
  isWebAssemblyCompiledModule,
  isNumberObject,
  isStringObject,
  isBooleanObject,
  isBigIntObject,
  isSymbolObject,
  isBoxedPrimitive,
  isAnyArrayBuffer,
  isRegExp,
  isDate,
  isNativeError,
  isProxy,
} = types;
export default types;
