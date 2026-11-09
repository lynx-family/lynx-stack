// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// BTS-side transfer protocol tests. The transfer context is created once per
// runtime (the first `registerComponent` fixes the thread), so this file owns
// the background side and fakes the main thread peer over a manual bus. The
// main thread side lives in `transferProtocol.mts.test.jsx`.
import { createElement, render } from 'preact';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { useState } from '../../react/runtime/src/index';
import { RENDER } from '../../react/runtime/src/shared/render-constants';
import {
  BackgroundSnapshotInstance,
  backgroundSnapshotInstanceManager,
} from '../../react/runtime/src/snapshot/snapshot/backgroundSnapshot';
import { TransferRegistry } from '@lynx-js/react-transfer';
import { transferDiagnostics } from '@lynx-js/react-transfer/experimental/diagnostics';
import { globalEnvManager } from '../../react/runtime/__test__/snapshot/utils/envManager';
import {
  elementTree,
  waitSchedule,
} from '../../react/runtime/__test__/snapshot/utils/nativeMethod';

let bumpRoot;
let bumpChild;
function Counter(props) {
  transferDiagnostics.recordRender();
  const [n, setN] = useState(0);
  bumpChild = setN;
  return <text>{`${props.label}:${n}`}</text>;
}
function App(props) {
  transferDiagnostics.recordRender();
  const [extra, setExtra] = useState('x');
  bumpRoot = setExtra;
  return (
    <view>
      <text>{props.label}</text>
      <text>{extra}</text>
      <Counter label={props.label} />
    </view>
  );
}

/**
 * A manual cross-thread event bus standing in for the JS-context/core-context
 * message channels. `dispatchEvent` only queues; `deliver` plays queued events
 * into the listeners registered so far, which makes commit/ACK ordering
 * observable instead of coincidental. The bus lives for the whole file because
 * the transfer context attaches its listeners once; each test drains it.
 */
function makeBus() {
  const listeners = new Map();
  const outbox = [];
  return {
    outbox,
    sent(type) {
      return outbox.filter(event => event.type === type);
    },
    drain() {
      outbox.length = 0;
    },
    capture(type) {
      return [...(listeners.get(type) ?? [])];
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      const arr = listeners.get(type);
      if (arr) listeners.set(type, arr.filter(l => l !== listener));
    },
    dispatchEvent(event) {
      outbox.push(event);
      return { canceled: false };
    },
    deliver(type) {
      for (let i = 0; i < outbox.length;) {
        const event = outbox[i];
        if (type !== undefined && event.type !== type) {
          i++;
          continue;
        }
        outbox.splice(i, 1);
        for (const listener of [...(listeners.get(event.type) ?? [])]) {
          listener(event);
        }
      }
    },
  };
}

let link;
let nativeChannel;

function fireJS(type, data, asString = false) {
  link.dispatchEvent({ type, data: asString ? JSON.stringify(data) : data });
}
function ack(seq, status = 'applied', scopeKey = key) {
  fireJS('__TransferCommitResult', {
    key: scopeKey,
    reloadVersion: 0,
    seq,
    status,
  });
  link.deliver('__TransferCommitResult');
}

/** Serializes a background tree the way a main thread first frame would. */
function serializeFirstFrame() {
  const toSerialized = node => ({
    id: node.__id,
    type: node.type,
    values: node.__values,
    children: node.childNodes.length > 0
      ? node.childNodes.map(toSerialized)
      : undefined,
  });
  return JSON.stringify(
    toSerialized(backgroundSnapshotInstanceManager.values.get(1)),
  );
}

const key = { transferId: '1', generation: 1 };
let firstFrameSnapshot;

