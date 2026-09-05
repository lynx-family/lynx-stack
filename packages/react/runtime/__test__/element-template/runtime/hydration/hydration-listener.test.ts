import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';

import { WorkletEvents } from '@lynx-js/react/worklet-runtime/bindings';

import { MainThreadRef, clearMainThreadRefLastIdForTesting } from '../../../../src/core/main-thread-ref.js';
import { takeMainThreadRefInitValuePatch } from '../../../../src/core/main-thread-ref-init-value.js';
import { clearMtsConfigCacheForTesting } from '../../../../src/core/mts-capability.js';
import { getReloadVersion, increaseReloadVersion } from '../../../../src/core/reload-version.js';
import * as elementTemplateAlog from '../../../../src/element-template/debug/alog.js';
import { globalCommitContext } from '../../../../src/element-template/background/commit-context.js';
import {
  installElementTemplateHydrationListener,
  resetElementTemplateHydrationListener,
} from '../../../../src/element-template/background/hydration-listener.js';
import {
  installElementTemplatePatchListener,
  resetElementTemplatePatchListener,
} from '../../../../src/element-template/native/patch-listener.js';
import {
  BackgroundElementTemplateInstance,
  BackgroundListElementTemplateInstance,
} from '../../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../../src/element-template/background/manager.js';
import { PerformanceTimingFlags, PipelineOrigins, globalPipelineOptions } from '../../../../src/core/performance.js';
import {
  clearEventState,
  flushPendingEvents,
  publishEvent,
  resetEventStateForRuntime,
} from '../../../../src/element-template/prop-adapters/event.js';
import {
  ElementTemplateRefProxy,
  clearRefState,
  flushDelayedRefUiOps,
  flushPendingRefs,
} from '../../../../src/element-template/prop-adapters/ref.js';
import { ElementTemplateLifecycleConstant } from '../../../../src/element-template/protocol/lifecycle-constant.js';
import { ElementTemplateUpdateOps } from '../../../../src/element-template/protocol/opcodes.js';
import { parseElementTemplateUpdateEventPayload } from '../../../../src/element-template/protocol/update-event.js';
import type {
  SerializableValue,
  SerializedElementTemplate,
  SerializedEtNode,
  SerializedPageRoot,
  SerializedTypedNode,
} from '../../../../src/element-template/protocol/types.js';
import { __root } from '../../../../src/element-template/runtime/page/root-instance.js';
import {
  __etAttrPlanMap,
  adaptEventAttrSlot,
  adaptRefAttrSlot,
  adaptSpreadAttrSlot,
  clearEtAttrPlanMap,
} from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import {
  enqueueDelayedRunOnMainThreadData,
  takeDelayedRunOnMainThreadData,
} from '../../../../src/core/thread-function-call/main-thread.js';
import { runOnMainThread } from '../../../../src/element-template/runtime/template/main-thread-function.js';
import { resetFunctionCallReturnListener } from '../../../../src/core/thread-function-call/return-value.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';

import '../../../../src/element-template/native/index.js';

function createSerializedTemplate(handleId: number, templateKey: string): SerializedElementTemplate {
  return {
    templateKey,
    attributeSlots: [],
    elementSlots: [],
    uid: handleId,
  };
}

interface LynxMock {
  getJSContext(): { dispatchEvent(event: { type: string; data: unknown }): number };
}

interface TTMock {
  callDestroyLifetimeFun?: () => void;
}

function parseUpdateEventData(data: unknown): unknown {
  return parseElementTemplateUpdateEventPayload(data);
}

function dispatchHydrate(
  instances: SerializedEtNode[],
  reloadVersion = getReloadVersion(),
  attributes: SerializedPageRoot['attributes'] = null,
): void {
  lynx.getJSContext().dispatchEvent({
    type: ElementTemplateLifecycleConstant.hydrate,
    data: {
      page: {
        tag: 'page',
        attributes,
        elementSlots: [instances],
        uid: 0,
      },
      reloadVersion,
    },
  });
}

