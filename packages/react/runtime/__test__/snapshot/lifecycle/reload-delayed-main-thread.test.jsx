// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createElement } from 'preact';
import { useLayoutEffect } from 'preact/hooks';
import { expect, it, vi } from 'vitest';

import {
  delayedRunOnMainThreadData,
  takeDelayedRunOnMainThreadData,
} from '../../../src/core/thread-function-call/main-thread.js';
import { resetFunctionCallReturnListener } from '../../../src/core/thread-function-call/return-value.js';
import { root } from '../../../src/lynx-api.js';
import { __root } from '../../../src/root.js';
import { destroyBackground } from '../../../src/snapshot/lifecycle/destroy.js';
import { globalCommitTaskMap } from '../../../src/snapshot/lifecycle/patch/commit.js';
import { reloadBackground } from '../../../src/snapshot/lifecycle/reload.js';
import { setupPage } from '../../../src/snapshot/index.js';
import { runOnMainThread } from '../../../src/snapshot/worklet/call/runOnMainThread.js';
import { registerWorklet } from '../../../src/worklet-runtime/bindings/index.js';
import { initWorklet } from '../../../src/worklet-runtime/workletRuntime.js';
import { globalEnvManager } from '../utils/envManager.js';
import { elementTree } from '../utils/nativeMethod.js';

it('drops pre-hydration and unmount calls before a reload reuses their return IDs', async () => {
  const oldResult = vi.fn();
  const cleanupResult = vi.fn();
  const cleanup = vi.fn(() => {
    void runOnMainThread({ _wkltId: 'unmount-call' })().then(cleanupResult);
    expect(delayedRunOnMainThreadData.map(data => data.resolveId)).toEqual([1, 2]);
  });
  function App() {
    useLayoutEffect(() => cleanup, []);
    return null;
  }

  const oldCall = vi.fn(() => 'old-page');
  const unmountCall = vi.fn(() => 'old-page');
  const newCall = vi.fn(() => 'new-page');
  const workletGlobals = {
    lynxWorkletImpl: globalThis.lynxWorkletImpl,
    runWorklet: globalThis.runWorklet,
    registerWorklet: globalThis.registerWorklet,
    registerWorkletInternal: globalThis.registerWorkletInternal,
  };
  const sdkVersion = SystemInfo.lynxSdkVersion;
  globalEnvManager.resetEnv();
  SystemInfo.lynxSdkVersion = '4.0';
  try {
    initWorklet();
    registerWorklet('main-thread', 'old-call', oldCall);
    registerWorklet('main-thread', 'unmount-call', unmountCall);
    registerWorklet('main-thread', 'new-call', newCall);
    setupPage(__CreatePage('0', 0));
    __root.__jsx = null;
    renderPage({});
    globalEnvManager.switchToBackground();
    root.render(createElement(App));
    void runOnMainThread({ _wkltId: 'old-call' })().then(oldResult);
    expect(delayedRunOnMainThreadData[0]?.resolveId).toBe(1);

    reloadBackground({});
    expect(cleanup).toHaveBeenCalledOnce();
    // Both threads share resolver state in this harness. Complete MTS reload
    // before creating the replacement BTS call, then deliver its hydration.
    globalEnvManager.switchToMainThread();
    updatePage({}, { reloadTemplate: true });
    globalEnvManager.switchToBackground();
    const result = runOnMainThread({ _wkltId: 'new-call' })();
    expect(delayedRunOnMainThreadData.at(-1)?.resolveId).toBe(1);

    lynx.getNativeApp().callLepusMethod.mockClear();
    lynx.getApp().OnLifecycleEvent(...__OnLifecycleEvent.mock.lastCall);
    const [method, patch, complete] = lynx.getNativeApp().callLepusMethod.mock.lastCall;
    expect(patch.patchOptions.isHydration).toBe(true);
    expect(JSON.parse(patch.data).delayedRunOnMainThreadData).toEqual([
      { worklet: expect.objectContaining({ _wkltId: 'new-call' }), params: [], resolveId: 1 },
    ]);
    globalEnvManager.switchToMainThread();
    globalThis[method](patch);
    globalEnvManager.switchToBackground();
    complete();

    await expect(result).resolves.toBe('new-page');
    expect(newCall).toHaveBeenCalledExactlyOnceWith();
    expect(oldCall).not.toHaveBeenCalled();
    expect(unmountCall).not.toHaveBeenCalled();
    expect(oldResult).not.toHaveBeenCalled();
    expect(cleanupResult).not.toHaveBeenCalled();
  } finally {
    cleanup.mockImplementation(() => {});
    globalEnvManager.switchToBackground();
    destroyBackground();
    takeDelayedRunOnMainThreadData();
    resetFunctionCallReturnListener();
    globalCommitTaskMap.clear();
    globalEnvManager.resetEnv();
    elementTree.clear();
    Object.assign(globalThis, workletGlobals);
    SystemInfo.lynxSdkVersion = sdkVersion;
    vi.restoreAllMocks();
  }
});
