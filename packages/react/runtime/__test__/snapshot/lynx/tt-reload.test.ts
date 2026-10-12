/*
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getReloadVersion } from '../../../src/core/reload-version.js';
import { reloadBackground } from '../../../src/snapshot/lifecycle/reload.js';
import { injectTt } from '../../../src/snapshot/lynx/tt.js';
import { globalEnvManager } from '../utils/envManager.js';

const entrySupportsReEvalKey = Symbol.for('__LYNX_ENTRY_SUPPORTS_RE_EVAL__');

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  delete (lynx as unknown as Record<symbol, unknown>)[entrySupportsReEvalKey];
  vi.unstubAllGlobals();
  globalEnvManager.resetEnv();
});

describe('tt.onAppReload with experimental entry re-evaluation', () => {
  it('preserves the original receiver and increments reload version once', () => {
    const app = lynx.getApp();
    let receiver: unknown;
    let receivedUpdateData: Record<string, unknown> | undefined;
    app.onAppReload = function(this: unknown, updateData) {
      receiver = this;
      receivedUpdateData = updateData;
    };
    vi.stubGlobal('__EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__', true);

    const reloadVersion = getReloadVersion();
    const updateData = { value: 'reloaded' };
    (lynx as unknown as Record<symbol, unknown>)[entrySupportsReEvalKey] = true;
    injectTt();
    app.onAppReload(updateData);

    expect(receiver).toBe(app);
    expect(receivedUpdateData).toBe(updateData);
    expect(getReloadVersion()).toBe(reloadVersion + 1);
  });

  it('uses the legacy reload for an entry without re-evaluation support', () => {
    const app = lynx.getApp();
    const coreReload = vi.fn();
    app.onAppReload = coreReload;
    vi.stubGlobal('__EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__', true);
    const reloadVersion = getReloadVersion();
    const initData = lynx.__initData;

    injectTt();
    expect(app.onAppReload).toBe(reloadBackground);
    app.onAppReload({ value: 'legacy' });

    expect(coreReload).not.toHaveBeenCalled();
    expect(lynx.__initData).not.toBe(initData);
    expect(lynx.__initData['value']).toBe('legacy');
    expect(getReloadVersion()).toBe(reloadVersion + 1);
  });
});
