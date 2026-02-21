// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, beforeAll, afterEach, vi } from 'vitest';
import { __root } from '../../src/root';
import { globalEnvManager } from '../utils/envManager';
import { describe } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { render } from 'preact';
import { waitSchedule, elementTree } from '../utils/nativeMethod';
import { replaceCommitHook } from '../../src/lifecycle/patch/commit';
import { wrapWithLynxComponent, ComponentFromReactRuntime } from '../../src/compat/lynxComponent';
import { deinitGlobalSnapshotPatch } from '../../src/lifecycle/patch/snapshotPatch';

beforeAll(() => {
  replaceCommitHook();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  deinitGlobalSnapshotPatch();
  elementTree.clear();
  vi.restoreAllMocks();
});

describe('updateGlobalProps', () => {
  it('should update global props', async () => {
    lynx.__globalProps = { theme: 'dark' };
    const Comp = () => {
      return <text>{lynx.__globalProps.theme}</text>;
    };

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="dark"
            />
          </text>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      __root.__jsx = <Comp />;
      render(<Comp />, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      await waitSchedule();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="dark"
            />
          </text>
        </page>
      `);
    }

    // updateGlobalProps
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      lynxCoreInject.tt.updateGlobalProps({ theme: 'light' });
      await waitSchedule();

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);

      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="light"
            />
          </text>
        </page>
      `);
    }
  });

  it('should update global props with root page element', async () => {
    lynx.__globalProps = { theme: 'dark' };

    class C extends ComponentFromReactRuntime {
      render() {
        return <text>{lynx.__globalProps.theme}</text>;
      }
    }

    const jsx = (
      <page class={lynx.__globalProps.theme}>
        <C />
        <text>{lynx.__globalProps.theme}</text>
      </page>
    );
    // main thread render
    {
      __root.__jsx = jsx;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          class="dark"
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="dark"
            />
          </text>
          <text>
            <raw-text
              text="dark"
            />
          </text>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      __root.__jsx = jsx;
      render(jsx, __root);
    }

    // hydrate
    {
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      await waitSchedule();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          class="dark"
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="dark"
            />
          </text>
          <text>
            <raw-text
              text="dark"
            />
          </text>
        </page>
      `);
    }

    // updateGlobalProps with addComponentElement enabled
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      lynxCoreInject.tt.updateGlobalProps({ theme: 'light' });
      await waitSchedule();

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);

      // cannot update elements in root render
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          class="dark"
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="light"
            />
          </text>
          <text>
            <raw-text
              text="dark"
            />
          </text>
        </page>
      `);
    }
  });

  it('should update global props with addComponentElement enabled', async () => {
    lynx.__globalProps = { theme: 'dark' };

    class C extends ComponentFromReactRuntime {
      render() {
        return <text>{lynx.__globalProps.theme}</text>;
      }
    }

    const jsx = wrapWithLynxComponent((__c) => <view>{__c}</view>, <C />);

    // main thread render
    {
      __root.__jsx = jsx;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="dark"
              />
            </text>
          </view>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      __root.__jsx = jsx;
      render(jsx, __root);
    }

    // hydrate
    {
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      await waitSchedule();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="dark"
              />
            </text>
          </view>
        </page>
      `);
    }

    // updateGlobalProps with addComponentElement enabled
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      lynxCoreInject.tt.updateGlobalProps({ theme: 'light' });
      await waitSchedule();

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);

      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="light"
              />
            </text>
          </view>
        </page>
      `);
    }
  });
});
