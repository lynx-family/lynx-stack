/*
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/

import { afterEach, describe, expect, it, vi } from 'vitest';

import { getReloadVersion } from '../../../src/core/reload-version';
import { reloadBackground } from '../../../src/snapshot/lifecycle/reload';
import { injectTt, reattachTt } from '../../../src/snapshot/lynx/tt';

function injectWith(coreReload) {
  const tt = lynx.getApp();
  const injected = { ...tt };
  if (coreReload) {
    tt.onAppReload = coreReload;
  } else {
    delete tt.onAppReload;
  }
  injectTt();
  const onAppReload = tt.onAppReload;
  Object.assign(tt, injected);
  return onAppReload;
}

afterEach(() => {
  delete lynx.__initData;
});

describe('background reload handover', () => {
  it('re-renders the previous jsx when lynx core cannot reload the card', () => {
    expect(injectWith(undefined)).toBe(reloadBackground);
  });

  it('hands reload to lynx core with the data this app accumulated', () => {
    const coreReload = vi.fn();
    const onAppReload = injectWith(coreReload);

    expect(onAppReload).not.toBe(reloadBackground);

    lynx.__initData = { kept: 1, replaced: 'old' };
    onAppReload({ replaced: 'new' }, { processorName: 'p' });

    expect(coreReload).toHaveBeenCalledTimes(1);
    expect(coreReload.mock.calls[0][0]).toEqual({ kept: 1, replaced: 'new' });
    expect(coreReload.mock.calls[0][1]).toEqual({ processorName: 'p' });
  });

  it('wires the app a reload brought back, which no module scoped setup reaches', () => {
    const tt = lynx.getApp();
    const injected = { ...tt };
    tt.onAppReload = vi.fn();
    injectTt();
    const wired = tt.onAppReload;

    reattachTt();
    expect(tt.onAppReload).toBe(wired);

    const reloaded = { ...tt, onAppReload: vi.fn() };
    const getApp = vi.spyOn(lynx, 'getApp').mockReturnValue(reloaded);
    reattachTt();
    getApp.mockRestore();
    Object.assign(tt, injected);

    expect(reloaded.onAppReload).not.toBe(wired);
    expect(typeof reloaded.OnLifecycleEvent).toBe('function');
  });

  it('counts the reload so the re-evaluated entry stamps patches the main thread keeps', () => {
    const onAppReload = injectWith(vi.fn());

    lynx.__initData = {};
    const before = getReloadVersion();
    onAppReload({}, {});

    expect(getReloadVersion()).toBe(before + 1);
  });
});