describe('ElementTemplate hydration listener', () => {
  const envManager = new ElementTemplateEnvManager();
  let originalLynxSdkVersion: string | undefined;

  beforeEach(() => {
    rs.clearAllMocks();
    originalLynxSdkVersion = SystemInfo.lynxSdkVersion;
    SystemInfo.lynxSdkVersion = '4.0';
    clearMainThreadRefLastIdForTesting();
    clearMtsConfigCacheForTesting();
    takeMainThreadRefInitValuePatch();
    clearEtAttrPlanMap();
    clearEventState();
    clearRefState();
    resetElementTemplateHydrationListener();
    envManager.resetEnv('background');
  });

  afterEach(() => {
    globalThis.__ALOG__ = true;
    resetElementTemplateHydrationListener();
    clearRefState();
    takeMainThreadRefInitValuePatch();
    takeDelayedRunOnMainThreadData();
    resetFunctionCallReturnListener();
    SystemInfo.lynxSdkVersion = originalLynxSdkVersion;
    clearMtsConfigCacheForTesting();
  });

  it('hydrates instances sent from main thread', () => {
    envManager.switchToBackground();
    installElementTemplateHydrationListener();

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const after = new BackgroundElementTemplateInstance('_et_test');
    backgroundRoot.appendChild(after);
    const oldId = after.instanceId;

    envManager.switchToMainThread();
    const instances: SerializedElementTemplate[] = [
      createSerializedTemplate(-1, '_et_test'),
      createSerializedTemplate(-2, '_et_test'),
    ];
    dispatchHydrate(instances);

    const lynxObj = (globalThis as unknown as { lynx: LynxMock }).lynx;
    lynxObj.getJSContext().dispatchEvent({
      type: '_unknown',
      data: { not: 'an array' },
    });

    envManager.switchToBackground();

    expect(backgroundElementTemplateInstanceManager.get(oldId)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(-1)).toBe(after);
    expect(backgroundElementTemplateInstanceManager.get(-2)).toBeUndefined();
  });

  it('hydrates when no pipeline options are generated', () => {
    const performance = lynx.performance as unknown as {
      _generatePipelineOptions?: unknown;
    };
    const originalGenerate = performance._generatePipelineOptions;
    performance._generatePipelineOptions = undefined;

    try {
      envManager.switchToBackground();
      installElementTemplateHydrationListener();

      const backgroundRoot = __root as BackgroundElementTemplateInstance;
      const after = new BackgroundElementTemplateInstance('_et_test');
      backgroundRoot.appendChild(after);

      envManager.switchToMainThread();
      dispatchHydrate([createSerializedTemplate(after.instanceId, '_et_test')]);

      envManager.switchToBackground();

      expect(globalPipelineOptions).toBeUndefined();
    } finally {
      performance._generatePipelineOptions = originalGenerate;
    }
  });

  it('dispatches hydration boundary after clean hydrate without ops', () => {
    envManager.switchToBackground();
    installElementTemplateHydrationListener();
    const dispatchSpy = rs.spyOn(lynx.getCoreContext(), 'dispatchEvent');

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const after = new BackgroundElementTemplateInstance('_et_test');
    backgroundRoot.appendChild(after);

    envManager.switchToMainThread();
    dispatchHydrate([createSerializedTemplate(after.instanceId, '_et_test')]);

    envManager.switchToBackground();
    const updatePayload = parseUpdateEventData(dispatchSpy.mock.calls.at(-1)?.[0]?.data);
    expect(updatePayload).toEqual({
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
      flowIds: undefined,
      isHydration: true,
      reloadVersion: getReloadVersion(),
      delayedRunOnMainThreadData: undefined,
    });
  });

  it('dispatches delayed-only runOnMainThread payloads after clean hydrate', () => {
    envManager.switchToBackground();
    installElementTemplateHydrationListener();
    const dispatchSpy = rs.spyOn(lynx.getCoreContext(), 'dispatchEvent');

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const after = new BackgroundElementTemplateInstance('_et_test');
    backgroundRoot.appendChild(after);
    const delayedData = {
      worklet: { _wkltId: 'clean-hydrate-main-thread-function' },
      params: ['from-hydrate'],
      resolveId: 1,
    };
    enqueueDelayedRunOnMainThreadData(delayedData);

    envManager.switchToMainThread();
    dispatchHydrate([createSerializedTemplate(after.instanceId, '_et_test')]);

    envManager.switchToBackground();
    const updatePayload = parseUpdateEventData(dispatchSpy.mock.calls.at(-1)?.[0]?.data);
    expect(updatePayload).toEqual({
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
      flowIds: undefined,
      isHydration: true,
      reloadVersion: getReloadVersion(),
      delayedRunOnMainThreadData: [delayedData],
    });
    expect(takeDelayedRunOnMainThreadData()).toEqual([]);
  });

  it('dispatches MainThreadRef init-value patch after clean hydrate', () => {
    envManager.switchToBackground();
    installElementTemplateHydrationListener();
    const dispatchSpy = rs.spyOn(lynx.getCoreContext(), 'dispatchEvent');

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const after = new BackgroundElementTemplateInstance('_et_test');
    backgroundRoot.appendChild(after);
    new MainThreadRef('hydrate-init');

    envManager.switchToMainThread();
    dispatchHydrate([createSerializedTemplate(after.instanceId, '_et_test')]);

    envManager.switchToBackground();
    const updatePayload = parseUpdateEventData(dispatchSpy.mock.calls.at(-1)?.[0]?.data);
    expect(updatePayload).toEqual({
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
      flowIds: undefined,
      isHydration: true,
      reloadVersion: getReloadVersion(),
      delayedRunOnMainThreadData: undefined,
      mainThreadRefInitValuePatch: [[1, 'hydrate-init']],
    });
    expect(takeMainThreadRefInitValuePatch()).toEqual([]);
  });

  it('applies MainThreadRef init values when reload makes the hydration update stale', () => {
    const updateWorkletRefInitValueChanges = rs.fn();
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _refImpl: {
        updateWorkletRefInitValueChanges,
      },
    };

    try {
      envManager.switchToBackground();
      installElementTemplateHydrationListener();

      const backgroundRoot = __root as BackgroundElementTemplateInstance;
      const after = new BackgroundElementTemplateInstance('_et_test');
      backgroundRoot.appendChild(after);
      new MainThreadRef('reload-init');

      envManager.switchToMainThread();
      installElementTemplatePatchListener();
      dispatchHydrate([createSerializedTemplate(after.instanceId, '_et_test')]);

      envManager.switchToBackground();
      // This harness shares module state across both simulated threads. Advance
      // the version after BTS dispatch so the queued update is stale on MTS.
      increaseReloadVersion();
      rs.mocked(__FlushElementTree).mockClear();
      envManager.switchToMainThread();

      expect(updateWorkletRefInitValueChanges).toHaveBeenCalledWith([[1, 'reload-init']]);
      expect(__FlushElementTree).not.toHaveBeenCalled();
    } finally {
      envManager.switchToMainThread();
      resetElementTemplatePatchListener();
      globalThis.lynxWorkletImpl = previousWorkletImpl;
      envManager.switchToBackground();
    }
  });

  it('clears delayed runOnMainThread state when hydrate matching fails', () => {
    SystemInfo.lynxSdkVersion = '4.0';
    envManager.switchToBackground();
    installElementTemplateHydrationListener();
    const removeEventListener = rs.spyOn(lynx.getCoreContext(), 'removeEventListener');
    const oldReportError = lynx.reportError;
    const reportError = rs.fn();
    lynx.reportError = reportError;

    try {
      const backgroundRoot = __root as BackgroundElementTemplateInstance;
      const after = new BackgroundElementTemplateInstance('_et_test');
      backgroundRoot.appendChild(after);
      const worklet = { _wkltId: 'failed-hydrate-main-thread-function' };

      void runOnMainThread(worklet as unknown as () => void)();
      expect(takeDelayedRunOnMainThreadData()).toEqual([
        {
          worklet,
          params: [],
          resolveId: 1,
        },
      ]);
      void runOnMainThread(worklet as unknown as () => void)();

      envManager.switchToMainThread();
      dispatchHydrate([createSerializedTemplate(0, '_et_test')]);

      envManager.switchToBackground();
      expect(reportError).toHaveBeenCalledTimes(1);
      expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
        'ElementTemplate hydrate received invalid uid 0 for \'_et_test\'',
      );
      expect(takeDelayedRunOnMainThreadData()).toEqual([]);
      expect(removeEventListener).toHaveBeenCalledWith(WorkletEvents.FunctionCallRet, expect.any(Function));
      expect(globalPipelineOptions).toBeUndefined();
    } finally {
      lynx.reportError = oldReportError;
    }
  });

  it('clears MainThreadRef init-value patch when hydrate matching fails', () => {
    SystemInfo.lynxSdkVersion = '4.0';
    const oldReportError = lynx.reportError;
    const reportError = rs.fn();
    lynx.reportError = reportError;

    try {
      envManager.switchToBackground();
      installElementTemplateHydrationListener();

      const backgroundRoot = __root as BackgroundElementTemplateInstance;
      const after = new BackgroundElementTemplateInstance('_et_test');
      backgroundRoot.appendChild(after);
      new MainThreadRef('failed-hydrate-init');

      envManager.switchToMainThread();
      dispatchHydrate([createSerializedTemplate(0, '_et_test')]);

      envManager.switchToBackground();
      expect(takeMainThreadRefInitValuePatch()).toEqual([]);
      expect(reportError).toHaveBeenCalledTimes(1);
    } finally {
      lynx.reportError = oldReportError;
    }
  });

  it('ignores stale hydrate payloads from before reload', () => {
    envManager.switchToBackground();
    installElementTemplateHydrationListener();

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const after = new BackgroundElementTemplateInstance('_et_test');
    backgroundRoot.appendChild(after);
    const oldId = after.instanceId;
    const staleReloadVersion = getReloadVersion();
    increaseReloadVersion();

    envManager.switchToMainThread();
    dispatchHydrate([createSerializedTemplate(-1, '_et_test')], staleReloadVersion);

    envManager.switchToBackground();
    expect(backgroundElementTemplateInstanceManager.get(oldId)).toBe(after);
    expect(backgroundElementTemplateInstanceManager.get(-1)).toBeUndefined();
  });

  it('hydrates typed list roots sent from main thread', () => {
    const oldReportError = lynx.reportError;
    const reportError = rs.fn();
    lynx.reportError = reportError;

    try {
      envManager.switchToBackground();
      installElementTemplateHydrationListener();

      const backgroundRoot = __root as BackgroundElementTemplateInstance;
      const list = new BackgroundListElementTemplateInstance();
      const item = new BackgroundElementTemplateInstance('_et_list_item');
      list.setAttribute('attributes', { id: 'feed' });
      list.appendChild(item);
      backgroundRoot.appendChild(list);
      const oldListId = list.instanceId;
      const oldItemId = item.instanceId;

      envManager.switchToMainThread();
      dispatchHydrate([
        {
          tag: 'list',
          attributes: { id: 'feed' },
          elementSlots: null,
          uid: -1,
          options: {
            listChildren: [createSerializedTemplate(-2, '_et_list_item')],
          },
        } satisfies SerializedTypedNode,
      ]);

      envManager.switchToBackground();

      expect(reportError).not.toHaveBeenCalled();
      expect(globalCommitContext.ops).toEqual([]);
      expect(backgroundElementTemplateInstanceManager.get(oldListId)).toBeUndefined();
      expect(backgroundElementTemplateInstanceManager.get(oldItemId)).toBeUndefined();
      expect(backgroundElementTemplateInstanceManager.get(-1)).toBe(list);
      expect(backgroundElementTemplateInstanceManager.get(-2)).toBe(item);
    } finally {
      lynx.reportError = oldReportError;
    }
  });

  it('reconciles root type mismatch through page slot update instead of hydrate failure', () => {
    const oldReportError = lynx.reportError;
    const reportError = rs.fn();
    lynx.reportError = reportError;

    try {
      envManager.switchToBackground();
      installElementTemplateHydrationListener();
      const dispatchSpy = rs.spyOn(lynx.getCoreContext(), 'dispatchEvent');

      const backgroundRoot = __root as BackgroundElementTemplateInstance;
      const after = new BackgroundElementTemplateInstance('_et_after', ['after']);
      backgroundRoot.appendChild(after);
      const afterLocalId = after.instanceId;

      envManager.switchToMainThread();
      dispatchHydrate([createSerializedTemplate(-1, '_et_before')]);

      envManager.switchToBackground();

      const updateCall = dispatchSpy.mock.calls.find(([event]) =>
        (event as { type: string }).type === ElementTemplateLifecycleConstant.update
      );
      const updatePayload = parseUpdateEventData(updateCall?.[0].data);
      expect(reportError).not.toHaveBeenCalled();
      expect(updateCall?.[0]).toMatchObject({ type: ElementTemplateLifecycleConstant.update });
      expect(updatePayload).toMatchObject({
        isHydration: true,
        reloadVersion: getReloadVersion(),
        ops: [
          ElementTemplateUpdateOps.removeNode,
          0,
          0,
          -1,
          [-1],
          ElementTemplateUpdateOps.createTemplate,
          afterLocalId,
          '_et_after',
          null,
          ['after'],
          [],
          ElementTemplateUpdateOps.insertNode,
          0,
          0,
          afterLocalId,
          0,
          null,
        ],
      });
      expect(backgroundElementTemplateInstanceManager.get(afterLocalId)).toBe(after);
      expect(backgroundElementTemplateInstanceManager.get(-1)).toBeUndefined();
    } finally {
      lynx.reportError = oldReportError;
    }
  });

  it('inserts background-only roots during hydrate', () => {
    envManager.switchToBackground();
    installElementTemplateHydrationListener();
    const dispatchSpy = rs.spyOn(lynx.getCoreContext(), 'dispatchEvent');

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const after = new BackgroundElementTemplateInstance('_et_after');
    backgroundRoot.appendChild(after);
    const afterLocalId = after.instanceId;

    envManager.switchToMainThread();
    dispatchHydrate([]);

    envManager.switchToBackground();

    const updateCall = dispatchSpy.mock.calls.find(([event]) =>
      (event as { type: string }).type === ElementTemplateLifecycleConstant.update
    );
    const updatePayload = parseUpdateEventData(updateCall?.[0].data);
    expect(updateCall?.[0]).toMatchObject({ type: ElementTemplateLifecycleConstant.update });
    expect(updatePayload).toMatchObject({
      isHydration: true,
      reloadVersion: getReloadVersion(),
      ops: [
        ElementTemplateUpdateOps.createTemplate,
        afterLocalId,
        '_et_after',
        null,
        [],
        [],
        ElementTemplateUpdateOps.insertNode,
        0,
        0,
        afterLocalId,
        0,
        null,
      ],
    });
  });

  it('removes serialized-only roots during hydrate', () => {
    envManager.switchToBackground();
    installElementTemplateHydrationListener();
    const dispatchSpy = rs.spyOn(lynx.getCoreContext(), 'dispatchEvent');

    envManager.switchToMainThread();
    dispatchHydrate([createSerializedTemplate(-1, '_et_stale')]);

    envManager.switchToBackground();

    const updateCall = dispatchSpy.mock.calls.find(([event]) =>
      (event as { type: string }).type === ElementTemplateLifecycleConstant.update
    );
    const updatePayload = parseUpdateEventData(updateCall?.[0].data);
    expect(updateCall?.[0]).toMatchObject({ type: ElementTemplateLifecycleConstant.update });
    expect(updatePayload).toMatchObject({
      isHydration: true,
      reloadVersion: getReloadVersion(),
      ops: [
        ElementTemplateUpdateOps.removeNode,
        0,
        0,
        -1,
        [-1],
      ],
    });
    expect(backgroundElementTemplateInstanceManager.get(-1)).toBeUndefined();
  });

  it('schedules delayed cleanup for removed subtrees produced during hydration', () => {
    rs.useFakeTimers();
    try {
      envManager.switchToBackground();
      installElementTemplateHydrationListener();
      const dispatchSpy = rs.spyOn(lynx.getCoreContext(), 'dispatchEvent');

      const backgroundRoot = __root as BackgroundElementTemplateInstance;
      const host = new BackgroundElementTemplateInstance('_et_test');
      backgroundRoot.appendChild(host);
      const stale = new BackgroundElementTemplateInstance('_et_stale');

      envManager.switchToMainThread();
      dispatchHydrate([
        {
          ...createSerializedTemplate(host.instanceId, '_et_test'),
          elementSlots: [[createSerializedTemplate(stale.instanceId, '_et_stale')]],
        },
      ]);

      envManager.switchToBackground();
      expect(dispatchSpy).toHaveBeenCalledWith({
        type: ElementTemplateLifecycleConstant.update,
        data: expect.anything(),
      });
      expect(parseUpdateEventData(dispatchSpy.mock.calls.at(-1)?.[0]?.data)).toEqual(
        expect.objectContaining({
          isHydration: true,
          reloadVersion: getReloadVersion(),
        }),
      );
      rs.advanceTimersByTime(9999);
      expect(backgroundElementTemplateInstanceManager.get(stale.instanceId)).toBe(stale);

      rs.advanceTimersByTime(1);
      expect(backgroundElementTemplateInstanceManager.get(stale.instanceId)).toBeUndefined();
    } finally {
      rs.useRealTimers();
    }
  });

  it('resets commit state when hydrate serialization throws with no delayed main-thread data', () => {
    SystemInfo.lynxSdkVersion = '4.0';
    const serializeError = new Error('hydrate update serialization failed');
    const oldReportError = lynx.reportError;
    const reportError = rs.fn();
    const printTreeSpy = rs.spyOn(
      elementTemplateAlog,
      'printElementTemplateTreeToString',
    ).mockReturnValue('<tree>');
    lynx.reportError = reportError;

    try {
      __etAttrPlanMap._et_serialize_failure = [1, adaptEventAttrSlot];
      resetEventStateForRuntime();
      envManager.switchToBackground();
      installElementTemplateHydrationListener();

      const backgroundRoot = __root as BackgroundElementTemplateInstance;
      const throwingValue = {
        toJSON() {
          throw serializeError;
        },
      } as unknown as SerializableValue;
      const after = new BackgroundElementTemplateInstance(
        '_et_serialize_failure',
        [throwingValue, rs.fn()],
      );
      backgroundRoot.appendChild(after);

      envManager.switchToMainThread();
      dispatchHydrate([
        {
          ...createSerializedTemplate(-1, '_et_serialize_failure'),
          attributeSlots: ['before', '-1:1:'],
        } satisfies SerializedElementTemplate,
      ]);

      expect(() => envManager.switchToBackground()).not.toThrow();
      expect(reportError).toHaveBeenCalledWith(serializeError);
      expect(globalCommitContext.ops).toEqual([]);
      expect(takeDelayedRunOnMainThreadData()).toEqual([]);
    } finally {
      lynx.reportError = oldReportError;
      printTreeSpy.mockRestore();
    }
  });

  it('resets commit state when hydrate update serialization throws', () => {
    SystemInfo.lynxSdkVersion = '4.0';
    const serializeError = new Error('hydrate update serialization failed');
    const oldReportError = lynx.reportError;
    const oldCreateSelectorQuery = lynx.createSelectorQuery;
    const reportError = rs.fn();
    const eventHandler = rs.fn();
    const ref = rs.fn();
    const exec = rs.fn();
    const select = rs.fn(() => ({ setNativeProps: rs.fn(() => ({ exec })) }));
    const printTreeSpy = rs.spyOn(elementTemplateAlog, 'printElementTemplateTreeToString').mockReturnValue('<tree>');
    lynx.reportError = reportError;
    lynx.createSelectorQuery = rs.fn(() => ({ select })) as typeof lynx.createSelectorQuery;

    try {
      __etAttrPlanMap._et_serialize_failure = [1, adaptEventAttrSlot, 2, adaptRefAttrSlot];
      resetEventStateForRuntime();
      envManager.switchToBackground();
      installElementTemplateHydrationListener();
      const removeEventListener = rs.spyOn(lynx.getCoreContext(), 'removeEventListener');

      const backgroundRoot = __root as BackgroundElementTemplateInstance;
      const throwingValue = {
        toJSON() {
          throw serializeError;
        },
      } as unknown as SerializableValue;
      const after = new BackgroundElementTemplateInstance('_et_serialize_failure', [throwingValue, eventHandler, ref]);
      backgroundRoot.appendChild(after);
      publishEvent('-1:1:', { type: 'tap' });
      new ElementTemplateRefProxy(after.instanceId, 2).setNativeProps({ opacity: 1 }).exec();
      new MainThreadRef('failed-serialize-init');
      void runOnMainThread({ _wkltId: 'failed-serialize-main-thread-function' } as unknown as () => void)();

      envManager.switchToMainThread();
      dispatchHydrate([
        {
          ...createSerializedTemplate(-1, '_et_serialize_failure'),
          attributeSlots: ['before', '-1:1:', '-1-2'],
        } satisfies SerializedElementTemplate,
      ]);

      expect(() => envManager.switchToBackground()).not.toThrow();
      expect(reportError).toHaveBeenCalledWith(serializeError);
      expect(globalCommitContext.ops).toEqual([]);
      expect(globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown).toEqual([]);
      expect(takeMainThreadRefInitValuePatch()).toEqual([]);
      expect(takeDelayedRunOnMainThreadData()).toEqual([]);
      expect(removeEventListener).toHaveBeenCalledWith(WorkletEvents.FunctionCallRet, expect.any(Function));
      expect(globalPipelineOptions).toBeUndefined();
      flushPendingEvents();
      flushPendingRefs();
      flushDelayedRefUiOps();
      expect(eventHandler).not.toHaveBeenCalled();
      expect(ref).not.toHaveBeenCalled();
      expect(select).not.toHaveBeenCalled();
      expect(exec).not.toHaveBeenCalled();
      expect(lynx.performance._markTiming.mock.calls).toEqual([
        ['pipelineID', 'hydrateParseSnapshotStart'],
        ['pipelineID', 'hydrateParseSnapshotEnd'],
        ['pipelineID', 'diffVdomStart'],
        ['pipelineID', 'diffVdomEnd'],
        ['pipelineID', 'packChangesStart'],
        ['pipelineID', 'packChangesEnd'],
      ]);
    } finally {
      lynx.reportError = oldReportError;
      lynx.createSelectorQuery = oldCreateSelectorQuery;
      printTreeSpy.mockRestore();
    }
  });

  it('processes hydrate events only when background events are flushed', () => {
    envManager.switchToBackground();
    installElementTemplateHydrationListener();

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const after = new BackgroundElementTemplateInstance('_et_test');
    backgroundRoot.appendChild(after);
    const oldId = after.instanceId;

    envManager.switchToMainThread();
    const instances: SerializedElementTemplate[] = [createSerializedTemplate(-1, '_et_test')];
    dispatchHydrate(instances);

    expect(backgroundElementTemplateInstanceManager.get(oldId)).toBe(after);
    expect(backgroundElementTemplateInstanceManager.get(-1)).toBeUndefined();

    envManager.switchToBackground();
    expect(backgroundElementTemplateInstanceManager.get(oldId)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(-1)).toBe(after);
  });

  it('cleans up hydrate listener via tt.callDestroyLifetimeFun', () => {
    envManager.switchToBackground();
    installElementTemplateHydrationListener();

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const after = new BackgroundElementTemplateInstance('_et_test');
    backgroundRoot.appendChild(after);
    const oldId = after.instanceId;

    const tt = lynx.getApp() as unknown as TTMock;
    tt.callDestroyLifetimeFun?.();

    envManager.switchToMainThread();
    const instances: SerializedElementTemplate[] = [createSerializedTemplate(-1, '_et_test')];
    dispatchHydrate(instances);

    envManager.switchToBackground();
    expect(backgroundElementTemplateInstanceManager.get(oldId)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(-1)).toBeUndefined();
  });

  it('flushes queued direct events after hydrate registers serialized handlers', () => {
    __etAttrPlanMap._et_event = [0, adaptEventAttrSlot];
    resetEventStateForRuntime();
    envManager.switchToBackground();
    installElementTemplateHydrationListener();

    const eventData = { type: 'tap' };
    const handler = rs.fn();
    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const after = new BackgroundElementTemplateInstance('_et_event');
    after.setAttribute('attributeSlots', [handler]);
    backgroundRoot.appendChild(after);

    publishEvent('-1:0:', eventData);

    envManager.switchToMainThread();
    dispatchHydrate([
      {
        templateKey: '_et_event',
        attributeSlots: ['-1:0:'],
        elementSlots: [],
        uid: -1,
      } satisfies SerializedElementTemplate,
    ]);

    envManager.switchToBackground();

    expect(handler).toHaveBeenCalledWith(eventData);
  });

  it('drops queued direct events when root replacement leaves the old event handle unmatched', () => {
    __etAttrPlanMap._et_event = [0, adaptEventAttrSlot];
    resetEventStateForRuntime();
    const oldReportError = lynx.reportError;
    const reportError = rs.fn();
    lynx.reportError = reportError;

    try {
      envManager.switchToBackground();
      installElementTemplateHydrationListener();

      const eventData = { type: 'tap' };
      const handler = rs.fn();
      const backgroundRoot = __root as BackgroundElementTemplateInstance;
      const after = new BackgroundElementTemplateInstance('_et_event');
      after.setAttribute('attributeSlots', [handler]);
      backgroundRoot.appendChild(after);

      publishEvent('-1:0:', eventData);

      envManager.switchToMainThread();
      dispatchHydrate([
        {
          templateKey: '_et_mismatch',
          attributeSlots: ['-1:0:'],
          elementSlots: [],
          uid: -1,
        } satisfies SerializedElementTemplate,
      ]);

      envManager.switchToBackground();

      expect(reportError).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    } finally {
      lynx.reportError = oldReportError;
    }
  });

  it('does not attach pending direct refs during hydrate', () => {
    const ref = rs.fn();
    __etAttrPlanMap._et_ref = [0, adaptRefAttrSlot];
    envManager.switchToBackground();
    installElementTemplateHydrationListener();

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const after = new BackgroundElementTemplateInstance('_et_ref');
    after.setAttribute('attributeSlots', [ref]);
    backgroundRoot.appendChild(after);

    envManager.switchToMainThread();
    dispatchHydrate([
      {
        templateKey: '_et_ref',
        attributeSlots: ['-1-0'],
        elementSlots: [],
        uid: -1,
      } satisfies SerializedElementTemplate,
    ]);

    envManager.switchToBackground();

    expect(ref).not.toHaveBeenCalled();
  });

  it('does not re-attach pre-hydration refs and replays delayed ref ops after hydrate', () => {
    const exec = rs.fn();
    const setNativeProps = rs.fn(() => ({ exec }));
    const select = rs.fn(() => ({ setNativeProps }));
    const createSelectorQuery = rs.fn(() => ({ select }));
    const oldCreateSelectorQuery = lynx.createSelectorQuery;
    lynx.createSelectorQuery = createSelectorQuery as typeof lynx.createSelectorQuery;

    try {
      const ref = rs.fn();
      __etAttrPlanMap._et_ref = [0, adaptRefAttrSlot];
      envManager.switchToBackground();
      installElementTemplateHydrationListener();

      const backgroundRoot = __root as BackgroundElementTemplateInstance;
      const after = new BackgroundElementTemplateInstance('_et_ref');
      after.setAttribute('attributeSlots', [ref]);
      backgroundRoot.appendChild(after);
      flushPendingRefs();
      const proxy = ref.mock.calls[0]![0];
      proxy.setNativeProps({ opacity: 1 }).exec();
      expect(select).not.toHaveBeenCalled();
      ref.mockClear();

      envManager.switchToMainThread();
      dispatchHydrate([
        {
          templateKey: '_et_ref',
          attributeSlots: ['-1-0'],
          elementSlots: [],
          uid: -1,
        } satisfies SerializedElementTemplate,
      ]);

      envManager.switchToBackground();

      expect(ref).not.toHaveBeenCalled();
      expect(select).toHaveBeenCalledWith('[ref=-1-0]');
      expect(setNativeProps).toHaveBeenCalledWith({ opacity: 1 });
      expect(exec).toHaveBeenCalledTimes(1);
    } finally {
      lynx.createSelectorQuery = oldCreateSelectorQuery;
    }
  });

  it('does not re-attach pre-hydration spread refs and replays delayed ref ops after hydrate', () => {
    const exec = rs.fn();
    const setNativeProps = rs.fn(() => ({ exec }));
    const select = rs.fn(() => ({ setNativeProps }));
    const createSelectorQuery = rs.fn(() => ({ select }));
    const oldCreateSelectorQuery = lynx.createSelectorQuery;
    lynx.createSelectorQuery = createSelectorQuery as typeof lynx.createSelectorQuery;

    try {
      const ref = rs.fn();
      __etAttrPlanMap._et_spread = [0, adaptSpreadAttrSlot];
      envManager.switchToBackground();
      installElementTemplateHydrationListener();

      const backgroundRoot = __root as BackgroundElementTemplateInstance;
      const after = new BackgroundElementTemplateInstance('_et_spread');
      after.setAttribute('attributeSlots', [{ ref }]);
      backgroundRoot.appendChild(after);
      flushPendingRefs();
      const proxy = ref.mock.calls[0]![0];
      proxy.setNativeProps({ opacity: 1 }).exec();
      expect(select).not.toHaveBeenCalled();
      ref.mockClear();

      envManager.switchToMainThread();
      dispatchHydrate([
        {
          templateKey: '_et_spread',
          attributeSlots: [{ ref: '-1-0' }],
          elementSlots: [],
          uid: -1,
        } satisfies SerializedElementTemplate,
      ]);

      envManager.switchToBackground();

      expect(ref).not.toHaveBeenCalled();
      expect(select).toHaveBeenCalledWith('[ref=-1-0]');
      expect(setNativeProps).toHaveBeenCalledWith({ opacity: 1 });
      expect(exec).toHaveBeenCalledTimes(1);
    } finally {
      lynx.createSelectorQuery = oldCreateSelectorQuery;
    }
  });

  it('detaches and attaches spread refs on real updates after hydrate', () => {
    const oldRef = rs.fn();
    const newRef = rs.fn();
    __etAttrPlanMap._et_spread = [0, adaptSpreadAttrSlot];
    envManager.switchToBackground();
    installElementTemplateHydrationListener();

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const after = new BackgroundElementTemplateInstance('_et_spread');
    after.setAttribute('attributeSlots', [{ ref: oldRef }]);
    backgroundRoot.appendChild(after);
    flushPendingRefs();
    oldRef.mockClear();

    envManager.switchToMainThread();
    dispatchHydrate([
      {
        templateKey: '_et_spread',
        attributeSlots: [{ ref: '-1-0' }],
        elementSlots: [],
        uid: -1,
      } satisfies SerializedElementTemplate,
    ]);

    envManager.switchToBackground();
    expect(oldRef).not.toHaveBeenCalled();

    after.setAttribute('attributeSlots', [{ ref: newRef }]);
    flushPendingRefs();

    expect(oldRef).toHaveBeenCalledWith(null);
    expect(newRef).toHaveBeenCalledWith(expect.objectContaining({
      selector: '[ref=-1-0]',
    }));
  });

  it('drops delayed ref ops when hydrate fails before stable handle binding', () => {
    const exec = rs.fn();
    const setNativeProps = rs.fn(() => ({ exec }));
    const select = rs.fn(() => ({ setNativeProps }));
    const createSelectorQuery = rs.fn(() => ({ select }));
    const oldCreateSelectorQuery = lynx.createSelectorQuery;
    const oldReportError = lynx.reportError;
    const reportError = rs.fn();
    lynx.createSelectorQuery = createSelectorQuery as typeof lynx.createSelectorQuery;
    lynx.reportError = reportError;

    try {
      const ref = rs.fn();
      __etAttrPlanMap._et_ref = [0, adaptRefAttrSlot];
      envManager.switchToBackground();
      installElementTemplateHydrationListener();

      const backgroundRoot = __root as BackgroundElementTemplateInstance;
      const after = new BackgroundElementTemplateInstance('_et_ref');
      after.setAttribute('attributeSlots', [ref]);
      backgroundRoot.appendChild(after);
      flushPendingRefs();
      const proxy = ref.mock.calls[0]![0];
      proxy.setNativeProps({ opacity: 1 }).exec();
      expect(select).not.toHaveBeenCalled();

      envManager.switchToMainThread();
      dispatchHydrate([
        {
          templateKey: '_et_ref',
          attributeSlots: ['-1-0'],
          elementSlots: [],
          uid: 0,
        } satisfies SerializedElementTemplate,
      ]);

      envManager.switchToBackground();
      flushDelayedRefUiOps();

      expect(reportError).toHaveBeenCalledTimes(1);
      expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
        'invalid uid 0',
      );
      expect(select).not.toHaveBeenCalled();
      expect(setNativeProps).not.toHaveBeenCalled();
      expect(exec).not.toHaveBeenCalled();
    } finally {
      lynx.createSelectorQuery = oldCreateSelectorQuery;
      lynx.reportError = oldReportError;
    }
  });

  it('marks hydrate performance timings on background thread', () => {
    SystemInfo.lynxSdkVersion = '4.0';
    envManager.switchToBackground();
    installElementTemplateHydrationListener();

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const after = new BackgroundElementTemplateInstance('_et_test');
    backgroundRoot.appendChild(after);
    const { performance } = lynx;
    const profileEndCallCount = performance.profileEnd.mock.calls.length;

    envManager.switchToMainThread();
    const instances: SerializedElementTemplate[] = [createSerializedTemplate(-1, '_et_test')];
    dispatchHydrate(instances);

    envManager.switchToBackground();

    expect(performance.profileStart).toHaveBeenCalledWith('ReactLynx::hydrate');
    expect(performance.profileStart).toHaveBeenCalledWith('ReactLynx::commitChanges');
    expect(performance.profileEnd.mock.calls.length - profileEndCallCount).toBeGreaterThanOrEqual(2);

    const onStartCalls = performance._onPipelineStart.mock.calls;
    expect(onStartCalls).toHaveLength(1);
    expect(onStartCalls[0]?.[0]).toBe('pipelineID');
    expect(onStartCalls[0]?.[1]).toMatchObject({
      pipelineID: 'pipelineID',
      needTimestamps: true,
      pipelineOrigin: PipelineOrigins.reactLynxHydrate,
      dsl: 'reactLynx',
      stage: 'hydrate',
    });

    const bindCalls = performance._bindPipelineIdWithTimingFlag.mock.calls;
    expect(bindCalls).toHaveLength(1);
    expect(bindCalls[0]).toEqual(['pipelineID', PerformanceTimingFlags.reactLynxHydrate]);

    expect(performance._markTiming.mock.calls).toEqual([
      ['pipelineID', 'hydrateParseSnapshotStart'],
      ['pipelineID', 'hydrateParseSnapshotEnd'],
      ['pipelineID', 'diffVdomStart'],
      ['pipelineID', 'diffVdomEnd'],
      ['pipelineID', 'packChangesStart'],
      ['pipelineID', 'packChangesEnd'],
    ]);
  });

  it('marks hydrate packChanges around update payload serialization', () => {
    SystemInfo.lynxSdkVersion = '4.0';
    globalThis.__ALOG__ = false;
    envManager.switchToBackground();
    installElementTemplateHydrationListener();

    let didSerializePayload = false;
    const serializingValue = {
      toJSON() {
        didSerializePayload = true;
        expect(lynx.performance._markTiming.mock.calls).toEqual([
          ['pipelineID', 'hydrateParseSnapshotStart'],
          ['pipelineID', 'hydrateParseSnapshotEnd'],
          ['pipelineID', 'diffVdomStart'],
          ['pipelineID', 'diffVdomEnd'],
          ['pipelineID', 'packChangesStart'],
        ]);
        return 'after';
      },
    } as unknown as SerializableValue;

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const after = new BackgroundElementTemplateInstance('_et_test', [serializingValue]);
    backgroundRoot.appendChild(after);

    envManager.switchToMainThread();
    dispatchHydrate([
      {
        ...createSerializedTemplate(-1, '_et_test'),
        attributeSlots: ['before'],
      } satisfies SerializedElementTemplate,
    ]);

    envManager.switchToBackground();

    expect(didSerializePayload).toBe(true);
    expect(lynx.performance._markTiming.mock.calls).toEqual([
      ['pipelineID', 'hydrateParseSnapshotStart'],
      ['pipelineID', 'hydrateParseSnapshotEnd'],
      ['pipelineID', 'diffVdomStart'],
      ['pipelineID', 'diffVdomEnd'],
      ['pipelineID', 'packChangesStart'],
      ['pipelineID', 'packChangesEnd'],
    ]);
  });

  it('logs hydrate payload and background tree states when alog is enabled', () => {
    envManager.switchToBackground();
    installElementTemplateHydrationListener();

    const alog = console.alog as unknown as { mock: { calls: unknown[][] }; mockClear(): void };
    alog.mockClear();

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const after = new BackgroundElementTemplateInstance('_et_test', ['before']);
    backgroundRoot.appendChild(after);

    envManager.switchToMainThread();
    dispatchHydrate([
      {
        templateKey: '_et_test',
        attributeSlots: ['after'],
        elementSlots: [],
        uid: -1,
      } satisfies SerializedElementTemplate,
    ]);

    envManager.switchToBackground();

    const output = alog.mock.calls.map(args => String(args[0])).join('\n');
    expect(output).toContain('[ReactLynxDebug] ElementTemplate MTS -> BTS hydrate');
    expect(output).toContain('BackgroundElementTemplate tree before hydration');
    expect(output).toContain('BackgroundElementTemplate tree after hydration');
    expect(output).toContain('setAttribute');
  });

  it('does not format hydrate alog when alog is disabled', () => {
    globalThis.__ALOG__ = false;
    envManager.switchToBackground();
    installElementTemplateHydrationListener();

    const alog = console.alog as unknown as { mock: { calls: unknown[][] }; mockClear(): void };
    alog.mockClear();
    const formatSpy = rs.spyOn(elementTemplateAlog, 'formatElementTemplateUpdateCommands');
    const printSpy = rs.spyOn(elementTemplateAlog, 'printElementTemplateTreeToString');

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const after = new BackgroundElementTemplateInstance('_et_test', ['before']);
    backgroundRoot.appendChild(after);

    envManager.switchToMainThread();
    dispatchHydrate([
      {
        templateKey: '_et_test',
        attributeSlots: ['after'],
        elementSlots: [],
        uid: -1,
      } satisfies SerializedElementTemplate,
    ]);

    envManager.switchToBackground();

    expect(formatSpy).not.toHaveBeenCalled();
    expect(printSpy).not.toHaveBeenCalled();
    expect(alog.mock.calls).toHaveLength(0);
  });

  it('fails serialized-only invalid root removal without dispatching updates or replaying delayed refs', () => {
    const exec = rs.fn();
    const setNativeProps = rs.fn(() => ({ exec }));
    const select = rs.fn(() => ({ setNativeProps }));
    const createSelectorQuery = rs.fn(() => ({ select }));
    const oldCreateSelectorQuery = lynx.createSelectorQuery;
    const oldReportError = lynx.reportError;
    const reportError = rs.fn();
    lynx.createSelectorQuery = createSelectorQuery as typeof lynx.createSelectorQuery;
    lynx.reportError = reportError;

    try {
      __etAttrPlanMap._et_ref = [0, adaptRefAttrSlot];
      envManager.switchToBackground();
      installElementTemplateHydrationListener();
      const dispatchSpy = rs.spyOn(lynx.getCoreContext(), 'dispatchEvent');

      const backgroundRoot = __root as BackgroundElementTemplateInstance;
      const ref = rs.fn();
      const after = new BackgroundElementTemplateInstance('_et_ref');
      after.setAttribute('attributeSlots', [ref]);
      backgroundRoot.appendChild(after);
      flushPendingRefs();
      const proxy = ref.mock.calls[0]![0];
      proxy.setNativeProps({ opacity: 1 }).exec();

      envManager.switchToMainThread();
      dispatchHydrate([createSerializedTemplate(0, '_et_stale')]);

      envManager.switchToBackground();
      flushDelayedRefUiOps();

      const updateCall = dispatchSpy.mock.calls.find(([event]) =>
        (event as { type: string }).type === ElementTemplateLifecycleConstant.update
      );
      expect(updateCall).toBeUndefined();
      expect(reportError).toHaveBeenCalledTimes(1);
      expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('invalid uid 0');
      expect(select).not.toHaveBeenCalled();
      expect(setNativeProps).not.toHaveBeenCalled();
      expect(exec).not.toHaveBeenCalled();
    } finally {
      lynx.createSelectorQuery = oldCreateSelectorQuery;
      lynx.reportError = oldReportError;
      (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
    }
  });

  it('reports illegal handleId 0 during hydrate', () => {
    envManager.switchToBackground();
    installElementTemplateHydrationListener();

    const lynxObj = globalThis.lynx as typeof lynx & { reportError?: (error: Error) => void };
    const oldReportError = lynxObj.reportError;
    const reportErrorSpy = rs.fn();
    lynxObj.reportError = reportErrorSpy;

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const after = new BackgroundElementTemplateInstance('_et_test');
    backgroundRoot.appendChild(after);
    const oldId = after.instanceId;

    envManager.switchToMainThread();
    dispatchHydrate([createSerializedTemplate(0, '_et_test')]);

    envManager.switchToBackground();

    expect(reportErrorSpy).toHaveBeenCalledTimes(1);
    expect(String(reportErrorSpy.mock.calls[0]?.[0]?.message ?? '')).toContain('invalid uid 0');
    expect(backgroundElementTemplateInstanceManager.get(oldId)).toBe(after);
    expect(backgroundElementTemplateInstanceManager.get(0)).toBe(backgroundRoot);

    lynxObj.reportError = oldReportError;
  });

  it('reports duplicate handleId during hydrate', () => {
    envManager.switchToBackground();
    installElementTemplateHydrationListener();

    const lynxObj = globalThis.lynx as typeof lynx & { reportError?: (error: Error) => void };
    const oldReportError = lynxObj.reportError;
    const reportErrorSpy = rs.fn();
    lynxObj.reportError = reportErrorSpy;

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const first = new BackgroundElementTemplateInstance('_et_test');
    const second = new BackgroundElementTemplateInstance('_et_test');
    backgroundRoot.appendChild(first);
    backgroundRoot.appendChild(second);
    const oldSecondId = second.instanceId;

    envManager.switchToMainThread();
    dispatchHydrate([createSerializedTemplate(-1, '_et_test'), createSerializedTemplate(-1, '_et_test')]);

    envManager.switchToBackground();

    expect(reportErrorSpy).toHaveBeenCalledTimes(1);
    expect(String(reportErrorSpy.mock.calls[0]?.[0]?.message ?? '')).toContain('already bound');
    expect(backgroundElementTemplateInstanceManager.get(-1)).toBe(first);
    expect(backgroundElementTemplateInstanceManager.get(oldSecondId)).toBe(second);

    lynxObj.reportError = oldReportError;
  });
});
