/*
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/

/**
 * Cross-primitive property exploration for the main-thread slot pool.
 *
 * `MainThreadEvent`, `MainThreadInstance` and `useMainThreadEffect` are three
 * write policies over one substrate (id-keyed slots in the main-thread
 * callable pool, patched at commit boundaries). These tests document the
 * semantic differences as executable properties:
 *
 * 1. Freshness: an Event re-synchronizes captured values on every committed
 *    render; an Instance freezes them at first commit; an Effect snapshots
 *    them per deps-triggered run.
 * 2. Ordering: within one commit, ctx updates flush before the patch, effect
 *    runs after the patch, and releases last — so releases observed by a
 *    commit's main-thread tasks (effects included) are deferred past them.
 * 3. Identity: all three share one id space and one main-thread pool.
 */
import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { __root } from '../../../src/root';
import { setupPage } from '../../../src/snapshot';
import { replaceCommitHook } from '../../../src/snapshot/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../../src/snapshot/lifecycle/patch/updateMainThread';
import { injectUpdateMTCallableCtx } from '../../../src/snapshot/worklet/callable/updateCallableCtx';
import { useMainThreadEffect } from '../../../src/snapshot/worklet/callable/mainThreadEffect';
import { useMainThreadEvent } from '../../../src/snapshot/worklet/callable/mainThreadEvent';
import { useMainThreadInstance } from '../../../src/snapshot/worklet/callable/mainThreadInstance';
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

function lepusCalls() {
  return lynx.getNativeApp().callLepusMethod.mock.calls;
}

function callableCallsSince(offset) {
  return lepusCalls().slice(offset).filter(([name]) => name === 'rLynxChangeCallableCtx');
}

describe('slot pool properties', () => {
  it('one id space: event, instance and effect draw from the same pool', () => {
    const Comp = () => {
      useMainThreadEvent({ _wkltId: '835d:event:1' });
      useMainThreadInstance({ _wkltId: '835d:create:1' });
      useMainThreadEffect({ _wkltId: '835d:effect:1' }, []);
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
      const [call] = callableCallsSince(0);
      expect(call[1]).toMatchInlineSnapshot(`
        {
          "data": "[[1,{"_wkltId":"835d:event:1","_execId":1}],[2,{"_wkltId":"835d:create:1","_execId":2}],[3,{"_wkltId":"835d:effect:1","_execId":3}]]",
        }
      `);
    }
  });

  it('freshness matrix: per-commit (event) vs frozen (instance) vs per-run (effect)', async () => {
    let x = 1;
    const Comp = () => {
      useMainThreadEvent({ _wkltId: '835d:event:1', _c: { x } });
      useMainThreadInstance({ _wkltId: '835d:create:1', _c: { x } });
      useMainThreadEffect({ _wkltId: '835d:effect:1', _c: { x } }, []);
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
    }

    // All three primitives observe the same captured value change; only the
    // event re-synchronizes it.
    {
      const offset = lepusCalls().length;
      x = 2;
      render(<Comp />, __root);
      const calls = callableCallsSince(offset);
      expect(calls.length).toBe(1);
      expect(calls[0][1]).toMatchInlineSnapshot(`
        {
          "data": "[[1,{"_wkltId":"835d:event:1","_c":{"x":2},"_execId":4}]]",
        }
      `);
    }
  });

  it('ordering theorem: updates < patch < runs < releases within one commit', async () => {
    let dep = 'a';
    const Comp = ({ show }) => {
      useMainThreadEffect({ _wkltId: '835d:parent-effect:1', _c: { dep } }, [dep]);
      return show ? <Child /> : <view></view>;
    };
    const Child = () => {
      useMainThreadEvent({ _wkltId: '835d:event:1' });
      useMainThreadInstance({ _wkltId: '835d:create:1' });
      return <view></view>;
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
    }

    // One commit carries all four kinds of traffic: the parent effect's ctx
    // update and run (deps changed), the patch, and the child's releases
    // (event and instance unmount).
    {
      const offset = lepusCalls().length;
      dep = 'b';
      render(<Comp show={false} />, __root);
      const names = lepusCalls().slice(offset).map(([name]) => name);
      expect(names).toMatchInlineSnapshot(`
        [
          "rLynxChangeCallableCtx",
          "rLynxChange",
          "rLynxRunCallableCtx",
          "rLynxChangeCallableCtx",
        ]
      `);

      const calls = lepusCalls().slice(offset);
      // Pre-patch: the parent effect's fresh ctx.
      expect(calls[0][1].data).toContain('parent-effect');
      // Post-patch, before releases: the parent effect's run.
      expect(calls[2][1]).toMatchInlineSnapshot(`
        {
          "data": "[1]",
        }
      `);
      // Last: the unmounted child's releases — after the run, so an effect of
      // this commit could still have called them. Releases are LIFO (reverse
      // declaration order): the instance (id 3, declared after the event)
      // tears down first, destructor-style.
      expect(calls[3][1]).toMatchInlineSnapshot(`
        {
          "data": "[[3,null],[2,null]]",
        }
      `);
    }
  });
});
