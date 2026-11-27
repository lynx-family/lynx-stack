// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// `node:util` from the npm `util` package, with the members of Node.js 24
// that it lacks and that build tools use.

/// <reference path="./packages.d.ts" />

import { isDeepStrictEqual } from 'assert/build/internal/util/comparisons.js';
import npmUtil from 'util/util.js';

import types from './util-types.js';

// CSI and OSC escape sequences.
// eslint-disable-next-line no-control-regex
const ANSI = /\u001B(?:\[[\d;?]*[\x20-\x2F]*[\x40-\x7E]|\][^\u0007]*\u0007)/g;

const util = {
  ...npmUtil,
  types,
  isDeepStrictEqual,
  formatWithOptions: (_options: unknown, ...args: unknown[]) =>
    npmUtil.format(...args),
  stripVTControlCharacters: (input: unknown) => String(input).replace(ANSI, ''),
  styleText: (_format: unknown, text: string) => text,
  TextEncoder: globalThis.TextEncoder,
  TextDecoder: globalThis.TextDecoder,
};

export const {
  format,
  deprecate,
  debuglog,
  inspect,
  isArray,
  isBoolean,
  isNull,
  isNullOrUndefined,
  isNumber,
  isString,
  isSymbol,
  isUndefined,
  isRegExp,
  isObject,
  isDate,
  isError,
  isFunction,
  isPrimitive,
  isBuffer,
  log,
  inherits,
  _extend,
  promisify,
  callbackify,
  formatWithOptions,
  stripVTControlCharacters,
  styleText,
  TextEncoder,
  TextDecoder,
} = util;
export { isDeepStrictEqual, types };
export default util;
