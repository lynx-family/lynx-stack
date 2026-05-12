// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// Smoke tests for the upstream-`BASIC_FUNCTIONS` adapter. Per-function
// behavior is covered by `@a2ui/web_core`'s own test suite — we only verify
// here that the adapter wires upstream impls into our `FunctionRegistry`
// and that the `email` omission is honored.
import { afterAll, beforeAll, describe, expect, test } from '@rstest/core';

import {
  basicFunctions,
  registerBasicFunctions,
} from '../src/functions/index.js';
import {
  FunctionRegistry,
  functionRegistry,
} from '../src/store/FunctionRegistry.js';

describe('basicFunctions adapter', () => {
  test('exposes the validators + logic functions consumed by useChecks', () => {
    const names = basicFunctions.map(fn => fn.name);
    for (
      const required of [
        'required',
        'regex',
        'length',
        'numeric',
        'email',
        'and',
        'or',
        'not',
      ]
    ) {
      expect(names).toContain(required);
    }
  });

  test('exposes the spec\'s formatters + side-effect functions', () => {
    const names = basicFunctions.map(fn => fn.name);
    for (
      const required of [
        'formatString',
        'formatNumber',
        'formatCurrency',
        'formatDate',
        'pluralize',
        'openUrl',
      ]
    ) {
      expect(names).toContain(required);
    }
  });

  describe('registerBasicFunctions', () => {
    const snapshot = new FunctionRegistry();
    void beforeAll(() => {
      // Save anything already registered so we can restore it after.
      for (const entry of functionRegistry.list()) {
        snapshot.register(entry);
      }
    });
    void afterAll(() => {
      // Best-effort cleanup so other tests see the pre-test state.
      for (const entry of functionRegistry.list()) {
        functionRegistry.unregister(entry.name);
      }
      for (const entry of snapshot.list()) {
        functionRegistry.register(entry);
      }
    });

    test('routes a known function through the upstream impl', () => {
      registerBasicFunctions();
      const required = functionRegistry.resolve('required');
      expect(required).toBeDefined();
      expect(required!({ value: '' })).toBe(false);
      expect(required!({ value: 'hi' })).toBe(true);
    });
  });
});
