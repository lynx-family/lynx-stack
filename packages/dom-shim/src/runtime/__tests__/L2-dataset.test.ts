// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { wrapPapi } from '../nodes.ts';
import type { L2SafeWritableElement } from '../nodes.ts';
import { _resetSchedulerForTesting } from '../scheduler.ts';

interface MockEl extends Record<string, unknown> {
  tag: string;
  data: Record<string, unknown>;
}

function installPapi(): void {
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockEl) => n.tag;
  g['__GetDataset'] = (n: MockEl) => n.data;
  g['__GetDataByKey'] = (n: MockEl, k: string) => n.data[k];
  g['__AddDataset'] = (n: MockEl, k: string, v: unknown) => {
    n.data[k] = v;
  };
  g['__SetDataset'] = (n: MockEl, v: Record<string, unknown> | undefined) => {
    n.data = { ...(v ?? {}) };
  };
  g['__FlushElementTree'] = () => undefined;
}

function el(data: Record<string, unknown> = {}): MockEl {
  return { tag: 'view', data: { ...data } };
}

describe('US-416 L2 writable dataset', () => {
  beforeEach(() => {
    _resetSchedulerForTesting();
    installPapi();
  });

  afterEach(() => {
    _resetSchedulerForTesting();
  });

  it('assignment writes through to PAPI', () => {
    const ref = el();
    const e = wrapPapi(ref) as L2SafeWritableElement;
    e.dataset['foo'] = 'bar';
    expect(ref.data['foo']).toBe('bar');
  });

  it('round-trips synchronously via cache', () => {
    const e = wrapPapi(el()) as L2SafeWritableElement;
    e.dataset['userId'] = '42';
    expect(e.dataset['userId']).toBe('42');
  });

  it('non-string values coerce', () => {
    const e = wrapPapi(el()) as L2SafeWritableElement;
    e.dataset['n'] = 42 as unknown as string;
    expect(e.dataset['n']).toBe('42');
  });

  it('delete removes from cache and pushes via __SetDataset', () => {
    const ref = el({ foo: 'bar', baz: 'qux' });
    const e = wrapPapi(ref) as L2SafeWritableElement;
    delete e.dataset['foo'];
    expect(e.dataset['foo']).toBeUndefined();
    expect(ref.data['foo']).toBeUndefined();
    expect(ref.data['baz']).toBe('qux');
  });

  it('delete-then-set re-establishes the key', () => {
    const e = wrapPapi(el({ foo: 'one' })) as L2SafeWritableElement;
    delete e.dataset['foo'];
    expect(e.dataset['foo']).toBeUndefined();
    e.dataset['foo'] = 'two';
    expect(e.dataset['foo']).toBe('two');
  });

  it('\'in\' operator considers cache + PAPI', () => {
    const e = wrapPapi(el({ a: '1' })) as L2SafeWritableElement;
    e.dataset['b'] = '2';
    expect('a' in e.dataset).toBe(true);
    expect('b' in e.dataset).toBe(true);
    expect('c' in e.dataset).toBe(false);
  });

  it('Object.keys lists both PAPI + cache, deduped', () => {
    const e = wrapPapi(el({ a: '1' })) as L2SafeWritableElement;
    e.dataset['b'] = '2';
    expect(Object.keys(e.dataset).sort()).toEqual(['a', 'b']);
  });

  it('mutations schedule auto-flush', async () => {
    let flushed = 0;
    (globalThis as Record<string, unknown>)['__FlushElementTree'] = () => {
      flushed++;
    };
    const e = wrapPapi(el()) as L2SafeWritableElement;
    e.dataset['x'] = '1';
    e.dataset['y'] = '2';
    delete e.dataset['x'];
    expect(flushed).toBe(0);
    await new Promise<void>((r) => {
      queueMicrotask(r);
    });
    expect(flushed).toBe(1);
  });
});
