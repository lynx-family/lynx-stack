import { afterEach, beforeEach, describe, expect, it, rstest } from '@rstest/core';

import { WorkletEvents, type RunWorkletCtxData } from '../../src/worklet-runtime/bindings/events.js';
import {
  createRunOnMainThread,
  delayedRunOnMainThreadData,
  enqueueDelayedRunOnMainThreadData,
  takeDelayedRunOnMainThreadData,
} from '../../src/core/thread-function-call/main-thread.js';
import {
  dropFunctionCallReturnIds,
  onFunctionCall,
  resetFunctionCallReturnListener,
} from '../../src/core/thread-function-call/return-value.js';

function createLynxMock() {
  const coreContext = {
    addEventListener: rstest.fn(),
    removeEventListener: rstest.fn(),
    dispatchEvent: rstest.fn(),
  };
  const jsContext = {
    addEventListener: rstest.fn(),
    removeEventListener: rstest.fn(),
    dispatchEvent: rstest.fn(),
  };

  globalThis.lynx = {
    getCoreContext: rstest.fn(() => coreContext),
    getJSContext: rstest.fn(() => jsContext),
  } as unknown as typeof lynx;

  return { coreContext, jsContext };
}

describe('thread-function-call main-thread primitives', () => {
  beforeEach(() => {
    rstest.stubGlobal('__JS__', true);
    rstest.stubGlobal('__LEPUS__', false);
    globalThis.SystemInfo = {
      lynxSdkVersion: '999.999',
    } as SystemInfo;
  });

  afterEach(() => {
    takeDelayedRunOnMainThreadData();
    resetFunctionCallReturnListener();
    rstest.unstubAllGlobals();
  });

  it('keeps delayed main-thread data in a live shared queue', () => {
    const pending = delayedRunOnMainThreadData;
    const data = {
      worklet: { _wkltId: 'main-thread-function' },
      params: ['hello'],
      resolveId: 1,
    } satisfies RunWorkletCtxData;

    enqueueDelayedRunOnMainThreadData(data);

    expect(delayedRunOnMainThreadData).toHaveLength(1);
    expect(delayedRunOnMainThreadData).toBe(pending);
    expect(takeDelayedRunOnMainThreadData()).toEqual([data]);
    expect(delayedRunOnMainThreadData).toHaveLength(0);
    expect(delayedRunOnMainThreadData).not.toBe(pending);

    enqueueDelayedRunOnMainThreadData(data);
    expect(takeDelayedRunOnMainThreadData()).toEqual([data]);
    expect(takeDelayedRunOnMainThreadData()).toEqual([]);
  });

  it('dispatches direct main-thread calls with the shared payload shape', () => {
    const { coreContext } = createLynxMock();
    const worklet = { _wkltId: 'direct-main-thread-function' };
    const runOnMainThread = createRunOnMainThread({
      shouldDispatchRunOnMainThreadDirectly: () => true,
    });

    void runOnMainThread(worklet as unknown as (value: string) => void)('hello');

    expect(delayedRunOnMainThreadData).toHaveLength(0);
    expect(coreContext.dispatchEvent).toHaveBeenCalledWith({
      type: WorkletEvents.runWorkletCtx,
      data: JSON.stringify({
        worklet,
        params: ['hello'],
        resolveId: 1,
      }),
    });
  });

  it('registers background function handles in main-thread function ctx', () => {
    createLynxMock();
    const worklet = {
      _wkltId: 'main-thread-function-with-background-function',
      _jsFn: {
        onDone: {
          _fn: rstest.fn(),
          _jsFnId: 7,
        },
      },
    };
    const runOnMainThread = createRunOnMainThread({
      shouldDispatchRunOnMainThreadDirectly: () => false,
    });

    void runOnMainThread(worklet as unknown as () => void)();

    expect(worklet._execId).toEqual(expect.any(Number));
  });

  it('queues delayed main-thread calls with the shared payload shape', () => {
    createLynxMock();
    const worklet = { _wkltId: 'delayed-main-thread-function' };
    const runOnMainThread = createRunOnMainThread({
      shouldDispatchRunOnMainThreadDirectly: () => false,
    });

    void runOnMainThread(worklet as unknown as (value: string) => void)('queued');

    expect(takeDelayedRunOnMainThreadData()).toEqual([
      {
        worklet,
        params: ['queued'],
        resolveId: 1,
      },
    ]);
  });

  it('drops only selected function return ids', async () => {
    const { coreContext } = createLynxMock();
    const droppedResolve = rstest.fn();
    const droppedId = onFunctionCall(droppedResolve);
    let keptId = 0;
    const keptPromise = new Promise(resolve => {
      keptId = onFunctionCall(resolve);
    });
    const functionCallRetListener = coreContext.addEventListener.mock.calls.find(
      ([type]) => type === WorkletEvents.FunctionCallRet,
    )?.[1] as ((event: RuntimeProxy.Event) => void) | undefined;

    dropFunctionCallReturnIds([droppedId]);
    expect(() =>
      functionCallRetListener?.({
        type: WorkletEvents.FunctionCallRet,
        data: JSON.stringify({ resolveId: droppedId, returnValue: 'dropped' }),
      })
    ).not.toThrow();
    functionCallRetListener?.({
      type: WorkletEvents.FunctionCallRet,
      data: JSON.stringify({ resolveId: keptId, returnValue: 'kept' }),
    });

    expect(droppedResolve).not.toHaveBeenCalled();
    await expect(keptPromise).resolves.toBe('kept');

    const finalId = onFunctionCall(rstest.fn());
    dropFunctionCallReturnIds([finalId]);
    expect(coreContext.removeEventListener).toHaveBeenCalledWith(WorkletEvents.FunctionCallRet, expect.any(Function));
  });

  it('ignores dropped function return ids before listener initialization', () => {
    expect(() => dropFunctionCallReturnIds([1])).not.toThrow();
  });

  it('uses the shared SDK support gate', () => {
    createLynxMock();
    globalThis.SystemInfo = {
      lynxSdkVersion: '2.13',
    } as SystemInfo;
    const runOnMainThread = createRunOnMainThread({
      shouldDispatchRunOnMainThreadDirectly: () => true,
    });

    expect(() => runOnMainThread({ _wkltId: 'unsupported' } as unknown as () => void)).toThrowError(
      'runOnMainThread requires Lynx sdk version 2.14.',
    );
  });
});
