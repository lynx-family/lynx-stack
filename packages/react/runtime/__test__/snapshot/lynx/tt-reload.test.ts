/*
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getReloadVersion } from '../../../src/core/reload-version';
import { injectTt } from '../../../src/snapshot/lynx/tt';
import { globalEnvManager } from '../utils/envManager';

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
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
    injectTt();
    app.onAppReload(updateData);

    expect(receiver).toBe(app);
    expect(receivedUpdateData).toBe(updateData);
    expect(getReloadVersion()).toBe(reloadVersion + 1);
  });
});
