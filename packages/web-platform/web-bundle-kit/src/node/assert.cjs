// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const { isDeepStrictEqual } = require('./util.cjs');

class AssertionError extends Error {
  code = 'ERR_ASSERTION';
}

function assert(value, message) {
  if (!value) {
    throw message instanceof Error
      ? message
      : new AssertionError(
        message ?? 'The expression evaluated to a falsy value',
      );
  }
}
assert.ok = assert;
assert.AssertionError = AssertionError;
assert.equal = (a, b, message) => assert(a == b, message ?? `${a} == ${b}`);
assert.strictEqual = (a, b, message) =>
  assert(Object.is(a, b), message ?? `${a} === ${b}`);
assert.notStrictEqual = (a, b, message) =>
  assert(!Object.is(a, b), message ?? `${a} !== ${b}`);
assert.deepStrictEqual = (a, b, message) =>
  assert(
    isDeepStrictEqual(a, b),
    message ?? 'Expected values to be strictly deep-equal',
  );
assert.fail = (message) => {
  throw new AssertionError(message ?? 'Failed');
};
assert.strict = assert;

module.exports = assert;
