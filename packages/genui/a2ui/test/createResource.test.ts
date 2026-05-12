// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { createResource } from '../src/store/Resource.js';

describe('createResource', () => {
  test('starts in pending status with undefined value', () => {
    const r = createResource<string>('a');
    expect(r.status).toBe('pending');
    expect(r.value).toBeUndefined();
    expect(r.completed).toBe(false);
    expect(r.getSnapshot()).toEqual({
      status: 'pending',
      value: undefined,
      error: undefined,
    });
  });

  test('complete moves to success and exposes value via getSnapshot', () => {
    const r = createResource<string>('a');
    r.complete('hello');
    expect(r.status).toBe('success');
    expect(r.value).toBe('hello');
    expect(r.completed).toBe(true);
    expect(r.getSnapshot()).toEqual({
      status: 'success',
      value: 'hello',
      error: undefined,
    });
  });

  test('getSnapshot reference changes on every transition', () => {
    const r = createResource<string>('a');
    const s1 = r.getSnapshot();
    r.complete('hello');
    const s2 = r.getSnapshot();
    expect(s2).not.toBe(s1);
  });

  test('pending → error transition produces a new snapshot reference', () => {
    const r = createResource<string>('a');
    const s1 = r.getSnapshot();
    r.fail(new Error('boom'));
    const s2 = r.getSnapshot();
    expect(s2).not.toBe(s1);
    expect(s2.status).toBe('error');
    expect((s2.error as Error).message).toBe('boom');
  });

  test('complete after fail is rejected — error is terminal', () => {
    const r = createResource<string>('a');
    r.fail(new Error('boom'));
    r.complete('hello');
    expect(r.status).toBe('error');
    expect(r.value).toBeUndefined();
  });

  test('read does not throw when pending', () => {
    const r = createResource<string>('a');
    expect(() => r.read()).not.toThrow();
    expect(r.read()).toBeUndefined();
  });

  test('subscribe is invoked on every complete and disposers stop firing', () => {
    const r = createResource<string>('a');
    let count1 = 0;
    let count2 = 0;
    const d1 = r.subscribe(() => {
      count1++;
    });
    r.subscribe(() => {
      count2++;
    });

    r.complete('first');
    expect(count1).toBe(1);
    expect(count2).toBe(1);

    d1();
    r.complete('second');
    expect(count1).toBe(1);
    expect(count2).toBe(2);
  });

  test('promise resolves on first complete', async () => {
    const r = createResource<string>('a');
    setTimeout(() => r.complete('x'), 0);
    const v = await r.promise;
    expect(v).toBe('x');
  });

  test('fail moves to error and rejects promise', async () => {
    const r = createResource<string>('a');
    r.fail(new Error('boom'));
    expect(r.status).toBe('error');
    await expect(r.promise).rejects.toThrow('boom');
  });

  test('subsequent completes update value but only first resolves promise', async () => {
    const r = createResource<string>('a');
    r.complete('first');
    r.complete('second');
    expect(r.value).toBe('second');
    const v = await r.promise;
    expect(v).toBe('first');
  });

  test('onUpdate (deprecated) still receives updates', () => {
    const r = createResource<string>('a');
    const seen: string[] = [];
    r.onUpdate((v) => seen.push(v));
    r.complete('x');
    r.complete('y');
    expect(seen).toEqual(['x', 'y']);
  });
});
