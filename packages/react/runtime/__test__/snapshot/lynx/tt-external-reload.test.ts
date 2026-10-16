// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getReloadVersion, increaseReloadVersion } from '../../../src/core/reload-version';
import * as lifecycle from '../../../src/snapshot/lifecycle/destroy';
import { injectTt } from '../../../src/snapshot/lynx/tt';
import { globalEnvManager } from '../utils/envManager';

const externalCacheKey = Symbol.for('__LYNX_EXTERNAL_GLOBAL__');

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  Reflect.deleteProperty(lynx, externalCacheKey);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  globalEnvManager.resetEnv();
});

describe('external bundle exports on experimental reload', () => {
  it('clears exports after background cleanup', () => {
    vi.stubGlobal('__EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__', true);
    const external = { reactLynx: {}, framework: {} };
    Reflect.set(lynx, externalCacheKey, external);
    const cleanup = vi.spyOn(lifecycle, 'destroyBackground').mockImplementation(() => {
      expect(Reflect.get(lynx, externalCacheKey)).toBe(external);
    });

    injectTt();
    lynx.getApp().callDestroyLifetimeFun();

    expect(cleanup).toHaveBeenCalledOnce();
    expect(Reflect.get(lynx, externalCacheKey)).toBeUndefined();
  });

  it('initializes external exports for each new app and preserves reload version', () => {
    vi.stubGlobal('__EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__', true);
    const originalApp = lynx.getApp();
    const getApp = vi.spyOn(lynx, 'getApp');
    const initializeExternal = vi.fn(() => {
      injectTt();
      return { reactLynx: {}, framework: {} };
    });
    const initialVersion = getReloadVersion();

    for (const reload of [0, 1, 2]) {
      const publishEvent = vi.fn();
      const app = { ...originalApp, publishEvent };
      getApp.mockReturnValue(app);
      if (Reflect.get(lynx, externalCacheKey) === undefined) {
        Reflect.set(lynx, externalCacheKey, initializeExternal());
      }

      expect(app.publishEvent).not.toBe(publishEvent);
      expect(initializeExternal).toHaveBeenCalledTimes(reload + 1);
      expect(getReloadVersion()).toBe(initialVersion + reload);
      app.callDestroyLifetimeFun();
      expect(getReloadVersion()).toBe(initialVersion + reload);
      increaseReloadVersion();
    }
  });

  it('keeps exports when re-evaluation is disabled', () => {
    vi.stubGlobal('__EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__', false);
    const external = { reactLynx: {}, framework: {} };
    Reflect.set(lynx, externalCacheKey, external);

    injectTt();
    lynx.getApp().callDestroyLifetimeFun();

    expect(Reflect.get(lynx, externalCacheKey)).toBe(external);
  });
});
