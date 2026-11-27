// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The default export is the `assert` function, with the other members as its
// properties, as in Node.js. A CommonJS `require('assert')` in bundled code
// gets this module's namespace, which has the members but cannot be called.

import { isDeepStrictEqual } from './util.js';

class AssertionError extends Error {
  code = 'ERR_ASSERTION';
}

function assert(value: unknown, message?: string | Error): asserts value {
  if (!value) {
    throw message instanceof Error
      ? message
      : new AssertionError(
        message ?? 'The expression evaluated to a falsy value',
      );
  }
}
// `ok` is `assert` itself. Typed without `asserts`: TypeScript only accepts
// assertion signatures on names declared with an explicit type.
assert.ok = assert as (value: unknown, message?: string | Error) => void;
assert.AssertionError = AssertionError;
assert.equal = (a: unknown, b: unknown, message?: string | Error): void =>
  // Loose equality, as `assert.equal` in Node.js.
  assert(a == b, message ?? `${String(a)} == ${String(b)}`);
assert.strictEqual = (
  a: unknown,
  b: unknown,
  message?: string | Error,
): void => assert(Object.is(a, b), message ?? `${String(a)} === ${String(b)}`);
assert.notStrictEqual = (
  a: unknown,
  b: unknown,
  message?: string | Error,
): void => assert(!Object.is(a, b), message ?? `${String(a)} !== ${String(b)}`);
assert.deepStrictEqual = (
  a: unknown,
  b: unknown,
  message?: string | Error,
): void =>
  assert(
    isDeepStrictEqual(a, b),
    message ?? 'Expected values to be strictly deep-equal',
  );
assert.fail = (message?: string): never => {
  throw new AssertionError(message ?? 'Failed');
};
assert.strict = assert.ok;

export const {
  ok,
  equal,
  strictEqual,
  notStrictEqual,
  deepStrictEqual,
  fail,
  strict,
} = assert;
export { AssertionError };
export default assert;
