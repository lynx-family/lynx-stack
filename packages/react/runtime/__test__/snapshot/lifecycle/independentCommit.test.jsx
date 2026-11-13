// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { options, render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useState } from '../../../src/index';
import { __root } from '../../../src/root';
import { setupPage } from '../../../src/snapshot';
import {
  enqueueDelayedRunOnMainThreadData,
  takeDelayedRunOnMainThreadData,
} from '../../../src/core/thread-function-call/main-thread';
import { removeCommitHookForTesting, replaceCommitHook } from '../../../src/snapshot/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../../src/snapshot/lifecycle/patch/updateMainThread';
import { BackgroundSnapshotInstance } from '../../../src/snapshot/snapshot/backgroundSnapshot';
import { installIndependentCommitHook } from '../../../src/snapshot/independent/commit';
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
  lynx.getApp().OnLifecycleEvent(
    ...globalThis.__OnLifecycleEvent.mock.calls[0],
  );
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
    await import('../../../src/snapshot/independent/commit');
    expect(options.__c).toBe(ordinary);
  });

  it('removes its hook when no previous commit hook exists', () => {
    removeCommitHookForTesting();
    const previous = options.__c;
    delete options.__c;
    try {
      removeTransferHook = installIndependentCommitHook(vi.fn());
      expect(options.__c).toBeTypeOf('function');
      removeTransferHook();
      expect(options.__c).toBeUndefined();
    } finally {
      options.__c = previous;
    }
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
    removeTransferHook = installIndependentCommitHook(submit);
    update('b');
    await waitSchedule();
    expect(submit).toHaveBeenCalledOnce();
    expect(lynx.getNativeApp().callLepusMethod.mock.calls.length).toBe(before);

    removeTransferHook();
    replaceCommitHook();
    update('c');
    await waitSchedule();
    expect(submit).toHaveBeenCalledOnce();
    expect(lynx.getNativeApp().callLepusMethod.mock.calls.length).toBe(
      before + 1,
    );
  });

  it('tears down removed background instances once even when finish runs twice', async () => {
    let setShow;
    function Conditional() {
      const [show, value] = useState(true);
      setShow = value;
      return <view>{show ? <text>a</text> : null}</view>;
    }
    mountAndHydrate(<Conditional />);
    const tearDown = vi.spyOn(BackgroundSnapshotInstance.prototype, 'tearDown');
    const teardownsBefore = tearDown.mock.calls.length;
    removeTransferHook = installIndependentCommitHook(
      (_vnode, _patchList, _patchOptions, finish) => {
        finish();
        // A duplicated finish must be a no-op.
        finish();
      },
    );
    setShow(false);
    await waitSchedule();
    // Exactly one background instance (the removed text subtree) is teared down.
    expect(tearDown.mock.calls.length - teardownsBefore).toBe(1);
  });

  it('forwards delayed main-thread calls through the transfer packet', async () => {
    let update;
    function App() {
      const [text, setText] = useState('a');
      update = setText;
      return <text>{text}</text>;
    }
    mountAndHydrate(<App />);
    const delayed = {
      worklet: { _wkltId: 'main-thread-call' },
      params: [],
      resolveId: 1,
    };
    enqueueDelayedRunOnMainThreadData(delayed);
    const submit = vi.fn((_vnode, patchList, _options, finish) => {
      expect(patchList.delayedRunOnMainThreadData).toEqual([delayed]);
      finish();
    });
    removeTransferHook = installIndependentCommitHook(submit);
    update('b');
    await waitSchedule();
    expect(submit).toHaveBeenCalledOnce();
    // The delayed queue is drained into the packet, not left behind.
    expect(takeDelayedRunOnMainThreadData()).toEqual([]);
  });
});
