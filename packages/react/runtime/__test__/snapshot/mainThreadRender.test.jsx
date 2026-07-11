// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { root, useInitData } from '../../src/lynx-api';
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
  globalThis.__OnLifecycleEvent.mockClear();
  lynx.getNativeApp().callLepusMethod.mockClear();
  globalThis.__MAIN_THREAD_RENDER__ = false;
});

afterEach(() => {
  globalThis.__MAIN_THREAD_RENDER__ = true;
  vi.restoreAllMocks();
  elementTree.clear();
});

describe('mainThreadRender: false', () => {
  it('renders an empty first screen and fills it in through hydration', async () => {
    const App = () => {
      return (
        <view>
          <text>Hello</text>
        </view>
      );
    };

    // main thread render: the first screen is empty, but it is still synced
    {
      __root.__jsx = <App />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        />
      `);
      expect(globalThis.__OnLifecycleEvent).toBeCalled();
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      root.render(<App />);
    }

    // hydrate
    {
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
    }

    // rLynxChange: the background render fills the screen in
    {
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
      await waitSchedule();
      expect(__root.__element_root).toMatchInlineSnapshot(`
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
    }
  });

  it('skips the pre-hydration main-thread re-render on data updates', () => {
    globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'manual';
    try {
      const Comp = () => {
        const initData = useInitData();
        return <text>{initData.msg}</text>;
      };

      // main thread render: held and empty
      {
        __root.__jsx = <Comp />;
        renderPage({ msg: 'init' });
        expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      }

      // a data update does not re-render on the main thread — there is
      // nothing to reflect without a main-thread first-screen render
      {
        updatePage({ msg: 'update' });
        expect(__root.__element_root).toMatchInlineSnapshot(`
          <page
            cssId="default-entry-from-native:0"
          />
        `);
        expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      }
    } finally {
      globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'immediately';
    }
  });
});
