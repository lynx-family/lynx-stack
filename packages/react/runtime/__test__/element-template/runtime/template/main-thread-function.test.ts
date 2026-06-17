// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkletEvents } from '@lynx-js/react/worklet-runtime/bindings';
import { options } from 'preact';
import { createElement } from 'preact/compat';
import { useLayoutEffect, useState } from 'preact/hooks';

import { root, runOnMainThread } from '@lynx-js/react/element-template';
import {
  markElementTemplateHydrated,
  resetElementTemplateCommitState,
} from '../../../../src/element-template/background/commit-hook.js';
import { destroyElementTemplateBackgroundRuntime } from '../../../../src/element-template/background/destroy.js';
import { takeDelayedRunOnMainThreadData } from '../../../../src/core/thread-function-call/main-thread.js';
import { resetFunctionCallReturnListener } from '../../../../src/core/thread-function-call/return-value.js';
import { resetElementTemplateBackgroundFunctionRuntime } from '../../../../src/element-template/runtime/template/main-thread-background-function.js';
import { ElementTemplateLifecycleConstant } from '../../../../src/element-template/protocol/lifecycle-constant.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';

describe('ElementTemplate runOnMainThread', () => {
  const envManager = new ElementTemplateEnvManager();

  beforeEach(() => {
    vi.clearAllMocks();
    envManager.resetEnv('background');
    SystemInfo.lynxSdkVersion = '4.0';
    resetElementTemplateCommitState();
  });

  afterEach(() => {
    takeDelayedRunOnMainThreadData();
    resetFunctionCallReturnListener();
    resetElementTemplateCommitState();
  });

  it('is exported from the ET public alias', async () => {
    const elementTemplateRuntime = await import('@lynx-js/react/element-template');

    expect(elementTemplateRuntime.runOnMainThread).toBe(runOnMainThread);
  });

  it('dispatches hydrated calls to the main thread and resolves returned values', async () => {
    markElementTemplateHydrated();
    const coreContext = lynx.getCoreContext();
    const dispatchSpy = vi.spyOn(coreContext, 'dispatchEvent');
    const worklet = { _wkltId: 'direct-main-thread-function' };

    const promise = runOnMainThread(worklet as unknown as (value: string) => string)('hello');

    expect(dispatchSpy).toHaveBeenCalledWith({
      type: WorkletEvents.runWorkletCtx,
      data: JSON.stringify({
        worklet,
        params: ['hello'],
        resolveId: 1,
      }),
    });

    envManager.switchToMainThread();
    lynx.getJSContext().dispatchEvent({
      type: WorkletEvents.FunctionCallRet,
      data: JSON.stringify({
        resolveId: 1,
        returnValue: 'world',
      }),
    });
    envManager.switchToBackground();

    await expect(promise).resolves.toBe('world');
  });

  it('queues calls before hydration without dispatching directly', async () => {
    const coreContext = lynx.getCoreContext();
    const dispatchSpy = vi.spyOn(coreContext, 'dispatchEvent');
    const worklet = { _wkltId: 'pre-hydrate-main-thread-function' };

    const promise = runOnMainThread(worklet as unknown as (value: string) => string)('hello');

    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({
      type: WorkletEvents.runWorkletCtx,
    }));
    expect(takeDelayedRunOnMainThreadData()).toEqual([
      {
        worklet,
        params: ['hello'],
        resolveId: 1,
      },
    ]);

    envManager.switchToMainThread();
    lynx.getJSContext().dispatchEvent({
      type: WorkletEvents.FunctionCallRet,
      data: JSON.stringify({
        resolveId: 1,
        returnValue: 'queued result',
      }),
    });
    envManager.switchToBackground();

    await expect(promise).resolves.toBe('queued result');
  });

  it('keeps component render calls on the delayed path', () => {
    markElementTemplateHydrated();
    const dispatchSpy = vi.spyOn(lynx.getCoreContext(), 'dispatchEvent');
    const worklet = { _wkltId: 'component-render-main-thread-function' };

    function App() {
      void runOnMainThread(worklet as unknown as (value: string) => void)('from-render');
      return createElement('view');
    }

    root.render(createElement(App, null));

    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({
      type: WorkletEvents.runWorkletCtx,
    }));
    const delayedUpdate = dispatchSpy.mock.calls.find(([event]) =>
      event.type === ElementTemplateLifecycleConstant.update
    )?.[0];
    expect(JSON.parse(delayedUpdate?.data as string)).toMatchObject({
      delayedRunOnMainThreadData: [
        {
          worklet,
          params: ['from-render'],
          resolveId: 1,
        },
      ],
    });
    expect(takeDelayedRunOnMainThreadData()).toEqual([]);
  });

  it('keeps post-hydration state update render calls on the delayed path', () => {
    const scheduledRenders: Array<() => void> = [];
    const previousDebounce = options.debounceRendering;
    options.debounceRendering = (cb) => {
      scheduledRenders.push(cb);
    };
    const dispatchSpy = vi.spyOn(lynx.getCoreContext(), 'dispatchEvent');
    const worklet = { _wkltId: 'state-update-main-thread-function' };
    let rerender: () => void = () => {
      throw new Error('rerender was not initialized');
    };

    try {
      function App() {
        const [count, setCount] = useState(0);
        rerender = () => setCount(1);
        if (count === 1) {
          void runOnMainThread(worklet as unknown as (value: string) => void)('from-state-render');
        }
        return createElement('view');
      }

      markElementTemplateHydrated();
      root.render(createElement(App, null));
      dispatchSpy.mockClear();

      rerender();
      while (scheduledRenders.length > 0) {
        scheduledRenders.shift()?.();
      }

      expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({
        type: WorkletEvents.runWorkletCtx,
      }));
      const delayedUpdate = dispatchSpy.mock.calls.find(([event]) =>
        event.type === ElementTemplateLifecycleConstant.update
      )?.[0];
      expect(JSON.parse(delayedUpdate?.data as string)).toMatchObject({
        delayedRunOnMainThreadData: [
          {
            worklet,
            params: ['from-state-render'],
            resolveId: 1,
          },
        ],
      });
    } finally {
      options.debounceRendering = previousDebounce;
    }
  });

  it('dispatches commit effect calls directly after render scope ends', () => {
    markElementTemplateHydrated();
    const dispatchSpy = vi.spyOn(lynx.getCoreContext(), 'dispatchEvent');
    const worklet = { _wkltId: 'commit-effect-main-thread-function' };

    function App() {
      useLayoutEffect(() => {
        void runOnMainThread(worklet as unknown as (value: string) => void)('from-layout-effect');
      }, []);
      return createElement('view');
    }

    root.render(createElement(App, null));

    expect(dispatchSpy).toHaveBeenCalledWith({
      type: WorkletEvents.runWorkletCtx,
      data: JSON.stringify({
        worklet,
        params: ['from-layout-effect'],
        resolveId: 1,
      }),
    });
    expect(takeDelayedRunOnMainThreadData()).toEqual([]);
  });

  it('registers background function handles inside main-thread function ctx', () => {
    markElementTemplateHydrated();
    const worklet = {
      _wkltId: 'with-background-function',
      _jsFn: {
        onDone: {
          _fn: vi.fn(),
          _jsFnId: 7,
        },
      },
    };

    void runOnMainThread(worklet as unknown as () => void)();

    expect(worklet._execId).toEqual(expect.any(Number));
  });

  it('clears the return listener when background function runtime resets', () => {
    markElementTemplateHydrated();
    const coreContext = lynx.getCoreContext();
    const removeEventListener = vi.spyOn(coreContext, 'removeEventListener');

    void runOnMainThread('pending-main-thread-function' as unknown as () => void)();

    resetElementTemplateBackgroundFunctionRuntime();

    expect(removeEventListener).toHaveBeenCalledWith(WorkletEvents.FunctionCallRet, expect.any(Function));
  });

  it('clears delayed queue and return listener on background destroy', () => {
    const removeEventListener = vi.spyOn(lynx.getCoreContext(), 'removeEventListener');
    const worklet = { _wkltId: 'pending-before-destroy' };

    void runOnMainThread(worklet as unknown as () => void)();
    expect(takeDelayedRunOnMainThreadData()).toEqual([
      {
        worklet,
        params: [],
        resolveId: 1,
      },
    ]);
    void runOnMainThread({ _wkltId: 'pending-before-destroy-2' } as unknown as () => void)();

    destroyElementTemplateBackgroundRuntime();

    expect(takeDelayedRunOnMainThreadData()).toEqual([]);
    expect(removeEventListener).toHaveBeenCalledWith(WorkletEvents.FunctionCallRet, expect.any(Function));
  });

  it('throws on the main thread', () => {
    envManager.switchToMainThread();

    expect(() => runOnMainThread({ _wkltId: 'main-thread' } as unknown as () => void)).toThrowError(
      'runOnMainThread can only be used on the background thread.',
    );
  });

  it('throws when MTS is unavailable', () => {
    SystemInfo.lynxSdkVersion = '2.13';

    expect(() => runOnMainThread({ _wkltId: 'legacy-sdk' } as unknown as () => void)).toThrowError(
      'runOnMainThread requires Lynx sdk version 2.14.',
    );
  });
});