function createLive(scopeKey) {
  fireJS('__CreateTransfer', {
    componentName: 'App',
    key: scopeKey,
    reloadVersion: 0,
    initialProps: { label: 'a' },
    propsVersion: 1,
  });
  link.deliver('__CreateTransfer');
  const id = `${scopeKey.transferId}:1`;
  // The record renders its component tree (root and nested component).
  expect(transferDiagnostics.debug.records[id]).toMatchObject({
    phase: 'waiting',
    renders: 2,
  });
  // The frame arrives while the record exists: hydrated right away.
  firstFrameSnapshot ??= serializeFirstFrame();
  fireJS('__TransferFirstFrame', {
    key: scopeKey,
    reloadVersion: 0,
    propsVersion: 1,
    snapshot: firstFrameSnapshot,
  });
  link.deliver('__TransferFirstFrame');
  expect(transferDiagnostics.debug.records[id]).toMatchObject({
    phase: 'hydrating',
  });
  const commits = link.sent('__TransferCommit');
  expect(commits).toHaveLength(1);
  const packet = JSON.parse(commits[0].data);
  expect(packet).toMatchObject({ key: scopeKey, seq: 1, kind: 'hydrate' });
  expect(packet.patchOptions.isHydration).toBe(true);
  expect(Array.isArray(packet.patchList.patchList[0].snapshotPatch)).toBe(true);
  ack(1, 'applied', scopeKey);
  expect(transferDiagnostics.debug.records[id]).toMatchObject({
    phase: 'live',
    seq: 1,
    renders: 2,
  });
}

