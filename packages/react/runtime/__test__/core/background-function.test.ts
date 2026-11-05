import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createBackgroundFunctionHandle,
  resetBackgroundFunctionHandleIdForTesting,
} from '../../src/core/background-function/handle.js';
import { BackgroundFunctionExecMap } from '../../src/core/background-function/exec-map.js';
import {
  registerBackgroundFunctionCtx,
  resetBackgroundFunctionRuntime,
  runOnBackground,
} from '../../src/core/background-function/run-on-background.js';
import { resetFunctionCallReturnListener } from '../../src/core/thread-function-call/return-value.js';

function createCrossThreadLynxMock() {
  const coreListeners = new Map<string, (event: RuntimeProxy.Event) => void>();
  const jsListeners = new Map<string, (event: RuntimeProxy.Event) => void>();

  const coreContext = {
    addEventListener: vi.fn((type: string, listener: (event: RuntimeProxy.Event) => void) => {
      coreListeners.set(type, listener);
    }),
    removeEventListener: vi.fn((type: string) => {
      coreListeners.delete(type);
    }),
    dispatchEvent: vi.fn((event: RuntimeProxy.Event) => {
      jsListeners.get(event.type)?.(event);
    }),
  };

  const jsContext = {
    addEventListener: vi.fn((type: string, listener: (event: RuntimeProxy.Event) => void) => {
      jsListeners.set(type, listener);
    }),
    removeEventListener: vi.fn((type: string) => {
      jsListeners.delete(type);
    }),
    dispatchEvent: vi.fn((event: RuntimeProxy.Event) => {
      coreListeners.get(event.type)?.(event);
    }),
  };

  const app = {};
  vi.stubGlobal('tt', app);
  vi.stubGlobal('lynx', {
    getApp: () => app,
    getCoreContext: vi.fn(() => coreContext),
    getJSContext: vi.fn(() => jsContext),
  });

  return { coreContext, jsContext };
}

describe('background-function core primitives', () => {
  beforeEach(() => {
    vi.stubGlobal('__JS__', false);
    vi.stubGlobal('SystemInfo', { lynxSdkVersion: '999.999' });
    resetBackgroundFunctionHandleIdForTesting();
  });

  afterEach(() => {
    resetBackgroundFunctionRuntime();
    resetFunctionCallReturnListener();
    vi.unstubAllGlobals();
  });

  it('creates background function handles with stable JSON behavior', () => {
    const fn = vi.fn();

    const first = createBackgroundFunctionHandle(fn);
    const second = createBackgroundFunctionHandle(fn);
    const invalid = createBackgroundFunctionHandle(1 as unknown as () => void);

    expect(first._jsFnId).toBe(1);
    expect(first._fn).toBe(fn);
    expect(second._jsFnId).toBe(2);
    expect(JSON.stringify(second)).toBe('{"_jsFnId":2,"_fn":"[BackgroundFunction]"}');
    expect(invalid._error).toBe('Argument of runOnBackground should be a function, but got [number] instead');
  });

  it('keeps background function ctx by exec id and finds nested handles', () => {
    const map = new BackgroundFunctionExecMap();
    const handle = {
      _jsFnId: 233,
    };
    const ctx = {
      _wkltId: 'ctx',
      nested: {
        handle,
      },
    };

    const execId = map.add(ctx);

    expect(ctx._execId).toBe(execId);
    expect(map.findJsFnHandle(execId, 233)).toBe(handle);
    expect(map.findJsFnHandle(execId, 234)).toBeUndefined();

    map.remove(execId);
    expect(map.findJsFnHandle(execId, 233)).toBeUndefined();
  });

  it('dispatches a background function call and resolves the returned value', async () => {
    const { coreContext, jsContext } = createCrossThreadLynxMock();
    const fn = vi.fn((value: string) => `${value}-from-background`);
    const ctx = {
      _wkltId: 'ctx',
      _jsFn: {
        fn: {
          _jsFnId: 1,
          _fn: fn,
        },
      },
    };

    registerBackgroundFunctionCtx(ctx);
    const ret = runOnBackground(
      {
        _jsFnId: 1,
        _execId: ctx._execId,
      } as unknown as () => string,
    )('hello');

    await expect(ret).resolves.toBe('hello-from-background');
    expect(fn).toHaveBeenCalledWith('hello');
    expect(coreContext.addEventListener).toHaveBeenCalledTimes(2);
    expect(jsContext.addEventListener).toHaveBeenCalledTimes(1);

    resetBackgroundFunctionRuntime();
    resetFunctionCallReturnListener();
    expect(coreContext.removeEventListener).toHaveBeenCalledTimes(2);
    expect(jsContext.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it('drops registrations and calls once BTS or MTS host destruction is observed', async () => {
    const { bindPage } = await import('@lynx-js/lynx-runtime/bts');
    const { onDestroy } = await import('@lynx-js/lynx-runtime/mts');
    const { onFunctionCall } = await import('../../src/core/thread-function-call/return-value.js');
    const nativeListeners = new Map<string, () => void>();
    const native = {
      addEventListener: vi.fn((type: string, cb: () => void) => nativeListeners.set(type, cb)),
      removeEventListener: vi.fn((type: string) => nativeListeners.delete(type)),
    };
    const { coreContext, jsContext } = createCrossThreadLynxMock();
    Object.assign(lynx, { getNative: () => native });

    bindPage();
    (lynx.getApp() as { callDestroyLifetimeFun?: () => void }).callDestroyLifetimeFun?.();
    const deadCtx = { _wkltId: 'dead-ctx' };
    registerBackgroundFunctionCtx(deadCtx);
    expect(deadCtx).not.toHaveProperty('_execId');
    expect(coreContext.addEventListener).not.toHaveBeenCalled();

    onDestroy(() => {});
    nativeListeners.get('__DestroyLifetime')?.();
    expect(onFunctionCall(vi.fn())).toBe(0);
    void runOnBackground({ _jsFnId: 1, _execId: 1 } as unknown as () => void)();
    expect(jsContext.addEventListener).not.toHaveBeenCalled();
    expect(jsContext.dispatchEvent).not.toHaveBeenCalled();
  });
});
