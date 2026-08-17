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
import { takeCallableReleasePatch } from '../../../src/snapshot/worklet/callable/callablePool';
import { injectUpdateMTCallableCtx } from '../../../src/snapshot/worklet/callable/updateCallableCtx';
import { MainThreadInstance, useMainThreadInstance } from '../../../src/snapshot/worklet/callable/mainThreadInstance';
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

function takeCallableLepusCalls() {
  const calls = lynx.getNativeApp().callLepusMethod.mock.calls;
  return calls.filter(([name]) => name === 'rLynxChangeCallableCtx');
}

describe('MainThreadInstance in js', () => {
  it('to json', () => {
    globalEnvManager.switchToBackground();
    const instance = new MainThreadInstance({ _wkltId: '835d:test:1' });
    expect(JSON.stringify(instance)).toMatchInlineSnapshot(`"{"_wiid":1}"`);
  });

  it('should release when main thread agrees', () => {
    globalEnvManager.switchToBackground();
    const instance = new MainThreadInstance({ _wkltId: '835d:test:1' });
    lynx.getNativeApp().createJSObjectDestructionObserver.mock.calls[0][0]();
    expect(lynx.getCoreContext().dispatchEvent.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "data": {
              "id": 1,
            },
            "type": "Lynx.Worklet.releaseMainThreadCallable",
          },
        ],
      ]
    `);
  });

  it('should send the create ctx once and never re-synchronize it', () => {
    let x = 1;
    const Comp = () => {
      useMainThreadInstance(
        { _wkltId: '835d:create:1', _c: { x } },
        { _wkltId: '835d:dispose:1', _c: { x } },
      );
      return <view></view>;
    };

    // main thread render (covers the first-screen constructor branch)
    {
      __root.__jsx = <Comp />;
      renderPage();
      expect(globalThis.lynxWorkletImpl._callableImpl.registerFirstScreenCallableCtx.mock.calls)
        .toMatchInlineSnapshot(`
          [
            [
              -1,
              {
                "_c": {
                  "x": 1,
                },
                "_instDispose": {
                  "_c": {
                    "x": 1,
                  },
                  "_wkltId": "835d:dispose:1",
                },
                "_wkltId": "835d:create:1",
              },
            ],
          ]
        `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
    }

    // hydrate: the bundled create + dispose ctx is pushed once
    {
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalEnvManager.switchToMainThread();
      const callableCalls = takeCallableLepusCalls();
      expect(callableCalls).toMatchInlineSnapshot(`
        [
          [
            "rLynxChangeCallableCtx",
            {
              "data": "[[1,{"_wkltId":"835d:create:1","_c":{"x":1},"_execId":2,"_instDispose":{"_wkltId":"835d:dispose:1","_c":{"x":1},"_execId":1}}]]",
            },
          ],
        ]
      `);
    }

    // rerender with changed captured values: instances are frozen at first
    // commit — nothing new is pushed (unlike MainThreadEvent).
    {
      globalEnvManager.switchToBackground();
      x = 2;
      render(<Comp />, __root);
      expect(takeCallableLepusCalls().length).toBe(1);
    }
  });

  it('should release the instance on unmount, after the patch', async () => {
    const Comp = ({ show }) => {
      return show ? <Child /> : <view></view>;
    };
    const Child = () => {
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
      expect(takeCallableLepusCalls().length).toBe(1);
    }

    {
      render(<Comp show={false} />, __root);
      const callableCalls = takeCallableLepusCalls();
      expect(callableCalls.length).toBe(2);
      expect(callableCalls[1][1]).toMatchInlineSnapshot(`
        {
          "data": "[[1,null]]",
        }
      `);
      // The release (and therefore the dispose) must be flushed after the
      // unmounting commit's patch so main-thread tasks of that commit can
      // still use the instance.
      const callNames = lynx.getNativeApp().callLepusMethod.mock.calls.map(([name]) => name);
      expect(callNames.lastIndexOf('rLynxChangeCallableCtx')).toBeGreaterThan(
        callNames.lastIndexOf('rLynxChange'),
      );
    }
  });

  it('should bind on the first render that provides create and stay stable', () => {
    let create = null;
    let results = [];
    const Comp = () => {
      results.push(useMainThreadInstance(create));
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
      expect(results.at(-1)).toBe(null);
      expect(takeCallableLepusCalls().length).toBe(0);
    }

    // The first non-null create binds the instance.
    {
      create = { _wkltId: '835d:create:1' };
      render(<Comp />, __root);
      expect(results.at(-1)).toBeInstanceOf(MainThreadInstance);
      expect(takeCallableLepusCalls().length).toBe(1);
    }

    // Later null renders keep the bound handle: the instance is create-once.
    {
      const bound = results.at(-1);
      create = null;
      render(<Comp />, __root);
      expect(results.at(-1)).toBe(bound);
      expect(takeCallableLepusCalls().length).toBe(1);
    }
  });

  it('should report and return null for a plain create function', () => {
    const reportError = vi.spyOn(lynx, 'reportError');
    let result;
    const Comp = () => {
      result = useMainThreadInstance(function myCreate() {});
      return <view></view>;
    };

    globalEnvManager.switchToBackground();
    render(<Comp />, __root);
    expect(result).toBe(null);
    expect(reportError.mock.calls[0][0].message).toMatchInlineSnapshot(
      `"useMainThreadInstance: expected a main-thread function but received function myCreate. Did you forget to add a "main thread" directive?"`,
    );
  });

  it('should report and drop a plain dispose function but keep create', () => {
    const reportError = vi.spyOn(lynx, 'reportError');
    let result;
    const Comp = () => {
      result = useMainThreadInstance(
        { _wkltId: '835d:create:1' },
        function myDispose() {},
      );
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
      expect(result).toBeInstanceOf(MainThreadInstance);
      expect(reportError.mock.calls[0][0].message).toContain(
        'useMainThreadInstance: expected a main-thread function but received function myDispose.',
      );
      const callableCalls = takeCallableLepusCalls();
      expect(callableCalls[0][1].data).not.toContain('_instDispose');
    }
  });

  it('should not stage anything when the sdk version is too low', () => {
    SystemInfo.lynxSdkVersion = '2.13';
    const Comp = () => {
      useMainThreadInstance({ _wkltId: '835d:create:1' }, { _wkltId: '835d:dispose:1' });
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
      expect(takeCallableLepusCalls().length).toBe(0);
    }
  });

  it('should tolerate double release', () => {
    globalEnvManager.switchToBackground();
    const instance = new MainThreadInstance({ _wkltId: '835d:create:1' });
    instance.release();
    instance.release();
    expect(takeCallableReleasePatch()).toMatchInlineSnapshot(`
      [
        [
          1,
          null,
        ],
      ]
    `);
  });

  it('should not crash on unmount when create was always null', async () => {
    const Child = () => {
      useMainThreadInstance(null);
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
      expect(takeCallableLepusCalls().length).toBe(0);
    }
  });

  it('should register a first-screen ctx without dispose', () => {
    const Comp = () => {
      useMainThreadInstance({ _wkltId: '835d:create:1' });
      return <view></view>;
    };

    __root.__jsx = <Comp />;
    renderPage();
    const calls = globalThis.lynxWorkletImpl._callableImpl.registerFirstScreenCallableCtx.mock.calls;
    expect(calls.length).toBe(1);
    expect(calls[0][1]._instDispose).toBe(undefined);
  });
});
