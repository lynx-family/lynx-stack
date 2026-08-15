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
import {
  MainThreadCallable,
  useMainThreadCallable,
  useMainThreadCallables,
} from '../../../src/snapshot/worklet/callable/mainThreadCallable';
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

describe('MainThreadCallable in js', () => {
  it('to json', () => {
    globalEnvManager.switchToBackground();
    const callable = new MainThreadCallable({ _wkltId: '835d:test:1' });
    expect(JSON.stringify(callable)).toMatchInlineSnapshot(`"{"_wcid":1}"`);
  });

  it('should release when main thread agrees', () => {
    globalEnvManager.switchToBackground();
    const callable = new MainThreadCallable({ _wkltId: '835d:test:1' });
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

  it('should send ctx to the main thread and update it on rerender', () => {
    let x = 1;
    const Comp = () => {
      useMainThreadCallable({ _wkltId: '835d:test:1', _c: { x } });
      return <view></view>;
    };

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
    }

    // hydrate
    {
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      globalEnvManager.switchToMainThread();
      const callableCalls = takeCallableLepusCalls();
      expect(callableCalls).toMatchInlineSnapshot(`
        [
          [
            "rLynxChangeCallableCtx",
            {
              "data": "[[1,{"_wkltId":"835d:test:1","_c":{"x":1},"_execId":1}]]",
            },
          ],
        ]
      `);
      globalThis[callableCalls[0][0]](callableCalls[0][1]);
      expect(globalThis.lynxWorkletImpl._callableImpl.updateCallableCtxChanges.mock.calls)
        .toMatchInlineSnapshot(`
          [
            [
              [
                [
                  1,
                  {
                    "_c": {
                      "x": 1,
                    },
                    "_execId": 1,
                    "_wkltId": "835d:test:1",
                  },
                ],
              ],
            ],
          ]
        `);
    }

    // rerender with unchanged captured values: no new patch
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
      expect(takeCallableLepusCalls().length).toBe(1);
    }

    // rerender with changed captured values: a new patch
    {
      x = 2;
      render(<Comp />, __root);
      const callableCalls = takeCallableLepusCalls();
      expect(callableCalls.length).toBe(2);
      expect(callableCalls[1][1]).toMatchInlineSnapshot(`
        {
          "data": "[[1,{"_wkltId":"835d:test:1","_c":{"x":2},"_execId":2}]]",
        }
      `);
    }
  });

  it('should release the callable on unmount', async () => {
    const Comp = ({ show }) => {
      return show ? <Child /> : <view></view>;
    };
    const Child = () => {
      useMainThreadCallable({ _wkltId: '835d:test:1' });
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
      // The release must be flushed after the unmounting commit's patch so
      // main-thread tasks of that commit can still call the callable.
      const callNames = lynx.getNativeApp().callLepusMethod.mock.calls.map(([name]) => name);
      expect(callNames.lastIndexOf('rLynxChangeCallableCtx')).toBeGreaterThan(
        callNames.lastIndexOf('rLynxChange'),
      );
    }
  });

  it('should return null and report for a plain function', () => {
    const reportError = vi.spyOn(lynx, 'reportError');
    let result;
    const Comp = () => {
      result = useMainThreadCallable(function myEasing() {});
      return <view></view>;
    };

    globalEnvManager.switchToBackground();
    render(<Comp />, __root);
    expect(result).toBe(null);
    expect(reportError.mock.calls[0][0].message).toMatchInlineSnapshot(
      `"useMainThreadCallable: expected a main-thread function but received function myEasing. Did you forget to add a "main thread" directive?"`,
    );
  });

  it('should report for a non-function value', () => {
    const reportError = vi.spyOn(lynx, 'reportError');
    let result;
    const Comp = () => {
      result = useMainThreadCallable(42);
      return <view></view>;
    };

    globalEnvManager.switchToBackground();
    render(<Comp />, __root);
    expect(result).toBe(null);
    expect(reportError.mock.calls[0][0].message).toContain(
      'useMainThreadCallable: expected a main-thread function but received 42.',
    );
  });

  it('should report for an anonymous plain function', () => {
    const reportError = vi.spyOn(lynx, 'reportError');
    const anonymous = function() {};
    Object.defineProperty(anonymous, 'name', { value: '' });
    const Comp = () => {
      useMainThreadCallable(anonymous);
      return <view></view>;
    };

    globalEnvManager.switchToBackground();
    render(<Comp />, __root);
    expect(reportError.mock.calls[0][0].message).toContain(
      'useMainThreadCallable: expected a main-thread function but received function (anonymous).',
    );
  });

  it('should not stage a release when the sdk version is too low', () => {
    SystemInfo.lynxSdkVersion = '2.13';
    globalEnvManager.switchToBackground();
    const callable = new MainThreadCallable({ _wkltId: '835d:test:1' });
    callable.release();
    expect(takeCallableReleasePatch()).toEqual([]);
  });

  it('should not stage anything when the sdk version is too low', () => {
    SystemInfo.lynxSdkVersion = '2.13';
    const Comp = () => {
      useMainThreadCallable({ _wkltId: '835d:test:1' });
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

  it('should ignore updates after release and tolerate double release', () => {
    globalEnvManager.switchToBackground();
    const callable = new MainThreadCallable({ _wkltId: '835d:test:1' });
    callable.release();
    callable.release();
    callable._update({ _wkltId: '835d:test:1', _c: { x: 1 } });
    callable._clear();
    expect(takeCallableReleasePatch()).toMatchInlineSnapshot(`
      [
        [
          1,
          null,
        ],
      ]
    `);
  });

  it('should clear and re-stage when fn toggles between a function and null', () => {
    let fn = { _wkltId: '835d:test:1' };
    let result;
    const Comp = () => {
      result = useMainThreadCallable(fn);
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
      expect(result).toBeInstanceOf(MainThreadCallable);
      expect(takeCallableLepusCalls().length).toBe(1);
    }

    // fn becomes null: the ctx is released while the handle is kept.
    {
      fn = null;
      render(<Comp />, __root);
      expect(result).toBe(null);
      const callableCalls = takeCallableLepusCalls();
      expect(callableCalls.length).toBe(2);
      expect(callableCalls[1][1]).toMatchInlineSnapshot(`
        {
          "data": "[[1,null]]",
        }
      `);
      // A second null render stages nothing new.
      render(<Comp />, __root);
      expect(takeCallableLepusCalls().length).toBe(2);
    }

    // fn is provided again: the same handle is re-staged.
    {
      fn = { _wkltId: '835d:test:1' };
      render(<Comp />, __root);
      expect(result).toBeInstanceOf(MainThreadCallable);
      const callableCalls = takeCallableLepusCalls();
      expect(callableCalls.length).toBe(3);
      expect(callableCalls[2][1]).toMatchInlineSnapshot(`
        {
          "data": "[[1,{"_wkltId":"835d:test:1","_execId":2}]]",
        }
      `);
    }
  });

  it('should always re-push a ctx carrying background function handles', () => {
    const fnWithJsFn = () => ({
      _wkltId: '835d:test:1',
      _jsFn: { _jsFn1: { _jsFnId: 1 } },
    });
    const Comp = () => {
      useMainThreadCallable(fnWithJsFn());
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
      expect(takeCallableLepusCalls().length).toBe(1);
    }

    // JSON-identical, but `_jsFn` handles force a re-push.
    {
      render(<Comp />, __root);
      expect(takeCallableLepusCalls().length).toBe(2);
    }
  });

  it('should not crash on unmount when fn was always null', async () => {
    const Child = () => {
      useMainThreadCallable(null);
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

  it('should return null for null and undefined', () => {
    let results;
    const Comp = () => {
      results = [useMainThreadCallable(null), useMainThreadCallable(undefined)];
      return <view></view>;
    };

    globalEnvManager.switchToBackground();
    render(<Comp />, __root);
    expect(results).toEqual([null, null]);
    expect(takeCallableLepusCalls().length).toBe(0);
  });
});

describe('useMainThreadCallables in js', () => {
  it('should transport nested functions and keep slot identity across rerenders', () => {
    let duration = 0.8;
    let results = [];
    const Comp = () => {
      const transition = useMainThreadCallables({
        duration,
        ease: [
          { _wkltId: '835d:test:1', _c: { tag: 'first' } },
          { _wkltId: '835d:test:2', _c: { tag: 'second' } },
        ],
      });
      results.push(transition);
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
    }

    const transition = results.at(-1);
    expect(transition.duration).toBe(0.8);
    expect(transition.ease[0]).toBeInstanceOf(MainThreadCallable);
    expect(transition.ease[1]).toBeInstanceOf(MainThreadCallable);
    expect(JSON.stringify(transition)).toMatchInlineSnapshot(
      `"{"duration":0.8,"ease":[{"_wcid":1},{"_wcid":2}]}"`,
    );

    const callableCalls = takeCallableLepusCalls();
    expect(callableCalls.length).toBe(1);
    expect(callableCalls[0][1]).toMatchInlineSnapshot(`
      {
        "data": "[[1,{"_wkltId":"835d:test:1","_c":{"tag":"first"},"_execId":1}],[2,{"_wkltId":"835d:test:2","_c":{"tag":"second"},"_execId":2}]]",
      }
    `);

    // Rerender: the same structural slots keep the same callable identity.
    {
      duration = 1.2;
      render(<Comp />, __root);
      const next = results.at(-1);
      expect(next.duration).toBe(1.2);
      expect(next.ease[0]).toBe(transition.ease[0]);
      expect(next.ease[1]).toBe(transition.ease[1]);
      // Unchanged captured values push nothing new.
      expect(takeCallableLepusCalls().length).toBe(1);
    }
  });

  it('should release slots that disappear and all slots on unmount', async () => {
    let withSecond = true;
    const Child = () => {
      useMainThreadCallables({
        ease: withSecond
          ? [{ _wkltId: '835d:test:1' }, { _wkltId: '835d:test:2' }]
          : [{ _wkltId: '835d:test:1' }],
      });
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
      expect(takeCallableLepusCalls().at(-1)[1]).toMatchInlineSnapshot(`
        {
          "data": "[[1,{"_wkltId":"835d:test:1","_execId":1}],[2,{"_wkltId":"835d:test:2","_execId":2}]]",
        }
      `);
    }

    // Dropping a slot releases its callable.
    {
      withSecond = false;
      render(<Comp show={true} />, __root);
      expect(takeCallableLepusCalls().at(-1)[1]).toMatchInlineSnapshot(`
        {
          "data": "[[2,null]]",
        }
      `);
    }

    // Unmount releases the remaining slots.
    {
      render(<Comp show={false} />, __root);
      expect(takeCallableLepusCalls().at(-1)[1]).toMatchInlineSnapshot(`
        {
          "data": "[[1,null]]",
        }
      `);
    }
  });

  it('should pass through existing handles and unchanged arrays', () => {
    let results = [];
    const Comp = () => {
      const handle = useMainThreadCallable({ _wkltId: '835d:test:1' });
      const value = { ease: [handle], tags: ['a', 'b'] };
      results.push([value, useMainThreadCallables(value)]);
      return <view></view>;
    };

    globalEnvManager.switchToBackground();
    render(<Comp />, __root);
    const [input, output] = results.at(-1);
    expect(output).toBe(input);
    expect(output.ease[0]).toBeInstanceOf(MainThreadCallable);
    expect(output.tags).toBe(input.tags);
  });

  it('should throw when the value is too deep', () => {
    let deep = { _leaf: true };
    for (let i = 0; i < 1001; i++) {
      deep = { next: deep };
    }
    const Comp = () => {
      useMainThreadCallables(deep);
      return <view></view>;
    };

    globalEnvManager.switchToBackground();
    expect(() => render(<Comp />, __root)).toThrowError(
      'useMainThreadCallables: depth of value exceeds limit of 1000.',
    );
  });

  it('should return the value as-is when it contains no main-thread functions', () => {
    let results = [];
    const Comp = () => {
      const value = { duration: 0.8, ease: 'easeOut' };
      results.push([value, useMainThreadCallables(value)]);
      return <view></view>;
    };

    globalEnvManager.switchToBackground();
    render(<Comp />, __root);
    const [input, output] = results.at(-1);
    expect(output).toBe(input);
    expect(takeCallableLepusCalls().length).toBe(0);
  });

  it('should pass through class instances and report plain functions', () => {
    const reportError = vi.spyOn(lynx, 'reportError');
    class Opaque {}
    const opaque = new Opaque();
    let result;
    const Comp = () => {
      result = useMainThreadCallables({
        opaque,
        bad: function notAWorklet() {},
      });
      return <view></view>;
    };

    globalEnvManager.switchToBackground();
    render(<Comp />, __root);
    expect(result.opaque).toBe(opaque);
    expect(typeof result.bad).toBe('function');
    expect(reportError.mock.calls[0][0].message).toContain(
      'useMainThreadCallables: expected a main-thread function but received function notAWorklet.',
    );
  });
});
