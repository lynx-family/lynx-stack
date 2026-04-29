// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import { createMessageStore } from '../src/store/MessageStore.js';
import type { ServerToClientMessage } from '../src/store/types.js';

const A: ServerToClientMessage = {
  createSurface: { surfaceId: 's1' },
} as ServerToClientMessage;
const B: ServerToClientMessage = {
  updateComponents: {
    surfaceId: 's1',
    components: [{ id: 'root', component: 'Text', text: 'hi' }],
  },
} as ServerToClientMessage;

describe('createMessageStore', () => {
  test('starts empty when no initial messages are provided', () => {
    const store = createMessageStore();
    expect(store.getSnapshot()).toHaveLength(0);
  });

  test('seeds from `initialMessages`', () => {
    const store = createMessageStore({ initialMessages: [A, B] });
    expect(store.getSnapshot()).toEqual([A, B]);
  });

  test('getSnapshot is referentially stable between mutations', () => {
    const store = createMessageStore();
    const a = store.getSnapshot();
    const b = store.getSnapshot();
    expect(a).toBe(b);
  });

  test('push appends a single message and notifies subscribers', () => {
    const store = createMessageStore();
    let calls = 0;
    store.subscribe(() => calls++);
    store.push(A);
    expect(store.getSnapshot()).toEqual([A]);
    expect(calls).toBe(1);
  });

  test('push appends a batch in one notification', () => {
    const store = createMessageStore();
    let calls = 0;
    store.subscribe(() => calls++);
    store.push([A, B]);
    expect(store.getSnapshot()).toEqual([A, B]);
    expect(calls).toBe(1);
  });

  test('push of an empty array is a no-op', () => {
    const store = createMessageStore();
    let calls = 0;
    store.subscribe(() => calls++);
    store.push([]);
    expect(store.getSnapshot()).toEqual([]);
    expect(calls).toBe(0);
  });

  test('subscribers can unsubscribe', () => {
    const store = createMessageStore();
    let calls = 0;
    const dispose = store.subscribe(() => calls++);
    dispose();
    store.push(A);
    expect(calls).toBe(0);
  });

  test('clear empties the buffer and notifies', () => {
    const store = createMessageStore({ initialMessages: [A, B] });
    let calls = 0;
    store.subscribe(() => calls++);
    store.clear();
    expect(store.getSnapshot()).toEqual([]);
    expect(calls).toBe(1);
  });

  test('clear is a no-op when already empty', () => {
    const store = createMessageStore();
    let calls = 0;
    store.subscribe(() => calls++);
    store.clear();
    expect(calls).toBe(0);
  });

  test('snapshot is frozen — mutations throw in strict mode', () => {
    const store = createMessageStore({ initialMessages: [A] });
    const snap = store.getSnapshot();
    expect(() => {
      (snap as ServerToClientMessage[]).push(B);
    }).toThrow();
  });
});
