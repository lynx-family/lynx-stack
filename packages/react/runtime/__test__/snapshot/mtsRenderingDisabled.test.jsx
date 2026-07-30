// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { useState } from '../../src/index';
import { __root } from '../../src/root';
import { setupPage, SnapshotInstance } from '../../src/snapshot';
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

    __root.__jsx = <Comp />;
    renderPage();

    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      />
    `);
  });

  it('replaces a pre-hydration root fallback with the background content', async () => {
    globalThis.__ENABLE_MTS_RENDERING__ = false;
    // `resetEnv` does not reset the mock — drop the earlier tests' first-screen
    // payloads so the background hydrates against THIS render's root.
    globalThis.__OnLifecycleEvent.mockClear();

    // What the `mts-rendering-disabled` entry does when the assembled defines
    // name a root `<Background>` fallback: link an instance under the root
    // before `renderPage` builds the elements.
    const fallback = new SnapshotInstance('view');
    __root.insertBefore(fallback);
    renderPage();

    // The first frame is the fallback, not an empty page.
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view />
      </page>
    `);

    // The background renders the real tree; the first-screen hydration diff
    // sees the unmatched fallback instance and replaces it.
    globalEnvManager.switchToBackground();
    render(<Comp />, __root);
    lynx.getNativeApp().callLepusMethod.mockClear();

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

  it('should hydrate the empty main-thread root into the full tree', async () => {
    globalThis.__ENABLE_MTS_RENDERING__ = false;

    renderPage();
    expect(__root.__element_root.children).toHaveLength(0);

    globalEnvManager.switchToBackground();
    render(<Comp />, __root);
    lynx.getNativeApp().callLepusMethod.mockClear();

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

describe('page attributes without a main-thread render', () => {
  it('applies a spread the background sends to the root', () => {
    globalEnvManager.switchToMainThread();
    setupPage(__CreatePage('0', 0));

    const root = new SnapshotInstance('root');
    root.ensureElements();
    root.setAttribute(0, { className: 'a b' });

    expect(root.__elements[0]).toMatchInlineSnapshot(`
      <page
        class="a b"
        cssId="default-entry-from-native:0"
      />
    `);
  });
});
