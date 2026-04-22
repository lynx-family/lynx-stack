// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, afterEach, vi } from 'vitest';
import { globalEnvManager } from '../utils/envManager';
import { describe } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { render } from 'preact';
import { waitSchedule } from '../utils/nativeMethod';
import { beforeAll } from 'vitest';
import { replaceCommitHook } from '../../../src/snapshot/lifecycle/patch/commit';
import { elementTree } from '../utils/nativeMethod';
import { __root } from '../../../src/root';

beforeAll(() => {
  replaceCommitHook();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  elementTree.clear();
  vi.resetModules();
  vi.restoreAllMocks();
  globalThis.__GLOBAL_PROPS_MODE__ = 'reactive';
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

  it('should update global props once when use useGlobalProps and get warning', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { useGlobalProps } = await import('../../../src/lynx-api');
    const Comp = () => {
      const globalProps = useGlobalProps();
      return <text>{globalProps.theme}</text>;
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
              text="light"
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
      expect(console.warn).toBeCalledWith(expect.stringContaining('No need to use this API'));
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
              text="light"
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

  it('should update global props once when use GlobalPropsConsumer / GlobalPropsProvider and get warning', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { GlobalPropsProvider, GlobalPropsConsumer, useGlobalPropsChanged } = await import('../../../src/lynx-api');
    let count = 0;
    let dataTheme, globalPropsTheme;
    const Comp = () => {
      useGlobalPropsChanged(data => {
        count++;
        dataTheme = data.theme;
        globalPropsTheme = lynx.__globalProps.theme;
      });
      return (
        <GlobalPropsProvider>
          <GlobalPropsConsumer>
            {globalProps => {
              return <text>{globalProps.theme}</text>;
            }}
          </GlobalPropsConsumer>
        </GlobalPropsProvider>
      );
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
              text="light"
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
      expect(console.warn).toBeCalledWith(expect.stringContaining('No need to use this API'));
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
              text="light"
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
      expect(count).toBe(1);
      expect(dataTheme).toBe('light');
      expect(globalPropsTheme).toBe('light');

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

      // No ui change
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
  });

  it('should trigger re-render when useGlobalProps is called', async () => {
    globalThis.__GLOBAL_PROPS_MODE__ = 'event';
    const { useGlobalProps, useGlobalPropsChanged, GlobalPropsProvider, GlobalPropsConsumer } = await import(
      '../../../src/lynx-api'
    );

    lynx.__globalProps = { theme: 'dark' };
    let count = 0;
    let dataTheme, globalPropsTheme;
    const Comp = () => {
      const globalProps = useGlobalProps();
      useGlobalPropsChanged(data => {
        count++;
        dataTheme = data.theme;
        globalPropsTheme = lynx.__globalProps.theme;
      });
      return <text>{globalProps.theme}</text>;
    };

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
      expect(count).toBe(0);
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

      // rLynxChange should be called
      expect(lynx.getNativeApp().callLepusMethod.mock.calls.length).toBe(1);
      expect(count).toBe(1);
      expect(dataTheme).toBe('light');
      expect(globalPropsTheme).toBe('light');
      // ui change
      globalEnvManager.switchToMainThread();
      for (const rLynxChange of lynx.getNativeApp().callLepusMethod.mock.calls) {
        globalThis[rLynxChange[0]](rLynxChange[1]);
        rLynxChange[2]();
      }
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

  it('should trigger update when GlobalPropsProvider and useGlobalProps are used', async () => {
    globalThis.__GLOBAL_PROPS_MODE__ = 'event';
    const { useGlobalProps, useGlobalPropsChanged, GlobalPropsProvider, GlobalPropsConsumer } = await import(
      '../../../src/lynx-api'
    );

    lynx.__globalProps = { theme: 'dark' };
    const Comp = () => {
      return (
        <GlobalPropsProvider>
          <GlobalPropsConsumer>
            {globalProps => {
              return <text>{globalProps.theme}</text>;
            }}
          </GlobalPropsConsumer>
        </GlobalPropsProvider>
      );
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

      // rLynxChange should be called
      expect(lynx.getNativeApp().callLepusMethod.mock.calls.length).toBe(2);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "rLynxChange",
            {
              "data": "{"patchList":[{"id":17}]}",
              "patchOptions": {
                "flowIds": [
                  666,
                ],
                "reloadVersion": 0,
              },
            },
            [Function],
          ],
          [
            "rLynxChange",
            {
              "data": "{"patchList":[{"id":18,"snapshotPatch":[3,-3,0,"light"]}]}",
              "patchOptions": {
                "reloadVersion": 0,
              },
            },
            [Function],
          ],
        ]
      `);
      // ui change
      globalEnvManager.switchToMainThread();
      for (const rLynxChange of lynx.getNativeApp().callLepusMethod.mock.calls) {
        globalThis[rLynxChange[0]](rLynxChange[1]);
        rLynxChange[2]();
      }
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
});
