// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// Background side of the transfer protocol. The first `registerComponent` fixes
// the thread, so the main thread side lives in `transfer.mts.test.jsx`.
import { render } from 'preact';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { root, useState } from '../../../src/index';
import { TransferRegistry } from '../../../src/internal';
import { __root } from '../../../src/root';
import {
  BackgroundSnapshotInstance,
  backgroundSnapshotInstanceManager,
} from '../../../src/snapshot/snapshot/backgroundSnapshot';
import { globalEnvManager } from '../utils/envManager';
import { waitSchedule } from '../utils/nativeMethod';

function makeBus() {
  const listeners = {};
  const sent = [];
  return {
    sent,
    of: type => sent.filter(event => event.type === type).map(event => event.data),
    count: () => Object.values(listeners).flat().length,
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
      listeners[type]?.forEach(listener => listener({ data: JSON.stringify(data) }));
    },
  };
}

const link = makeBus();
const native = makeBus();
const reportError = vi.fn();

let setCount;
let taps = 0;
function Bubble(props) {
  const [count, setCountState] = useState(0);
  setCount = setCountState;
  return (
    <view bindtap={() => taps++}>
      <text>{`${props.text}:${count}`}</text>
    </view>
  );
}
function Page() {
  return <view />;
}

/** Serializes the newest transfer root the way the main thread first frame would. */
function firstFrame() {
  const roots = [...backgroundSnapshotInstanceManager.values.values()].filter(si => si.type === 'root');
  const toJSON = si => ({
    id: si.__id,
    type: si.type,
    values: si.__values,
    children: si.childNodes.length ? si.childNodes.map(toJSON) : undefined,
  });
  return JSON.stringify(toJSON(roots.reduce((a, b) => (a.__id > b.__id ? a : b))));
}
function commits(transferId) {
  return link.of('__TransferCommit').filter(packet => packet.transferId === transferId);
}
function ack(transferId, seq, status = 'applied') {
  link.fire('__TransferCommitResult', { transferId, seq, status });
}

beforeAll(() => {
  globalEnvManager.resetEnv();
  globalEnvManager.switchToBackground();
  vi.stubGlobal('lynx', {
    ...lynx,
    getCoreContext: () => link,
    getJSContext: () => link,
    getNative: () => native,
    reportError,
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
  globalEnvManager.resetEnv();
});

describe('transfer (background thread)', () => {
  it('keeps the page root empty once a component is registered', () => {
    root.render(<Page />);
    expect(__root.childNodes).toHaveLength(1);

    TransferRegistry.registerComponent('Bubble', () => Bubble);
    expect(__root.__jsx).toBeUndefined();
    expect(__root.childNodes).toHaveLength(0);

    root.render(<Page />);
    expect(__root.__jsx).toBeUndefined();
    expect(__root.childNodes).toHaveLength(0);
  });

  it('hydrates a created component and sends one commit at a time', async () => {
    link.fire('__CreateTransfer', { transferId: '1', componentName: 'Bubble', initialProps: { text: 'a' } });
    expect(commits('1')).toHaveLength(0);

    link.fire('__TransferFirstFrame', { transferId: '1', snapshot: firstFrame() });
    expect(commits('1')).toMatchObject([{ seq: 1, kind: 'hydrate', patchOptions: { isHydration: true } }]);

    setCount(1);
    await waitSchedule();
    // Queued until the hydration commit is applied.
    expect(commits('1')).toHaveLength(1);
    ack('1', 1);
    expect(commits('1')[1]).toMatchObject({ seq: 2, kind: 'update' });
    expect(JSON.stringify(commits('1')[1].patchList)).toContain('a:1');

    link.fire('__SetTransferProps', { transferId: '1', props: { text: 'b' } });
    expect(commits('1')).toHaveLength(2);
    ack('1', 2);
    expect(commits('1')[2]).toMatchObject({ seq: 3, kind: 'update' });
    expect(JSON.stringify(commits('1')[2].patchList)).toContain('b:1');
    ack('1', 3);

    // Events dispatch directly to the hydrated handlers.
    const view = [...backgroundSnapshotInstanceManager.values.values()].find(si =>
      typeof si.__values?.[0] === 'function'
    );
    lynx.getApp().publishEvent(`${view.__id}:0:`, { type: 'tap' });
    expect(taps).toBe(1);
  });

  it('drops commits before hydration and disposes in both directions', async () => {
    link.fire('__CreateTransfer', { transferId: '2', componentName: 'Bubble', initialProps: { text: 'c' } });
    setCount(5);
    await waitSchedule();
    expect(commits('2')).toHaveLength(0);

    link.fire('__TransferFirstFrame', { transferId: '2', snapshot: firstFrame() });
    expect(commits('2')).toMatchObject([{ seq: 1, kind: 'hydrate' }]);
    ack('2', 1, 'failed');
    expect(link.of('__TransferDisposed')).toEqual([{ transferId: '2' }]);

    // Disposed by the main thread: torn down without echoing back.
    link.fire('__DestroyTransfer', { transferId: '1' });
    expect(link.of('__TransferDisposed')).toHaveLength(1);
    link.fire('__SetTransferProps', { transferId: '1', props: { text: 'd' } });
    expect(commits('1')).toHaveLength(3);

    link.fire('__CreateTransfer', { transferId: '3', componentName: 'Missing', initialProps: {} });
    expect(reportError).toHaveBeenCalledWith(new Error('Unknown transfer component: Missing'));
  });

  it('ignores early, duplicate and stale messages', async () => {
    // An empty first frame hydrates by inserting the rendered children.
    const emptyFrame = id => JSON.stringify({ id, type: 'root' });
    link.fire('__TransferFirstFrame', { transferId: '4', snapshot: emptyFrame(-100) });
    expect(commits('4')).toHaveLength(0);
    link.fire('__CreateTransfer', { transferId: '4', componentName: 'Bubble', initialProps: { text: 'e' } });
    expect(commits('4')).toMatchObject([{ seq: 1, kind: 'hydrate' }]);

    link.fire('__TransferFirstFrame', { transferId: '4', snapshot: emptyFrame(-100) });
    link.fire('__CreateTransfer', { transferId: '4', componentName: 'Bubble', initialProps: {} });
    ack('4', 7);
    ack('404', 1);
    setCount(1);
    await waitSchedule();
    expect(commits('4')).toHaveLength(1);

    // Disposal releases the in-flight and queued commits; later messages are ignored.
    link.fire('__DestroyTransfer', { transferId: '4' });
    link.fire('__DestroyTransfer', { transferId: '4' });
    ack('4', 1);
    link.fire('__TransferFirstFrame', { transferId: '4', snapshot: emptyFrame(-101) });
    link.fire('__CreateTransfer', { transferId: '4', componentName: 'Bubble', initialProps: {} });
    expect(commits('4')).toHaveLength(1);

    render(<Page />, new BackgroundSnapshotInstance('root'));
    expect(reportError).toHaveBeenCalledWith(new Error('Commit rendered outside a transfer instance'));
  });

  it('removes its listeners when the lifetime is destroyed', () => {
    native.fire('__DestroyLifetime', {});
    expect(link.count()).toBe(0);
    expect(native.count()).toBe(0);
  });
});
