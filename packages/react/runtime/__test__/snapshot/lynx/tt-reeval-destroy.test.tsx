// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NodesRef } from '@lynx-js/types';

import { root, useEffect } from '../../../src/index.js';
import { __root } from '../../../src/root.js';
import { removeCommitHookForTesting, replaceCommitHook } from '../../../src/snapshot/lifecycle/patch/commit.js';
import { shouldDelayUiOps } from '../../../src/snapshot/lifecycle/ref/delay.js';
import { injectTt } from '../../../src/snapshot/lynx/tt.js';
import { globalEnvManager } from '../utils/envManager.js';
import { waitSchedule } from '../utils/nativeMethod.js';

beforeEach(() => {
  globalEnvManager.resetEnv();
  globalEnvManager.switchToBackground();
  lynx.__globalProps = {};
  replaceCommitHook();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  globalEnvManager.resetEnv();
  removeCommitHookForTesting();
});

describe('background teardown on experimental entry re-evaluation', () => {
  it('does not remount the destroyed entry from a queued global props update', async () => {
    vi.stubGlobal('__EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__', true);
    vi.stubGlobal('__GLOBAL_PROPS_MODE__', undefined);
    shouldDelayUiOps.value = false;
    const createSelectorQuery = vi.spyOn(lynx, 'createSelectorQuery');
    const ref = vi.fn((node: NodesRef | null) => {
      node?.invoke({ method: 'boundingClientRect' }).exec();
    });
    const mount = vi.fn();
    const unmount = vi.fn();
    function App() {
      useEffect(() => {
        mount();
        return unmount;
      }, []);
      return <view ref={ref} />;
    }
    root.render(<App />);
    await waitSchedule();
    const oldRoot = __root;
    expect(oldRoot.childNodes).toHaveLength(1);
    expect(ref).toHaveBeenCalledOnce();
    expect(createSelectorQuery).toHaveBeenCalledOnce();
    expect(mount).toHaveBeenCalledOnce();
    injectTt();

    const app = lynx.getApp();
    app.updateGlobalProps({ theme: 'dark' });
    app.callDestroyLifetimeFun();
    expect(ref).toHaveBeenLastCalledWith(null);
    expect(unmount).toHaveBeenCalledOnce();
    ref.mockClear();
    createSelectorQuery.mockClear();
    await waitSchedule();

    expect(oldRoot.__jsx).toBeUndefined();
    expect(oldRoot.childNodes).toHaveLength(0);
    expect(ref).not.toHaveBeenCalled();
    expect(createSelectorQuery).not.toHaveBeenCalled();
    expect(mount).toHaveBeenCalledOnce();
    expect(unmount).toHaveBeenCalledOnce();
  });

  it.each([false, undefined])('preserves stored JSX when re-evaluation is %s', (enabled) => {
    vi.stubGlobal('__EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__', enabled);
    root.render(<view />);
    const jsx = __root.__jsx;
    injectTt();

    lynx.getApp().callDestroyLifetimeFun();

    expect(__root.__jsx).toBe(jsx);
    expect(__root.childNodes).toHaveLength(0);
  });
});
