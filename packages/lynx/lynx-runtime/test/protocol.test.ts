// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it, vi } from 'vitest';

import {
  copyHostData,
  isPlainRecord,
  subscribeSlot,
} from '../src/common/protocol.js';

describe('host slot subscriptions', () => {
  it('composes with a later wrapper without recursion and leaves that wrapper intact on unsubscribe', () => {
    const original = vi.fn();
    const host = { renderPage: original };
    const listener = vi.fn();
    const before = vi.fn();
    const after = vi.fn();
    const unsubscribe = subscribeSlot(
      host,
      'renderPage',
      listener,
      before,
      after,
    );
    const captured = host.renderPage;
    const wrapper = vi.fn((...args: unknown[]) => {
      captured(...args);
    });
    host.renderPage = wrapper;
    const laterListener = vi.fn();
    const unsubscribeLater = subscribeSlot(host, 'renderPage', laterListener);

    host.renderPage({ page: 1 });
    expect(original).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledExactlyOnceWith({ page: 1 });
    expect(before).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
    expect(laterListener).toHaveBeenCalledExactlyOnceWith({ page: 1 });

    unsubscribe();
    unsubscribeLater();
    expect(host.renderPage).toBe(wrapper);
    host.renderPage({ page: 2 });
    expect(original).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(before).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('finishes the dispatch and cleanup before rethrowing the first callback error', () => {
    const order: string[] = [];
    const host = {
      destroy() {
        order.push('old');
        throw new Error('old error');
      },
    };
    subscribeSlot(host, 'destroy', () => {
      order.push('first');
    }, () => {
      order.push('before');
    }, () => {
      order.push('after');
      throw new Error('cleanup error');
    });
    subscribeSlot(host, 'destroy', () => {
      order.push('second');
    });

    expect(() => host.destroy()).toThrow('old error');
    expect(order).toEqual(['before', 'old', 'first', 'second', 'after']);
  });
});

describe('plain records', () => {
  it('recognizes object literals and null-prototype records while rejecting non-plain prototypes', () => {
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
  });
});
