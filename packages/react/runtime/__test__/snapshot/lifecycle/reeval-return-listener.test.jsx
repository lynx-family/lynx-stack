// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, expect, it, vi } from 'vitest';

import { runOnBackground } from '../../../src/core/background-function/run-on-background';
import { WorkletEvents } from '../../../src/worklet-runtime/bindings/events';
import { reloadMainThread } from '../../../src/snapshot/lifecycle/reload';
import { __root, setRoot } from '../../../src/root';
import { SnapshotInstance } from '../../../src/snapshot/snapshot/snapshot';
import { setupPage } from '../../../src/snapshot';
import { globalEnvManager } from '../utils/envManager';
import { elementTree } from '../utils/nativeMethod';

const reloaderKey = Symbol.for('__LYNX_MAIN_THREAD_ENTRY_RELOADER__');
const supportsKey = Symbol.for('__LYNX_ENTRY_SUPPORTS_RE_EVAL__');
const versionKey = Symbol.for('__LYNX_RELOAD_VERSION__');

afterEach(() => {
  delete lynx[reloaderKey];
  delete lynx[supportsKey];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  globalEnvManager.resetEnv();
});

it('retires the old return listener before the Snapshot entry handoff runs cleanup', async () => {
  globalEnvManager.resetEnv();
  globalEnvManager.switchToMainThread();
  vi.stubGlobal('SystemInfo', { ...SystemInfo, lynxSdkVersion: '999.999' });
  elementTree.root = undefined;
  setupPage(__CreatePage('0', 0));
  lynx[versionKey] = 0;
  const listeners = new Set();
  const context = {
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    dispatchEvent: vi.fn(),
  };
  vi.spyOn(lynx, 'getJSContext').mockReturnValue(context);
  const oldContinuation = vi.fn();
  const oldCall = runOnBackground({ _jsFnId: 1, _execId: 1, _reloadVersion: 0 });
  void oldCall().then(oldContinuation);
  expect(listeners.size).toBe(1);

  // A freshly evaluated entry has its own return table, but the native event
  // context and reloadVersion live across both module instances.
  vi.resetModules();
  const fresh = await import('../../../src/core/thread-function-call/return-value');
  const newContinuation = vi.fn();
  let resultId;
  vi.stubGlobal('__EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__', true);
  lynx[supportsKey] = true;
  lynx[reloaderKey] = () => {
    expect(listeners.size).toBe(0);
    // A retained old ref/cleanup closure runs after version has advanced.
    context.dispatchEvent.mockClear();
    void oldCall().then(oldContinuation);
    expect(context.dispatchEvent).not.toHaveBeenCalled();
    fresh.onFunctionCall(vi.fn());
    resultId = fresh.onFunctionCall(newContinuation);
    setRoot(new SnapshotInstance('root'));
    __root.__jsx = <view />;
  };
  __root.__jsx = <view />;
  renderPage();
  reloadMainThread({}, {});

  expect(listeners.size).toBe(1);
  for (const listener of listeners) {
    listener({
      type: WorkletEvents.FunctionCallRet,
      data: JSON.stringify({ resolveId: resultId, reloadVersion: 1, returnValue: 'new-result' }),
    });
  }
  expect(newContinuation).toHaveBeenCalledExactlyOnceWith('new-result');
  expect(oldContinuation).not.toHaveBeenCalled();
  fresh.resetFunctionCallReturnListener();
});
