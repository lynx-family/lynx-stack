// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { options, render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useState } from '../../../src/index';
import { __root } from '../../../src/root';
import { setupPage } from '../../../src/snapshot';
import { removeCommitHookForTesting, replaceCommitHook } from '../../../src/snapshot/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../../src/snapshot/lifecycle/patch/updateMainThread';
import { installTransferCommitHook } from '../../../src/snapshot/transfer-commit';
import { globalEnvManager } from '../utils/envManager';
import { elementTree, waitSchedule } from '../utils/nativeMethod';

let removeTransferHook;
beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  injectUpdateMainThread();
});
beforeEach(() => globalEnvManager.resetEnv());
afterEach(() => {
  removeTransferHook?.();
  removeTransferHook = undefined;
  removeCommitHookForTesting();
  vi.restoreAllMocks();
  elementTree.clear();
});

function mountAndHydrate(jsx) {
  replaceCommitHook();
  __root.__jsx = jsx;
  renderPage();
  globalEnvManager.switchToBackground();
  render(jsx, __root);
  lynx.getApp().OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
  globalEnvManager.switchToMainThread();
  const call = lynx.getNativeApp().callLepusMethod.mock.calls.at(-1);
  globalThis[call[0]](call[1]);
  globalEnvManager.switchToBackground();
  call[2]?.();
}

describe('opt-in transfer commit hook', () => {
  it('does not change the ordinary hook when its module is merely imported', async () => {
    replaceCommitHook();
    const ordinary = options.__c;
    await import('../../../src/snapshot/transfer-commit');
    expect(options.__c).toBe(ordinary);
  });

  it('replaces rather than chains the ordinary transport', async () => {
    let update;
    function App() {
      const [text, setText] = useState('a');
      update = setText;
      return <text>{text}</text>;
    }
    mountAndHydrate(<App />);
    const before = lynx.getNativeApp().callLepusMethod.mock.calls.length;
    const submit = vi.fn((_vnode, patchList, _options, finish) => {
      expect(patchList.patchList).toHaveLength(1);
      expect(patchList.patchList[0].snapshotPatch.length).toBeGreaterThan(0);
      finish();
    });
    removeTransferHook = installTransferCommitHook(submit);
    update('b');
    await waitSchedule();
    expect(submit).toHaveBeenCalledOnce();
    expect(lynx.getNativeApp().callLepusMethod.mock.calls.length).toBe(before);

    removeTransferHook();
    replaceCommitHook();
    update('c');
    await waitSchedule();
    expect(submit).toHaveBeenCalledOnce();
    expect(lynx.getNativeApp().callLepusMethod.mock.calls.length).toBe(before + 1);
  });
});
