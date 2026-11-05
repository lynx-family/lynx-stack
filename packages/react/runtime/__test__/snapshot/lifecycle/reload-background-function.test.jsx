// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { render } from 'preact';
import { useLayoutEffect } from 'preact/hooks';
import { expect, it, vi } from 'vitest';

import { createBackgroundFunctionHandle } from '../../../src/core/background-function/handle.js';
import {
  resetBackgroundFunctionRuntime,
  runOnBackground,
} from '../../../src/core/background-function/run-on-background.js';
import { resetFunctionCallReturnListener } from '../../../src/core/thread-function-call/return-value.js';
import { root } from '../../../src/lynx-api.js';
import { __root } from '../../../src/root.js';
import { setupPage } from '../../../src/snapshot/snapshot/definition.js';
import { destroyBackground } from '../../../src/snapshot/lifecycle/destroy.js';
import { globalCommitTaskMap, replaceCommitHook } from '../../../src/snapshot/lifecycle/patch/commit.js';
import { onPostWorkletCtx } from '../../../src/snapshot/worklet/ctx.js';
import { clearConfigCacheForTesting } from '../../../src/snapshot/worklet/functionality.js';
import { registerWorklet } from '../../../src/worklet-runtime/bindings/index.js';
import { WorkletEvents } from '../../../src/worklet-runtime/bindings/events.js';
import { initWorklet } from '../../../src/worklet-runtime/workletRuntime.js';
import { globalEnvManager } from '../utils/envManager.js';
import { elementTree } from '../utils/nativeMethod.js';

