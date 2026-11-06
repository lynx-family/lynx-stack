import { bindPage } from '@lynx-js/lynx-runtime/bts';
import { afterEach, expect, it, vi } from 'vitest';

import { setupLynxEnv } from '../../../src/snapshot/lynx/env.js';
import { injectTt } from '../../../src/snapshot/lynx/tt.js';
import { globalEnvManager } from '../utils/envManager.js';

const originalSystemInfo = globalThis.SystemInfo;
const originalGlobalPropsMode = globalThis.__GLOBAL_PROPS_MODE__;
const originalRuntimeConfigs = globalThis.lynx?.__runtime_configs__;
const originalGlobalProps = globalThis.lynx?.__globalProps;

afterEach(() => {
  globalThis.SystemInfo = originalSystemInfo;
  globalThis.__GLOBAL_PROPS_MODE__ = originalGlobalPropsMode;
  if (globalThis.lynx) {
    globalThis.lynx.__runtime_configs__ = originalRuntimeConfigs;
    globalThis.lynx.__globalProps = originalGlobalProps;
  }
  vi.restoreAllMocks();
  globalEnvManager.resetEnv();
});

it.each([false, true])('keeps Snapshot state semantics through host runtime notifications (Web: %s)', (isWeb) => {
  globalThis.SystemInfo = isWeb ? { platform: 'web' } : undefined;
  globalEnvManager.resetEnv();
  globalEnvManager.switchToBackground();
  const hostGlobalProps = { theme: 'light', locale: 'en' };
  lynx.__globalProps = hostGlobalProps;
  lynx.__runtime_configs__ = { globalPropsMode: 'reactive' };
  const app = {
    GlobalEventEmitter: lynx.getJSModule('GlobalEventEmitter'),
    _params: {
      appGUID: 'snapshot-host-runtime',
      cardType: isWeb ? 'react' : 'react_nodiff',
      initData: { count: 1, static: true },
      updateData: { count: 2 },
    },
  };
  vi.spyOn(lynx, 'getApp').mockReturnValue(app);
  const notify = vi.spyOn(lynx.getJSModule('GlobalEventEmitter'), 'emit');

  setupLynxEnv();
  injectTt();
  const card = bindPage();
  expect(lynx.__initData).toEqual({ count: 2, static: true });
  expect(lynx.__initData).not.toBe(card.getInitData());
  expect(lynx.__globalProps).toEqual({ theme: 'light', locale: 'en' });
  expect(lynx.__globalProps).not.toBe(hostGlobalProps);
  expect(lynx.__globalProps).not.toBe(card.getGlobalProps());

  const initialState = lynx.__initData;
  app.updateCardData({ count: 3 });
  expect(lynx.__initData).toEqual({ count: 3, static: true });
  expect(lynx.__initData).not.toBe(initialState);
  expect(card.getInitData()).toEqual({ count: 2, static: true });
  expect(notify).toHaveBeenCalledExactlyOnceWith('onDataChanged', [{ count: 3 }]);

  app.updateCardData({ count: 4 }, { type: 1 });
  expect(lynx.__initData).toEqual({ count: 4 });
  expect(card.getInitData()).toEqual({ count: 2, static: true });

  app.onAppReload({ count: 5 });
  expect(lynx.__initData).toEqual({ count: 5 });
  expect(card.getInitData()).toEqual({ count: 5, static: true });

  // RL isolates its root GlobalProps object so reactive updates preserve root identity without mutating the host's object.
  const reactiveRoot = lynx.__globalProps;
  app.updateGlobalProps({ theme: 'warm' });
  expect(lynx.__globalProps).toBe(reactiveRoot);
  expect(lynx.__globalProps).toEqual({ theme: 'warm', locale: 'en' });
  expect(hostGlobalProps).toEqual({ theme: 'light', locale: 'en' });
  expect(card.getGlobalProps()).toEqual({ theme: 'warm' });

  // RL retains its COW merge policy in event mode.
  globalThis.__GLOBAL_PROPS_MODE__ = 'event';
  lynx.__runtime_configs__ = { globalPropsMode: 'event' };
  app.updateGlobalProps({ theme: 'dark' });
  expect(lynx.__globalProps).not.toBe(reactiveRoot);
  expect(lynx.__globalProps).toEqual({ theme: 'dark', locale: 'en' });
  expect(card.getGlobalProps()).toEqual({ theme: 'dark' });
  const globalPropsChanged = vi.fn();
  card.onGlobalPropsChanged(globalPropsChanged);
  app.updateGlobalProps({ theme: 'blue' });
  // RL retains its historical merge policy; Runtime exposes the host notification.
  expect(lynx.__globalProps).toEqual({ theme: 'blue', locale: 'en' });
  expect(card.getGlobalProps()).toEqual({ theme: 'blue' });
  expect(globalPropsChanged).toHaveBeenCalledExactlyOnceWith({ theme: 'blue' });

  app.callDestroyLifetimeFun();
  expect(app.updateCardData).toBeUndefined();
  expect(app.onAppReload).toBeUndefined();
  expect(app.callDestroyLifetimeFun).toBeUndefined();
  expect(card.getGlobalProps()).toEqual({ theme: 'blue' });
  expect(app.updateGlobalProps).toBeUndefined();
});
