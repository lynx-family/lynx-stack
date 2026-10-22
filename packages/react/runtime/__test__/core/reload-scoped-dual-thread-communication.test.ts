// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkletEvents } from '../../src/worklet-runtime/bindings/events.js';

// Like the native one, it keeps every listener until it is removed.
function createEventHost() {
  const listeners = new Map<string, Set<(event: { data: unknown }) => void>>();
  return {
    addEventListener(type: string, fn: (event: { data: unknown }) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: (event: { data: unknown }) => void) {
      listeners.get(type)?.delete(fn);
    },
    dispatchEvent: vi.fn(),
    emit(type: string, data: unknown) {
      for (const fn of [...(listeners.get(type) ?? [])]) fn({ data });
    },
    count: (type: string) => listeners.get(type)?.size ?? 0,
    listener: (type: string) => [...(listeners.get(type) ?? [])][0],
  };
}

let context: ReturnType<typeof createEventHost>;
async function loadRuntime() {
  return {
    destroyRuntime: (await import('../../src/core/runtime-destroy.js')).runDestroyTasks,
    runOnMainThread: (await import('../../src/core/thread-function-call/main-thread.js')).createRunOnMainThread({
      shouldDispatchRunOnMainThreadDirectly: () => true,
    }),
    initEventListeners: (await import('../../src/worklet-runtime/listeners.js')).initEventListeners,
    increaseReloadVersion: (await import('../../src/core/reload-version.js')).increaseReloadVersion,
  };
}
beforeEach(() => {
  vi.resetModules();
  context = createEventHost();
  vi.stubGlobal('__JS__', true);
  vi.stubGlobal('__LEPUS__', false);
  vi.stubGlobal('SystemInfo', { lynxSdkVersion: '999.999' });
  vi.stubGlobal('lynx', { getCoreContext: () => context, getJSContext: () => context });
});
afterEach(async () => {
  (await loadRuntime()).destroyRuntime();
  vi.unstubAllGlobals();
});
describe('reload-scoped dual-thread communication delivery', () => {
  it('drops an old background request even before a new function table exists', async () => {
    const runtime = await loadRuntime();
    const { registerBackgroundFunctionCtx, resetBackgroundFunctionRuntime } = await import(
      '../../src/core/background-function/run-on-background.js'
    );
    registerBackgroundFunctionCtx({ _wkltId: 'ctx', _c: {}, _execId: 0 });
    const listener = context.listener(WorkletEvents.runOnBackground)!;
    resetBackgroundFunctionRuntime();
    runtime.increaseReloadVersion();
    // Native delivery may already have captured the callback before removal.
    expect(() =>
      listener({
        data: JSON.stringify({ obj: { _execId: 1, _jsFnId: 1 }, params: [], resolveId: 1, reloadVersion: 0 }),
      })
    ).not.toThrow();
    expect(context.count(WorkletEvents.runOnBackground)).toBe(0);
  });

  it('drops an old direct request before execution while the new page still works', async () => {
    const oldEntry = await loadRuntime();
    oldEntry.initEventListeners();
    const oldResult = vi.fn();
    void oldEntry.runOnMainThread({ _wkltId: 'old' } as unknown as () => string)().then(oldResult);
    const oldRequest = context.dispatchEvent.mock.calls.at(-1)![0];
    oldEntry.destroyRuntime();

    const fresh = await loadRuntime();
    fresh.increaseReloadVersion();
    // The worklet listener belongs to the persistent host, not the replaced page.
    const execute = vi.fn(() => 'fresh');
    vi.stubGlobal('runWorklet', execute);
    const result = fresh.runOnMainThread({ _wkltId: 'fresh' } as unknown as () => string)();
    const freshRequest = context.dispatchEvent.mock.calls.at(-1)![0];
    context.emit(oldRequest.type, oldRequest.data);
    expect(execute).not.toHaveBeenCalled();
    context.emit(freshRequest.type, freshRequest.data);
    expect(execute).toHaveBeenCalledOnce();
    const reply = context.dispatchEvent.mock.calls.at(-1)![0];
    context.emit(reply.type, reply.data);
    await expect(result).resolves.toBe('fresh');
    expect(oldResult).not.toHaveBeenCalled();
    expect(context.count(WorkletEvents.runWorkletCtx)).toBe(1);
  });

  it('drops the old reply without settling the new Promise', async () => {
    const runtime = await loadRuntime();
    const oldResult = vi.fn();
    void runtime.runOnMainThread({ _wkltId: 'old' } as unknown as () => string)().then(oldResult);
    const oldRequest = JSON.parse(context.dispatchEvent.mock.calls.at(-1)![0].data as string);
    runtime.destroyRuntime();
    runtime.increaseReloadVersion();
    const freshResult = vi.fn();
    const fresh = runtime.runOnMainThread({ _wkltId: 'fresh' } as unknown as () => string)().then(freshResult);
    const freshRequest = JSON.parse(context.dispatchEvent.mock.calls.at(-1)![0].data as string);
    expect(freshRequest.resolveId).toBe(oldRequest.resolveId);
    context.emit(
      WorkletEvents.FunctionCallRet,
      JSON.stringify({
        resolveId: oldRequest.resolveId,
        returnValue: 'stale',
        reloadVersion: oldRequest.reloadVersion,
      }),
    );
    await Promise.resolve();
    expect(oldResult).not.toHaveBeenCalled();
    expect(freshResult).not.toHaveBeenCalled();
    context.emit(
      WorkletEvents.FunctionCallRet,
      JSON.stringify({
        resolveId: freshRequest.resolveId,
        returnValue: 'fresh',
        reloadVersion: freshRequest.reloadVersion,
      }),
    );
    await fresh;
    expect(freshResult).toHaveBeenCalledWith('fresh');
    expect(oldResult).not.toHaveBeenCalled();
  });
});