it('retires old and unmount background functions across ordinary reload and hydrates working replacements', async () => {
  const oldCall = vi.fn(() => 'old-page');
  const cleanupCall = vi.fn(() => 'unmounted-page');
  const newCall = vi.fn(() => 'new-page');
  const oldResult = vi.fn();
  const oldRequestResult = vi.fn();
  const newResult = vi.fn(value => value);
  let generation = 0;
  let cleanupCtx;
  const cleanup = vi.fn(() => {
    cleanupCtx = onPostWorkletCtx({
      _wkltId: 'cleanup',
      _jsFn: { callback: createBackgroundFunctionHandle(cleanupCall) },
    });
  });
  function App() {
    useLayoutEffect(() => cleanup, []);
    const ctx = {
      _wkltId: 'call-background',
      _jsFn: {
        callback: __MAIN_THREAD__
          ? { _isFirstScreen: true }
          : createBackgroundFunctionHandle(generation === 0 ? oldCall : newCall),
      },
    };
    return <view main-thread:bindtap={ctx} />;
  }

  function hydratePage() {
    globalEnvManager.switchToBackground();
    lynx.getNativeApp().callLepusMethod.mockClear();
    lynx.getApp().OnLifecycleEvent(...__OnLifecycleEvent.mock.lastCall);
    const [method, patch, complete] = lynx.getNativeApp().callLepusMethod.mock.lastCall;
    expect(patch.patchOptions.isHydration).toBe(true);
    globalEnvManager.switchToMainThread();
    globalThis[method](patch);
    globalEnvManager.switchToBackground();
    complete();
    globalEnvManager.switchToMainThread();
    return __root.__element_root.children[0].props.event['bindEvent:tap'].value;
  }

  const workletGlobals = {
    lynxWorkletImpl: globalThis.lynxWorkletImpl,
    runWorklet: globalThis.runWorklet,
    registerWorklet: globalThis.registerWorklet,
    registerWorkletInternal: globalThis.registerWorkletInternal,
  };
  const sdkVersion = SystemInfo.lynxSdkVersion;
  globalEnvManager.resetEnv();
  SystemInfo.lynxSdkVersion = '4.0';
  clearConfigCacheForTesting();
  try {
    replaceCommitHook();
    initWorklet();
    registerWorklet('main-thread', 'call-background', function(value) {
      return runOnBackground(this._jsFn.callback)(value);
    });
    setupPage(__CreatePage('0', 0));
    __root.__jsx = <App />;
    renderPage({});
    globalEnvManager.switchToBackground();
    root.render(<App />);
    const oldCtx = hydratePage();
    const context = lynx.getCoreContext();
    const jsContext = lynx.getJSContext();
    // Hold a real old return and request at the transport boundary. Replay the
    // original envelopes after reload; do not manufacture their version/IDs.
    context.dispatchEvent.mockImplementationOnce(() => {});
    void runWorklet(oldCtx, ['before']).then(oldResult);
    const oldReturn = context.dispatchEvent.mock.lastCall[0];
    expect(oldReturn.type).toBe(WorkletEvents.FunctionCallRet);
    expect(oldCall).toHaveBeenCalledExactlyOnceWith('before');
    jsContext.dispatchEvent.mockImplementationOnce(() => {});
    void runWorklet(oldCtx, ['delayed-request']).then(oldRequestResult);
    const oldRequest = jsContext.dispatchEvent.mock.lastCall[0];
    expect(oldRequest.type).toBe(WorkletEvents.runOnBackground);

    globalEnvManager.switchToBackground();
    const oldListeners = context.addEventListener.mock.calls.filter(([type]) =>
      type === WorkletEvents.runOnBackground || type === WorkletEvents.releaseBackgroundWorkletCtx
    );
    expect(oldListeners).toHaveLength(2);
    context.removeEventListener.mockClear();
    generation = 1;
    lynx.getApp().onAppReload({});
    expect(cleanup).toHaveBeenCalledOnce();
    // The test harness shares resolver state across threads: finish MTS reload
    // before dispatching new calls, then apply the actual hydration patch.
    globalEnvManager.switchToMainThread();
    updatePage({}, { reloadTemplate: true });
    const newCtx = hydratePage();
    context.dispatchEvent.mockImplementationOnce(() => {});
    const result = runWorklet(newCtx, ['after']).then(newResult);
    const newReturn = context.dispatchEvent.mock.lastCall[0];
    expect(JSON.parse(newReturn.data).resolveId).toBe(JSON.parse(oldReturn.data).resolveId);
    expect(newCall).toHaveBeenCalledExactlyOnceWith('after');
    jsContext.dispatchEvent(oldRequest);
    globalEnvManager.switchToBackground();
    context.dispatchEvent(oldReturn);
    await Promise.resolve();
    expect(newResult).not.toHaveBeenCalled();
    expect(oldResult).not.toHaveBeenCalled();
    expect(oldRequestResult).not.toHaveBeenCalled();
    context.dispatchEvent(newReturn);
    await expect(result).resolves.toBe('new-page');

    globalEnvManager.switchToMainThread();
    await expect(runWorklet(oldCtx, ['retired'])).rejects.toThrow('runOnBackground: JS function not found');
    // A thrown native listener leaves this harness on the receiving thread.
    globalEnvManager.switchToMainThread();
    await expect(
      runOnBackground({
        _jsFnId: cleanupCtx._jsFn.callback._jsFnId,
        _execId: cleanupCtx._execId,
      })(),
    ).rejects.toThrow('runOnBackground: JS function not found');
    expect.soft(oldCall).toHaveBeenCalledOnce();
    expect.soft(cleanupCall).not.toHaveBeenCalled();
    for (const [type, listener] of oldListeners) {
      expect.soft(context.removeEventListener).toHaveBeenCalledWith(type, listener);
    }
    globalEnvManager.switchToMainThread();
    // Releasing retired contexts must not remove a replacement page's context.
    lynx.getJSContext().dispatchEvent({
      type: WorkletEvents.releaseBackgroundWorkletCtx,
      data: [oldCtx._execId, cleanupCtx._execId],
    });
    await expect(runWorklet(newCtx, ['after-release'])).resolves.toBe('new-page');
    expect(newCall).toHaveBeenCalledTimes(2);
  } finally {
    cleanup.mockImplementation(() => {});
    globalEnvManager.switchToBackground();
    destroyBackground();
    resetBackgroundFunctionRuntime();
    resetFunctionCallReturnListener();
    globalCommitTaskMap.clear();
    globalEnvManager.resetEnv();
    elementTree.clear();
    Object.assign(globalThis, workletGlobals);
    SystemInfo.lynxSdkVersion = sdkVersion;
    clearConfigCacheForTesting();
    vi.restoreAllMocks();
  }
});

