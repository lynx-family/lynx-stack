// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The part of `node:util` that build tools use for messages and helpers.

const types = require('./util-types.cjs');

function inspect(value, options) {
  const depth = options?.depth ?? 2;
  const seen = new WeakSet();
  const walk = (input, level) => {
    if (typeof input === 'string') {
      return level === 0
        ? input
        : JSON.stringify(input);
    }
    if (typeof input === 'function') {
      return `[Function: ${input.name || 'anonymous'}]`;
    }
    if (typeof input === 'symbol' || typeof input === 'bigint') {
      return String(input);
    }
    if (input instanceof Error) {
      return input.stack ?? `${input.name}: ${input.message}`;
    }
    if (input === null || typeof input !== 'object') return String(input);
    if (seen.has(input)) return '[Circular]';
    if (level > depth) return Array.isArray(input) ? '[Array]' : '[Object]';
    seen.add(input);
    if (input instanceof RegExp || input instanceof Date) return String(input);
    if (input instanceof Map) {
      return `Map(${input.size}) {${
        [...input].map(([k, v]) =>
          ` ${walk(k, level + 1)} => ${walk(v, level + 1)}`
        ).join(',')
      } }`;
    }
    if (input instanceof Set) {
      return `Set(${input.size}) {${
        [...input].map(v => ` ${walk(v, level + 1)}`).join(',')
      } }`;
    }
    if (Array.isArray(input)) {
      return `[ ${input.map(v => walk(v, level + 1)).join(', ')} ]`;
    }
    const entries = Object.keys(input).map(key =>
      `${key}: ${walk(input[key], level + 1)}`
    );
    return `{ ${entries.join(', ')} }`;
  };
  return walk(value, 1);
}
inspect.custom = Symbol.for('nodejs.util.inspect.custom');

function format(first, ...args) {
  if (typeof first !== 'string') {
    return [first, ...args].map(v => (typeof v === 'string' ? v : inspect(v)))
      .join(' ');
  }
  let index = 0;
  const out = first.replace(/%([sdifjoOc%])/g, (match, spec) => {
    if (spec === '%') return '%';
    if (index >= args.length) return match;
    const value = args[index++];
    switch (spec) {
      case 's':
        return typeof value === 'string' ? value : inspect(value, { depth: 0 });
      case 'd':
      case 'i':
        return String(
          spec === 'i' ? Number.parseInt(value, 10) : Number(value),
        );
      case 'f':
        return String(Number.parseFloat(value));
      case 'j':
        try {
          return JSON.stringify(value);
        } catch {
          return '[Circular]';
        }
      case 'c':
        return '';
      default:
        return inspect(value);
    }
  });
  const rest = args.slice(index).map(
    v => (typeof v === 'string' ? v : inspect(v)),
  );
  return [out, ...rest].join(' ');
}

const kCustomPromisify = Symbol.for('nodejs.util.promisify.custom');
function promisify(fn) {
  if (fn[kCustomPromisify]) return fn[kCustomPromisify];
  return function promisified(...args) {
    return new Promise((resolve, reject) => {
      fn.call(this, ...args, (error, ...values) => {
        if (error) reject(error);
        else resolve(values.length > 1 ? values : values[0]);
      });
    });
  };
}
promisify.custom = kCustomPromisify;

function callbackify(fn) {
  return function callbackified(...args) {
    const callback = args.pop();
    fn.apply(this, args).then(
      value => callback(null, value),
      error => callback(error),
    );
  };
}

function deprecate(fn) {
  return fn;
}

function inherits(ctor, superCtor) {
  Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
  Object.setPrototypeOf(ctor, superCtor);
}

// CSI and OSC escape sequences.
// eslint-disable-next-line no-control-regex
const ANSI = /\u001B(?:\[[\d;?]*[\x20-\x2F]*[\x40-\x7E]|\][^\u0007]*\u0007)/g;

function isDeepStrictEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (
    typeof a !== 'object' || typeof b !== 'object' || a === null || b === null
  ) return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  const keysA = Reflect.ownKeys(a);
  const keysB = Reflect.ownKeys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(key => isDeepStrictEqual(a[key], b[key]));
}

module.exports = {
  format,
  formatWithOptions: (_options, ...args) => format(...args),
  inspect,
  promisify,
  callbackify,
  deprecate,
  inherits,
  isDeepStrictEqual,
  stripVTControlCharacters: (input) => String(input).replace(ANSI, ''),
  debuglog: () => Object.assign(() => {}, { enabled: false }),
  styleText: (_format, text) => text,
  types,
  isArray: Array.isArray,
  isRegExp: types.isRegExp,
  isDate: types.isDate,
  isError: (value) => value instanceof Error,
  TextEncoder,
  TextDecoder,
};
