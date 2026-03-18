// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, afterEach, vi } from 'vitest';
import { __root } from '../../src/root';
import { globalEnvManager } from '../utils/envManager';
import { describe } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { render } from 'preact';
import { waitSchedule } from '../utils/nativeMethod';
import { beforeAll } from 'vitest';
import { replaceCommitHook } from '../../src/lifecycle/patch/commit';
import { elementTree } from '../utils/nativeMethod';

beforeAll(() => {
  replaceCommitHook();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  vi.restoreAllMocks();
  elementTree.clear();
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

  it('should not trigger re-render when __GLOBAL_PROPS_MODE__ is event', async () => {
    globalThis.__GLOBAL_PROPS_MODE__ = 'event';

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
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      await waitSchedule();
    }

    // updateGlobalProps
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      lynxCoreInject.tt.updateGlobalProps({ theme: 'light' });
      await waitSchedule();

      // No rLynxChange should be called because it skips runWithForce
      expect(lynx.getNativeApp().callLepusMethod.mock.calls.length).toBe(0);

      // no ui change
      globalEnvManager.switchToMainThread();
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

    globalThis.__GLOBAL_PROPS_MODE__ = 'reactive';
  });
});