it('rebinds and retains module-scope main-thread callbacks across ordinary reload', async () => {
  let generation = 0;
  const received = [];
  const moduleMtsRef = {
    _wkltId: 'module-scope-ref',
    _jsFn: {
      onQueued: { _isFirstScreen: true },
      onPost: { _isFirstScreen: true },
    },
  };

  function App({ step = 0 }) {
    const epochTag = `epoch-${generation}`;
    const refValue = __MAIN_THREAD__
      ? moduleMtsRef
      : {
        _wkltId: 'module-scope-ref',
        _jsFn: {
          onQueued: createBackgroundFunctionHandle((label) => {
            received.push(`${epochTag}:queued:${label}`);
            return `${epochTag}:${label}`;
          }),
          onPost: createBackgroundFunctionHandle((label) => {
            received.push(`${epochTag}:post:${label}`);
            return `${epochTag}:${label}`;
          }),
        },
      };
    return (
      <view main-thread:ref={refValue}>
        <text>{`${step}`}</text>
      </view>
    );
  }

  function flushPatch(expectHydration) {
    globalEnvManager.switchToBackground();
    const [method, patch, complete] = lynx.getNativeApp().callLepusMethod.mock.lastCall;
    expect(Boolean(patch.patchOptions.isHydration)).toBe(expectHydration);
    globalEnvManager.switchToMainThread();
    globalThis[method](patch);
    globalEnvManager.switchToBackground();
    complete?.();
    globalEnvManager.switchToMainThread();
  }

  function hydratePage() {
    globalEnvManager.switchToBackground();
    lynx.getNativeApp().callLepusMethod.mockClear();
    lynx.getApp().OnLifecycleEvent(...__OnLifecycleEvent.mock.lastCall);
    flushPatch(true);
    return Array.from(__root.__element_root.children[0].__worklet_ref_set ?? [])[0];
  }

  const workletGlobals = {
    lynxWorkletImpl: globalThis.lynxWorkletImpl,
    runWorklet: globalThis.runWorklet,
    registerWorklet: globalThis.registerWorklet,
    registerWorkletInternal: globalThis.registerWorkletInternal,
  };
  const sdkVersion = SystemInfo.lynxSdkVersion;
  globalEnvManager.resetEnv();
  SystemInfo.lynxSdkVersion = '4.0';
  clearConfigCacheForTesting();
  try {
    replaceCommitHook();
    initWorklet();
    const queuedPromises = [];
    let triggerPost;
    let lastHydratedEpochSeen = -1;
    registerWorklet('main-thread', 'module-scope-ref', function(element) {
      if (!element) return;
      const currentEpoch = globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.epoch;
      if (lastHydratedEpochSeen === currentEpoch) return;
      lastHydratedEpochSeen = currentEpoch;
      const { onQueued, onPost } = this._jsFn;
      queuedPromises.push(runOnBackground(onQueued)(`mount-${currentEpoch}`));
      triggerPost = (label) => runOnBackground(onPost)(label);
    });

    // Epoch 0: initial mount + hydration + post-hydration call
    setupPage(__CreatePage('0', 0));
    __root.__jsx = <App />;
    renderPage({});
    globalEnvManager.switchToBackground();
    root.render(<App />);
    hydratePage();
    await expect(queuedPromises[0]).resolves.toBe('epoch-0:mount-0');
    await expect(triggerPost('live-0')).resolves.toBe('epoch-0:live-0');

    // Epoch 1: ordinary reload (no re-eval; moduleMtsRef is reused across epochs)
    generation = 1;
    globalEnvManager.switchToBackground();
    lynx.getApp().onAppReload({});
    globalEnvManager.switchToMainThread();
    // Synchronous ref execution during reloadMainThread must queue (Mode A) rather than dispatch dead Epoch 0 execId
    updatePage({}, { reloadTemplate: true });
    expect(queuedPromises).toHaveLength(2);
    expect(globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.delayedBackgroundFunctionArray).toHaveLength(1);

    hydratePage();
    const epoch1ExecId = moduleMtsRef._jsFn.onPost._execId;
    await expect(queuedPromises[1]).resolves.toBe('epoch-1:mount-1');

    // Epoch 1 rerender + retired hydrated-slot collection (Mode B across ordinary reload)
    globalEnvManager.switchToBackground();
    lynx.getNativeApp().callLepusMethod.mockClear();
    render(<App step={1} />, __root);
    flushPatch(false);
    // Drop the initial Epoch 1 hydrated slot reference; moduleMtsRef._jsFn handles must still retain epoch1ExecId
    globalThis.lynxWorkletImpl._jsFunctionLifecycleManager.removeRef(epoch1ExecId);
    await Promise.resolve();

    await expect(triggerPost('live-1-after-gc')).resolves.toBe('epoch-1:live-1-after-gc');
    expect(received).toEqual([
      'epoch-0:queued:mount-0',
      'epoch-0:post:live-0',
      'epoch-1:queued:mount-1',
      'epoch-1:post:live-1-after-gc',
    ]);
  } finally {
    globalEnvManager.switchToBackground();
    destroyBackground();
    resetBackgroundFunctionRuntime();
    resetFunctionCallReturnListener();
    globalCommitTaskMap.clear();
    globalEnvManager.resetEnv();
    elementTree.clear();
    Object.assign(globalThis, workletGlobals);
    SystemInfo.lynxSdkVersion = sdkVersion;
    clearConfigCacheForTesting();
    vi.restoreAllMocks();
  }
});
