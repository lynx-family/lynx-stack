// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import {
  createMessageReader,
  createMessageStore,
} from '../src/store/MessageStore.js';
import type { MessageRun, MessageStore } from '../src/store/MessageStore.js';
import type { ServerToClientMessage } from '../src/store/types.js';

const message = (surfaceId: string): ServerToClientMessage => ({
  version: '1.0',
  deleteSurface: { surfaceId },
});
const [A, B, C, D] = ['a', 'b', 'c', 'd'].map(id => message(id)) as [
  ServerToClientMessage,
  ServerToClientMessage,
  ServerToClientMessage,
  ServerToClientMessage,
];

function noop(): void {
  // Placeholder until the real disposer is known.
}

function drain(reader: { read(): MessageRun | undefined }) {
  const runs: [MessageRun['kind'], readonly ServerToClientMessage[]][] = [];
  for (let run = reader.read(); run; run = reader.read()) {
    runs.push([run.kind, run.messages]);
  }
  return runs;
}

describe('createMessageReader', () => {
  test('delivers initial and pushed messages once, as appends', () => {
    const store = createMessageStore({ initialMessages: [A] });
    const reader = createMessageReader(store);
    expect(drain(reader)).toEqual([['append', [A]]]);
    expect(drain(reader)).toEqual([]);
    store.push(B);
    store.push([C, D]);
    expect(drain(reader)).toEqual([['append', [B, C, D]]]);
  });

  test('delivers a replacement as one snapshot and its tail as appends', () => {
    const store = createMessageStore({ initialMessages: [A] });
    const reader = createMessageReader(store);
    drain(reader);
    store.replace([B, C]);
    store.push(D);
    expect(drain(reader)).toEqual([['replace', [B, C]], ['append', [D]]]);
  });

  test('delivers an empty replacement', () => {
    const store = createMessageStore({ initialMessages: [A] });
    const reader = createMessageReader(store);
    drain(reader);
    store.replace([]);
    expect(drain(reader)).toEqual([['replace', []]]);
    expect(drain(reader)).toEqual([]);
  });

  test('a clear delivers nothing by itself and later pushes as appends', () => {
    const store = createMessageStore({ initialMessages: [A] });
    const reader = createMessageReader(store);
    drain(reader);
    store.clear();
    expect(drain(reader)).toEqual([]);
    store.push(B);
    expect(drain(reader)).toEqual([['append', [B]]]);
  });

  test('a reader that fell behind sees every mutation in the order it was made', () => {
    const store = createMessageStore();
    const reader = createMessageReader(store);
    store.push(A);
    store.replace([B]);
    store.push(C);
    store.clear();
    store.push(D);
    store.replace([]);
    expect(drain(reader)).toEqual([
      ['append', [A]],
      ['replace', [B]],
      ['append', [C]],
      ['append', [D]],
      ['replace', []],
    ]);
  });

  test('a new reader starts at the current buffer, not at its history', () => {
    const store = createMessageStore({ initialMessages: [A] });
    store.replace([B]);
    store.push(C);
    expect(drain(createMessageReader(store))).toEqual([
      ['replace', [B]],
      ['append', [C]],
    ]);
    store.clear();
    store.push(D);
    expect(drain(createMessageReader(store))).toEqual([['append', [D]]]);
  });

  test('marks the tail of a replacement with the same generation', () => {
    const store = createMessageStore();
    const reader = createMessageReader(store);
    store.replace([A]);
    store.push(B);
    const snapshot = reader.read()!;
    const tail = reader.read()!;
    expect(tail.epoch).toBe(snapshot.epoch);
    store.clear();
    store.push(C);
    expect(reader.read()!.epoch).not.toBe(snapshot.epoch);
  });

  test('independent readers each see everything', () => {
    const store = createMessageStore();
    const first = createMessageReader(store);
    const second = createMessageReader(store);
    store.push(A);
    expect(drain(first)).toEqual([['append', [A]]]);
    store.replace([B]);
    expect(drain(second)).toEqual([['append', [A]], ['replace', [B]]]);
    expect(drain(first)).toEqual([['replace', [B]]]);
  });

  test('adopting delivers the whole buffer as one replacement', () => {
    const store = createMessageStore({ initialMessages: [A] });
    store.push(B);
    const reader = createMessageReader(store, { adopt: true });
    expect(drain(reader)).toEqual([['replace', [A, B]]]);
    store.push(C);
    expect(drain(reader)).toEqual([['append', [C]]]);
  });

  test('follows a wrapper built with object spread', () => {
    const original = createMessageStore();
    const wrapper: MessageStore = { ...original };
    const reader = createMessageReader(wrapper);
    wrapper.replace([A]);
    wrapper.push(B);
    expect(drain(reader)).toEqual([['replace', [A]], ['append', [B]]]);
  });

  test('follows a wrapper that only delegates', () => {
    const original = createMessageStore();
    const wrapper: MessageStore = {
      subscribe: cb => original.subscribe(cb),
      getSnapshot: () => original.getSnapshot(),
      push: messages => original.push(messages),
      replace: messages => original.replace(messages),
      clear: () => original.clear(),
    };
    const reader = createMessageReader(wrapper);
    wrapper.replace([A]);
    wrapper.push(B);
    expect(drain(reader)).toEqual([['replace', [A]], ['append', [B]]]);
  });

  test('reads a foreign store as an append-only buffer', () => {
    let snapshot: readonly ServerToClientMessage[] = [A];
    const foreign: MessageStore = {
      subscribe: () => noop,
      getSnapshot: () => snapshot,
      push: noop,
      replace: noop,
      clear: noop,
    };
    const reader = createMessageReader(foreign);
    expect(drain(reader)).toEqual([['append', [A]]]);
    snapshot = [A, B];
    expect(drain(reader)).toEqual([['append', [B]]]);
    snapshot = [];
    expect(drain(reader)).toEqual([]);
    snapshot = [C];
    expect(drain(reader)).toEqual([['append', [C]]]);
  });
});

describe('createMessageStore buffer', () => {
  test('a push does not rebuild the snapshot until it is read', () => {
    const store = createMessageStore();
    const before = store.getSnapshot();
    store.push(A);
    store.push(B);
    const after = store.getSnapshot();
    expect(before).toEqual([]);
    expect(after).toEqual([A, B]);
    expect(store.getSnapshot()).toBe(after);
    expect(Object.isFrozen(after)).toBe(true);
  });

  test('a subscriber removed during a notification is not called', () => {
    const store = createMessageStore();
    const calls: string[] = [];
    const offSecond: { current: () => void } = { current: noop };
    store.subscribe(() => {
      calls.push('first');
      offSecond.current();
    });
    offSecond.current = store.subscribe(() => calls.push('second'));
    store.push(A);
    expect(calls).toEqual(['first']);
  });

  test('a subscriber may mutate the store from its callback', () => {
    const store = createMessageStore();
    const reader = createMessageReader(store);
    let echoed = false;
    store.subscribe(() => {
      if (echoed) return;
      echoed = true;
      store.push(B);
    });
    store.push(A);
    expect(store.getSnapshot()).toEqual([A, B]);
    expect(drain(reader)).toEqual([['append', [A, B]]]);
  });
});
