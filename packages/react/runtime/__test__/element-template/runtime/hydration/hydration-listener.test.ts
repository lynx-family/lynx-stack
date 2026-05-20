import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as elementTemplateAlog from '../../../../src/element-template/debug/alog.js';
import { globalCommitContext } from '../../../../src/element-template/background/commit-context.js';
import {
  installElementTemplateHydrationListener,
  resetElementTemplateHydrationListener,
} from '../../../../src/element-template/background/hydration-listener.js';
import { BackgroundElementTemplateInstance } from '../../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../../src/element-template/background/manager.js';
import { PerformanceTimingFlags, PipelineOrigins } from '../../../../src/element-template/lynx/performance.js';
import {
  clearEventState,
  publishEvent,
  resetEventStateForRuntime,
} from '../../../../src/element-template/prop-adapters/event.js';
import {
  clearRefState,
  flushDelayedRefUiOps,
  flushPendingRefs,
} from '../../../../src/element-template/prop-adapters/ref.js';
import { ElementTemplateLifecycleConstant } from '../../../../src/element-template/protocol/lifecycle-constant.js';
import type {
  SerializedElementTemplate,
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
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';
import { flushCoreContextEvents } from '../../test-utils/mock/mockNativePapi/context.js';

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

describe('ElementTemplate hydration listener', () => {
  const envManager = new ElementTemplateEnvManager();

  beforeEach(() => {
    vi.clearAllMocks();
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
    lynx.getJSContext().dispatchEvent({
      type: ElementTemplateLifecycleConstant.hydrate,
      data: instances,
    });

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

  it('drops typed roots before typed hydrate support lands', () => {
    const oldReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;

    try {
      envManager.switchToBackground();
      installElementTemplateHydrationListener();

      const backgroundRoot = __root as BackgroundElementTemplateInstance;
      const after = new BackgroundElementTemplateInstance('_et_test');
      backgroundRoot.appendChild(after);
      const oldId = after.instanceId;

      envManager.switchToMainThread();
      lynx.getJSContext().dispatchEvent({
        type: ElementTemplateLifecycleConstant.hydrate,
        data: [
          {
            type: 'view',
            elementSlots: [],
            uid: -1,
          } satisfies SerializedTypedNode,
        ],
      });

      envManager.switchToBackground();

      expect(reportError).toHaveBeenCalledTimes(1);
      expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
        'does not support serialized typed root',
      );
      expect(backgroundElementTemplateInstanceManager.get(oldId)).toBe(after);
      expect(backgroundElementTemplateInstanceManager.get(-1)).toBeUndefined();
    } finally {
      lynx.reportError = oldReportError;
    }
  });

  it('schedules delayed cleanup for removed subtrees produced during hydration', () => {
    vi.useFakeTimers();
    try {
      envManager.switchToBackground();
      installElementTemplateHydrationListener();

      const backgroundRoot = __root as BackgroundElementTemplateInstance;
      const host = new BackgroundElementTemplateInstance('_et_test');
      backgroundRoot.appendChild(host);
      const stale = new BackgroundElementTemplateInstance('_et_stale');

      envManager.switchToMainThread();
      lynx.getJSContext().dispatchEvent({
        type: ElementTemplateLifecycleConstant.hydrate,
        data: [
          {
            ...createSerializedTemplate(host.instanceId, '_et_test'),
            elementSlots: [[createSerializedTemplate(stale.instanceId, '_et_stale')]],
          },
        ],
      });

      envManager.switchToBackground();
      vi.advanceTimersByTime(9999);
      expect(backgroundElementTemplateInstanceManager.get(stale.instanceId)).toBe(stale);

      vi.advanceTimersByTime(1);
      expect(backgroundElementTemplateInstanceManager.get(stale.instanceId)).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('resets commit state when hydrate update dispatch throws', () => {
    vi.useFakeTimers();
    const dispatchError = new Error('hydrate update dispatch failed');
    let dispatchSpy: ReturnType<typeof vi.spyOn> | undefined;

    try {
      envManager.switchToBackground();
      installElementTemplateHydrationListener();
      dispatchSpy = vi.spyOn(lynx.getCoreContext(), 'dispatchEvent').mockImplementationOnce(() => {
        throw dispatchError;
      });

      const backgroundRoot = __root as BackgroundElementTemplateInstance;
      const host = new BackgroundElementTemplateInstance('_et_test');
      backgroundRoot.appendChild(host);
      const stale = new BackgroundElementTemplateInstance('_et_stale');

      envManager.switchToMainThread();
      lynx.getJSContext().dispatchEvent({
        type: ElementTemplateLifecycleConstant.hydrate,
        data: [
          {
            ...createSerializedTemplate(host.instanceId, '_et_test'),
            elementSlots: [[createSerializedTemplate(stale.instanceId, '_et_stale')]],
          },
        ],
      });

      expect(() => envManager.switchToBackground()).toThrow(dispatchError);
      expect(globalCommitContext.ops).toEqual([]);
      expect(globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown).toEqual([]);

      vi.advanceTimersByTime(10000);
      expect(backgroundElementTemplateInstanceManager.get(stale.instanceId)).toBeUndefined();
    } finally {
      dispatchSpy?.mockRestore();
      vi.useRealTimers();
    }
  });

  it('clears pending direct refs when hydrate update dispatch throws', () => {
    const dispatchError = new Error('hydrate update dispatch failed');
    const ref = vi.fn();
    let dispatchSpy: ReturnType<typeof vi.spyOn> | undefined;

    try {
      __etAttrPlanMap._et_ref_parent = [0, adaptRefAttrSlot];
      envManager.switchToBackground();
      installElementTemplateHydrationListener();
      dispatchSpy = vi.spyOn(lynx.getCoreContext(), 'dispatchEvent').mockImplementationOnce(() => {
        throw dispatchError;
      });

      const backgroundRoot = __root as BackgroundElementTemplateInstance;
      const parent = new BackgroundElementTemplateInstance('_et_parent');
      const inserted = new BackgroundElementTemplateInstance('_et_ref_parent');
      inserted.setAttribute('attributeSlots', [ref]);
      parent.appendChild(inserted);
      backgroundRoot.appendChild(parent);

      envManager.switchToMainThread();
      lynx.getJSContext().dispatchEvent({
        type: ElementTemplateLifecycleConstant.hydrate,
        data: [
          {
            templateKey: '_et_parent',
            attributeSlots: [],
            elementSlots: [[]],
            uid: -1,
          } satisfies SerializedElementTemplate,
        ],
      });

      expect(() => envManager.switchToBackground()).toThrow(dispatchError);
      expect(ref).not.toHaveBeenCalled();

      envManager.switchToBackground();
      expect(ref).not.toHaveBeenCalled();
    } finally {
      dispatchSpy?.mockRestore();
    }
  });

  it('does nothing when events are flushed on main thread', () => {
    envManager.switchToBackground();
    installElementTemplateHydrationListener();

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const after = new BackgroundElementTemplateInstance('_et_test');
    backgroundRoot.appendChild(after);
    const oldId = after.instanceId;

    envManager.switchToMainThread();
    const instances: SerializedElementTemplate[] = [createSerializedTemplate(-1, '_et_test')];
    lynx.getJSContext().dispatchEvent({
      type: ElementTemplateLifecycleConstant.hydrate,
      data: instances,
    });

    flushCoreContextEvents();

    envManager.switchToBackground();
    expect(backgroundElementTemplateInstanceManager.get(oldId)).toBe(after);
    expect(backgroundElementTemplateInstanceManager.get(-1)).toBeUndefined();
  });

  it('cleans up hydrate listener via tt.callDestroyLifetimeFun', () => {
    envManager.switchToBackground();
    installElementTemplateHydrationListener();

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const after = new BackgroundElementTemplateInstance('_et_test');
    backgroundRoot.appendChild(after);
    const oldId = after.instanceId;

    const tt = (globalThis as unknown as { lynxCoreInject: { tt: TTMock } }).lynxCoreInject.tt;
    tt.callDestroyLifetimeFun?.();

    envManager.switchToMainThread();
    const instances: SerializedElementTemplate[] = [createSerializedTemplate(-1, '_et_test')];
    lynx.getJSContext().dispatchEvent({
      type: ElementTemplateLifecycleConstant.hydrate,
      data: instances,
    });

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
    const handler = vi.fn();
    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const after = new BackgroundElementTemplateInstance('_et_event');
    after.setAttribute('attributeSlots', [handler]);
    backgroundRoot.appendChild(after);

    publishEvent('-1:0:', eventData);

    envManager.switchToMainThread();
    lynx.getJSContext().dispatchEvent({
      type: ElementTemplateLifecycleConstant.hydrate,
      data: [
        {
          templateKey: '_et_event',
          attributeSlots: ['-1:0:'],
          elementSlots: [],
          uid: -1,
        } satisfies SerializedElementTemplate,
      ],
    });

    envManager.switchToBackground();

    expect(handler).toHaveBeenCalledWith(eventData);
  });

  it('drops queued direct events when hydrate matching fails', () => {
    __etAttrPlanMap._et_event = [0, adaptEventAttrSlot];
    resetEventStateForRuntime();
    const oldReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.reportError = reportError;

    try {
      envManager.switchToBackground();
      installElementTemplateHydrationListener();

      const eventData = { type: 'tap' };
      const handler = vi.fn();
      const backgroundRoot = __root as BackgroundElementTemplateInstance;
      const after = new BackgroundElementTemplateInstance('_et_event');
      after.setAttribute('attributeSlots', [handler]);
      backgroundRoot.appendChild(after);

      publishEvent('-1:0:', eventData);

      envManager.switchToMainThread();
      lynx.getJSContext().dispatchEvent({
        type: ElementTemplateLifecycleConstant.hydrate,
        data: [
          {
            templateKey: '_et_mismatch',
            attributeSlots: ['-1:0:'],
            elementSlots: [],
            uid: -1,
          } satisfies SerializedElementTemplate,
        ],
      });

      envManager.switchToBackground();

      envManager.switchToMainThread();
      lynx.getJSContext().dispatchEvent({
        type: ElementTemplateLifecycleConstant.hydrate,
        data: [
          {
            templateKey: '_et_event',
            attributeSlots: ['-1:0:'],
            elementSlots: [],
            uid: -1,
          } satisfies SerializedElementTemplate,
        ],
      });

      envManager.switchToBackground();

      expect(reportError).toHaveBeenCalledTimes(1);
      expect(handler).not.toHaveBeenCalled();
    } finally {
      lynx.reportError = oldReportError;
    }
  });

  it('drops queued direct events when hydrate update dispatch throws', () => {
    const dispatchError = new Error('hydrate update dispatch failed');
    const eventData = { type: 'tap' };
    const handler = vi.fn();
    let dispatchSpy: ReturnType<typeof vi.spyOn> | undefined;

    try {
      __etAttrPlanMap._et_event_parent = [0, adaptEventAttrSlot];
      resetEventStateForRuntime();
      envManager.switchToBackground();
      installElementTemplateHydrationListener();
      dispatchSpy = vi.spyOn(lynx.getCoreContext(), 'dispatchEvent').mockImplementationOnce(() => {
        throw dispatchError;
      });

      const backgroundRoot = __root as BackgroundElementTemplateInstance;
      const parent = new BackgroundElementTemplateInstance('_et_event_parent');
      parent.setAttribute('attributeSlots', [handler]);
      const stale = new BackgroundElementTemplateInstance('_et_stale');
      parent.appendChild(stale);
      backgroundRoot.appendChild(parent);

      publishEvent('-1:0:', eventData);

      envManager.switchToMainThread();
      lynx.getJSContext().dispatchEvent({
        type: ElementTemplateLifecycleConstant.hydrate,
        data: [
          {
            templateKey: '_et_event_parent',
            attributeSlots: ['-1:0:'],
            elementSlots: [[]],
            uid: -1,
          } satisfies SerializedElementTemplate,
        ],
      });

      expect(() => envManager.switchToBackground()).toThrow(dispatchError);
      expect(handler).not.toHaveBeenCalled();

      dispatchSpy.mockRestore();
      dispatchSpy = undefined;

      envManager.switchToMainThread();
      lynx.getJSContext().dispatchEvent({
        type: ElementTemplateLifecycleConstant.hydrate,
        data: [
          {
            templateKey: '_et_event_parent',
            attributeSlots: ['-1:0:'],
            elementSlots: [[]],
            uid: -1,
          } satisfies SerializedElementTemplate,
        ],
      });

      envManager.switchToBackground();

      expect(handler).not.toHaveBeenCalled();
    } finally {
      dispatchSpy?.mockRestore();
    }
  });

  it('does not attach pending direct refs during hydrate', () => {
    const ref = vi.fn();
    __etAttrPlanMap._et_ref = [0, adaptRefAttrSlot];
    envManager.switchToBackground();
    installElementTemplateHydrationListener();

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const after = new BackgroundElementTemplateInstance('_et_ref');
    after.setAttribute('attributeSlots', [ref]);
    backgroundRoot.appendChild(after);

    envManager.switchToMainThread();
    lynx.getJSContext().dispatchEvent({
      type: ElementTemplateLifecycleConstant.hydrate,
      data: [
        {
          templateKey: '_et_ref',
          attributeSlots: ['-1-0'],
          elementSlots: [],
          uid: -1,
        } satisfies SerializedElementTemplate,
      ],
    });

    envManager.switchToBackground();

    expect(ref).not.toHaveBeenCalled();
  });

  it('does not re-attach pre-hydration refs and replays delayed ref ops after hydrate', () => {
    const exec = vi.fn();
    const setNativeProps = vi.fn(() => ({ exec }));
    const select = vi.fn(() => ({ setNativeProps }));
    const createSelectorQuery = vi.fn(() => ({ select }));
    const oldCreateSelectorQuery = lynx.createSelectorQuery;
    lynx.createSelectorQuery = createSelectorQuery as typeof lynx.createSelectorQuery;

    try {
      const ref = vi.fn();
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
      lynx.getJSContext().dispatchEvent({
        type: ElementTemplateLifecycleConstant.hydrate,
        data: [
          {
            templateKey: '_et_ref',
            attributeSlots: ['-1-0'],
            elementSlots: [],
            uid: -1,
          } satisfies SerializedElementTemplate,
        ],
      });

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
    const exec = vi.fn();
    const setNativeProps = vi.fn(() => ({ exec }));
    const select = vi.fn(() => ({ setNativeProps }));
    const createSelectorQuery = vi.fn(() => ({ select }));
    const oldCreateSelectorQuery = lynx.createSelectorQuery;
    lynx.createSelectorQuery = createSelectorQuery as typeof lynx.createSelectorQuery;

    try {
      const ref = vi.fn();
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
      lynx.getJSContext().dispatchEvent({
        type: ElementTemplateLifecycleConstant.hydrate,
        data: [
          {
            templateKey: '_et_spread',
            attributeSlots: [{ ref: '-1-0' }],
            elementSlots: [],
            uid: -1,
          } satisfies SerializedElementTemplate,
        ],
      });

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
    const oldRef = vi.fn();
    const newRef = vi.fn();
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
    lynx.getJSContext().dispatchEvent({
      type: ElementTemplateLifecycleConstant.hydrate,
      data: [
        {
          templateKey: '_et_spread',
          attributeSlots: [{ ref: '-1-0' }],
          elementSlots: [],
          uid: -1,
        } satisfies SerializedElementTemplate,
      ],
    });

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
    const exec = vi.fn();
    const setNativeProps = vi.fn(() => ({ exec }));
    const select = vi.fn(() => ({ setNativeProps }));
    const createSelectorQuery = vi.fn(() => ({ select }));
    const oldCreateSelectorQuery = lynx.createSelectorQuery;
    const oldReportError = lynx.reportError;
    const reportError = vi.fn();
    lynx.createSelectorQuery = createSelectorQuery as typeof lynx.createSelectorQuery;
    lynx.reportError = reportError;

    try {
      const ref = vi.fn();
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
      lynx.getJSContext().dispatchEvent({
        type: ElementTemplateLifecycleConstant.hydrate,
        data: [
          {
            templateKey: '_et_mismatch',
            attributeSlots: ['-1-0'],
            elementSlots: [],
            uid: -1,
          } satisfies SerializedElementTemplate,
        ],
      });

      envManager.switchToBackground();
      flushDelayedRefUiOps();

      expect(reportError).toHaveBeenCalledTimes(1);
      expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
        'ElementTemplate hydrate key mismatch',
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
    envManager.switchToBackground();
    installElementTemplateHydrationListener();

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const after = new BackgroundElementTemplateInstance('_et_test');
    backgroundRoot.appendChild(after);

    envManager.switchToMainThread();
    const instances: SerializedElementTemplate[] = [createSerializedTemplate(-1, '_et_test')];
    lynx.getJSContext().dispatchEvent({
      type: ElementTemplateLifecycleConstant.hydrate,
      data: instances,
    });

    envManager.switchToBackground();

    const { performance } = lynx;
    expect(performance.profileStart).toHaveBeenCalledWith('ReactLynx::hydrate');
    expect(performance.profileEnd).toHaveBeenCalledTimes(1);

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
      ['pipelineID', 'hydrateParsePayloadStart'],
      ['pipelineID', 'hydrateParsePayloadEnd'],
      ['pipelineID', 'diffVdomStart'],
      ['pipelineID', 'diffVdomEnd'],
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
    lynx.getJSContext().dispatchEvent({
      type: ElementTemplateLifecycleConstant.hydrate,
      data: [
        {
          templateKey: '_et_test',
          attributeSlots: ['after'],
          elementSlots: [],
          uid: -1,
        } satisfies SerializedElementTemplate,
      ],
    });

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
    const formatSpy = vi.spyOn(elementTemplateAlog, 'formatElementTemplateUpdateCommands');
    const printSpy = vi.spyOn(elementTemplateAlog, 'printElementTemplateTreeToString');

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const after = new BackgroundElementTemplateInstance('_et_test', ['before']);
    backgroundRoot.appendChild(after);

    envManager.switchToMainThread();
    lynx.getJSContext().dispatchEvent({
      type: ElementTemplateLifecycleConstant.hydrate,
      data: [
        {
          templateKey: '_et_test',
          attributeSlots: ['after'],
          elementSlots: [],
          uid: -1,
        } satisfies SerializedElementTemplate,
      ],
    });

    envManager.switchToBackground();

    expect(formatSpy).not.toHaveBeenCalled();
    expect(printSpy).not.toHaveBeenCalled();
    expect(alog.mock.calls).toHaveLength(0);
  });

  it('reports illegal handleId 0 during hydrate', () => {
    envManager.switchToBackground();
    installElementTemplateHydrationListener();

    const lynxObj = globalThis.lynx as typeof lynx & { reportError?: (error: Error) => void };
    const oldReportError = lynxObj.reportError;
    const reportErrorSpy = vi.fn();
    lynxObj.reportError = reportErrorSpy;

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const after = new BackgroundElementTemplateInstance('_et_test');
    backgroundRoot.appendChild(after);
    const oldId = after.instanceId;

    envManager.switchToMainThread();
    lynx.getJSContext().dispatchEvent({
      type: ElementTemplateLifecycleConstant.hydrate,
      data: [createSerializedTemplate(0, '_et_test')],
    });

    envManager.switchToBackground();

    expect(reportErrorSpy).toHaveBeenCalledTimes(1);
    expect(String(reportErrorSpy.mock.calls[0]?.[0]?.message ?? '')).toContain('invalid uid 0');
    expect(backgroundElementTemplateInstanceManager.get(oldId)).toBe(after);
    expect(backgroundElementTemplateInstanceManager.get(0)).toBeUndefined();

    lynxObj.reportError = oldReportError;
  });

  it('reports duplicate handleId during hydrate', () => {
    envManager.switchToBackground();
    installElementTemplateHydrationListener();

    const lynxObj = globalThis.lynx as typeof lynx & { reportError?: (error: Error) => void };
    const oldReportError = lynxObj.reportError;
    const reportErrorSpy = vi.fn();
    lynxObj.reportError = reportErrorSpy;

    const backgroundRoot = __root as BackgroundElementTemplateInstance;
    const first = new BackgroundElementTemplateInstance('_et_test');
    const second = new BackgroundElementTemplateInstance('_et_test');
    backgroundRoot.appendChild(first);
    backgroundRoot.appendChild(second);
    const oldSecondId = second.instanceId;

    envManager.switchToMainThread();
    lynx.getJSContext().dispatchEvent({
      type: ElementTemplateLifecycleConstant.hydrate,
      data: [createSerializedTemplate(-1, '_et_test'), createSerializedTemplate(-1, '_et_test')],
    });

    envManager.switchToBackground();

    expect(reportErrorSpy).toHaveBeenCalledTimes(1);
    expect(String(reportErrorSpy.mock.calls[0]?.[0]?.message ?? '')).toContain('already bound');
    expect(backgroundElementTemplateInstanceManager.get(-1)).toBe(first);
    expect(backgroundElementTemplateInstanceManager.get(oldSecondId)).toBe(second);

    lynxObj.reportError = oldReportError;
  });
});
