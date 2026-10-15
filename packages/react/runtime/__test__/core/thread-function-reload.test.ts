import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Queue real protocol messages so reload can happen before their delivery.
function setupContexts() {
  const listeners = new Map<string, Set<(event: RuntimeProxy.Event) => void>>();
  const replies: RuntimeProxy.Event[] = [];
  const context = {
    addEventListener: (type: string, listener: (event: RuntimeProxy.Event) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener: (type: string, listener: (event: RuntimeProxy.Event) => void) => {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent: (event: RuntimeProxy.Event) => replies.push(event),
  };
  vi.stubGlobal('lynx', { getCoreContext: () => context, getJSContext: () => context });
  vi.stubGlobal('SystemInfo', { lynxSdkVersion: '999.999' });
  vi.stubGlobal('__JS__', false);
  return {
    deliver: (event: RuntimeProxy.Event) => {
      for (const listener of [...(listeners.get(event.type) ?? [])]) listener(event);
    },
    replies,
  };
}

function worklet(fn: () => string) {
  return { _wkltId: 'callback', _c: { fn: { _jsFnId: 1, _fn: fn } } };
}

describe('cross-thread messages arriving after reload', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it('does not restart calls or old continuations after the entry is destroyed', async () => {
    const { deliver, replies } = setupContexts();
    vi.stubGlobal('__LEPUS__', false);
    const oldReturns = await import('../../src/core/thread-function-call/return-value.js');
    const { destroyRuntime } = await import('../../src/core/runtime-destroy.js');
    const { increaseReloadVersion } = await import('../../src/core/reload-version.js');
    const { runOnBackground } = await import('../../src/core/background-function/run-on-background.js');
    const { createRunOnMainThread } = await import('../../src/core/thread-function-call/main-thread.js');
    const oldContinuation = vi.fn();
    const oldCall = runOnBackground({ _jsFnId: 1, _execId: 1, _reloadVersion: 0 } as unknown as () => string);
    void oldCall().then(oldContinuation);
    replies.length = 0;

    increaseReloadVersion();
    destroyRuntime();
    // Reset is reusable cleanup, but must not undo a permanent destroy.
    oldReturns.resetFunctionCallReturnListener();
    void oldCall().then(oldContinuation);
    vi.stubGlobal('__JS__', true);
    const oldMainCall = createRunOnMainThread({ shouldDispatchRunOnMainThreadDirectly: () => true });
    void oldMainCall({ _wkltId: 'old' } as unknown as () => string)().then(oldContinuation);
    expect(replies).toHaveLength(0);

    vi.resetModules();
    vi.stubGlobal('__JS__', false);
    const fresh = await import('../../src/core/background-function/run-on-background.js');
    const newFn = vi.fn(() => 'new-result');
    fresh.registerBackgroundFunctionCtx(worklet(newFn));
    const result = fresh.runOnBackground(
      { _jsFnId: 1, _execId: 1, _reloadVersion: 1 } as unknown as () => string,
    )();
    deliver(replies.shift()!);
    deliver(replies.shift()!);
    await expect(result).resolves.toBe('new-result');
    expect(oldContinuation).not.toHaveBeenCalled();
    expect(newFn).toHaveBeenCalledOnce();
  });

  it('ignores an old unmount call instead of calling a new function with the same IDs', async () => {
    const { deliver, replies } = setupContexts();
    const { registerBackgroundFunctionCtx, resetBackgroundFunctionRuntime, runOnBackground } = await import(
      '../../src/core/background-function/run-on-background.js'
    );
    const { increaseReloadVersion } = await import('../../src/core/reload-version.js');
    const oldFn = vi.fn(() => 'old');
    const oldCtx = worklet(oldFn);
    registerBackgroundFunctionCtx(oldCtx);
    const oldHandle = { ...oldCtx._c.fn, _execId: 1, _reloadVersion: 0 };

    resetBackgroundFunctionRuntime();
    increaseReloadVersion();
    const newFn = vi.fn(() => 'new');
    registerBackgroundFunctionCtx(worklet(newFn));

    // A main-thread ref's old null callback runs after the version increased.
    void runOnBackground(oldHandle as unknown as () => string)();
    deliver(replies.shift()!);
    expect(oldFn).not.toHaveBeenCalled();
    expect(newFn).not.toHaveBeenCalled();

    const result = runOnBackground({ ...oldHandle, _reloadVersion: 1 } as unknown as () => string)();
    deliver(replies.shift()!);
    deliver(replies.shift()!);
    await expect(result).resolves.toBe('new');
    expect(newFn).toHaveBeenCalledTimes(1);
  });

  it('does not complete a new main-thread call with a delayed old result', async () => {
    const { deliver, replies } = setupContexts();
    const { onFunctionCall, resetFunctionCallReturnListener } = await import(
      '../../src/core/thread-function-call/return-value.js'
    );
    const { runRunOnMainThreadTask } = await import('../../src/worklet-runtime/runOnMainThread.js');
    const { increaseReloadVersion } = await import('../../src/core/reload-version.js');
    vi.stubGlobal('runWorklet', (_ctx: unknown, args: string[]) => args[0]);
    const oldResolve = vi.fn();
    const oldId = onFunctionCall(oldResolve);
    runRunOnMainThreadTask({ _wkltId: 'old' }, ['old'], oldId, 0);
    const oldReply = replies.shift()!;

    resetFunctionCallReturnListener();
    increaseReloadVersion();
    const newResolve = vi.fn();
    const newId = onFunctionCall(newResolve);
    expect(newId).toBe(oldId);
    runRunOnMainThreadTask({ _wkltId: 'new' }, ['fresh'], newId, 1);
    const freshReply = replies.shift()!;

    deliver(oldReply);
    expect(newResolve).not.toHaveBeenCalled();
    deliver(freshReply);
    expect(newResolve).toHaveBeenCalledExactlyOnceWith('fresh');
    expect(oldResolve).not.toHaveBeenCalled();

    runRunOnMainThreadTask({ _wkltId: 'old' }, [], oldId, 0);
    expect(replies).toHaveLength(0);
  });

  it('keeps new calls working when ordinary reload preserves the return table', async () => {
    const { deliver, replies } = setupContexts();
    const { onFunctionCall } = await import('../../src/core/thread-function-call/return-value.js');
    const { increaseReloadVersion } = await import('../../src/core/reload-version.js');
    const { runRunOnMainThreadTask } = await import('../../src/worklet-runtime/runOnMainThread.js');
    vi.stubGlobal('runWorklet', (_ctx: unknown, args: string[]) => args[0]);
    const oldResolve = vi.fn();
    const oldId = onFunctionCall(oldResolve);
    runRunOnMainThreadTask({ _wkltId: 'old' }, ['old'], oldId, 0);
    increaseReloadVersion();
    const newResolve = vi.fn();
    const newId = onFunctionCall(newResolve);
    runRunOnMainThreadTask({ _wkltId: 'new' }, ['fresh'], newId, 1);
    deliver(replies.shift()!);
    deliver(replies.shift()!);
    expect(oldResolve).toHaveBeenCalledExactlyOnceWith('old');
    expect(newResolve).toHaveBeenCalledExactlyOnceWith('fresh');
  });

  it('does not release a new callback when an old worklet is collected', async () => {
    const { deliver, replies } = setupContexts();
    let collect!: () => void;
    vi.stubGlobal(
      'FinalizationRegistry',
      class {
        constructor(private callback: (held: unknown) => void) {}
        register(_target: object, held: unknown) {
          collect = () => this.callback(held);
        }
      },
    );
    const { JsFunctionLifecycleManager } = await import('../../src/worklet-runtime/jsFunctionLifecycle.js');
    const { registerBackgroundFunctionCtx, resetBackgroundFunctionRuntime, runOnBackground } = await import(
      '../../src/core/background-function/run-on-background.js'
    );
    const { increaseReloadVersion } = await import('../../src/core/reload-version.js');
    const manager = new JsFunctionLifecycleManager();
    registerBackgroundFunctionCtx(worklet(() => 'old'));
    manager.addRef(1, {}, 0);
    resetBackgroundFunctionRuntime();
    increaseReloadVersion();
    const fn = vi.fn(() => 'new');
    registerBackgroundFunctionCtx(worklet(fn));

    collect();
    await Promise.resolve();
    deliver(replies.shift()!);
    const result = runOnBackground({ _jsFnId: 1, _execId: 1, _reloadVersion: 1 } as unknown as () => string)();
    deliver(replies.shift()!);
    deliver(replies.shift()!);
    await expect(result).resolves.toBe('new');
  });
});
