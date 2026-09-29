// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { COMMIT } from '../../src/shared/render-constants';
import { globalEnvManager } from './utils/envManager';

let options;
let createRootContext;
let defaultRootContext;
let getCurrentRootContext;
let switchRootContext;
let snapshotPatch;
let initGlobalSnapshotPatch;
let takeGlobalSnapshotPatch;
let replaceCommitHook;
let backgroundSnapshotInstanceManager;
let BackgroundSnapshotInstance;

beforeEach(async () => {
  globalEnvManager.resetEnv();
  globalThis.__LYNX_GROUP_MODULE_SHARING__ = true;
  vi.resetModules();
  ({ options } = await import('preact'));
  ({ createRootContext, defaultRootContext, getCurrentRootContext, switchRootContext } = await import(
    '../../src/render-context'
  ));
  snapshotPatch = await import('../../src/snapshot/lifecycle/patch/snapshotPatch');
  ({ initGlobalSnapshotPatch, takeGlobalSnapshotPatch } = snapshotPatch);
  ({ replaceCommitHook } = await import('../../src/snapshot/lifecycle/patch/commit'));
  ({ backgroundSnapshotInstanceManager, BackgroundSnapshotInstance } = await import(
    '../../src/snapshot/snapshot/backgroundSnapshot'
  ));
});

