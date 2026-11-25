// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// Main thread side of the transfer protocol. The first `registerComponent` fixes
// the thread, so the background side lives in `transfer.test.jsx`.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { runOnBackground } from '../../../src/core/background-function/run-on-background';
import { resetFunctionCallReturnListener } from '../../../src/core/thread-function-call/return-value';
import { root } from '../../../src/index';
import { TransferRegistry } from '../../../src/internal';
import { __root } from '../../../src/root';
import { snapshotInstanceManager } from '../../../src/snapshot/snapshot/snapshotInstanceManager';
import { WorkletEvents } from '../../../src/worklet-runtime/bindings/events';
import { hydrateJsFnHandles, initRunOnBackgroundDelay } from '../../../src/worklet-runtime/run-on-background/index';
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
function commit(transferId, seq, isHydration = false, version = 0) {
  link.fire('__TransferCommit', {
    transferId,
    version,
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
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    root.render(<Page />);
    expect(__root.__jsx).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('`root.render` is ignored on transfer pages'));
    warn.mockRestore();

    create('1');
    native.fire('__CreateTransfer', { transferId: 'missing', componentName: 'Missing', initialProps: {} });
    // Props sent before the page renders replace the queued initial props.
    native.fire('__UpdateTransfer', { transferId: '1', props: { text: 'early' } });
    native.fire('__ReloadTransfer', { transferId: '1', props: { text: 'queued' } });
    expect(link.of('__TransferFirstFrame')).toHaveLength(0);
    expect(link.of('__UpdateTransfer')).toHaveLength(0);
    expect(link.of('__ReloadTransfer')).toHaveLength(0);

    engine.fire('__RenderPage', [{ text: 'init' }]);
    expect(lynx.__initData).toEqual({ text: 'init' });
    expect(reportError).toHaveBeenCalledWith(new Error('Unknown transfer component: Missing'));
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
    expect(commit('1', 1, true)).toEqual({ transferId: '1', version: 0, seq: 1, status: 'applied' });
    expect(commit('1', 2)).toEqual({ transferId: '1', version: 0, seq: 2, status: 'applied' });
    expect(commit('1', 4)).toEqual({ transferId: '1', version: 0, seq: 4, status: 'failed' });
    expect(reportError).toHaveBeenCalledWith(new Error('Transfer commit sequence mismatch'));
    expect(commit('404', 1)).toEqual({ transferId: '404', version: 0, seq: 1, status: 'disposed' });
  });

  it('re-renders and re-syncs the first frame when props reload', () => {
    const view = elementTree.root.children[0].children[0];
    const size = snapshotInstanceManager.values.size;
    native.fire('__ReloadTransfer', { transferId: '1', props: { text: 'x' } });
    expect(link.of('__ReloadTransfer')).toEqual([{ transferId: '1', props: { text: 'x' } }]);

    // Like a template reload, the new frame reuses the elements of the previous one.
    expect(elementTree.root.children[0].children[0]).toBe(view);
    expect(view.children[0].children[0].props.text).toBe('x');
    expect(snapshotInstanceManager.values.size).toBe(size);
    const frames = link.of('__TransferFirstFrame');
    expect(frames).toHaveLength(2);
    expect(frames[1].snapshot).toContain('"x"');

    // Commits rendered against the replaced frame are dropped; the new version restarts at seq 1.
    const results = link.of('__TransferCommitResult').length;
    commit('1', 3);
    expect(link.of('__TransferCommitResult')).toHaveLength(results);
    expect(commit('1', 1, true, 1)).toEqual({ transferId: '1', version: 1, seq: 1, status: 'applied' });
  });

  it('disposes in both directions', () => {
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

    // A props update whose frame throws rolls back the same way.
    TransferRegistry.registerComponent('Flaky', () => props => {
      if (props.fail) throw new Error('flaky');
      return <view />;
    });
    const size = snapshotInstanceManager.values.size;
    native.fire('__CreateTransfer', { transferId: '4', componentName: 'Flaky', initialProps: {} });
    native.fire('__ReloadTransfer', { transferId: '4', props: { fail: true } });
    expect(reportError).toHaveBeenCalledWith(new Error('flaky'));
    expect(elementTree.root.children).toHaveLength(0);
    expect(snapshotInstanceManager.values.size).toBe(size);
    expect(link.of('__DestroyTransfer').at(-1)).toEqual({ transferId: '4' });

    // A page rendered without data gets empty init data.
    engine.fire('__RenderPage', []);
    expect(lynx.__initData).toEqual({});
  });

  it('runs first-screen runOnBackground calls after their own transfer hydrates', () => {
    const previousImpl = globalThis.lynxWorkletImpl;
    const previousSdkVersion = SystemInfo.lynxSdkVersion;
    SystemInfo.lynxSdkVersion = '4.0';
    // Only the parts of the worklet runtime that `onHydrationFinished` touches.
    globalThis.lynxWorkletImpl = {
      _runOnBackgroundDelayImpl: initRunOnBackgroundDelay(),
      _refImpl: { clearFirstScreenWorkletRefMap() {} },
      _eventDelayImpl: { clearDelayedWorklets() {} },
    };
    const firstScreenHandle = () => Object.assign(() => {}, { _isFirstScreen: true });
    // What the hydrate patch of an instance binds onto its first-screen handles.
    const bind = (handle, jsFnId, execId) =>
      hydrateJsFnHandles({ _jsFn: { _jsFnId: jsFnId } }, { _jsFn: handle }, execId);
    const sent = () => link.of(WorkletEvents.runOnBackground).map(({ obj }) => obj);
    try {
      create('rb-a');
      create('rb-b');
      const handleA = firstScreenHandle();
      const handleB = firstScreenHandle();
      const lateHandleB = firstScreenHandle();

      // Both instances call from their first frames before any hydration.
      void runOnBackground(handleA)();
      void runOnBackground(handleB)();

      // `rb-a` hydrates first.
      bind(handleA, 1, 101);
      expect(commit('rb-a', 1, true).status).toBe('applied');
      expect(sent()).toEqual([{ _jsFnId: 1, _execId: 101 }]);

      // `rb-b` is still waiting and calls again from its first frame.
      void runOnBackground(lateHandleB)();

      // `rb-b` hydrates: both of its calls should reach the background now.
      bind(handleB, 2, 202);
      bind(lateHandleB, 3, 202);
      expect(commit('rb-b', 1, true).status).toBe('applied');
      expect(sent()).toEqual([
        { _jsFnId: 1, _execId: 101 },
        { _jsFnId: 2, _execId: 202 },
        { _jsFnId: 3, _execId: 202 },
      ]);
    } finally {
      native.fire('__DestroyTransfer', { transferId: 'rb-a' });
      native.fire('__DestroyTransfer', { transferId: 'rb-b' });
      resetFunctionCallReturnListener();
      globalThis.lynxWorkletImpl = previousImpl;
      SystemInfo.lynxSdkVersion = previousSdkVersion;
    }
  });

  it('keeps its elements on an update and re-renders them on a reload', () => {
    const element = () => elementTree.root.children.find(child => child.props['transfer-id'] === 'u');
    const text = () => element().children[0].children[0].children[0].props.text;
    native.fire('__CreateTransfer', { transferId: 'u', componentName: 'Bubble', initialProps: { text: 'a' } });
    const frames = link.of('__TransferFirstFrame').length;
    const view = element().children[0];
    expect(commit('u', 1, true).status).toBe('applied');

    // The background renders updates; the main thread only forwards them.
    native.fire('__UpdateTransfer', { transferId: 'u', props: { text: 'b' } });
    expect(link.of('__UpdateTransfer')).toEqual([{ transferId: 'u', props: { text: 'b' } }]);
    expect(link.of('__TransferFirstFrame')).toHaveLength(frames);
    expect(text()).toBe('a');
    expect(commit('u', 2)).toEqual({ transferId: 'u', version: 0, seq: 2, status: 'applied' });

    // A reload renders the latest props into the same elements and re-syncs the first frame.
    const reloads = link.of('__ReloadTransfer').length;
    native.fire('__ReloadTransfer', { transferId: 'u', props: { text: 'c' } });
    expect(link.of('__ReloadTransfer').at(-1)).toEqual({ transferId: 'u', props: { text: 'c' } });
    expect(link.of('__TransferFirstFrame')).toHaveLength(frames + 1);
    expect(element().children[0]).toBe(view);
    expect(text()).toBe('c');
    expect(commit('u', 1, true, 1).status).toBe('applied');
    native.fire('__DestroyTransfer', { transferId: 'u' });

    // Updates and reloads for unknown or destroyed instances are ignored.
    native.fire('__UpdateTransfer', { transferId: 'u', props: { text: 'd' } });
    native.fire('__UpdateTransfer', { transferId: 'missing', props: {} });
    native.fire('__ReloadTransfer', { transferId: 'u', props: { text: 'e' } });
    native.fire('__ReloadTransfer', { transferId: 'missing', props: {} });
    expect(link.of('__UpdateTransfer')).toHaveLength(1);
    expect(link.of('__ReloadTransfer')).toHaveLength(reloads + 1);
  });
});
