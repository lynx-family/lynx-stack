// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// Main thread side of the transfer protocol. The first `registerComponent` fixes
// the thread, so the background side lives in `transfer.test.jsx`.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { root } from '../../../src/index';
import { TransferRegistry } from '../../../src/internal';
import { __root } from '../../../src/root';
import { snapshotInstanceManager } from '../../../src/snapshot/snapshot/snapshotInstanceManager';
import { globalEnvManager } from '../utils/envManager';
import { elementTree } from '../utils/nativeMethod';

function makeBus(stringify) {
  const listeners = {};
  const sent = [];
  return {
    of: type => sent.filter(event => event.type === type).map(event => event.data),
    addEventListener(type, listener) {
      (listeners[type] ??= []).push(listener);
    },
    removeEventListener(type, listener) {
      listeners[type] = listeners[type]?.filter(l => l !== listener);
    },
    dispatchEvent(event) {
      sent.push({ type: event.type, data: JSON.parse(event.data) });
    },
    fire(type, data) {
      listeners[type]?.forEach(listener => listener({ data: stringify ? JSON.stringify(data) : data }));
    },
  };
}

// Background payloads are JSON strings; native and engine payloads are objects.
const link = makeBus(true);
const native = makeBus(false);
const engine = makeBus(false);
const reportError = vi.fn();

function Bubble(props) {
  return (
    <view>
      <text>{props.text}</text>
    </view>
  );
}
function Page() {
  return <view />;
}

function create(transferId) {
  native.fire('__CreateTransfer', { transferId, componentName: 'Bubble', initialProps: { text: `t${transferId}` } });
}
function commit(transferId, seq, isHydration = false) {
  link.fire('__TransferCommit', {
    transferId,
    seq,
    kind: isHydration ? 'hydrate' : 'update',
    patchList: { patchList: [{ id: seq, snapshotPatch: [] }] },
    patchOptions: { reloadVersion: 0, isHydration },
  });
  return link.of('__TransferCommitResult').at(-1);
}

beforeAll(() => {
  globalEnvManager.resetEnv();
  elementTree.clear();
  vi.stubGlobal('lynx', {
    ...lynx,
    getCoreContext: () => link,
    getJSContext: () => link,
    getEngine: () => engine,
    getNative: () => native,
    reportError,
  });
});

afterAll(() => {
  native.fire('__DestroyLifetime', {});
  vi.unstubAllGlobals();
  globalEnvManager.resetEnv();
  elementTree.clear();
});

describe('transfer (main thread)', () => {
  it('creates components after the page renders and sends their first frames', () => {
    TransferRegistry.registerComponent('Bubble', () => Bubble);
    root.render(<Page />);
    expect(__root.__jsx).toBeUndefined();

    create('1');
    // Props sent before the page renders replace the queued initial props.
    native.fire('__SetTransferProps', { transferId: '1', props: { text: 'queued' } });
    expect(link.of('__TransferFirstFrame')).toHaveLength(0);
    expect(link.of('__SetTransferProps')).toHaveLength(0);

    engine.fire('__RenderPage', [{ text: 'init' }]);
    expect(lynx.__initData).toEqual({ text: 'init' });
    expect(elementTree.root.type).toBe('page');
    expect(elementTree.root.children).toHaveLength(1);
    const element = elementTree.root.children[0];
    expect(element.type).toBe('transfer-view');
    expect(element.props['transfer-id']).toBe('1');
    expect(element.children[0].type).toBe('view');

    expect(link.of('__CreateTransfer')).toMatchObject([{ transferId: '1', componentName: 'Bubble' }]);
    const [frame] = link.of('__TransferFirstFrame');
    expect(frame.transferId).toBe('1');
    expect(JSON.parse(frame.snapshot).type).toBe('root');
    expect(frame.snapshot).toContain('queued');
  });

  it('applies commits in sequence and reports the result', () => {
    expect(commit('1', 1, true)).toEqual({ transferId: '1', seq: 1, status: 'applied' });
    expect(commit('1', 2)).toEqual({ transferId: '1', seq: 2, status: 'applied' });
    expect(commit('1', 4)).toEqual({ transferId: '1', seq: 4, status: 'failed' });
    expect(reportError).toHaveBeenCalledWith(new Error('Transfer commit sequence mismatch'));
    expect(commit('404', 1)).toEqual({ transferId: '404', seq: 1, status: 'disposed' });
  });

  it('forwards props and disposes in both directions', () => {
    native.fire('__SetTransferProps', { transferId: '1', props: { text: 'x' } });
    expect(link.of('__SetTransferProps')).toEqual([{ transferId: '1', props: { text: 'x' } }]);

    const before = snapshotInstanceManager.values.size;
    create('2');
    expect(elementTree.root.children).toHaveLength(2);
    expect(snapshotInstanceManager.values.size).toBeGreaterThan(before);

    // Disposed by native: the background thread is told to tear down.
    native.fire('__DestroyTransfer', { transferId: '2' });
    expect(elementTree.root.children).toHaveLength(1);
    expect(snapshotInstanceManager.values.size).toBe(before);
    expect(link.of('__DestroyTransfer')).toEqual([{ transferId: '2' }]);

    // Disposed by the background thread: nothing is echoed back.
    link.fire('__TransferDisposed', { transferId: '1' });
    expect(elementTree.root.children).toHaveLength(0);
    expect(link.of('__DestroyTransfer')).toHaveLength(1);
    expect(commit('1', 3).status).toBe('disposed');
  });

  it('rolls back a creation whose first frame throws', () => {
    TransferRegistry.registerComponent('Broken', () => () => {
      throw new Error('broken');
    });
    native.fire('__CreateTransfer', { transferId: '3', componentName: 'Broken', initialProps: {} });
    expect(reportError).toHaveBeenCalledWith(new Error('broken'));
    expect(elementTree.root.children).toHaveLength(0);
    expect(link.of('__DestroyTransfer')).toEqual([{ transferId: '2' }, { transferId: '3' }]);
  });
});
