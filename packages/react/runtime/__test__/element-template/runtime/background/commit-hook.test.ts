import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkletEvents } from '@lynx-js/react/worklet-runtime/bindings';
import { options } from 'preact';
import { Component, createElement } from 'preact/compat';

import { getReloadVersion } from '../../../../src/core/reload-version.js';
import * as elementTemplateAlog from '../../../../src/element-template/debug/alog.js';
import {
  installElementTemplateCommitHook,
  markElementTemplateHydrated,
  resetElementTemplateCommitState,
  scheduleElementTemplateRemovedSubtreeCleanup,
} from '../../../../src/element-template/background/commit-hook.js';
import { destroyElementTemplateBackgroundRuntime } from '../../../../src/element-template/background/destroy.js';
import {
  installElementTemplateHydrationListener,
  resetElementTemplateHydrationListener,
} from '../../../../src/element-template/background/hydration-listener.js';
import { BackgroundElementTemplateInstance } from '../../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../../src/element-template/background/manager.js';
import {
  globalCommitContext,
  markRemovedSubtreeForPostDispatchTeardown,
  takeRemovedSubtreesForPostDispatchTeardown,
} from '../../../../src/element-template/background/commit-context.js';
import { ElementTemplateUpdateOps } from '../../../../src/element-template/protocol/opcodes.js';
import { ElementTemplateLifecycleConstant } from '../../../../src/element-template/protocol/lifecycle-constant.js';
import { PipelineOrigins } from '../../../../src/core/performance.js';
import {
  enqueueDelayedRunOnMainThreadData,
  takeDelayedRunOnMainThreadData,
} from '../../../../src/core/thread-function-call/main-thread.js';
import { onFunctionCall } from '../../../../src/core/thread-function-call/return-value.js';
import {
  InitDataConsumer,
  InitDataProvider,
  root,
  useInitData,
  useInitDataChanged,
  withInitDataInState,
} from '../../../../src/element-template/index.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';
import { clearRefState, queueRefAttrUpdate } from '../../../../src/element-template/prop-adapters/ref.js';
import { flushCoreContextEvents } from '../../test-utils/mock/mockNativePapi/context.js';

function createRawTextOps(id: number, text: string) {
  return [
    ElementTemplateUpdateOps.createTemplate,
    id,
    '_et_builtin_raw_text',
    null,
    [text],
    [],
  ];
}

type DataChangeListener = (...args: unknown[]) => void;

function installDataChangeHarness() {
  const scheduledRenders: Array<() => void> = [];
  const previousDebounce = options.debounceRendering;
  options.debounceRendering = (cb) => {
    scheduledRenders.push(cb);
  };

  const listeners = new Set<DataChangeListener>();
  const emitter = {
    addListener: vi.fn((eventName: string, listener: DataChangeListener) => {
      if (eventName === 'onDataChanged') {
        listeners.add(listener);
      }
    }),
    removeListener: vi.fn((eventName: string, listener: DataChangeListener) => {
      if (eventName === 'onDataChanged') {
        listeners.delete(listener);
      }
    }),
  };
  const originalGetJSModule = lynx.getJSModule;
  lynx.getJSModule = ((moduleName: string) => {
    if (moduleName === 'GlobalEventEmitter') {
      return emitter;
    }
    return originalGetJSModule?.(moduleName);
  }) as typeof lynx.getJSModule;

  return {
    listeners,
    emitDataChanged(...args: unknown[]) {
      for (const listener of [...listeners]) {
        listener(...args);
      }
    },
    flushScheduledRenders() {
      while (scheduledRenders.length > 0) {
        scheduledRenders.shift()?.();
      }
    },
    restore() {
      options.debounceRendering = previousDebounce;
      lynx.getJSModule = originalGetJSModule;
    },
  };
}

