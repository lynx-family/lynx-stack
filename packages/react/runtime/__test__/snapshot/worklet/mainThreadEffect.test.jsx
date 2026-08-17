/*
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { __root } from '../../../src/root';
import { setupPage } from '../../../src/snapshot';
import { replaceCommitHook } from '../../../src/snapshot/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../../src/snapshot/lifecycle/patch/updateMainThread';
import {
  addCallableCtxPatch,
  addCallableRunPatch,
  takeCallableRunPatch,
} from '../../../src/snapshot/worklet/callable/callablePool';
import { injectUpdateMTCallableCtx } from '../../../src/snapshot/worklet/callable/updateCallableCtx';
import { useMainThreadEffect } from '../../../src/snapshot/worklet/callable/mainThreadEffect';
import { destroyWorklet } from '../../../src/snapshot/worklet/destroy';
import { clearConfigCacheForTesting } from '../../../src/snapshot/worklet/functionality';
import { globalEnvManager } from '../utils/envManager';
import { waitSchedule } from '../utils/nativeMethod';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  injectUpdateMainThread();
  injectUpdateMTCallableCtx();
  replaceCommitHook();
  globalThis.lynxWorkletImpl = {
    _refImpl: {
      updateWorkletRef: vi.fn(),
      updateWorkletRefInitValueChanges: vi.fn(),
      clearFirstScreenWorkletRefMap: vi.fn(),
    },
    _callableImpl: {
      updateCallableCtxChanges: vi.fn(),
      runCallableCtxs: vi.fn(),
      registerFirstScreenCallableCtx: vi.fn(),
      clearFirstScreenCallableCtxMap: vi.fn(),
    },
    _runOnBackgroundDelayImpl: {
      runDelayedBackgroundFunctions: vi.fn(),
    },
    _eventDelayImpl: {
      clearDelayedWorklets: vi.fn(),
    },
  };
});

beforeEach(() => {
  globalEnvManager.resetEnv();
  SystemInfo.lynxSdkVersion = '999.999';
  clearConfigCacheForTesting();
});

afterEach(() => {
  destroyWorklet();
  vi.clearAllMocks();
});

function lepusCallNames() {
  return lynx.getNativeApp().callLepusMethod.mock.calls.map(([name]) => name);
}

function takeCtxLepusCalls() {
  return lynx.getNativeApp().callLepusMethod.mock.calls.filter(([name]) => name === 'rLynxChangeCallableCtx');
}

function takeRunLepusCalls() {
  return lynx.getNativeApp().callLepusMethod.mock.calls.filter(([name]) => name === 'rLynxRunCallableCtx');
}

describe('useMainThreadEffect in js', () => {
  it('should install the ctx before the patch and run it after the patch', () => {
    const Comp = () => {
      useMainThreadEffect({ _wkltId: '835d:effect:1', _c: { x: 1 } });
      return <view></view>;
    };

    // main thread render: effects do not run during first-screen rendering
    {
      __root.__jsx = <Comp />;
      renderPage();
      expect(globalThis.lynxWorkletImpl._callableImpl.registerFirstScreenCallableCtx.mock.calls.length).toBe(0);
    }

    // background render + hydrate
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalEnvManager.switchToMainThread();

      const ctxCalls = takeCtxLepusCalls();
      expect(ctxCalls).toMatchInlineSnapshot(`
        [
          [
            "rLynxChangeCallableCtx",
            {
              "data": "[[1,{"_wkltId":"835d:effect:1","_c":{"x":1},"_execId":1}]]",
            },
          ],
        ]
      `);
      const runCalls = takeRunLepusCalls();
      expect(runCalls).toMatchInlineSnapshot(`
        [
          [
            "rLynxRunCallableCtx",
            {
              "data": "[1]",
            },
          ],
        ]
      `);

      // The ordering theorem: ctx update < patch < run.
      const names = lepusCallNames();
      expect(names.indexOf('rLynxChangeCallableCtx')).toBeLessThan(names.indexOf('rLynxChange'));
      expect(names.indexOf('rLynxChange')).toBeLessThan(names.indexOf('rLynxRunCallableCtx'));

      // Delivering the run message reaches the main-thread impl.
      globalThis[runCalls[0][0]](runCalls[0][1]);
      expect(globalThis.lynxWorkletImpl._callableImpl.runCallableCtxs.mock.calls).toEqual([[[1]]]);
    }
  });

  it('should re-run only when deps change and snapshot captures per run', async () => {
    let x = 1;
    let dep = 'a';
    const Comp = () => {
      useMainThreadEffect({ _wkltId: '835d:effect:1', _c: { x } }, [dep]);
      return <view></view>;
    };

    {
      __root.__jsx = <Comp />;
      renderPage();
    }

    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      await waitSchedule();
      expect(takeCtxLepusCalls().length).toBe(1);
      expect(takeRunLepusCalls().length).toBe(1);
    }

    // Captured values change but deps do not: the effect neither re-installs
    // nor re-runs — its captures are a snapshot of the render that ran it.
    {
      x = 2;
      render(<Comp />, __root);
      expect(takeCtxLepusCalls().length).toBe(1);
      expect(takeRunLepusCalls().length).toBe(1);
    }

    // Deps change: fresh ctx (with the current captures) plus a new run.
    {
      dep = 'b';
      x = 3;
      render(<Comp />, __root);
      expect(takeCtxLepusCalls().length).toBe(2);
      expect(takeCtxLepusCalls().at(-1)[1]).toMatchInlineSnapshot(`
        {
          "data": "[[1,{"_wkltId":"835d:effect:1","_c":{"x":3},"_execId":2}]]",
        }
      `);
      expect(takeRunLepusCalls().length).toBe(2);
    }
  });

  it('should run on every committed render when deps are omitted', async () => {
    let x = 1;
    const Comp = () => {
      useMainThreadEffect({ _wkltId: '835d:effect:1', _c: { x } });
      return <view></view>;
    };

    {
      __root.__jsx = <Comp />;
      renderPage();
    }

    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      await waitSchedule();
      expect(takeRunLepusCalls().length).toBe(1);
    }

    {
      x = 2;
      render(<Comp />, __root);
      expect(takeRunLepusCalls().length).toBe(2);
    }
  });

  it('should run exactly once with empty deps', async () => {
    const Comp = ({ n }) => {
      useMainThreadEffect({ _wkltId: '835d:effect:1', _c: { n } }, []);
      return <view></view>;
    };

    {
      __root.__jsx = <Comp n={1} />;
      renderPage();
    }

    {
      globalEnvManager.switchToBackground();
      render(<Comp n={1} />, __root);
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      await waitSchedule();
      render(<Comp n={2} />, __root);
      expect(takeCtxLepusCalls().length).toBe(1);
      expect(takeRunLepusCalls().length).toBe(1);
    }
  });

  it('should release after the patch on unmount', async () => {
    const Child = () => {
      useMainThreadEffect({ _wkltId: '835d:effect:1' }, []);
      return <view></view>;
    };
    const Comp = ({ show }) => {
      return show ? <Child /> : <view></view>;
    };

    {
      __root.__jsx = <Comp show={true} />;
      renderPage();
    }

    {
      globalEnvManager.switchToBackground();
      render(<Comp show={true} />, __root);
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      await waitSchedule();
      expect(takeCtxLepusCalls().length).toBe(1);
    }

    {
      render(<Comp show={false} />, __root);
      const ctxCalls = takeCtxLepusCalls();
      expect(ctxCalls.length).toBe(2);
      expect(ctxCalls[1][1]).toMatchInlineSnapshot(`
        {
          "data": "[[1,null]]",
        }
      `);
      // The release (which runs the pending cleanup on the main thread) is
      // flushed after the unmounting commit's patch.
      const names = lepusCallNames();
      expect(names.lastIndexOf('rLynxChangeCallableCtx')).toBeGreaterThan(
        names.lastIndexOf('rLynxChange'),
      );
    }
  });

  it('should cancel a pending run when the same id is released', () => {
    globalEnvManager.switchToBackground();
    addCallableCtxPatch(1, { _wkltId: '835d:effect:1' });
    addCallableRunPatch(1);
    addCallableRunPatch(2);
    // Releasing id 1 cancels its scheduled run; id 2 is unaffected.
    addCallableCtxPatch(1, null);
    expect(takeCallableRunPatch()).toEqual([2]);
  });

  it('should re-run when deps appear or change length', async () => {
    let deps = undefined;
    const Comp = () => {
      useMainThreadEffect({ _wkltId: '835d:effect:1' }, deps);
      return <view></view>;
    };

    {
      __root.__jsx = <Comp />;
      renderPage();
    }

    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      await waitSchedule();
      expect(takeRunLepusCalls().length).toBe(1);
    }

    // deps appear after a deps-less run: the effect re-runs.
    {
      deps = ['a'];
      render(<Comp />, __root);
      expect(takeRunLepusCalls().length).toBe(2);
    }

    // A deps array of a different length re-runs.
    {
      deps = ['a', 'b'];
      render(<Comp />, __root);
      expect(takeRunLepusCalls().length).toBe(3);
    }

    // Same deps: no re-run.
    {
      deps = ['a', 'b'];
      render(<Comp />, __root);
      expect(takeRunLepusCalls().length).toBe(3);
    }
  });

  it('should not stage run requests when the sdk version is too low', () => {
    SystemInfo.lynxSdkVersion = '2.13';
    globalEnvManager.switchToBackground();
    addCallableRunPatch(1);
    expect(takeCallableRunPatch()).toEqual([]);
  });

  it('should report and stage nothing for a plain function', () => {
    const reportError = vi.spyOn(lynx, 'reportError');
    const Comp = () => {
      useMainThreadEffect(function myEffect() {});
      return <view></view>;
    };

    globalEnvManager.switchToBackground();
    render(<Comp />, __root);
    expect(reportError.mock.calls[0][0].message).toMatchInlineSnapshot(
      `"useMainThreadEffect: expected a main-thread function but received function myEffect. Did you forget to add a "main thread" directive?"`,
    );
    expect(takeCtxLepusCalls().length).toBe(0);
    expect(takeRunLepusCalls().length).toBe(0);
  });

  it('should not stage anything when the sdk version is too low', () => {
    SystemInfo.lynxSdkVersion = '2.13';
    const Comp = () => {
      useMainThreadEffect({ _wkltId: '835d:effect:1' });
      return <view></view>;
    };

    {
      __root.__jsx = <Comp />;
      renderPage();
    }

    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      expect(takeCtxLepusCalls().length).toBe(0);
      expect(takeRunLepusCalls().length).toBe(0);
    }
  });

  it('should not crash on unmount when fn was always null', async () => {
    const Child = () => {
      useMainThreadEffect(null);
      return <view></view>;
    };
    const Comp = ({ show }) => {
      return show ? <Child /> : <view></view>;
    };

    {
      __root.__jsx = <Comp show={true} />;
      renderPage();
    }

    {
      globalEnvManager.switchToBackground();
      render(<Comp show={true} />, __root);
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      await waitSchedule();
      render(<Comp show={false} />, __root);
      expect(takeCtxLepusCalls().length).toBe(0);
    }
  });

  it('should re-arm when fn toggles from null to a function', async () => {
    let fn = null;
    const Comp = () => {
      useMainThreadEffect(fn, []);
      return <view></view>;
    };

    {
      __root.__jsx = <Comp />;
      renderPage();
    }

    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      await waitSchedule();
      expect(takeRunLepusCalls().length).toBe(0);
    }

    {
      fn = { _wkltId: '835d:effect:1' };
      render(<Comp />, __root);
      expect(takeCtxLepusCalls().length).toBe(1);
      expect(takeRunLepusCalls().length).toBe(1);
    }
  });
});
