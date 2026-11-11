// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { createElement } from '../../../lepus/index.js';
import { runOnBackground } from '../../../src/core/background-function/run-on-background.js';
import { getReloadVersion } from '../../../src/core/reload-version.js';
import { resetFunctionCallReturnListener } from '../../../src/core/thread-function-call/return-value.js';
import { __root } from '../../../src/root.js';
import { setupPage } from '../../../src/snapshot/index.js';
import { initRunOnBackgroundDelay } from '../../../src/worklet-runtime/delayRunOnBackground.js';
import { globalEnvManager } from '../utils/envManager.js';
import { elementTree } from '../utils/nativeMethod.js';

beforeEach(() => {
  globalEnvManager.resetEnv();
  setupPage(__CreatePage('0', 0));
});

afterEach(() => {
  vi.restoreAllMocks();
  globalEnvManager.resetEnv();
  elementTree.clear();
});

it('clears old delayed background calls before rendering and preserves new calls', () => {
  const previousImpl = globalThis.lynxWorkletImpl;
  const previousSdkVersion = SystemInfo.lynxSdkVersion;
  SystemInfo.lynxSdkVersion = '4.0';
  const delay = initRunOnBackgroundDelay();
  globalThis.lynxWorkletImpl = { ...previousImpl, _runOnBackgroundDelayImpl: delay };
  const dispatch = vi.spyOn(lynx.getJSContext(), 'dispatchEvent').mockImplementation(() => {});
  try {
    __root.__jsx = createElement(() => {
      void runOnBackground(Object.assign(() => {}, { _isFirstScreen: true }))();
      return null;
    });
    renderPage({});
    expect(delay.delayedBackgroundFunctionArray).toHaveLength(1);
    const oldTask = delay.delayedBackgroundFunctionArray[0];
    const oldCallback = vi.spyOn(oldTask, 'task');

    updatePage({}, { reloadTemplate: true });

    expect(delay.delayedBackgroundFunctionArray).toHaveLength(1);
    expect(delay.delayedBackgroundFunctionArray[0]).not.toBe(oldTask);
    delay.delayedBackgroundFunctionArray[0].jsFnHandle = { _jsFnId: 7, _execId: 9 };
    delay.runDelayedBackgroundFunctions();
    expect(oldCallback).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledOnce();
    expect(JSON.parse(dispatch.mock.calls[0][0].data)).toMatchObject({
      obj: { _jsFnId: 7, _execId: 9 },
      reloadVersion: getReloadVersion(),
    });
    expect(delay.delayedBackgroundFunctionArray).toHaveLength(0);
  } finally {
    delay.clearDelayedBackgroundFunctions();
    resetFunctionCallReturnListener();
    globalThis.lynxWorkletImpl = previousImpl;
    SystemInfo.lynxSdkVersion = previousSdkVersion;
  }
});
