// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Background } from '../../src/core/background';
import { root, useState } from '../../src/index';
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
  vi.restoreAllMocks();
  elementTree.clear();
});

describe('main thread first-screen render', () => {
  it('renders the fallback instead of children', () => {
    const App = () => {
      return (
        <view>
          <text>Header</text>
          <Background fallback={<text>Skeleton</text>}>
            <text>Feed</text>
          </Background>
        </view>
      );
    };

    __root.__jsx = <App />;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text>
            <raw-text
              text="Header"
            />
          </text>
          <wrapper>
            <text>
              <raw-text
                text="Skeleton"
              />
            </text>
          </wrapper>
        </view>
      </page>
    `);
  });

  it('renders nothing when no fallback is given', () => {
    const App = () => {
      return (
        <view>
          <text>Header</text>
          <Background>
            <text>Feed</text>
          </Background>
        </view>
      );
    };

    __root.__jsx = <App />;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text>
            <raw-text
              text="Header"
            />
          </text>
          <wrapper />
        </view>
      </page>
    `);
  });
});

describe('dual-thread render', () => {
  it('replaces the fallback with children when hydration completes', async () => {
    const handleTap = vi.fn();
    const App = () => {
      return (
        <view>
          <text>Header</text>
          <Background fallback={<text>Skeleton</text>}>
            <text bindtap={handleTap}>Feed</text>
          </Background>
        </view>
      );
    };

    // main thread render
    {
      __root.__jsx = <App />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="Header"
              />
            </text>
            <wrapper>
              <text>
                <raw-text
                  text="Skeleton"
                />
              </text>
            </wrapper>
          </view>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      root.render(<App />);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
    }

    // rLynxChange
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
                text="Header"
              />
            </text>
            <wrapper>
              <text
                event={
                  {
                    "bindEvent:tap": "3:0:",
                  }
                }
              >
                <raw-text
                  text="Feed"
                />
              </text>
            </wrapper>
          </view>
        </page>
      `);
    }

    // events attached by hydration work
    {
      globalEnvManager.switchToBackground();
      lynxCoreInject.tt.publishEvent('3:0:', 'data');
      expect(handleTap).toHaveBeenCalledTimes(1);
      expect(handleTap).toHaveBeenCalledWith('data');
    }
  });

  it('removes the fallback when the boundary has no children', async () => {
    const App = () => {
      return (
        <view>
          <text>Header</text>
          <Background fallback={<text>Skeleton</text>} />
        </view>
      );
    };

    // main thread render
    {
      __root.__jsx = <App />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="Header"
              />
            </text>
            <wrapper>
              <text>
                <raw-text
                  text="Skeleton"
                />
              </text>
            </wrapper>
          </view>
        </page>
      `);
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

    // rLynxChange
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
                text="Header"
              />
            </text>
            <wrapper />
          </view>
        </page>
      `);
    }
  });

  it('supports nested boundaries', async () => {
    const App = () => {
      return (
        <view>
          <Background fallback={<text>Outer Skeleton</text>}>
            <view>
              <Background fallback={<text>Inner Skeleton</text>}>
                <text>Inner Content</text>
              </Background>
            </view>
          </Background>
        </view>
      );
    };

    // main thread render
    {
      __root.__jsx = <App />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="Outer Skeleton"
              />
            </text>
          </view>
        </page>
      `);
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

    // rLynxChange
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
            <view>
              <text>
                <raw-text
                  text="Inner Content"
                />
              </text>
            </view>
          </view>
        </page>
      `);
    }
  });
});

describe('updates after hydration', () => {
  it('updates inside the boundary flow through', async () => {
    let setCount;
    const Feed = () => {
      const [count, _setCount] = useState(0);
      setCount = _setCount;
      return <text>{`Feed ${count}`}</text>;
    };
    const App = () => {
      return (
        <view>
          <Background fallback={<text>Skeleton</text>}>
            <Feed />
          </Background>
        </view>
      );
    };

    // main thread render
    {
      __root.__jsx = <App />;
      renderPage();
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

    // rLynxChange
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
                text="Feed 0"
              />
            </text>
          </view>
        </page>
      `);
    }

    // update state inside the boundary
    {
      globalEnvManager.switchToBackground();
      setCount(1);
      await waitSchedule();

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[1];
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
                text="Feed 1"
              />
            </text>
          </view>
        </page>
      `);
    }
  });
});
