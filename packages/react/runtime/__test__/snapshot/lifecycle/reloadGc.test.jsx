/*
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { BasicMT } from './reloadMT';
import { replaceCommitHook } from '../../../src/snapshot/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../../src/snapshot/lifecycle/patch/updateMainThread';
import { __root } from '../../../src/root';
import { setupPage } from '../../../src/snapshot';
import { globalEnvManager } from '../utils/envManager';
import { elementTree } from '../utils/nativeMethod';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));

  replaceCommitHook();
  injectUpdateMainThread();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
  globalEnvManager.switchToMainThread();
  __root.__jsx = BasicMT;
});

afterEach(() => {
  delete globalThis.lepusng_gc;
  globalEnvManager.resetEnv();
  elementTree.clear();
});

describe('gc after the rendered tree is replaced', () => {
  it('runs after reloadTemplate', () => {
    globalThis.lepusng_gc = vi.fn();
    renderPage({ text: 'Hello' });
    expect(globalThis.lepusng_gc).not.toHaveBeenCalled();

    updatePage({ text: 'Enjoy' }, { reloadTemplate: true });
    expect(globalThis.lepusng_gc).toHaveBeenCalledTimes(1);
  });

  it('runs after an update before first-screen sync, not after one that follows it', () => {
    globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'jsReady';
    try {
      globalThis.lepusng_gc = vi.fn();
      renderPage({ text: 'Hello' });

      updatePage({ text: 'Enjoy' });
      expect(globalThis.lepusng_gc).toHaveBeenCalledTimes(1);

      globalThis.rLynxFirstScreenSyncReady();
      updatePage({ text: 'Again' });
      expect(globalThis.lepusng_gc).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'immediately';
    }
  });

  it('is skipped when the engine does not expose it', () => {
    renderPage({ text: 'Hello' });
    expect(() => updatePage({ text: 'Enjoy' }, { reloadTemplate: true })).not.toThrow();
  });
});