describe('ElementTemplate commit hook', () => {
  const envManager = new ElementTemplateEnvManager();
  let updateEvents: unknown[] = [];

  const onUpdate = (event: { data: unknown }) => {
    updateEvents.push(JSON.parse(event.data as string));
  };

  beforeEach(() => {
    resetElementTemplateCommitState();
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;
    clearRefState();
    updateEvents = [];
    envManager.resetEnv('background');
    installElementTemplateCommitHook();

    envManager.switchToMainThread();
    lynx.getJSContext().addEventListener(ElementTemplateLifecycleConstant.update, onUpdate);
    envManager.switchToBackground();
  });

  afterEach(() => {
    globalThis.__ALOG__ = true;
    envManager.switchToMainThread();
    lynx.getJSContext().removeEventListener(ElementTemplateLifecycleConstant.update, onUpdate);
    envManager.switchToBackground();
    resetElementTemplateHydrationListener();
    resetElementTemplateCommitState();
    clearRefState();
    takeDelayedRunOnMainThreadData();
  });

  it('dispatches update after commit when hydrated', () => {
    markElementTemplateHydrated();
    globalCommitContext.ops = createRawTextOps(1, 'hello');
    globalCommitContext.flushOptions = { nativeUpdateDataOrder: 7 };

    options.__c?.({} as unknown as object, []);

    envManager.switchToMainThread();
    expect(updateEvents).toHaveLength(1);
    expect(updateEvents[0]).toEqual({
      ops: createRawTextOps(1, 'hello'),
      flushOptions: { nativeUpdateDataOrder: 7 },
      flowIds: undefined,
      reloadVersion: getReloadVersion(),
    });
    envManager.switchToBackground();
    expect(globalCommitContext.ops).toEqual([]);
  });

  it('dispatches flush-only update after commit when hydrated', () => {
    markElementTemplateHydrated();
    globalCommitContext.flushOptions = { triggerDataUpdated: true };

    options.__c?.({} as unknown as object, []);

    envManager.switchToMainThread();
    expect(updateEvents).toHaveLength(1);
    expect(updateEvents[0]).toEqual({
      ops: [],
      flushOptions: { triggerDataUpdated: true },
      flowIds: undefined,
      reloadVersion: getReloadVersion(),
    });
    envManager.switchToBackground();
    expect(globalCommitContext.flushOptions).toEqual({});

    options.__c?.({} as unknown as object, []);
    envManager.switchToMainThread();
    expect(updateEvents).toHaveLength(1);
    envManager.switchToBackground();
  });

  it('dispatches delayed-only runOnMainThread payload after commit when hydrated', () => {
    const worklet = { _wkltId: 'delayed-commit-main-thread-function' };
    const delayedData = {
      worklet,
      params: ['from-commit'],
      resolveId: 1,
    };
    markElementTemplateHydrated();
    enqueueDelayedRunOnMainThreadData(delayedData);

    options.__c?.({} as unknown as object, []);

    envManager.switchToMainThread();
    expect(updateEvents).toEqual([
      {
        ops: [],
        flushOptions: {},
        flowIds: undefined,
        reloadVersion: getReloadVersion(),
        delayedRunOnMainThreadData: [delayedData],
      },
    ]);
    envManager.switchToBackground();
    expect(takeDelayedRunOnMainThreadData()).toEqual([]);
  });

  it('drops only the failed delayed runOnMainThread return when update dispatch throws', async () => {
    markElementTemplateHydrated();
    const dispatchError = new Error('update dispatch failed');
    const coreContext = lynx.getCoreContext();
    const removeEventListener = vi.spyOn(coreContext, 'removeEventListener');
    vi.spyOn(coreContext, 'dispatchEvent').mockImplementationOnce(() => {
      throw dispatchError;
    });
    const worklet = { _wkltId: 'failed-commit-main-thread-function' };
    let keptResolveId = 0;
    const keptPromise = new Promise(resolve => {
      keptResolveId = onFunctionCall(resolve);
    });

    enqueueDelayedRunOnMainThreadData({
      worklet,
      params: [],
      resolveId: onFunctionCall(vi.fn()),
    });

    expect(() => options.__c?.({} as unknown as object, [])).toThrow(dispatchError);
    expect(takeDelayedRunOnMainThreadData()).toEqual([]);
    expect(removeEventListener).not.toHaveBeenCalled();

    envManager.switchToMainThread();
    lynx.getJSContext().dispatchEvent({
      type: WorkletEvents.FunctionCallRet,
      data: JSON.stringify({ resolveId: keptResolveId, returnValue: 'kept' }),
    });
    flushCoreContextEvents();
    envManager.switchToBackground();
    await expect(keptPromise).resolves.toBe('kept');
  });

  it('dispatches triggerDataUpdated when useInitData observes a data change', () => {
    const dataChange = installDataChangeHarness();

    try {
      function App() {
        useInitData();
        return createElement('view');
      }

      lynx.__initData = { msg: 'before' };
      root.render(createElement(App, null));
      expect(dataChange.listeners.size).toBe(1);

      markElementTemplateHydrated();
      lynx.__initData = { msg: 'after' };
      dataChange.emitDataChanged();
      dataChange.flushScheduledRenders();

      envManager.switchToMainThread();
      expect(updateEvents).toHaveLength(1);
      expect(updateEvents[0]).toMatchObject({
        ops: [],
        flushOptions: { triggerDataUpdated: true },
      });
    } finally {
      dataChange.restore();
    }
  });

  it('dispatches triggerDataUpdated when InitDataProvider observes a data change', () => {
    const dataChange = installDataChangeHarness();
    const renderedMessages: unknown[] = [];

    try {
      function App() {
        return createElement(
          InitDataProvider,
          null,
          createElement(InitDataConsumer, null, (initData: { msg?: string }) => {
            renderedMessages.push(initData.msg);
            return createElement('view');
          }),
        );
      }

      lynx.__initData = { msg: 'before' };
      root.render(createElement(App, null));
      expect(dataChange.listeners.size).toBe(1);
      expect(renderedMessages).toEqual(['before']);

      markElementTemplateHydrated();
      lynx.__initData = { msg: 'after' };
      dataChange.emitDataChanged();
      dataChange.flushScheduledRenders();

      expect(renderedMessages).toContain('after');
      envManager.switchToMainThread();
      expect(updateEvents).toHaveLength(1);
      expect(updateEvents[0]).toMatchObject({
        ops: [],
        flushOptions: { triggerDataUpdated: true },
      });
    } finally {
      dataChange.restore();
    }
  });

  it('notifies useInitDataChanged listeners through aliased ET hooks', () => {
    const dataChange = installDataChangeHarness();
    const onChanged = vi.fn();

    try {
      function App() {
        useInitDataChanged(onChanged);
        return createElement('view');
      }

      root.render(createElement(App, null));
      expect(dataChange.listeners.size).toBe(1);

      dataChange.emitDataChanged({ msg: 'after' });

      expect(onChanged).toHaveBeenCalledTimes(1);
      expect(onChanged).toHaveBeenCalledWith({ msg: 'after' });
    } finally {
      dataChange.restore();
    }
  });

  it('dispatches triggerDataUpdated when withInitDataInState observes a data change', () => {
    const dataChange = installDataChangeHarness();

    try {
      class App extends Component<Record<string, never>, { msg?: string }> {
        override render() {
          return createElement('view');
        }
      }
      const WrappedApp = withInitDataInState(App);

      lynx.__initData = { msg: 'before' };
      root.render(createElement(WrappedApp, null));
      expect(dataChange.listeners.size).toBe(1);

      markElementTemplateHydrated();
      dataChange.emitDataChanged({ msg: 'after' });
      dataChange.flushScheduledRenders();

      envManager.switchToMainThread();
      expect(updateEvents).toHaveLength(1);
      expect(updateEvents[0]).toMatchObject({
        ops: [],
        flushOptions: { triggerDataUpdated: true },
      });
    } finally {
      dataChange.restore();
    }
  });

  it('dispatches one data-updated payload for multiple initData readers', () => {
    const dataChange = installDataChangeHarness();
    let first: unknown;
    let second: unknown;
    let consumed: unknown;

    try {
      function App() {
        first = useInitData();
        second = useInitData();
        return createElement(
          InitDataProvider,
          null,
          createElement(InitDataConsumer, null, (initData: { msg?: string }) => {
            consumed = initData;
            return createElement('view');
          }),
        );
      }

      lynx.__initData = { msg: 'before' };
      root.render(createElement(App, null));
      expect(first).toEqual({ msg: 'before' });
      expect(second).toEqual({ msg: 'before' });
      expect(consumed).toEqual({ msg: 'before' });

      markElementTemplateHydrated();
      lynx.__initData = { msg: 'after' };
      dataChange.emitDataChanged();
      dataChange.flushScheduledRenders();

      expect(first).toEqual({ msg: 'after' });
      expect(second).toEqual({ msg: 'after' });
      expect(consumed).toEqual({ msg: 'after' });
      envManager.switchToMainThread();
      expect(updateEvents).toHaveLength(1);
      expect(updateEvents[0]).toMatchObject({
        ops: [],
        flushOptions: { triggerDataUpdated: true },
      });
    } finally {
      dataChange.restore();
    }
  });

  it('skips dispatch before hydration', () => {
    globalCommitContext.ops = createRawTextOps(1, 'hello');

    options.__c?.({} as unknown as object, []);

    envManager.switchToMainThread();
    expect(updateEvents).toHaveLength(0);
  });

  it('does not leak pre-hydration patches into later commits', () => {
    installElementTemplateHydrationListener();

    globalCommitContext.ops = createRawTextOps(1, 'before');
    globalCommitContext.flushOptions = { nativeUpdateDataOrder: 1 };

    envManager.switchToMainThread();
    lynx.getJSContext().dispatchEvent({
      type: ElementTemplateLifecycleConstant.hydrate,
      data: [],
    });
    envManager.switchToBackground();

    globalCommitContext.ops.push(...createRawTextOps(1, 'after'));
    globalCommitContext.flushOptions = { nativeUpdateDataOrder: 2 };

    options.__c?.({} as unknown as object, []);

    envManager.switchToMainThread();
    expect(updateEvents).toHaveLength(2);
    expect(updateEvents[0]).toMatchObject({
      ops: [],
      flushOptions: {
        pipelineOptions: {
          pipelineID: 'pipelineID',
          needTimestamps: true,
          pipelineOrigin: PipelineOrigins.reactLynxHydrate,
          dsl: 'reactLynx',
          stage: 'hydrate',
        },
      },
      isHydration: true,
    });
    expect(updateEvents[1]).toMatchObject({
      ops: createRawTextOps(1, 'after'),
      flushOptions: {
        nativeUpdateDataOrder: 2,
      },
    });
    expect(updateEvents[1]?.flushOptions.pipelineOptions).toBeUndefined();
    envManager.switchToBackground();
  });

  it('logs post-hydration update commits when alog is enabled', () => {
    const alog = console.alog as unknown as { mock: { calls: unknown[][] }; mockClear(): void };
    alog.mockClear();

    markElementTemplateHydrated();
    globalCommitContext.ops = createRawTextOps(1, 'hello');
    globalCommitContext.flushOptions = { nativeUpdateDataOrder: 7 };
    globalCommitContext.flowIds = [101, 202];

    options.__c?.({} as unknown as object, []);

    const output = alog.mock.calls.map(args => String(args[0])).join('\n');
    expect(output).toContain('[ReactLynxDebug] ElementTemplate BTS -> MTS update');
    expect(output).toContain('createTemplate');
    expect(output).toContain('nativeUpdateDataOrder');
    expect(output).toContain('101');
  });

  it('does not format update commit alog when alog is disabled', () => {
    globalThis.__ALOG__ = false;
    const alog = console.alog as unknown as { mock: { calls: unknown[][] }; mockClear(): void };
    alog.mockClear();
    const formatSpy = vi.spyOn(elementTemplateAlog, 'formatElementTemplateUpdateCommands');

    markElementTemplateHydrated();
    globalCommitContext.ops = createRawTextOps(1, 'hello');
    globalCommitContext.flushOptions = { nativeUpdateDataOrder: 7 };

    options.__c?.({} as unknown as object, []);

    expect(formatSpy).not.toHaveBeenCalled();
    expect(alog.mock.calls).toHaveLength(0);
  });

  it('schedules delayed cleanup from the current commit non-payload state', () => {
    vi.useFakeTimers();
    try {
      markElementTemplateHydrated();
      const root = new BackgroundElementTemplateInstance('root');
      markRemovedSubtreeForPostDispatchTeardown(root);
      globalCommitContext.ops = createRawTextOps(1, 'flush');

      options.__c?.({} as unknown as object, []);
      expect(globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown).toEqual([]);
      vi.advanceTimersByTime(9999);
      expect(backgroundElementTemplateInstanceManager.get(root.instanceId)).toBe(root);

      vi.advanceTimersByTime(1);

      expect(backgroundElementTemplateInstanceManager.get(root.instanceId)).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a removed subtree that is reattached before delayed cleanup', () => {
    vi.useFakeTimers();
    try {
      const parent = new BackgroundElementTemplateInstance('parent');
      const root = new BackgroundElementTemplateInstance('root');
      parent.appendChild(root);
      markElementTemplateHydrated();
      parent.markMaterializedByHydration();
      root.markMaterializedByHydration();

      parent.removeChild(root);
      scheduleElementTemplateRemovedSubtreeCleanup(takeRemovedSubtreesForPostDispatchTeardown());
      parent.appendChild(root);

      vi.advanceTimersByTime(10000);

      expect(backgroundElementTemplateInstanceManager.get(root.instanceId)).toBe(root);
      expect(root.parent).toBe(parent);
    } finally {
      vi.useRealTimers();
    }
  });

  it('releases detached subtrees without destroying data needed for later reattach', () => {
    vi.useFakeTimers();
    try {
      const parent = new BackgroundElementTemplateInstance('parent');
      const root = new BackgroundElementTemplateInstance('root');
      const child = new BackgroundElementTemplateInstance('child', ['value']);
      root.appendChild(child);
      parent.appendChild(root);
      markElementTemplateHydrated();
      parent.markMaterializedByHydration();
      root.markMaterializedByHydration();
      child.markMaterializedByHydration();

      parent.removeChild(root);
      scheduleElementTemplateRemovedSubtreeCleanup(takeRemovedSubtreesForPostDispatchTeardown());
      vi.advanceTimersByTime(10000);

      expect(backgroundElementTemplateInstanceManager.get(root.instanceId)).toBeUndefined();
      expect(backgroundElementTemplateInstanceManager.get(child.instanceId)).toBeUndefined();
      expect(root.firstChild).toBe(child);
      expect(child.parent).toBe(root);
      expect(child.attributeSlots).toEqual(['value']);

      globalCommitContext.ops = [];
      parent.appendChild(root);

      expect(backgroundElementTemplateInstanceManager.get(root.instanceId)).toBe(root);
      expect(backgroundElementTemplateInstanceManager.get(child.instanceId)).toBe(child);
      expect(globalCommitContext.ops).toEqual([
        ElementTemplateUpdateOps.createTemplate,
        child.instanceId,
        'child',
        null,
        ['value'],
        [],
        ElementTemplateUpdateOps.createTemplate,
        root.instanceId,
        'root',
        null,
        [],
        [[child.instanceId]],
        ElementTemplateUpdateOps.insertNode,
        parent.instanceId,
        0,
        root.instanceId,
        0,
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not overwrite a conflicting manager entry when recreating a detached subtree', () => {
    vi.useFakeTimers();
    try {
      const parent = new BackgroundElementTemplateInstance('parent');
      const root = new BackgroundElementTemplateInstance('root');
      parent.appendChild(root);
      markElementTemplateHydrated();
      parent.markMaterializedByHydration();
      root.markMaterializedByHydration();

      parent.removeChild(root);
      scheduleElementTemplateRemovedSubtreeCleanup(takeRemovedSubtreesForPostDispatchTeardown());
      vi.advanceTimersByTime(10000);
      expect(backgroundElementTemplateInstanceManager.get(root.instanceId)).toBeUndefined();

      const conflicting = new BackgroundElementTemplateInstance('conflicting');
      backgroundElementTemplateInstanceManager.updateId(conflicting.instanceId, root.instanceId);
      globalCommitContext.ops = [];

      expect(() => parent.appendChild(root)).toThrow(
        `ElementTemplate handleId ${root.instanceId} is already bound.`,
      );
      expect(backgroundElementTemplateInstanceManager.get(root.instanceId)).toBe(conflicting);
      expect(globalCommitContext.ops).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('flushes ref-only updates without dispatching native ops', () => {
    const ref = vi.fn();
    markElementTemplateHydrated();
    queueRefAttrUpdate(null, ref, -2, 0);

    options.__c?.({} as unknown as object, []);

    envManager.switchToMainThread();
    expect(updateEvents).toHaveLength(0);
    envManager.switchToBackground();
    expect(ref).toHaveBeenCalledWith(expect.objectContaining({
      selector: '[ref=-2-0]',
    }));
  });

  it('dispatches data-updated payload while flushing ref-only effects', () => {
    const ref = vi.fn();
    markElementTemplateHydrated();
    globalCommitContext.flushOptions = { triggerDataUpdated: true };
    queueRefAttrUpdate(null, ref, -2, 0);

    options.__c?.({} as unknown as object, []);

    envManager.switchToMainThread();
    expect(updateEvents).toEqual([
      {
        ops: [],
        flushOptions: { triggerDataUpdated: true },
        flowIds: undefined,
        reloadVersion: getReloadVersion(),
      },
    ]);
    envManager.switchToBackground();
    expect(ref).toHaveBeenCalledWith(expect.objectContaining({
      selector: '[ref=-2-0]',
    }));
  });

  it('flushes pre-hydration ref effects on commit without dispatching native ops', () => {
    const ref = vi.fn();
    queueRefAttrUpdate(null, ref, 1, 0);

    options.__c?.({} as unknown as object, []);

    envManager.switchToMainThread();
    expect(updateEvents).toHaveLength(0);
    envManager.switchToBackground();
    expect(ref).toHaveBeenCalledWith(expect.objectContaining({
      selector: '[ref=1-0]',
    }));
  });

  it('keeps pending removed subtrees when only the hydration listener is reset', () => {
    const root = new BackgroundElementTemplateInstance('root');
    markRemovedSubtreeForPostDispatchTeardown(root);

    resetElementTemplateHydrationListener();

    expect(globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown).toEqual([root]);
  });

  it('cancels scheduled removed subtree cleanup on background destroy', () => {
    vi.useFakeTimers();
    try {
      const root = new BackgroundElementTemplateInstance('root');
      const tearDown = vi.spyOn(root, 'tearDown');
      scheduleElementTemplateRemovedSubtreeCleanup([root]);

      destroyElementTemplateBackgroundRuntime();
      vi.advanceTimersByTime(10000);

      expect(tearDown).not.toHaveBeenCalled();
      expect(backgroundElementTemplateInstanceManager.get(root.instanceId)).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('resets commit state when update dispatch throws', () => {
    vi.useFakeTimers();
    const dispatchError = new Error('update dispatch failed');
    const dispatchSpy = vi.spyOn(lynx.getCoreContext(), 'dispatchEvent').mockImplementationOnce(() => {
      throw dispatchError;
    });

    try {
      markElementTemplateHydrated();
      const root = new BackgroundElementTemplateInstance('root');
      markRemovedSubtreeForPostDispatchTeardown(root);
      globalCommitContext.ops = createRawTextOps(1, 'flush');

      expect(() => options.__c?.({} as unknown as object, [])).toThrow(dispatchError);
      expect(globalCommitContext.ops).toEqual([]);
      expect(globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown).toEqual([]);

      vi.advanceTimersByTime(10000);
      expect(backgroundElementTemplateInstanceManager.get(root.instanceId)).toBeUndefined();
    } finally {
      dispatchSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('clears pending refs when update dispatch throws', () => {
    const ref = vi.fn();
    const dispatchError = new Error('update dispatch failed');
    const dispatchSpy = vi.spyOn(lynx.getCoreContext(), 'dispatchEvent').mockImplementationOnce(() => {
      throw dispatchError;
    });

    try {
      markElementTemplateHydrated();
      queueRefAttrUpdate(null, ref, -2, 0);
      globalCommitContext.ops = createRawTextOps(1, 'flush');

      expect(() => options.__c?.({} as unknown as object, [])).toThrow(dispatchError);
      expect(ref).not.toHaveBeenCalled();

      globalCommitContext.ops = [];
      options.__c?.({} as unknown as object, []);
      expect(ref).not.toHaveBeenCalled();
    } finally {
      dispatchSpy.mockRestore();
    }
  });

  it('is idempotent', () => {
    installElementTemplateCommitHook();
    installElementTemplateCommitHook();
    expect(true).toBe(true);
  });
});
