/*
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getReloadVersion } from '../../../src/core/reload-version.js';
import * as lifecycle from '../../../src/snapshot/lifecycle/destroy.js';
import { reloadBackground } from '../../../src/snapshot/lifecycle/reload.js';
import { injectTt } from '../../../src/snapshot/lynx/tt.js';
import { globalEnvManager } from '../utils/envManager.js';

const entrySupportsReEvalKey = Symbol.for('__LYNX_ENTRY_SUPPORTS_RE_EVAL__');

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  delete (lynx as unknown as Record<symbol, unknown>)[entrySupportsReEvalKey];
  vi.restoreAllMocks();
  Reflect.deleteProperty(lynx.getApp(), 'reloadCard');
  vi.unstubAllGlobals();
  globalEnvManager.resetEnv();
});

describe('tt.onAppReload with experimental entry re-evaluation', () => {
  it('destroys the previous lifetime and forwards reload arguments', () => {
    const app = lynx.getApp();
    let receiver: unknown;
    let receivedUpdateData: Record<string, unknown> | undefined;
    let receivedOptions: Record<string, unknown> | undefined;
    const cleanup = vi.spyOn(lifecycle, 'destroyBackground').mockImplementation(() => {});
    Object.assign(app, {
      reloadCard: function(this: unknown, updateData: Record<string, unknown>, options?: Record<string, unknown>) {
        receiver = this;
        receivedUpdateData = updateData;
        receivedOptions = options;
        return true;
      },
    });
    vi.stubGlobal('__EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__', true);

    const reloadVersion = getReloadVersion();
    const updateData = { value: 'reloaded' };
    const options = { processorName: 'custom' };
    (lynx as unknown as Record<symbol, unknown>)[entrySupportsReEvalKey] = true;
    injectTt();
    app.onAppReload(updateData, options);

    expect(cleanup).toHaveBeenCalledOnce();
    expect(receiver).toBe(app);
    expect(receivedUpdateData).toBe(updateData);
    expect(receivedOptions).toBe(options);
    expect(getReloadVersion()).toBe(reloadVersion + 1);
  });

  it('uses the legacy reload when the core API is unavailable', () => {
    const app = lynx.getApp();
    vi.stubGlobal('__EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__', true);
    (lynx as unknown as Record<symbol, unknown>)[entrySupportsReEvalKey] = true;
    injectTt();
    expect(app.onAppReload).toBe(reloadBackground);
  });

  it('uses the legacy reload when the experiment is disabled', () => {
    const app = lynx.getApp();
    app.reloadCard = vi.fn();
    vi.stubGlobal('__EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__', false);
    (lynx as unknown as Record<symbol, unknown>)[entrySupportsReEvalKey] = true;
    injectTt();
    expect(app.onAppReload).toBe(reloadBackground);
    expect(app.reloadCard).not.toHaveBeenCalled();
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