beforeAll(() => {
  link = makeBus();
  nativeChannel = makeBus();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
  elementTree.clear();
  link.drain();
  nativeChannel.drain();
  vi.stubGlobal('lynx', {
    ...lynx,
    getCoreContext: () => link,
    getJSContext: () => link,
    getEngine: () => link,
    getNative: () => nativeChannel,
    reportError: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  globalEnvManager.resetEnv();
  elementTree.clear();
});

afterAll(() => {
  // Disposes the shared transfer context; the second dispatch proves that
  // destroying the lifetime twice is a no-op.
  for (let i = 0; i < 2; i++) {
    nativeChannel.dispatchEvent({ type: '__DestroyLifetime', data: {} });
    nativeChannel.deliver('__DestroyLifetime');
  }
});

describe('transfer protocol (background side)', () => {
  it('initializes once on the background thread and rejects renders outside of any transfer record', () => {
    expect(() => transferDiagnostics.recordRender())
      .toThrow('Transfer rendering has not been initialized');
    globalEnvManager.switchToBackground();
    TransferRegistry.registerComponent('App', () => App);
    expect(transferDiagnostics.debug.thread).toBe('BTS');
    // Registering another component reuses the same context.
    TransferRegistry.registerComponent('App', () => App);
    expect(transferDiagnostics.debug.thread).toBe('BTS');
    expect(() => transferDiagnostics.recordRender())
      .toThrow('Transfer component rendered without its context');
  });

  it('buffers the first frame, hydrates and serializes commits behind in-flight ACKs', async () => {
    globalEnvManager.switchToBackground();

    // An event published before any snapshot is hydrated is queued by the
    // transfer event handlers and replayed once the record goes live.
    lynx.getApp().publishEvent('404:1:', { type: 'tap' });

    createLive(key);

    // A duplicate first frame is ignored once hydration started.
    fireJS('__TransferFirstFrame', {
      key,
      reloadVersion: 0,
      propsVersion: 1,
      snapshot: firstFrameSnapshot,
    });
    link.deliver('__TransferFirstFrame');
    expect(link.sent('__TransferCommit')).toHaveLength(1);

    // --- Update commits are queued behind the in-flight packet ---
    bumpRoot('b');
    await waitSchedule();
    bumpRoot('c');
    await waitSchedule();
    // Both scheduled renders executed; the second commit is still queued.
    expect(transferDiagnostics.debug.records['1:1'].renders).toBe(6);
    const commits = link.sent('__TransferCommit');
    expect(commits).toHaveLength(2);
    expect(JSON.parse(commits[1].data)).toMatchObject({
      key,
      seq: 2,
      kind: 'update',
    });

    // ACK the in-flight commit: only then is the queued one released.
    ack(2);
    expect(link.sent('__TransferCommit')).toHaveLength(3);
    expect(JSON.parse(link.sent('__TransferCommit')[2].data)).toMatchObject({
      key,
      seq: 3,
      kind: 'update',
    });
    ack(3);
    expect(transferDiagnostics.debug.records['1:1']).toMatchObject({
      seq: 3,
      renders: 6,
    });

    // --- Nested component updates stay isolated to their own root ---
    bumpChild(1);
    await waitSchedule();
    expect(transferDiagnostics.debug.records['1:1'].renders).toBe(7);
    expect(link.sent('__TransferCommit')).toHaveLength(4);
    expect(JSON.parse(link.sent('__TransferCommit')[3].data)).toMatchObject({
      key,
      seq: 4,
      kind: 'update',
    });
    ack(4);
    // ACKing the last commit pumps an empty queue without sending anything.
    expect(link.sent('__TransferCommit')).toHaveLength(4);

    // --- Destroy with one commit in flight and one queued ---
    bumpRoot('y');
    await waitSchedule();
    bumpRoot('z');
    await waitSchedule();
    expect(link.sent('__TransferCommit')).toHaveLength(5);
    fireJS('__DestroyTransfer', { key });
    link.deliver('__DestroyTransfer');
    expect(transferDiagnostics.debug.records['1:1']).toMatchObject({
      phase: 'disposed',
    });
    expect(link.sent('__TransferDisposed')).toHaveLength(1);

    // Results for a disposed or unknown record are ignored.
    ack(5, 'applied', key);
    ack(999, 'applied', key);
    ack(1, 'applied', { transferId: '404', generation: 1 });

    // Stale messages for the dead transfer are ignored.
    fireJS('__TransferFirstFrame', {
      key,
      reloadVersion: 0,
      propsVersion: 1,
      snapshot: firstFrameSnapshot,
    });
    link.deliver('__TransferFirstFrame');
    fireJS('__SetTransferProps', { key, props: {}, propsVersion: 3 });
    link.deliver('__SetTransferProps');
    fireJS('__CreateTransfer', {
      componentName: 'App',
      key,
      reloadVersion: 0,
      initialProps: {},
      propsVersion: 1,
    });
    link.deliver('__CreateTransfer');
    fireJS('__DestroyTransfer', { key });
    link.deliver('__DestroyTransfer');
    expect(transferDiagnostics.debug.records['1:1']).toMatchObject({
      phase: 'disposed',
    });

    // --- A frame that arrives before its create is buffered, then consumed ---
    const scope2 = { transferId: '2', generation: 1 };
    fireJS('__TransferFirstFrame', {
      key: scope2,
      reloadVersion: 0,
      propsVersion: 1,
      snapshot: firstFrameSnapshot,
    });
    link.deliver('__TransferFirstFrame');
    expect(transferDiagnostics.debug.records['2:1']).toBeUndefined();
    fireJS('__CreateTransfer', {
      componentName: 'App',
      key: scope2,
      reloadVersion: 0,
      initialProps: { label: 'a' },
      propsVersion: 1,
    });
    link.deliver('__CreateTransfer');
    expect(transferDiagnostics.debug.records['2:1']).toMatchObject({
      phase: 'hydrating',
    });
    expect(link.sent('__TransferCommit')).toHaveLength(6);
    ack(1, 'applied', scope2);
    expect(transferDiagnostics.debug.records['2:1']).toMatchObject({
      phase: 'live',
    });
    // A duplicate create for a live record is a no-op.
    fireJS('__CreateTransfer', {
      componentName: 'App',
      key: scope2,
      reloadVersion: 0,
      initialProps: { label: 'a' },
      propsVersion: 1,
    });
    link.deliver('__CreateTransfer');
    expect(link.sent('__TransferCommit')).toHaveLength(6);
  });

  it('drops pre-hydration commits and stale props, and disposes on failed ACKs', async () => {
    globalEnvManager.switchToBackground();
    const scope3 = { transferId: '3', generation: 1 };

    fireJS('__CreateTransfer', {
      componentName: 'Missing',
      key: scope3,
      reloadVersion: 0,
      initialProps: {},
      propsVersion: 1,
    });
    expect(() => link.deliver('__CreateTransfer')).toThrow(
      'Unknown transfer component: Missing',
    );
    expect(transferDiagnostics.debug.records['3:1']).toBeUndefined();

    fireJS('__CreateTransfer', {
      componentName: 'App',
      key: scope3,
      reloadVersion: 0,
      initialProps: { label: 'a' },
      propsVersion: 1,
    });
    link.deliver('__CreateTransfer');
    expect(transferDiagnostics.debug.records['3:1']).toMatchObject({
      phase: 'waiting',
      renders: 2,
    });

    // While still waiting, prop updates re-render the background but no
    // commit is sent: pre-hydration commits are dropped.
    fireJS('__SetTransferProps', {
      key: scope3,
      props: { label: 'b' },
      propsVersion: 2,
    });
    link.deliver('__SetTransferProps');
    expect(transferDiagnostics.debug.records['3:1'].renders).toBe(4);
    expect(link.sent('__TransferCommit')).toHaveLength(0);

    // A prop version that is not newer is ignored.
    fireJS('__SetTransferProps', {
      key: scope3,
      props: { label: 'stale' },
      propsVersion: 2,
    });
    link.deliver('__SetTransferProps');
    expect(transferDiagnostics.debug.records['3:1'].renders).toBe(4);

    // Hydrate for real now.
    const snapshot = serializeFirstFrame();
    fireJS('__TransferFirstFrame', {
      key: scope3,
      reloadVersion: 0,
      propsVersion: 1,
      snapshot,
    });
    link.deliver('__TransferFirstFrame');
    expect(transferDiagnostics.debug.records['3:1']).toMatchObject({
      phase: 'hydrating',
    });
    ack(1, 'applied', scope3);
    expect(transferDiagnostics.debug.records['3:1']).toMatchObject({
      phase: 'live',
    });

    // A failed ACK disposes the record and notifies the main thread.
    bumpRoot('z');
    await waitSchedule();
    ack(2, 'failed', scope3);
    expect(transferDiagnostics.debug.records['3:1']).toMatchObject({
      phase: 'disposed',
    });
    expect(link.sent('__TransferDisposed')).toHaveLength(1);
  });

  it('throws for ordinary page commits while a transfer context owns the thread', () => {
    globalEnvManager.switchToBackground();
    expect(() =>
      render(
        createElement(function Nobody() {
          return null;
        }),
        new BackgroundSnapshotInstance('root'),
      )
    ).toThrow(
      'Commit rendered outside an independent root',
    );
  });

  it('restores the tracked render hook on context disposal', async () => {
    globalEnvManager.switchToBackground();
    // Reimporting internal also reruns the renderer's background bootstrap.
    lynx.getApp()._params = { initData: {}, updateData: {} };
    // Round 1: no previous render hook - disposal deletes the tracker.
    vi.resetModules();
    const freshPreact1 = await import('preact');
    const { TransferRegistry: registry1 } = await import(
      '@lynx-js/react-transfer'
    );
    delete freshPreact1.options[RENDER];
    registry1.registerComponent('R1', () =>
      function R1() {
        return null;
      });
    expect(freshPreact1.options[RENDER]).toBeTypeOf('function');
    const queuedDestroy = nativeChannel.capture('__DestroyLifetime');
    const removeListener = vi.spyOn(nativeChannel, 'removeEventListener');
    nativeChannel.dispatchEvent({ type: '__DestroyLifetime', data: {} });
    nativeChannel.deliver('__DestroyLifetime');
    expect(freshPreact1.options[RENDER]).toBeUndefined();
    // A callback already queued by the native channel may arrive after removal.
    const removals = removeListener.mock.calls.length;
    queuedDestroy.forEach(listener => listener({ data: {} }));
    expect(removeListener).toHaveBeenCalledTimes(removals);
    expect(freshPreact1.options[RENDER]).toBeUndefined();
    removeListener.mockRestore();

    // Round 2: a previous render hook - disposal restores it.
    vi.resetModules();
    const freshPreact2 = await import('preact');
    const { TransferRegistry: registry2 } = await import(
      '@lynx-js/react-transfer'
    );
    const previous = vi.fn();
    freshPreact2.options[RENDER] = previous;
    registry2.registerComponent('R2', () =>
      function R2() {
        return null;
      });
    expect(freshPreact2.options[RENDER]).not.toBe(previous);
    nativeChannel.dispatchEvent({ type: '__DestroyLifetime', data: {} });
    nativeChannel.deliver('__DestroyLifetime');
    expect(freshPreact2.options[RENDER]).toBe(previous);
    delete freshPreact2.options[RENDER];

    // Round 3: the hook was replaced after installation - disposal leaves it.
    vi.resetModules();
    const freshPreact3 = await import('preact');
    const { TransferRegistry: registry3 } = await import(
      '@lynx-js/react-transfer'
    );
    registry3.registerComponent('R3', () =>
      function R3() {
        return null;
      });
    const hijacked = vi.fn();
    freshPreact3.options[RENDER] = hijacked;
    nativeChannel.dispatchEvent({ type: '__DestroyLifetime', data: {} });
    nativeChannel.deliver('__DestroyLifetime');
    expect(freshPreact3.options[RENDER]).toBe(hijacked);
    delete freshPreact3.options[RENDER];
  });
});
