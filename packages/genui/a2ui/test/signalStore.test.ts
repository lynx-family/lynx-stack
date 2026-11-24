// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { effect } from '@lynx-js/react-signals';

import { SignalStore } from '../src/store/SignalStore.js';

function watch(store: SignalStore, path: string) {
  const seen: unknown[] = [];
  effect(() => {
    seen.push(store.getSignal(path).value);
  });
  return seen;
}

describe('SignalStore', () => {
  test('a signal created after a write starts with the current value', () => {
    const store = new SignalStore();
    store.update('/', { user: { name: 'Ada' }, items: ['x', 'y'] });
    expect(store.getSignal('/user/name').value).toBe('Ada');
    expect(store.getSignal('/items/1').value).toBe('y');
    expect(store.getSignal('/').value).toBe(store.getDataModel());
    expect(store.getSignal('/missing/deep').value).toBeUndefined();
    expect(store.getSignal('/items/length').value).toBeUndefined();
  });

  test('a write notifies the path, its ancestors and its descendants only', () => {
    const store = new SignalStore();
    store.update('/', { user: { name: 'Ada', role: 'admin' }, other: 1 });
    const root = watch(store, '/');
    const user = watch(store, '/user');
    const name = watch(store, '/user/name');
    const role = watch(store, '/user/role');
    const other = watch(store, '/other');
    store.update('/user/name', 'Grace');
    expect(root).toHaveLength(2);
    expect(user).toEqual([{ name: 'Ada', role: 'admin' }, {
      name: 'Grace',
      role: 'admin',
    }]);
    expect(name).toEqual(['Ada', 'Grace']);
    expect(role).toEqual(['admin']);
    expect(other).toEqual([1]);
    store.update('/user', { name: 'Lin' });
    expect(name).toEqual(['Ada', 'Grace', 'Lin']);
    expect(role).toEqual(['admin', undefined]);
    expect(other).toEqual([1]);
  });

  test('writing an equal value changes nothing and notifies nobody', () => {
    const store = new SignalStore();
    store.update('/', { user: { name: 'Ada' } });
    const model = store.getDataModel();
    const root = watch(store, '/');
    const user = watch(store, '/user');
    store.update('/user', { name: 'Ada' });
    store.update('/user/name', 'Ada');
    store.update('/missing', null);
    expect(store.getDataModel()).toBe(model);
    expect(root).toHaveLength(1);
    expect(user).toHaveLength(1);
  });

  test('deleting an array element updates the siblings it shifts', () => {
    const store = new SignalStore();
    store.update('/', { items: ['a', 'b', 'c'] });
    const second = watch(store, '/items/1');
    const third = watch(store, '/items/2');
    store.update('/items/1', null);
    expect(store.getDataModel()).toEqual({ items: ['a', 'c'] });
    expect(second).toEqual(['b', 'c']);
    expect(third).toEqual(['c', undefined]);
  });

  test('reads escaped keys and treats a missing leading slash as absolute', () => {
    const store = new SignalStore();
    store.update('a/b', 1);
    store.update('/weird~1key', 2);
    expect(store.getDataModel()).toEqual({ a: { b: 1 }, 'weird/key': 2 });
    expect(store.getSignal('/a/b').value).toBe(1);
    expect(store.getSignal('/weird~1key').value).toBe(2);
  });

  test('keeps a default only while the path has no value', () => {
    const store = new SignalStore();
    expect(store.getSignal('/draft', 'fallback').value).toBe('fallback');
    store.update('/', { name: 'Ada' });
    expect(store.getSignal('/name', 'fallback').value).toBe('Ada');
  });
});