afterEach(() => {
  switchRootContext(defaultRootContext);
  delete globalThis.__LYNX_GROUP_MODULE_SHARING__;
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('switchRootContext', () => {
  it('routes per-render singletons to the current context and refreshes read aliases', () => {
    const a = createRootContext();
    const b = createRootContext();

    switchRootContext(a);
    initGlobalSnapshotPatch();
    snapshotPatch.__globalSnapshotPatch.push(['A']);

    switchRootContext(b);
    initGlobalSnapshotPatch();
    snapshotPatch.__globalSnapshotPatch.push(['B']);

    switchRootContext(a);
    expect(snapshotPatch.__globalSnapshotPatch).toEqual([['A']]);
    switchRootContext(b);
    expect(snapshotPatch.__globalSnapshotPatch).toEqual([['B']]);

    expect(a.snapshotPatch).toEqual([['A']]);
    expect(b.snapshotPatch).toEqual([['B']]);
  });

  it('takeGlobalSnapshotPatch only drains the current context', () => {
    const a = createRootContext();
    const b = createRootContext();

    switchRootContext(a);
    initGlobalSnapshotPatch();
    snapshotPatch.__globalSnapshotPatch.push(['A']);
    switchRootContext(b);
    initGlobalSnapshotPatch();
    snapshotPatch.__globalSnapshotPatch.push(['B']);

    switchRootContext(a);
    expect(takeGlobalSnapshotPatch()).toEqual([['A']]);
    expect(b.snapshotPatch).toEqual([['B']]);
  });

  it('is a no-op when switching to the current context', () => {
    const a = createRootContext();
    switchRootContext(a);
    const refresher = vi.fn();
    expect(getCurrentRootContext()).toBe(a);
    switchRootContext(a);
    expect(getCurrentRootContext()).toBe(a);
    expect(refresher).not.toHaveBeenCalled();
  });
});

describe('per-root background snapshot instances', () => {
  it('registers each instance in its owner context and tears down only that owner', () => {
    const a = createRootContext();
    const b = createRootContext();

    switchRootContext(a);
    const nodeA = new BackgroundSnapshotInstance('root');
    switchRootContext(b);
    const nodeB = new BackgroundSnapshotInstance('root');

    expect(a.bsiValues.has(nodeA.__id)).toBe(true);
    expect(b.bsiValues.has(nodeA.__id)).toBe(false);
    expect(b.bsiValues.has(nodeB.__id)).toBe(true);
    expect(a.bsiValues.has(nodeB.__id)).toBe(false);

    expect(nodeA.__id).not.toBe(nodeB.__id);

    switchRootContext(a);
    nodeB.tearDown();
    expect(a.bsiValues.has(nodeA.__id)).toBe(true);
    expect(b.bsiValues.has(nodeB.__id)).toBe(false);
  });

  it('manager.values follows the current context', () => {
    const a = createRootContext();
    switchRootContext(a);
    const nodeA = new BackgroundSnapshotInstance('root');
    expect(backgroundSnapshotInstanceManager.values.has(nodeA.__id)).toBe(true);

    switchRootContext(defaultRootContext);
    expect(backgroundSnapshotInstanceManager.values.has(nodeA.__id)).toBe(false);
  });
});

describe('commit callbacks', () => {
  it('run the commit task of the context that sent the patch', () => {
    globalEnvManager.switchToBackground();
    replaceCommitHook();
    const commitInContext = () => {
      const ctx = createRootContext();
      let onPatchApplied;
      ctx.lynx = {
        ...lynx,
        getNativeApp: () => ({
          ...lynx.getNativeApp(),
          callLepusMethod: (_name, _data, callback) => {
            onPatchApplied = callback;
          },
        }),
      };
      switchRootContext(ctx);
      initGlobalSnapshotPatch();
      options[COMMIT]({}, []);
      return { ctx, onPatchApplied: () => onPatchApplied() };
    };

    const a = commitInContext();
    const b = commitInContext();
    expect(a.ctx.commitTaskMap.size).toBe(1);
    expect(b.ctx.commitTaskMap.size).toBe(1);

    a.onPatchApplied();
    expect(a.ctx.commitTaskMap.size).toBe(0);
    expect(b.ctx.commitTaskMap.size).toBe(1);
  });
});

async function importWithSharing() {
  globalThis.__LYNX_GROUP_MODULE_SHARING__ = true;
  vi.resetModules();
  return import('../../src/internal');
}

function stubPage(from) {
  const emitter = { emit() {} };
  const app = { _params: { initData: { from }, updateData: {} }, GlobalEventEmitter: emitter };
  return {
    app,
    pageLynx: {
      ...lynx,
      __globalProps: {},
      __initData: undefined,
      getApp: () => app,
    },
  };
}

describe('createRoot app callbacks', () => {
  afterEach(() => {
    delete globalThis.__LYNX_GROUP_MODULE_SHARING__;
    vi.resetModules();
  });

  it('switches to the owning page context when a bound callback runs', async () => {
    globalEnvManager.switchToBackground();
    const { createRoot } = await importWithSharing();
    const rc = await import('../../src/render-context');
    const { getPageLynx } = await import('../../src/core/page-lynx');

    const a = stubPage('A');
    const b = stubPage('B');
    createRoot(a.pageLynx);
    createRoot(b.pageLynx);

    rc.switchRootContext(rc.defaultRootContext);
    let lynxDuringA;
    a.app.GlobalEventEmitter.emit = () => {
      lynxDuringA = getPageLynx();
    };
    a.app.updateGlobalProps({ k: 1 }, {});
    expect(lynxDuringA).toBe(a.pageLynx);

    rc.switchRootContext(rc.defaultRootContext);
    let lynxDuringB;
    b.app.GlobalEventEmitter.emit = () => {
      lynxDuringB = getPageLynx();
    };
    b.app.updateGlobalProps({ k: 2 }, {});
    expect(lynxDuringB).toBe(b.pageLynx);

    expect(a.pageLynx.__globalProps).toEqual({ k: 1 });
    expect(b.pageLynx.__globalProps).toEqual({ k: 2 });
  });

  it('runs each page\'s effects against its own lynx', async () => {
    globalEnvManager.switchToBackground();
    const { createRoot } = await importWithSharing();
    const { useEffect } = await import('../../src/index');
    const { getPageLynx } = await import('../../src/core/page-lynx');

    const lynxInEffect = {};
    const lynxInCleanup = {};
    const Page = ({ name }) => {
      useEffect(() => {
        lynxInEffect[name] = getPageLynx();
        if (name === 'A') {
          return () => {
            lynxInCleanup[name] = getPageLynx();
          };
        }
      }, []);
      return null;
    };
    const a = stubPage('A');
    const b = stubPage('B');
    const rootA = createRoot(a.pageLynx);
    const rootB = createRoot(b.pageLynx);
    rootA.render(<Page name='A' />);
    rootB.render(<Page name='B' />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(lynxInEffect.A).toBe(a.pageLynx);
    expect(lynxInEffect.B).toBe(b.pageLynx);

    rootA.render(null);
    rootB.render(<Page name='B' />);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(lynxInCleanup.A).toBe(a.pageLynx);
  });

  it('installs the lazy bundle loader on each page\'s lynx', async () => {
    globalEnvManager.switchToBackground();
    const { createRoot } = await importWithSharing();
    const { loadLazyBundle } = await import('../../src/core/lynx/lazy-bundle');

    const a = stubPage('A');
    const b = stubPage('B');
    delete a.pageLynx.loadLazyBundle;
    delete b.pageLynx.loadLazyBundle;
    createRoot(a.pageLynx);
    createRoot(b.pageLynx);

    expect(a.pageLynx.loadLazyBundle).toBe(loadLazyBundle);
    expect(b.pageLynx.loadLazyBundle).toBe(loadLazyBundle);
  });

  it('re-renders the page whose globalProps changed', async () => {
    globalEnvManager.switchToBackground();
    const { createRoot } = await importWithSharing();
    const rc = await import('../../src/render-context');

    const renders = { A: 0, B: 0 };
    const Page = ({ name }) => {
      renders[name]++;
      return null;
    };
    const a = stubPage('A');
    const b = stubPage('B');
    const rootA = createRoot(a.pageLynx);
    const rootB = createRoot(b.pageLynx);
    rootA.render(<Page name='A' />);
    rootB.render(<Page name='B' />);
    renders.A = renders.B = 0;

    a.app.updateGlobalProps({ k: 1 });
    rc.switchRootContext(rc.defaultRootContext);
    await Promise.resolve();

    expect(renders).toEqual({ A: 1, B: 0 });
  });
});

function fakeContext() {
  const listeners = new Map();
  return {
    addEventListener: vi.fn((type, fn) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    }),
    removeEventListener: vi.fn((type, fn) => {
      listeners.get(type)?.delete(fn);
    }),
    dispatchEvent: vi.fn(),
    count: (type) => listeners.get(type)?.size ?? 0,
    emit: (type, data) => {
      for (const fn of listeners.get(type) ?? []) fn({ type, data });
    },
  };
}

function stubRuntimePage(from) {
  const page = stubPage(from);
  const coreContext = fakeContext();
  const nativeApp = { callLepusMethod: vi.fn(), createJSObjectDestructionObserver: vi.fn((cb) => cb) };
  const selectorQuery = { select: vi.fn(() => ({ invoke: () => ({ exec: vi.fn() }) })) };
  Object.assign(page.pageLynx, {
    getCoreContext: () => coreContext,
    getNativeApp: () => nativeApp,
    reportError: vi.fn(),
    createSelectorQuery: vi.fn(() => selectorQuery),
    performance: {
      _generatePipelineOptions: () => ({ pipelineID: `pipeline-${from}` }),
      _onPipelineStart: vi.fn(),
      _bindPipelineIdWithTimingFlag: vi.fn(),
      _markTiming: vi.fn(),
    },
  });
  return { ...page, coreContext, nativeApp, selectorQuery };
}

describe('createRoot page isolation', () => {
  afterEach(() => {
    delete globalThis.__LYNX_GROUP_MODULE_SHARING__;
    vi.resetModules();
  });

  it('reports a missing snapshot ctx on the page whose main thread sent it', async () => {
    globalEnvManager.switchToBackground();
    const { createRoot } = await importWithSharing();
    const { ctxNotFoundType } = await import('../../src/snapshot/lifecycle/patch/error');
    const a = stubRuntimePage('A');
    const b = stubRuntimePage('B');
    createRoot(a.pageLynx);
    createRoot(b.pageLynx);

    expect(a.coreContext.count(ctxNotFoundType)).toBe(1);
    expect(b.coreContext.count(ctxNotFoundType)).toBe(1);

    b.coreContext.emit(ctxNotFoundType, { id: 42 });
    expect(b.pageLynx.reportError).toHaveBeenCalledTimes(1);
    expect(a.pageLynx.reportError).not.toHaveBeenCalled();

    a.app.callDestroyLifetimeFun();
    expect(a.coreContext.count(ctxNotFoundType)).toBe(0);
    expect(b.coreContext.count(ctxNotFoundType)).toBe(1);
  });

  it('gives class components and withInitDataInState the app and data of their own page', async () => {
    globalEnvManager.switchToBackground();
    const { createRoot } = await importWithSharing();
    const { Component, withInitDataInState } = await import('../../src/index');
    const seen = {};
    class Page extends Component {
      render() {
        seen[this.props.name] = { emitter: this.GlobalEventEmitter, state: this.state };
        return null;
      }
    }
    const WithData = withInitDataInState(Page);
    const a = stubRuntimePage('A');
    const b = stubRuntimePage('B');
    a.app.GlobalEventEmitter = { emit() {}, addListener() {}, removeListener() {} };
    b.app.GlobalEventEmitter = { emit() {}, addListener() {}, removeListener() {} };
    a.pageLynx.getJSModule = () => a.app.GlobalEventEmitter;
    b.pageLynx.getJSModule = () => b.app.GlobalEventEmitter;
    createRoot(a.pageLynx).render(<WithData name='A' />);
    createRoot(b.pageLynx).render(<WithData name='B' />);

    expect(seen.A.emitter).toBe(a.app.GlobalEventEmitter);
    expect(seen.B.emitter).toBe(b.app.GlobalEventEmitter);
    expect(seen.A.state).toEqual({ from: 'A' });
    expect(seen.B.state).toEqual({ from: 'B' });
  });
});

describe('per-page runtime state', () => {
  let rc;
  let a;
  let b;
  let ctxA;
  let ctxB;

  beforeEach(async () => {
    globalEnvManager.switchToBackground();
    rc = await import('../../src/render-context');
    a = stubRuntimePage('A');
    b = stubRuntimePage('B');
    ctxA = rc.createRootContext(a.pageLynx);
    ctxB = rc.createRootContext(b.pageLynx);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the reload version of each page apart', async () => {
    const { getReloadVersion, increaseReloadVersion } = await import('../../src/core/reload-version');
    rc.runInRootContext(ctxB, () => {
      increaseReloadVersion();
      increaseReloadVersion();
    });
    rc.runInRootContext(ctxA, () => increaseReloadVersion());

    expect(rc.runInRootContext(ctxA, getReloadVersion)).toBe(1);
    expect(rc.runInRootContext(ctxB, getReloadVersion)).toBe(2);
  });

  it('delays UI ops until the owning page hydrates and runs them against its lynx', async () => {
    const { RefProxy, runDelayedUiOps } = await import('../../src/snapshot/lifecycle/ref/delay');
    rc.runInRootContext(ctxA, () => {
      new RefProxy([1, 0]).invoke({ method: 'boundingClientRect' }).exec();
    });

    rc.runInRootContext(ctxB, runDelayedUiOps);
    expect(a.pageLynx.createSelectorQuery).not.toHaveBeenCalled();
    expect(b.pageLynx.createSelectorQuery).not.toHaveBeenCalled();

    rc.runInRootContext(ctxB, () => {
      new RefProxy([2, 0]).invoke({ method: 'boundingClientRect' }).exec();
    });
    expect(b.pageLynx.createSelectorQuery).toHaveBeenCalledTimes(1);

    rc.runInRootContext(ctxA, runDelayedUiOps);
    expect(a.pageLynx.createSelectorQuery).toHaveBeenCalledTimes(1);
  });

  it('keeps pipeline timing and flush options per page', async () => {
    const perf = await import('../../src/core/performance');
    const { globalCommitContext } = await import('../../src/core/commit-context');

    rc.runInRootContext(ctxA, () => {
      perf.beginPipeline(true, perf.PipelineOrigins.updateTriggeredByBts);
      globalCommitContext.flushOptions.triggerDataUpdated = true;
    });

    rc.runInRootContext(ctxB, () => {
      expect(perf.globalPipelineOptions).toBeUndefined();
      expect(globalCommitContext.flushOptions).toEqual({});
      perf.markTiming('diffVdomStart', true);
    });
    expect(b.pageLynx.performance._markTiming).not.toHaveBeenCalled();

    rc.runInRootContext(ctxA, () => {
      perf.markTiming('diffVdomStart', true);
      expect(globalCommitContext.flushOptions).toEqual({ triggerDataUpdated: true });
    });
    expect(a.pageLynx.performance._markTiming).toHaveBeenCalledWith('pipeline-A', 'diffVdomStart');
  });

  it('runs only the destroy tasks and takes only the main thread ref init values of its page', async () => {
    const { registerDestroyTask, runDestroyTasks } = await import('../../src/core/runtime-destroy');
    const { addMainThreadRefInitValue, takeMainThreadRefInitValuePatch } = await import(
      '../../src/core/main-thread-ref-init-value'
    );
    const tasks = { A: vi.fn(), B: vi.fn() };
    vi.stubGlobal('SystemInfo', { ...globalThis.SystemInfo, lynxSdkVersion: '999.999' });
    rc.runInRootContext(ctxA, () => {
      registerDestroyTask(tasks.A);
      addMainThreadRefInitValue(1, 'A');
    });
    rc.runInRootContext(ctxB, () => {
      registerDestroyTask(tasks.B);
      addMainThreadRefInitValue(2, 'B');
    });

    rc.runInRootContext(ctxA, runDestroyTasks);
    expect(tasks.A).toHaveBeenCalledTimes(1);
    expect(tasks.B).not.toHaveBeenCalled();
    expect(rc.runInRootContext(ctxB, takeMainThreadRefInitValuePatch)).toEqual([[2, 'B']]);
  });

  it('resolves runOnMainThread return values on the page that called it', async () => {
    const { onFunctionCall } = await import('../../src/core/thread-function-call/return-value');
    const { WorkletEvents } = await import('../../src/worklet-runtime/bindings/events');
    const resolved = { A: vi.fn(), B: vi.fn() };
    const idA = rc.runInRootContext(ctxA, () => onFunctionCall(resolved.A));
    const idB = rc.runInRootContext(ctxB, () => onFunctionCall(resolved.B));

    expect(a.coreContext.count(WorkletEvents.FunctionCallRet)).toBe(1);
    expect(b.coreContext.count(WorkletEvents.FunctionCallRet)).toBe(1);

    b.coreContext.emit(WorkletEvents.FunctionCallRet, JSON.stringify({ resolveId: idB, returnValue: 'b' }));
    a.coreContext.emit(WorkletEvents.FunctionCallRet, JSON.stringify({ resolveId: idA, returnValue: 'a' }));
    expect(resolved.A).toHaveBeenCalledWith('a');
    expect(resolved.B).toHaveBeenCalledWith('b');
  });

  it('runs runOnBackground calls from each page and replies to that page', async () => {
    const { registerBackgroundFunctionCtx } = await import('../../src/core/background-function/run-on-background');
    const { WorkletEvents } = await import('../../src/worklet-runtime/bindings/events');
    const fnA = vi.fn(() => 'a');
    const fnB = vi.fn(() => 'b');
    const workletA = { _jsFn: { f: { _jsFnId: 1, _fn: fnA } } };
    const workletB = { _jsFn: { f: { _jsFnId: 1, _fn: fnB } } };
    rc.runInRootContext(ctxA, () => registerBackgroundFunctionCtx(workletA));
    rc.runInRootContext(ctxB, () => registerBackgroundFunctionCtx(workletB));

    b.coreContext.emit(
      WorkletEvents.runOnBackground,
      JSON.stringify({ obj: { _execId: workletB._execId, _jsFnId: 1 }, params: [], resolveId: 7 }),
    );

    expect(fnB).toHaveBeenCalledTimes(1);
    expect(fnA).not.toHaveBeenCalled();
    expect(b.coreContext.dispatchEvent).toHaveBeenCalledWith({
      type: WorkletEvents.FunctionCallRet,
      data: JSON.stringify({ resolveId: 7, returnValue: 'b' }),
    });
    expect(a.coreContext.dispatchEvent).not.toHaveBeenCalled();
  });

  it('releases a main thread ref through the page that created it', async () => {
    const { MainThreadRef } = await import('../../src/core/main-thread-ref');
    const { WorkletEvents } = await import('../../src/worklet-runtime/bindings/events');
    const ref = rc.runInRootContext(ctxA, () => new MainThreadRef(0));

    rc.runInRootContext(ctxB, () => ref._lifecycleObserver());

    expect(a.coreContext.dispatchEvent).toHaveBeenCalledWith({
      type: WorkletEvents.releaseWorkletRef,
      data: { id: ref._wvid },
    });
    expect(b.coreContext.dispatchEvent).not.toHaveBeenCalled();
  });

  it('keeps portals queued before hydration on their own page', async () => {
    const portals = await import('../../src/snapshot/lynx/portalsPending');
    rc.runInRootContext(ctxB, () => portals.pendingInsertBefore.push('container', 'child', undefined));

    rc.runInRootContext(ctxA, () => expect(portals.pendingInsertBefore).toEqual([]));
    rc.runInRootContext(ctxB, () => expect(portals.pendingInsertBefore).toEqual(['container', 'child', undefined]));
  });

  it('restores the previous context after a bound callback and after a render flush', async () => {
    const bound = rc.runInRootContext(ctxA, () => rc.bindRootContext(() => rc.getCurrentRootContext()));
    expect(bound()).toBe(ctxA);
    expect(rc.getCurrentRootContext()).toBe(rc.defaultRootContext);

    const { installContextSwitchHook } = await import('../../src/snapshot/lifecycle/contextSwitchHook');
    installContextSwitchHook();
    await new Promise((resolve) => {
      options.debounceRendering(() => {
        rc.switchRootContext(ctxB);
        resolve();
      });
    });
    expect(rc.getCurrentRootContext()).toBe(rc.defaultRootContext);
  });
});
