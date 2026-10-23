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
  };
}

let context: ReturnType<typeof createEventHost>;

// Evaluates the runtime modules again on the same `lynx`, as a reload does.
async function evaluateEntry() {
  vi.resetModules();
  return {
    destroyRuntime: (await import('../../src/core/runtime-destroy.js')).destroyRuntime,
    runOnMainThread: (await import('../../src/core/thread-function-call/main-thread.js')).createRunOnMainThread({
      shouldDispatchRunOnMainThreadDirectly: () => true,
    }),
    registerBackgroundFunctionCtx:
      (await import('../../src/core/background-function/run-on-background.js')).registerBackgroundFunctionCtx,
    runOnBackground: (await import('../../src/core/background-function/run-on-background.js')).runOnBackground,
    installMainThreadReloadCompleter: (await import('../../src/core/entry-reload.js')).installMainThreadReloadCompleter,
  };
}

function lastDispatched(type: string) {
  const call = context.dispatchEvent.mock.calls.findLast(([event]) => event.type === type);
  return JSON.parse(call![0].data as string) as { resolveId: number };
}

beforeEach(() => {
  context = createEventHost();
  vi.stubGlobal('__EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__', true);
  vi.stubGlobal('__JS__', true);
  vi.stubGlobal('__LEPUS__', false);
  vi.stubGlobal('SystemInfo', { lynxSdkVersion: '999.999' });
  vi.stubGlobal('lynx', { getCoreContext: () => context, getJSContext: () => context });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('cross-thread calls across an entry re-evaluation', () => {
  it('resolves a call only with its own reply', async () => {
    const oldEntry = await evaluateEntry();
    const oldResult = vi.fn();
    void oldEntry.runOnMainThread(() => 'unused')().then(oldResult);
    const oldCall = lastDispatched(WorkletEvents.runWorkletCtx);
    oldEntry.destroyRuntime();

    const newEntry = await evaluateEntry();
    const newCall = newEntry.runOnMainThread(() => 'unused')();
    const newRequest = lastDispatched(WorkletEvents.runWorkletCtx);

    // The reply to the old call arrives late; it must not settle the new one.
    context.emit(WorkletEvents.FunctionCallRet, JSON.stringify({ resolveId: oldCall.resolveId, returnValue: 'old' }));
    context.emit(
      WorkletEvents.FunctionCallRet,
      JSON.stringify({ resolveId: newRequest.resolveId, returnValue: 'new' }),
    );

    await expect(newCall).resolves.toBe('new');
    expect(oldResult).not.toHaveBeenCalled();
    expect(context.count(WorkletEvents.FunctionCallRet)).toBe(1);
  });

  it('does not let a retired entry start new calls', async () => {
    const oldEntry = await evaluateEntry();
    const runOnMainThread = oldEntry.runOnMainThread;
    oldEntry.destroyRuntime();
    await evaluateEntry();
    context.dispatchEvent.mockClear();

    // e.g. a cleanup closure of the old entry
    void runOnMainThread(() => 'unused')();

    expect(context.dispatchEvent).not.toHaveBeenCalled();
    expect(context.count(WorkletEvents.FunctionCallRet)).toBe(0);
  });

  it('does not let a retired main-thread entry call the background', async () => {
    vi.stubGlobal('__JS__', false);
    const oldEntry = await evaluateEntry();
    const fn = oldEntry.runOnBackground(Object.assign(() => undefined, { _jsFnId: 1, _execId: 1 }));
    oldEntry.destroyRuntime();
    await evaluateEntry();
    context.dispatchEvent.mockClear();

    void fn();

    expect(context.dispatchEvent).not.toHaveBeenCalled();
    expect(context.count(WorkletEvents.FunctionCallRet)).toBe(0);
  });

  it('keeps background function contexts of the new entry apart from late messages', async () => {
    const oldFn = vi.fn();
    const newFn = vi.fn();
    const oldCtx = { _wkltId: 'ctx', _c: { fn: { _jsFnId: 1, _fn: oldFn } } };
    const newCtx = { _wkltId: 'ctx', _c: { fn: { _jsFnId: 1, _fn: newFn } } };

    const oldEntry = await evaluateEntry();
    oldEntry.registerBackgroundFunctionCtx(oldCtx);
    oldEntry.destroyRuntime();
    const newEntry = await evaluateEntry();
    newEntry.registerBackgroundFunctionCtx(newCtx);

    const call = (execId: number) =>
      context.emit(
        WorkletEvents.runOnBackground,
        JSON.stringify({ obj: { _execId: execId, _jsFnId: 1 }, params: [], resolveId: 1 }),
      );
    // The main thread releases and calls the old context after the reload.
    context.emit(WorkletEvents.releaseBackgroundWorkletCtx, [oldCtx._execId]);
    try {
      call(oldCtx._execId!);
    } catch {
      // Unknown contexts throw; what matters is that the new function is not run.
    }
    expect(newFn).not.toHaveBeenCalled();

    call(newCtx._execId!);
    expect(newFn).toHaveBeenCalledOnce();
    expect(oldFn).not.toHaveBeenCalled();
    expect(context.count(WorkletEvents.runOnBackground)).toBe(1);
  });
});

describe('main-thread reload completer', () => {
  it('is installed by an entry evaluated on the main thread only', async () => {
    const completerKey = Symbol.for('__LYNX_MAIN_THREAD_RELOAD_COMPLETER__');
    const complete = vi.fn();

    vi.stubGlobal('__MAIN_THREAD__', false);
    (await evaluateEntry()).installMainThreadReloadCompleter(complete);
    expect((lynx as unknown as Record<symbol, unknown>)[completerKey]).toBeUndefined();

    vi.stubGlobal('__MAIN_THREAD__', true);
    (await evaluateEntry()).installMainThreadReloadCompleter(complete);
    expect((lynx as unknown as Record<symbol, unknown>)[completerKey]).toBe(complete);
  });
});
