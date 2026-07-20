// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useState } from '../../../src/index';
import { installComponentCompat } from '../../../src/core/component';
import { __root } from '../../../src/root';
import { setupPage } from '../../../src/snapshot';
import { replaceCommitHook } from '../../../src/snapshot/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../../src/snapshot/lifecycle/patch/updateMainThread';
import { globalEnvManager } from '../utils/envManager';
import { elementTree, waitSchedule } from '../utils/nativeMethod';

beforeAll(() => {
  installComponentCompat();
  setupPage(__CreatePage('0', 0));
  injectUpdateMainThread();
  replaceCommitHook();
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

function flushLatestUpdate() {
  const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls.at(-1);
  globalEnvManager.switchToMainThread();
  globalThis.__FlushElementTree = vi.fn();
  globalThis[rLynxChange[0]](rLynxChange[1]);
  const flushOptions = globalThis.__FlushElementTree.mock.calls.at(-1)[1];
  globalEnvManager.switchToBackground();
  rLynxChange[2]?.();
  return flushOptions;
}

describe('emptyPatch flush option', () => {
  it('marks emptyPatch when the update produces no snapshot patch', async () => {
    let setCount;
    function App() {
      const [, setState] = useState(0);
      setCount = setState;
      return <text>hello</text>;
    }

    mountAndHydrate(<App />);

    setCount(1);
    await waitSchedule();

    expect(flushLatestUpdate()).toMatchObject({ emptyPatch: true });
  });

  it('does not mark emptyPatch when the update changes the tree', async () => {
    let setText;
    function App() {
      const [text, setState] = useState('a');
      setText = setState;
      return <text>{text}</text>;
    }

    mountAndHydrate(<App />);

    setText('b');
    await waitSchedule();

    expect(flushLatestUpdate()).not.toHaveProperty('emptyPatch');
  });
});
