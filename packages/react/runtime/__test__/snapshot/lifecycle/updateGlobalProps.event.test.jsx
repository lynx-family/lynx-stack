// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { __root } from '../../../src/root';
import { replaceCommitHook } from '../../../src/snapshot/lifecycle/patch/commit';
import { elementTree, waitSchedule } from '../utils/nativeMethod';
import { globalEnvManager } from '../utils/envManager';

beforeAll(() => {
  replaceCommitHook();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
  globalThis.__GLOBAL_PROPS_MODE__ = 'event';
});

afterEach(() => {
  elementTree.clear();
  vi.restoreAllMocks();
  globalThis.__GLOBAL_PROPS_MODE__ = 'reactive';
});

async function renderWithCurrentPreact(element, root) {
  const [preact, { document, setupBackgroundDocument }] = await Promise.all([
    import('preact'),
    import('../../../src/document'),
  ]);
  setupBackgroundDocument();
  preact.options.document = document;
  preact.render(element, root);
}

describe('updateGlobalProps event mode', () => {
  it('should trigger re-render when useGlobalProps is called', async () => {
    const { useGlobalProps, useGlobalPropsChanged } = await import('../../../src/lynx-api');

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
      await renderWithCurrentPreact(<Comp />, __root);
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
    const { GlobalPropsProvider, GlobalPropsConsumer } = await import('../../../src/lynx-api');

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
      await renderWithCurrentPreact(<Comp />, __root);
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
              "data": "{"patchList":[{"id":6}]}",
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
              "data": "{"patchList":[{"id":7,"snapshotPatch":[3,-3,0,"light"]}]}",
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
