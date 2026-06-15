// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Minimal WPT testharness emulation. See Shim_Design.md §11 and
 * Shim_Implementation_PRD.md US-462.
 *
 * Each Shim WPT test exports a `{ name, fn(ctx) }` shape. `ctx` carries
 * the assert_* helpers from the upstream `testharness.js`, a skip helper
 * for in-test bailout, and a diagnostics collector that grabs
 * Shim-emitted `shim:Lx/...` warning codes for the test result.
 */

import type { DiagnosticPayload } from '../src/runtime/errors.ts';

export interface TestContext {
  assert_true(actual: unknown, msg?: string): void;
  assert_false(actual: unknown, msg?: string): void;
  assert_equals<T>(actual: T, expected: T, msg?: string): void;
  assert_not_equals<T>(actual: T, expected: T, msg?: string): void;
  assert_array_equals<T>(actual: T[], expected: T[], msg?: string): void;
  assert_throws(
    expectedCode: string,
    fn: () => unknown,
    msg?: string,
  ): void;
  assert_unreached(msg?: string): never;
  skip(reason: string): never;
  /** Push a diagnostic code observed during the test. */
  recordDiagnostic(code: string): void;
}

export class AssertionError extends Error {
  constructor(public msg: string) {
    super(msg);
    this.name = 'WPTAssertionError';
  }
}

export class SkipError extends Error {
  constructor(public reason: string) {
    super(reason);
    this.name = 'WPTSkipError';
  }
}

function stringify(v: unknown): string {
  if (v === undefined || v === null) return String(v);
  switch (typeof v) {
    case 'string':
      return v;
    case 'number':
    case 'boolean':
    case 'bigint':
      return String(v);
    case 'symbol':
      return v.toString();
    default:
      return JSON.stringify(v);
  }
}

export function createContext(): { ctx: TestContext; diagnostics: string[] } {
  const diagnostics: string[] = [];
  const ctx: TestContext = {
    assert_true(actual, msg) {
      if (!actual) {
        throw new AssertionError(msg ?? `assert_true: ${stringify(actual)}`);
      }
    },
    assert_false(actual, msg) {
      if (actual) {
        throw new AssertionError(msg ?? `assert_false: ${stringify(actual)}`);
      }
    },
    assert_equals(actual, expected, msg) {
      if (actual !== expected) {
        throw new AssertionError(
          msg
            ?? `assert_equals: expected ${stringify(expected)} got ${
              stringify(actual)
            }`,
        );
      }
    },
    assert_not_equals(actual, expected, msg) {
      if (actual === expected) {
        throw new AssertionError(
          msg
            ?? `assert_not_equals: expected NOT ${
              stringify(expected)
            } but got it`,
        );
      }
    },
    assert_array_equals(actual, expected, msg) {
      if (!Array.isArray(actual) || !Array.isArray(expected)) {
        throw new AssertionError(
          msg ?? `assert_array_equals: non-array argument`,
        );
      }
      if (actual.length !== expected.length) {
        throw new AssertionError(
          msg
            ?? `assert_array_equals: length ${actual.length} != ${expected.length}`,
        );
      }
      for (let i = 0; i < actual.length; i++) {
        if (actual[i] !== expected[i]) {
          throw new AssertionError(
            msg ?? `assert_array_equals: index ${i} differs`,
          );
        }
      }
    },
    assert_throws(expectedCode, fn, msg) {
      let caught: unknown;
      try {
        fn();
      } catch (e) {
        caught = e;
      }
      if (caught === undefined) {
        throw new AssertionError(
          msg ?? `assert_throws: expected ${expectedCode} but no throw`,
        );
      }
      const diag = (caught as { diagnostic?: DiagnosticPayload }).diagnostic;
      if (!diag) {
        throw new AssertionError(
          msg ?? `assert_throws: thrown value has no diagnostic`,
        );
      }
      if (diag.code !== expectedCode) {
        throw new AssertionError(
          msg
            ?? `assert_throws: expected code ${expectedCode}, got ${diag.code}`,
        );
      }
    },
    assert_unreached(msg) {
      throw new AssertionError(msg ?? 'assert_unreached reached');
    },
    skip(reason) {
      throw new SkipError(reason);
    },
    recordDiagnostic(code) {
      diagnostics.push(code);
    },
  };
  return { ctx, diagnostics };
}
