import { describe, expect, it } from 'vitest';

import { describeInvalidValue } from '../../src/debug/describeInvalidValue.js';

describe('describeInvalidValue', () => {
  it('describes null and undefined', () => {
    expect(describeInvalidValue(null)).toBe('null');
    expect(describeInvalidValue(undefined)).toBe('undefined');
  });

  it('describes functions', () => {
    function namedFn() {}
    const anonymous = () => {};
    Object.defineProperty(anonymous, 'name', { value: '', configurable: true });

    expect(describeInvalidValue(namedFn)).toBe('function namedFn');
    expect(describeInvalidValue(anonymous)).toBe('function (anonymous)');
  });

  it('describes primitive values', () => {
    expect(describeInvalidValue('foo')).toBe('string "foo"');
    expect(describeInvalidValue(42)).toBe('number 42');
    expect(describeInvalidValue(BigInt(7))).toBe('bigint 7');
    expect(describeInvalidValue(true)).toBe('boolean true');
    const symbol = Symbol('token');
    expect(describeInvalidValue(symbol)).toBe(`symbol ${String(symbol)}`);
  });

  it('falls back for objects', () => {
    expect(describeInvalidValue({})).toBe('unexpected object');
  });
});
