// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// MTS-side transfer protocol tests. The transfer context is created once per
// runtime (the first `registerComponent` fixes the thread), so this file owns
// the main thread side and fakes the background peer over a manual bus. The
// background side lives in `transferProtocol.test.jsx`.
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

import { SnapshotOperation } from '../../react/runtime/src/snapshot/lifecycle/patch/snapshotPatch';
import { snapshotInstanceManager } from '../../react/runtime/src/snapshot/snapshot/snapshotInstanceManager';
import { TransferRegistry } from '@lynx-js/react-transfer';
import { transferDiagnostics } from '@lynx-js/react-transfer/experimental/diagnostics';
import { globalEnvManager } from '../../react/runtime/__test__/snapshot/utils/envManager';
import { elementTree } from '../../react/runtime/__test__/snapshot/utils/nativeMethod';

function App(props) {
  transferDiagnostics.recordRender();
  return (
    <view>
      <text>{props.label}</text>
    </view>
  );
}

/**
 * A manual cross-thread event bus. The engine channel carries __RenderPage;
 * the native channel carries client transfer commands. The link channel is
 * what the main thread sends to and listens on
 * (shared with the background peer's core-context). The buses live for the
 * whole file because the transfer context attaches its listeners once; each
 * test only drains the outboxes.
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

let engine;
let link;
let nativeChannel;
let reportError;

function fireEngine(type, data) {
  engine.dispatchEvent({ type, data });
}
function fireNative(type, data, asString = false) {
  nativeChannel.dispatchEvent({
    type,
    data: asString ? JSON.stringify(data) : data,
  });
}
function fireJS(type, data, asString = false) {
  link.dispatchEvent({ type, data: asString ? JSON.stringify(data) : data });
}
const createdKeys = [];
function createTransfer(scopeKey) {
  createdKeys.push(scopeKey);
  fireNative('__CreateTransfer', {
    componentName: 'App',
    key: scopeKey,
    reloadVersion: 0,
    initialProps: { label: 'a' },
    propsVersion: 1,
  });
  nativeChannel.deliver('__CreateTransfer');
}
function lastResult() {
  return JSON.parse(link.sent('__TransferCommitResult').at(-1).data);
}
function patchListPacket(id, snapshotPatch) {
  return { patchList: [{ id, snapshotPatch }] };
}

beforeAll(() => {
  engine = makeBus();
  link = makeBus();
  nativeChannel = makeBus();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
  elementTree.clear();
  engine.drain();
  link.drain();
  nativeChannel.drain();
  reportError = vi.fn();
  vi.stubGlobal('lynx', {
    ...lynx,
    getCoreContext: () => link,
    getJSContext: () => link,
    getEngine: () => engine,
    getNative: () => nativeChannel,
    reportError,
  });
});

afterEach(() => {
  // Disposes every transfer while its element tree is still intact, so the
  // MTS element cleanup runs against the live tree.
  for (const scopeKey of createdKeys.splice(0)) {
    fireNative('__DestroyTransfer', { key: scopeKey });
    nativeChannel.deliver('__DestroyTransfer');
  }
  vi.unstubAllGlobals();
  globalEnvManager.resetEnv();
  elementTree.clear();
});

afterAll(() => {
  // Disposes the transfer context; the second dispatch proves that destroying
  // the lifetime twice is a no-op.
  for (let i = 0; i < 2; i++) {
    nativeChannel.dispatchEvent({ type: '__DestroyLifetime', data: {} });
    nativeChannel.deliver('__DestroyLifetime');
  }
});

describe('transfer protocol (main thread side)', () => {
  it('gates creation until the page is ready and emits the first frame', () => {
    expect(() => transferDiagnostics.recordRender())
      .toThrow('Transfer rendering has not been initialized');
    const engineListen = vi.spyOn(engine, 'addEventListener');
    const nativeListen = vi.spyOn(nativeChannel, 'addEventListener');
    TransferRegistry.registerComponent('App', () => App);
    expect(engineListen.mock.calls.map(([type]) => type)).toEqual([
      '__RenderPage',
    ]);
    expect(nativeListen.mock.calls.map(([type]) => type)).toEqual([
      '__CreateTransfer',
      '__SetTransferProps',
      '__DestroyTransfer',
      '__DestroyLifetime',
    ]);
    engineListen.mockRestore();
    nativeListen.mockRestore();
    expect(transferDiagnostics.debug.thread).toBe('MTS');
    expect(() => transferDiagnostics.recordRender())
      .toThrow('Transfer component rendered without its context');

    const key = { transferId: '1', generation: 1 };
    const createEvent = () => ({
      componentName: 'App',
      key,
      reloadVersion: 0,
      initialProps: { label: 'a' },
      propsVersion: 1,
    });

    // Created before the page exists: buffered, nothing rendered nor sent.
    fireNative('__CreateTransfer', createEvent());
    nativeChannel.deliver('__CreateTransfer');
    expect(elementTree.root).toBeUndefined();
    expect(transferDiagnostics.debug.records['1:1']).toBeUndefined();
    expect(link.sent('__TransferFirstFrame')).toHaveLength(0);

    // Booting the page flushes the buffered create.
    createdKeys.push(key);
    fireEngine('__RenderPage', [{ text: 'Hello' }]);
    engine.deliver('__RenderPage');
    expect(elementTree.root.type).toBe('page');
    expect(lynx.__initData).toEqual({ text: 'Hello' });
    expect(transferDiagnostics.debug.records['1:1']).toMatchObject({
      phase: 'waiting',
      seq: 0,
      renders: 1,
    });
    const transferElement = elementTree.root.children[0];
    expect(transferElement.type).toBe('transfer-view');
    expect(transferElement.props['transfer-id']).toBe('1');
    expect(transferElement.props.dataset.__transferMeta).toMatchObject({
      reloadVersion: 0,
      key,
    });
    expect(transferElement.children[0].type).toBe('view');
    expect(transferElement.children[0].children[0].children[0].props.text).toBe(
      'a',
    );

    // The create and first frame are announced to the background thread.
    const creates = link.sent('__CreateTransfer');
    expect(creates).toHaveLength(1);
    expect(JSON.parse(creates[0].data)).toMatchObject({
      componentName: 'App',
      key,
      propsVersion: 1,
    });
    const frames = link.sent('__TransferFirstFrame');
    expect(frames).toHaveLength(1);
    const frame = JSON.parse(frames[0].data);
    expect(frame.key).toEqual(key);
    expect(frame.propsVersion).toBe(1);
    expect(frame.snapshot).toContain('"a"');
    expect(JSON.parse(frame.snapshot).type).toBe('root');

    // Unknown components are rejected without rendering anything.
    fireNative('__CreateTransfer', {
      ...createEvent(),
      componentName: 'Missing',
      key: { transferId: '404', generation: 1 },
    });
    expect(() => nativeChannel.deliver('__CreateTransfer')).toThrow(
      'Unknown transfer component: Missing',
    );
    expect(elementTree.root.children).toHaveLength(1);

    // A duplicate create for the same transfer is a no-op.
    fireNative('__CreateTransfer', createEvent());
    nativeChannel.deliver('__CreateTransfer');
    expect(link.sent('__TransferFirstFrame')).toHaveLength(1);
    expect(transferDiagnostics.debug.records['1:1'].renders).toBe(1);
  });

  it('applies hydration and update commits and fails on sequence mismatches', () => {
    TransferRegistry.registerComponent('App', () => App);
    fireEngine('__RenderPage', [{}]);
    engine.deliver('__RenderPage');
    const key = { transferId: '2', generation: 1 };
    createTransfer(key);
    expect(transferDiagnostics.debug.records['2:1']).toMatchObject({
      phase: 'waiting',
      seq: 0,
    });

    // Hydration commit with an empty patch: applied and flips the record live.
    fireJS('__TransferCommit', {
      key,
      reloadVersion: 0,
      seq: 1,
      kind: 'hydrate',
      patchList: patchListPacket(100, []),
      patchOptions: { reloadVersion: 0, isHydration: true },
    }, true);
    link.deliver('__TransferCommit');
    expect(lastResult()).toMatchObject({ key, seq: 1, status: 'applied' });
    expect(transferDiagnostics.debug.records['2:1']).toMatchObject({
      phase: 'live',
      seq: 1,
    });

    // Update commit with a real patch: creates a view under the page element.
    const root = [...snapshotInstanceManager.values.values()].find(si =>
      si.type === 'root'
    );
    const patch = [
      SnapshotOperation.CreateElement,
      'view',
      999,
      SnapshotOperation.InsertBefore,
      root.__id,
      999,
      null,
      0,
    ];
    fireJS('__TransferCommit', {
      key,
      reloadVersion: 0,
      seq: 2,
      kind: 'update',
      patchList: patchListPacket(101, patch),
      patchOptions: { reloadVersion: 0 },
    }, true);
    link.deliver('__TransferCommit');
    expect(lastResult().status).toBe('applied');
    expect(elementTree.root.children.map(child => child.type)).toEqual([
      'transfer-view',
      'view',
    ]);
    expect(transferDiagnostics.debug.records['2:1'].seq).toBe(2);

    // An out-of-sequence commit fails, is reported and answered as failed.
    fireJS('__TransferCommit', {
      key,
      reloadVersion: 0,
      seq: 2,
      kind: 'update',
      patchList: patchListPacket(102, []),
      patchOptions: { reloadVersion: 0 },
    }, true);
    link.deliver('__TransferCommit');
    expect(lastResult().status).toBe('failed');
    expect(reportError).toHaveBeenCalledOnce();
    expect(reportError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(transferDiagnostics.debug.records['2:1'].seq).toBe(2);

    // Commits for unknown transfers are answered as disposed.
    fireJS('__TransferCommit', {
      key: { transferId: '404', generation: 1 },
      reloadVersion: 0,
      seq: 1,
      kind: 'update',
      patchList: patchListPacket(103, []),
      patchOptions: { reloadVersion: 0 },
    }, true);
    link.deliver('__TransferCommit');
    expect(lastResult().status).toBe('disposed');
  });

  it('forwards prop updates and disposes through both destroy paths', () => {
    TransferRegistry.registerComponent('App', () => App);
    // Booting without page data defaults the init data to an empty object.
    fireEngine('__RenderPage', [undefined]);
    engine.deliver('__RenderPage');
    expect(lynx.__initData).toEqual({});

    // Native-initiated destroy removes the transfer element and notifies.
    const key = { transferId: '3', generation: 1 };
    createTransfer(key);
    expect(elementTree.root.children.map(child => child.type)).toEqual([
      'transfer-view',
    ]);
    fireNative('__DestroyTransfer', { key });
    nativeChannel.deliver('__DestroyTransfer');
    expect(elementTree.root.children).toHaveLength(0);
    expect(link.sent('__DestroyTransfer')).toHaveLength(1);
    expect(transferDiagnostics.debug.records['3:1']).toMatchObject({
      phase: 'disposed',
    });

    // Background-initiated destroy takes the other listener path.
    const key2 = { transferId: '4', generation: 1 };
    createTransfer(key2);
    fireJS('__TransferDisposed', { key: key2 }, true);
    link.deliver('__TransferDisposed');
    expect(elementTree.root.children).toHaveLength(0);
    expect(link.sent('__DestroyTransfer')).toHaveLength(2);
    expect(transferDiagnostics.debug.records['4:1']).toMatchObject({
      phase: 'disposed',
    });

    // Stale destroys for dead transfers are ignored.
    fireNative('__DestroyTransfer', { key });
    nativeChannel.deliver('__DestroyTransfer');
    fireJS('__TransferDisposed', { key: key2 }, true);
    link.deliver('__TransferDisposed');
    expect(link.sent('__DestroyTransfer')).toHaveLength(2);

    // Prop updates for a live transfer are forwarded to the background.
    const key3 = { transferId: '5', generation: 1 };
    createTransfer(key3);
    fireNative('__SetTransferProps', {
      key: key3,
      props: { label: 'z' },
      propsVersion: 2,
    }, true);
    nativeChannel.deliver('__SetTransferProps');
    const forwarded = link.sent('__SetTransferProps');
    expect(forwarded).toHaveLength(1);
    expect(JSON.parse(forwarded[0].data)).toMatchObject({
      key: key3,
      propsVersion: 2,
    });
  });
});
