// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from 'vitest';

import {
  copyHostData,
  dispatchListeners,
  invokeAll,
  isPlainRecord,
  subscribeListener,
} from '../src/common/protocol.js';

describe('protocol helpers', () => {
  it('runs all teardown callbacks in invokeAll before rethrowing the first error', () => {
    const order: string[] = [];
    expect(() =>
      invokeAll([
        () => {
          order.push('first');
          throw new Error('first teardown error');
        },
        () => {
          order.push('second');
          throw new Error('second teardown error');
        },
        () => {
          order.push('third');
        },
      ])
    ).toThrow('first teardown error');
    expect(order).toEqual(['first', 'second', 'third']);
  });

  it('deduplicates listeners, cancels immediately during dispatch, and defers additions', () => {
    const listeners = new Map<() => void, () => void>();
    const order: string[] = [];
    const first = () => {
      order.push('first');
      stopSecond();
      subscribeListener(listeners, () => {
        order.push('added-during-dispatch');
      });
    };
    const second = () => {
      order.push('second');
    };
    const stopFirst = subscribeListener(listeners, first);
    expect(subscribeListener(listeners, first)).toBe(stopFirst);
    const stopSecond = subscribeListener(listeners, second);

    dispatchListeners(listeners, (fn) => fn());
    expect(order).toEqual(['first']);

    dispatchListeners(listeners, (fn) => fn());
    expect(order).toEqual(['first', 'first', 'added-during-dispatch']);

    const failListeners = new Map<() => void, () => void>();
    subscribeListener(failListeners, () => {
      order.push('before-throw');
      throw new Error('fail-fast');
    });
    subscribeListener(failListeners, () => {
      order.push('skipped');
    });
    expect(() => dispatchListeners(failListeners, (fn) => fn())).toThrow(
      'fail-fast',
    );
    expect(order.at(-1)).toBe('before-throw');
  });

  it('recognizes object literals and null-prototype records while retaining opaque values by reference', () => {
    const nullRecord = Object.assign(
      Object.create(null) as { count: number; items: Array<{ ok: boolean }> },
      { count: 1, items: [{ ok: true }] },
    );
    const nullProtoChain: unknown = Object.create(
      Object.create(null) as object,
    );
    class NullBase extends null {
      constructor() {
        return Object.create(new.target.prototype) as NullBase;
      }
    }

    expect(isPlainRecord({ count: 1 })).toBe(true);
    expect(isPlainRecord(nullRecord)).toBe(true);
    expect(isPlainRecord(null)).toBe(false);
    expect(isPlainRecord([])).toBe(false);
    expect(isPlainRecord(new Date())).toBe(false);
    expect(isPlainRecord(nullProtoChain)).toBe(false);
    expect(isPlainRecord(new NullBase())).toBe(false);

    const copied = copyHostData(nullRecord);
    expect(copied).toEqual({ count: 1, items: [{ ok: true }] });
    expect(Object.getPrototypeOf(copied)).toBeNull();
    expect(Object.getPrototypeOf(copied.items[0])).toBe(Object.prototype);
    expect(isPlainRecord({ [Symbol.toStringTag]: 'Custom' })).toBe(true);
  });
});
