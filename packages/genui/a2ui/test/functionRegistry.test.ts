// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { beforeEach, describe, expect, test } from '@rstest/core';

import { FunctionRegistry } from '../src/store/FunctionRegistry.js';

describe('FunctionRegistry', () => {
  let registry: FunctionRegistry;

  void beforeEach(() => {
    registry = new FunctionRegistry();
  });

  test('register/resolve round-trip', () => {
    registry.register({ name: 'identity', impl: (args) => args['value'] });
    const fn = registry.resolve('identity');
    expect(fn).toBeDefined();
    expect(fn!({ value: 42 })).toBe(42);
  });

  test('has reflects registered state', () => {
    expect(registry.has('foo')).toBe(false);
    registry.register({ name: 'foo', impl: () => null });
    expect(registry.has('foo')).toBe(true);
    registry.unregister('foo');
    expect(registry.has('foo')).toBe(false);
  });

  test('list returns every registered entry', () => {
    registry.register({ name: 'a', impl: () => 1 });
    registry.register({ name: 'b', impl: () => 2 });
    const names = registry.list().map(entry => entry.name).sort();
    expect(names).toEqual(['a', 'b']);
  });

  test('re-registering by name overrides the prior impl', () => {
    registry.register({ name: 'pick', impl: () => 'first' });
    registry.register({ name: 'pick', impl: () => 'second' });
    expect(registry.resolve('pick')!({})).toBe('second');
  });

  test('schema is preserved when provided', () => {
    registry.register({
      name: 'schemed',
      impl: () => 0,
      schema: { type: 'object' },
    });
    expect(registry.list()[0]!.schema).toEqual({ type: 'object' });
  });
});
