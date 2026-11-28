// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// Background side of the transfer protocol. The first `registerComponent` fixes
// the thread, so the main thread side lives in `transfer.mts.test.jsx`.
import { options, render } from 'preact';
import { useEffect, useLayoutEffect } from 'preact/hooks';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  resetBackgroundFunctionRuntime,
  runBackgroundFunction,
} from '../../../src/core/background-function/run-on-background';
import { runOnMainThread, root, useState } from '../../../src/index';
import { resetFunctionCallReturnListener } from '../../../src/core/thread-function-call/return-value';
import { TransferRegistry } from '../../../src/internal';
import { __root } from '../../../src/root';
import { injectTt } from '../../../src/snapshot/lynx/tt';
import {
  BackgroundSnapshotInstance,
  backgroundSnapshotInstanceManager,
} from '../../../src/snapshot/snapshot/backgroundSnapshot';
import { WorkletEvents } from '../../../src/worklet-runtime/bindings/events';
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
function firstFrame(rootId, nextId) {
  const roots = [...backgroundSnapshotInstanceManager.values.values()].filter(si => si.type === 'root');
  const toJSON = si => ({
    id: nextId === undefined ? si.__id : nextId--,
    type: si.type,
    values: si.__values,
    children: si.childNodes.length ? si.childNodes.map(toJSON) : undefined,
  });
  const transferRoot = rootId === undefined
    ? roots.reduce((a, b) => (a.__id > b.__id ? a : b))
    : roots.find(root => root.__id === rootId);
  return JSON.stringify(toJSON(transferRoot));
}
function commits(transferId) {
  return link.of('__TransferCommit').filter(packet => packet.transferId === transferId);
}
function ack(transferId, seq, status = 'applied', version = 0) {
  link.fire('__TransferCommitResult', { transferId, version, seq, status });
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
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    root.render(<Page />);
    expect(__root.childNodes).toHaveLength(1);

    const received = vi.fn();
    injectTt();
    lynx.getApp().publishEvent('-9001:0:', { type: 'load' });
    TransferRegistry.registerComponent('StartupEvent', () => () => <view bindload={received} />);
    TransferRegistry.registerComponent('Bubble', () => Bubble);
    expect(__root.__jsx).toBeUndefined();
    expect(__root.childNodes).toHaveLength(0);

    root.render(<Page />);
    expect(__root.__jsx).toBeUndefined();
    expect(__root.childNodes).toHaveLength(0);
    // Both the earlier and the later `root.render` are reported in development.
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('`root.render` is ignored on transfer pages'));
    warn.mockRestore();

    const transferId = 'startup-event';
    link.fire('__CreateTransfer', { transferId, componentName: 'StartupEvent', initialProps: {} });
    link.fire('__TransferFirstFrame', { transferId, snapshot: firstFrame(undefined, -9000) });
    expect(received).not.toHaveBeenCalled();
    ack(transferId, 1);
    expect(received).toHaveBeenCalledExactlyOnceWith({ type: 'load' });
    link.fire('__DestroyTransfer', { transferId });
  });

  it('replays early native events in order after the matching first frame is applied', () => {
    const received = vi.fn();
    function Card({ name }) {
      return <view bindload={event => received(name, event.label)} />;
    }
    TransferRegistry.registerComponent('EventCard', () => Card);

    function createCard(name, viewId) {
      link.fire('__CreateTransfer', { transferId: name, componentName: 'EventCard', initialProps: { name } });
      return firstFrame(undefined, viewId + 1);
    }
    const first = createCard('event-a', -10001);
    const second = createCard('event-b', -20001);
    const app = lynx.getApp();
    app.publishEvent('-10001:0:', { type: 'load', label: 'before hydration' });
    app.publishEvent('-20001:0:', { type: 'load', label: 'before hydration' });
    app.publicComponentEvent('', '-10001:0:', { type: 'load', label: 'component event' });

    link.fire('__TransferFirstFrame', { transferId: 'event-a', snapshot: first });
    link.fire('__TransferFirstFrame', { transferId: 'event-b', snapshot: second });
    app.publishEvent('-10001:0:', { type: 'load', label: 'failed dispatch' });
    app.publishEvent('-10001:0:', { type: 'load', label: 'before acknowledgement' });
    expect(received).not.toHaveBeenCalled();

    ack('event-b', 1);
    ack('event-b', 1);
    expect(received.mock.calls).toEqual([['event-b', 'before hydration']]);
    const error = new Error('Event dispatch failed');
    app.callBeforePublishEvent = ({ label }) => {
      if (label === 'failed dispatch') throw error;
    };
    ack('event-a', 1);
    delete app.callBeforePublishEvent;
    expect(reportError).toHaveBeenCalledWith(error);
    expect(received.mock.calls).toEqual([
      ['event-b', 'before hydration'],
      ['event-a', 'before hydration'],
      ['event-a', 'component event'],
      ['event-a', 'before acknowledgement'],
    ]);
    app.publishEvent('-10001:0:', { type: 'load', label: 'live' });
    expect(received).toHaveBeenLastCalledWith('event-a', 'live');

    link.fire('__DestroyTransfer', { transferId: 'event-a' });
    link.fire('__DestroyTransfer', { transferId: 'event-b' });
  });

  it('discards native events from a first frame replaced by reload or disposal', () => {
    const received = vi.fn();
    TransferRegistry.registerComponent('DiscardedEvents', () => () => <view bindload={received} />);
    const transferId = 'discard-events';
    const app = lynx.getApp();
    function firstFrameFor(viewId, rootId) {
      link.fire('__TransferFirstFrame', { transferId, snapshot: firstFrame(rootId, viewId + 1) });
    }

    link.fire('__CreateTransfer', { transferId, componentName: 'DiscardedEvents', initialProps: {} });
    firstFrameFor(-30001);
    app.publishEvent('-30001:0:', { type: 'load' });
    link.fire('__ReloadTransfer', { transferId, props: {} });
    ack(transferId, 1);
    app.publishEvent('-30001:0:', { type: 'load' });
    app.publishEvent('-40001:0:', { type: 'load' });
    firstFrameFor(-40001, -30000);
    ack(transferId, 1);
    expect(received).not.toHaveBeenCalled();
    ack(transferId, 1, 'applied', 1);
    expect(received).toHaveBeenCalledTimes(1);

    link.fire('__ReloadTransfer', { transferId, props: {} });
    firstFrameFor(-50001, -40000);
    app.publishEvent('-50001:0:', { type: 'load' });
    link.fire('__DestroyTransfer', { transferId });
    ack(transferId, 1, 'applied', 2);
    expect(received).toHaveBeenCalledTimes(1);
  });

  it('skips queued events when their node is removed or their transfer is disposed during replay', () => {
    const transferId = 'removed-event-target';
    const received = vi.fn(() => link.fire('__DestroyTransfer', { transferId }));
    TransferRegistry.registerComponent(
      'RemovableEvent',
      () => ({ visible }) => visible ? <view bindload={received} /> : null,
    );
    function firstFrameFor(rootId, viewId) {
      link.fire('__TransferFirstFrame', { transferId, snapshot: firstFrame(rootId, viewId + 1) });
    }
    link.fire('__CreateTransfer', {
      transferId,
      componentName: 'RemovableEvent',
      initialProps: { visible: true },
    });
    const app = lynx.getApp();
    firstFrameFor(undefined, -60001);
    app.publishEvent('-60001:0:', { type: 'load' });
    link.fire('__UpdateTransfer', { transferId, props: { visible: false } });
    ack(transferId, 1);
    expect(received).not.toHaveBeenCalled();

    link.fire('__ReloadTransfer', { transferId, props: { visible: true } });
    firstFrameFor(-60000, -70001);
    app.publishEvent('-70001:0:', { type: 'load', label: 'first' });
    app.publishEvent('-70001:0:', { type: 'load', label: 'second' });
    ack(transferId, 1, 'applied', 1);
    expect(received).toHaveBeenCalledExactlyOnceWith({ type: 'load', label: 'first' });
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

    // Like a template reload, a reload remounts the component and waits for a new first frame.
    link.fire('__ReloadTransfer', { transferId: '1', props: { text: 'b' } });
    ack('1', 2);
    expect(commits('1')).toHaveLength(2);
    const frame = firstFrame();
    expect(frame).toContain('b:0');
    link.fire('__TransferFirstFrame', { transferId: '1', snapshot: frame });
    expect(commits('1')[2]).toMatchObject({ version: 1, seq: 1, kind: 'hydrate' });
    ack('1', 1, 'applied', 1);

    // Events dispatch directly to the hydrated handlers.
    const viewId = JSON.parse(frame).children[0].id;
    lynx.getApp().publishEvent(`${viewId}:0:`, { type: 'tap' });
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
    link.fire('__ReloadTransfer', { transferId: '1', props: { text: 'd' } });
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

    // A reload releases the in-flight and queued commits; their results no longer match.
    link.fire('__ReloadTransfer', { transferId: '4', props: { text: 'f' } });
    ack('4', 1);
    link.fire('__TransferFirstFrame', { transferId: '4', snapshot: emptyFrame(-102) });
    expect(commits('4')).toMatchObject([{ version: 0, seq: 1 }, { version: 1, seq: 1, kind: 'hydrate' }]);
    setCount(2);
    await waitSchedule();
    expect(commits('4')).toHaveLength(2);

    // Disposal releases the in-flight and queued commits; later messages are ignored.
    link.fire('__DestroyTransfer', { transferId: '4' });
    link.fire('__DestroyTransfer', { transferId: '4' });
    ack('4', 1);
    link.fire('__TransferFirstFrame', { transferId: '4', snapshot: emptyFrame(-101) });
    link.fire('__CreateTransfer', { transferId: '4', componentName: 'Bubble', initialProps: {} });
    expect(commits('4')).toHaveLength(2);

    render(<Page />, new BackgroundSnapshotInstance('root'));
    expect(reportError).toHaveBeenCalledWith(new Error('Commit rendered outside a transfer instance'));
  });

  it('keeps pre-hydration render and effect worklets with their instance across reuse', async () => {
    const sdkVersion = SystemInfo.lynxSdkVersion;
    SystemInfo.lynxSdkVersion = '4.3';
    const completed = [];
    const callback = vi.fn();
    const staleCleanup = vi.fn();
    const initialize = { _wkltId: 'initialize', _jsFn: { callback: { _fn: callback, _jsFnId: 1 } } };
    const call = (label) => void runOnMainThread(initialize)(label).then(() => completed.push(label));
    const runCallback = execId =>
      runBackgroundFunction({ obj: { _execId: execId, _jsFnId: 1 }, params: [], resolveId: 0 });
    let updateA;
    let updateB;
    let flushEffects;
    const requestAnimationFrame = options.requestAnimationFrame;
    function Card({ name }) {
      const [count, setCount] = useState(0);
      if (name === 'a') updateA = setCount;
      if (name === 'b') updateB = setCount;
      call(`${name}:render:${count}`);
      useEffect(() => {
        if (name === 'a' && count === 1) {
          call('a:effect');
          return () => call('a:effect-cleanup');
        }
        if (name === 'a' && count === 2) {
          return () => {
            staleCleanup();
            call('a:stale-effect-cleanup');
          };
        }
      }, [count]);
      useLayoutEffect(() => {
        call(`${name}:layout`);
        if (name !== 'a') return;
        setCount(1);
        return () => call('a:cleanup');
      }, []);
      return <text>{`${name}:${count}`}</text>;
    }
    const calls = (id, index) => commits(id)[index].patchList.delayedRunOnMainThreadData;
    const worklets = (id, index) => calls(id, index).map(({ params }) => params[0]);
    const returnFrom = (id, index) => {
      for (const { resolveId } of calls(id, index)) {
        link.fire(WorkletEvents.FunctionCallRet, { resolveId });
      }
    };
    TransferRegistry.registerComponent('Worklets', () => Card);
    try {
      options.requestAnimationFrame = flush => {
        flushEffects = flush;
      };
      const listenersBeforeFirstFrame = link.count();
      link.fire('__CreateTransfer', { transferId: 'work-a', componentName: 'Worklets', initialProps: { name: 'a' } });
      await waitSchedule();
      const frameA = firstFrame();
      link.fire('__CreateTransfer', { transferId: 'work-b', componentName: 'Worklets', initialProps: { name: 'b' } });
      await waitSchedule();
      expect(commits('work-a')).toHaveLength(0);
      expect(commits('work-b')).toHaveLength(0);
      expect(link.count()).toBe(listenersBeforeFirstFrame);
      link.fire('__TransferFirstFrame', { transferId: 'work-b', snapshot: firstFrame() });
      expect(worklets('work-b', 0)).toEqual(['b:render:0', 'b:layout']);
      ack('work-b', 1);
      updateB(1);
      await waitSchedule();
      expect(worklets('work-b', 1)).toEqual(['b:render:1']);
      returnFrom('work-b', 1);
      ack('work-b', 2);
      flushEffects();
      expect(link.of(WorkletEvents.runWorkletCtx)).not.toContainEqual(
        expect.objectContaining({ params: ['a:effect'] }),
      );
      updateA(2);
      await waitSchedule();
      flushEffects();
      expect(link.of(WorkletEvents.runWorkletCtx)).not.toContainEqual(
        expect.objectContaining({ params: ['a:effect-cleanup'] }),
      );
      link.fire('__TransferFirstFrame', { transferId: 'work-a', snapshot: frameA });
      expect(worklets('work-a', 0)).toEqual([
        'a:render:0',
        'a:layout',
        'a:render:1',
        'a:effect',
        'a:render:2',
        'a:effect-cleanup',
      ]);
      expect(new Set(calls('work-a', 0).map(({ worklet }) => worklet._execId)).size).toBe(6);
      const lastExecId = calls('work-a', 0).at(-1).worklet._execId;
      ack('work-a', 1);
      link.fire('__ReloadTransfer', { transferId: 'work-a', props: { name: 'reused' } });
      runCallback(calls('work-a', 0)[0].worklet._execId);
      expect(callback).toHaveBeenCalledOnce();
      await waitSchedule();
      flushEffects();
      expect(staleCleanup).toHaveBeenCalledOnce();
      expect(link.of(WorkletEvents.runWorkletCtx)).not.toContainEqual(
        expect.objectContaining({ params: ['a:stale-effect-cleanup'] }),
      );
      const replacementFrame = firstFrame(JSON.parse(frameA).id);
      expect(replacementFrame).toContain('reused:0');
      link.fire('__TransferFirstFrame', { transferId: 'work-a', snapshot: replacementFrame });
      expect(commits('work-a')[1]).toMatchObject({ version: 1, seq: 1, kind: 'hydrate' });
      expect(worklets('work-a', 1)).toEqual(['reused:render:0', 'reused:layout']);
      expect(calls('work-a', 1)[0].worklet._execId).toBe(lastExecId + 1);
      returnFrom('work-a', 0);
      returnFrom('work-b', 0);
      await waitSchedule();
      expect(completed).toEqual(['b:render:1', 'b:render:0', 'b:layout']);
      link.fire(WorkletEvents.FunctionCallRet, { resolveId: calls('work-a', 1)[0].resolveId });
      ack('work-a', 1, 'failed', 1);
      returnFrom('work-a', 1);
      await waitSchedule();
      expect(completed).toEqual(['b:render:1', 'b:render:0', 'b:layout', 'reused:render:0']);

      const lastSentExecId = calls('work-a', 1).at(-1).worklet._execId;
      link.fire('__CreateTransfer', { transferId: 'work-c', componentName: 'Worklets', initialProps: { name: 'c' } });
      link.fire('__DestroyTransfer', { transferId: 'work-c' });
      expect(commits('work-c')).toHaveLength(0);

      call('outside-render');
      expect(link.of(WorkletEvents.runWorkletCtx).at(-1)).toMatchObject({
        params: ['outside-render'],
        worklet: { _execId: lastSentExecId + 1 },
      });
    } finally {
      link.fire('__DestroyTransfer', { transferId: 'work-a' });
      link.fire('__DestroyTransfer', { transferId: 'work-b' });
      flushEffects?.();
      options.requestAnimationFrame = requestAnimationFrame;
      resetFunctionCallReturnListener();
      resetBackgroundFunctionRuntime();
      SystemInfo.lynxSdkVersion = sdkVersion;
    }
  });

  it('updates props in place and keeps state, while a reload resets it', async () => {
    let mounts = 0;
    let setN;
    function Streamed(props) {
      const [mounted, setMounted] = useState(false);
      const [n, setNState] = useState(0);
      setN = setNState;
      useEffect(() => {
        mounts++;
        setMounted(true);
      }, []);
      return mounted ? <text>{`${props.text}:${n}`}</text> : null;
    }
    TransferRegistry.registerComponent('Streamed', () => Streamed);
    link.fire('__CreateTransfer', { transferId: 's', componentName: 'Streamed', initialProps: { text: 'a' } });
    link.fire('__TransferFirstFrame', { transferId: 's', snapshot: firstFrame() });
    ack('s', 1);
    await waitSchedule();
    expect(mounts).toBe(1);
    expect(JSON.stringify(commits('s')[1].patchList)).toContain('a:0');
    ack('s', 2);

    // An update re-renders the mounted component with new props and keeps its state.
    link.fire('__UpdateTransfer', { transferId: 's', props: { text: 'b' } });
    expect(commits('s')[2]).toMatchObject({ version: 0, seq: 3, kind: 'update' });
    expect(JSON.stringify(commits('s')[2].patchList)).toContain('b:0');
    ack('s', 3);
    // Later commits still belong to the instance.
    const errors = reportError.mock.calls.length;
    setN(1);
    await waitSchedule();
    expect(reportError.mock.calls.length).toBe(errors);
    expect(JSON.stringify(commits('s')[3].patchList)).toContain('b:1');
    ack('s', 4);
    expect(mounts).toBe(1);

    // A reload remounts it and resets its state; updates before the new first frame are kept.
    link.fire('__ReloadTransfer', { transferId: 's', props: { text: 'c' } });
    link.fire('__UpdateTransfer', { transferId: 's', props: { text: 'd' } });
    expect(commits('s')).toHaveLength(4);
    link.fire('__TransferFirstFrame', { transferId: 's', snapshot: firstFrame() });
    expect(commits('s')[4]).toMatchObject({ version: 1, seq: 1, kind: 'hydrate' });
    ack('s', 1, 'applied', 1);
    await waitSchedule();
    expect(mounts).toBe(2);
    setN(5);
    await waitSchedule();
    expect(JSON.stringify(commits('s').at(-1).patchList)).toContain('d:5');
    link.fire('__DestroyTransfer', { transferId: 's' });

    // Updates for destroyed or unknown instances render nothing.
    const sent = commits('s').length;
    link.fire('__UpdateTransfer', { transferId: 's', props: { text: 'e' } });
    link.fire('__UpdateTransfer', { transferId: 'missing', props: {} });
    await waitSchedule();
    expect(commits('s')).toHaveLength(sent);
    expect(mounts).toBe(2);
  });

  it('removes its listeners when the lifetime is destroyed', () => {
    native.fire('__DestroyLifetime', {});
    expect(link.count()).toBe(0);
    expect(native.count()).toBe(0);
  });
});
