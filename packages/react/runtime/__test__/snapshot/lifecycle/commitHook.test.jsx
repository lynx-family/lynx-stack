// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useState } from '../../../src/index';
import { __root } from '../../../src/root';
import { setupPage } from '../../../src/snapshot';
import { replaceCommitHook } from '../../../src/snapshot/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../../src/snapshot/lifecycle/patch/updateMainThread';
import { globalEnvManager } from '../utils/envManager';
import { elementTree, waitSchedule } from '../utils/nativeMethod';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  injectUpdateMainThread();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  vi.restoreAllMocks();
  elementTree.clear();
});

function mountAndHydrate(jsx) {
  __root.__jsx = jsx;
  renderPage();

  globalEnvManager.switchToBackground();
  render(jsx, __root);

  lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

  globalEnvManager.switchToMainThread();
  const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls.at(-1);
  globalThis[rLynxChange[0]](rLynxChange[1]);

  globalEnvManager.switchToBackground();
  rLynxChange[2]?.();
}

describe('replaceCommitHook', () => {
  // Repeated installation (as test files do in `beforeEach`) stacks one
  // commit-hook wrapper per call onto Preact's global `options`. On every
  // commit the outermost wrapper takes the real snapshot patch and each
  // inner copy re-fires with an already-drained queue, sending a spurious
  // empty patch per extra install.
  it('stacks wrappers and sends duplicate empty patches when installed repeatedly', async () => {
    replaceCommitHook();
    replaceCommitHook();
    replaceCommitHook();

    let setText;
    function App() {
      const [text, setState] = useState('a');
      setText = setState;
      return <text>{text}</text>;
    }

    mountAndHydrate(<App />);

    const callsBeforeUpdate = lynx.getNativeApp().callLepusMethod.mock.calls.length;
    setText('b');
    await waitSchedule();

    const newCalls = lynx.getNativeApp().callLepusMethod.mock.calls.slice(callsBeforeUpdate);
    expect(newCalls.length).toBe(3);

    const patches = newCalls.map(call => JSON.parse(call[1].data));
    expect(patches[0].patchList[0].snapshotPatch).not.toHaveLength(0);
    expect(patches[1].patchList[0].snapshotPatch).toBeUndefined();
    expect(patches[1].flushOptions).toMatchObject({ emptyPatch: true });
    expect(patches[2].patchList[0].snapshotPatch).toBeUndefined();
    expect(patches[2].flushOptions).toMatchObject({ emptyPatch: true });
  });
});
