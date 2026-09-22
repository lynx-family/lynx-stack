/*
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/

import { afterEach, describe, expect, it, vi } from 'vitest';

import { BACKGROUND_ENTRY_REEVAL } from '../../../src/core/entry-reloader';
import { reloadBackground } from '../../../src/snapshot/lifecycle/reload';
import { injectTt } from '../../../src/snapshot/lynx/tt';

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
  delete globalThis[BACKGROUND_ENTRY_REEVAL];
  delete lynx.__initData;
});

describe('background reload handover', () => {
  it('re-renders the previous jsx when lynx core cannot reload the card', () => {
    expect(injectWith(undefined)).toBe(reloadBackground);
  });

  it('re-renders the previous jsx when the entry did not ask for a reeval', () => {
    const coreReload = vi.fn();
    const onAppReload = injectWith(coreReload);

    expect(onAppReload).not.toBe(reloadBackground);

    lynx.__initData = {};
    onAppReload({}, {});

    expect(coreReload).not.toHaveBeenCalled();
  });

  it('hands reload to lynx core with the data this app accumulated', () => {
    const coreReload = vi.fn();
    const onAppReload = injectWith(coreReload);

    globalThis[BACKGROUND_ENTRY_REEVAL] = true;
    lynx.__initData = { kept: 1, replaced: 'old' };
    onAppReload({ replaced: 'new' }, { processorName: 'p' });

    expect(coreReload).toHaveBeenCalledTimes(1);
    expect(coreReload.mock.calls[0][0]).toEqual({ kept: 1, replaced: 'new' });
    expect(coreReload.mock.calls[0][1]).toEqual({ processorName: 'p' });
  });
});
