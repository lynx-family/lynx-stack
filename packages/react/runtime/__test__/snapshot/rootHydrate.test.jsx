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
});

afterEach(() => {
  vi.restoreAllMocks();
  elementTree.clear();
});

const App = () => {
  return (
    <view>
      <text>Hello</text>
    </view>
  );
};

describe('root.hydrate() as an awaiter (automatic handover)', () => {
  it('resolves when the hydration handover completes', async () => {
    // main thread render (`immediately`: the tree is synced right away)
    {
      __root.__jsx = <App />;
      renderPage();
    }

    // background render
    let resolved = false;
    {
      globalEnvManager.switchToBackground();
      root.render(<App />);
      root.hydrate().then(() => {
        resolved = true;
      });
      // in the automatic presets, `hydrate()` does not send any signal
      expect(lynx.getNativeApp().callLepusMethod).not.toBeCalled();
    }

    // hydrate: diffing alone does not complete the handover
    {
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      await waitSchedule();
      expect(resolved).toBe(false);
    }

    // rLynxChange: applying + acking the hydration patch completes it
    {
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
      await waitSchedule();
      expect(resolved).toBe(true);
    }
  });

  it('resolves immediately when called after the handover completed', async () => {
    // full startup without ever calling `hydrate()`
    {
      __root.__jsx = <App />;
      renderPage();
      globalEnvManager.switchToBackground();
      root.render(<App />);
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
      await waitSchedule();
    }

    globalEnvManager.switchToBackground();
    await root.hydrate();
  });

  it('returns the same promise across calls', () => {
    globalEnvManager.switchToBackground();
    expect(root.hydrate()).toBe(root.hydrate());
  });
});

describe('root.render(jsx, { hydrate: false })', () => {
  it('holds the handover until root.hydrate()', async () => {
    const Comp = () => {
      const initData = useInitData();
      return <text>{initData.msg}</text>;
    };

    // main thread render: entry code runs before `renderPage`, so the main
    // thread holds the handover
    {
      root.render(<Comp />, { hydrate: false });
      renderPage({ msg: 'init' });
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
    }

    // the main thread still responds to data updates synchronously
    {
      updatePage({ msg: 'update' });
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="update"
            />
          </text>
        </page>
      `);
    }

    // background render: no automatic handover either
    let resolved = false;
    {
      globalEnvManager.switchToBackground();
      root.render(<Comp />, { hydrate: false });
      expect(lynx.getNativeApp().callLepusMethod).not.toBeCalled();
    }

    // `root.hydrate()` triggers the handover: the request is forwarded to the
    // main thread
    {
      root.hydrate().then(() => {
        resolved = true;
      });
      const forwarded = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      expect(forwarded[0]).toMatchInlineSnapshot(`"rLynxFirstScreenSyncReady"`);

      globalEnvManager.switchToMainThread();
      globalThis[forwarded[0]](forwarded[1]);
      // the main thread syncs the first screen
      expect(globalThis.__OnLifecycleEvent).toBeCalled();
    }

    // hydrate + rLynxChange complete the handover
    {
      globalEnvManager.switchToBackground();
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls.find((call) => call[0] === 'rLynxChange');
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
      await waitSchedule();
      expect(resolved).toBe(true);
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="update"
            />
          </text>
        </page>
      `);
    }
  });

  it('suppresses the automatic jsReady signal', () => {
    globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'jsReady';
    try {
      // main thread render
      {
        root.render(<App />, { hydrate: false });
        renderPage();
        expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      }

      // background render: `jsReady` would auto-signal, but the handover is held
      {
        globalEnvManager.switchToBackground();
        root.render(<App />, { hydrate: false });
        expect(lynx.getNativeApp().callLepusMethod).not.toBeCalled();
      }
    } finally {
      globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'immediately';
    }
  });
});

describe('root.hydrate() as a trigger (manual preset)', () => {
  beforeEach(() => {
    globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'manual';
  });

  afterEach(() => {
    globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'immediately';
  });

  it('triggers the handover like markFirstScreenSyncReady', async () => {
    // main thread render: held by the `manual` preset
    {
      root.render(<App />);
      renderPage();
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      root.render(<App />);
      expect(lynx.getNativeApp().callLepusMethod).not.toBeCalled();
    }

    // trigger + complete the handover
    let resolved = false;
    {
      root.hydrate().then(() => {
        resolved = true;
      });
      const forwarded = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalEnvManager.switchToMainThread();
      globalThis[forwarded[0]](forwarded[1]);

      globalEnvManager.switchToBackground();
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls.find((call) => call[0] === 'rLynxChange');
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
      await waitSchedule();
      expect(resolved).toBe(true);
    }
  });

  it('triggers the handover from the main thread', async () => {
    // main thread render: held by the `manual` preset
    {
      root.render(<App />);
      renderPage();
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
    }

    // a main-thread `hydrate()` call marks ready directly and the tree syncs
    {
      const promise = root.hydrate();
      expect(globalThis.__OnLifecycleEvent).toBeCalled();

      globalEnvManager.switchToBackground();
      root.render(<App />);
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls.find((call) => call[0] === 'rLynxChange');
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
      await waitSchedule();
      // resolved on the main thread once the hydration patch is applied
      await promise;
    }
  });
});
