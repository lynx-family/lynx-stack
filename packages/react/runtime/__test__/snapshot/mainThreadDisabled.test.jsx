// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { useState } from '../../src/index';
import { __root } from '../../src/root';
import { setupPage } from '../../src/snapshot';
import { replaceCommitHook } from '../../src/snapshot/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../src/snapshot/lifecycle/patch/updateMainThread';
import { globalEnvManager } from './utils/envManager';
import { elementTree, waitSchedule } from './utils/nativeMethod';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  injectUpdateMainThread();
  replaceCommitHook();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  globalThis.__ENABLE_MTS_RENDERING__ = true;
  elementTree.clear();
});

function Comp() {
  const [value] = useState('Hello');
  return (
    <view>
      <text>{value}</text>
    </view>
  );
}

describe('__ENABLE_MTS_RENDERING__ false', () => {
  it('should not render the first screen on the main thread', () => {
    globalThis.__ENABLE_MTS_RENDERING__ = false;

    // The main thread has no business code in this mode, so `__root.__jsx` is
    // never set. Setting it here proves `renderPage` ignores it.
    __root.__jsx = <Comp />;
    renderPage();

    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      />
    `);
  });

  it('should hydrate the empty main-thread root into the full tree', async () => {
    globalThis.__ENABLE_MTS_RENDERING__ = false;

    // main thread: creates the page and an empty root
    renderPage();
    expect(__root.__element_root.children).toHaveLength(0);

    // background: renders the real tree
    globalEnvManager.switchToBackground();
    render(<Comp />, __root);
    lynx.getNativeApp().callLepusMethod.mockClear();

    // hydrate: the background diffs against the empty root and sends the
    // resulting insert patch back to the main thread
    lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
    globalThis.__OnLifecycleEvent.mockClear();

    globalEnvManager.switchToMainThread();
    const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
    globalThis[rLynxChange[0]](rLynxChange[1]);
    rLynxChange[2]();
    await waitSchedule();

    expect(elementTree.root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text>
            <raw-text
              text="Hello"
            />
          </text>
        </view>
      </page>
    `);
  });
});
