// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getReloadVersion, increaseReloadVersion } from '../../../../src/core/reload-version.js';
import type { BackgroundElementTemplateInstance } from '../../../../src/element-template/background/instance.js';
import { root } from '../../../../src/element-template/index.js';
import {
  installElementTemplatePatchListener,
  resetElementTemplatePatchListener,
} from '../../../../src/element-template/native/patch-listener.js';
import { ElementTemplateLifecycleConstant } from '../../../../src/element-template/protocol/lifecycle-constant.js';
import { ElementTemplateUpdateOps } from '../../../../src/element-template/protocol/opcodes.js';
import type {
  ElementTemplateHandleSlotsCommand,
  ElementTemplateUpdateCommandStream,
  ElementTemplateUpdateCommitContext,
  SerializedElementTemplate,
} from '../../../../src/element-template/protocol/types.js';
import { createElementTemplateUpdateEvent } from '../../../../src/element-template/protocol/update-event.js';
import { __page, setupPage } from '../../../../src/element-template/runtime/page/page.js';
import { __root } from '../../../../src/element-template/runtime/page/root-instance.js';
import { applyElementTemplateUpdateCommands } from '../../../../src/element-template/runtime/patch.js';
import {
  composeElementTemplateListAttributes,
  createElementTemplateListState,
  markElementTemplateListDestroyed,
  registerElementTemplateListItem,
  registerElementTemplateListState,
} from '../../../../src/element-template/runtime/list/list.js';
import {
  clearMainThreadDynamicAttrState,
  getMainThreadDynamicAttrState,
  initializeMainThreadDynamicAttrSlots,
} from '../../../../src/element-template/runtime/template/main-thread-dynamic-attr-state.js';
import {
  __etAttrPlanMap,
  adaptMTEventAttrSlot,
  clearEtAttrPlanMap,
} from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import { elementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';
import { registerBuiltinRawTextTemplate, registerTemplates } from '../../test-utils/debug/registry.js';
import { lastMock } from '../../test-utils/mock/mockNativePapi.js';
import { serializeToJSX } from '../../test-utils/debug/serializer.js';

declare const renderPage: () => void;

interface RootWithFirstChild {
  firstChild: BackgroundElementTemplateInstance | null;
}
interface ReportErrorMock {
  mock: { calls: unknown[][] };
  mockClear: () => void;
}
interface LynxWithReportErrorMock {
  reportError: ReportErrorMock;
}
interface PageWithChildren {
  children?: Array<{ templateId?: string }>;
}

type HydrateEvent = { data: { instances: SerializedElementTemplate[] } };

function createRawTextOps(id: number, text: string) {
  return [
    ElementTemplateUpdateOps.createTemplate,
    id,
    '_et_builtin_raw_text',
    null,
    [text],
    [],
  ] as const;
}

function dispatchElementTemplateUpdate(payload: ElementTemplateUpdateCommitContext): void {
  lynx.getCoreContext().dispatchEvent(createElementTemplateUpdateEvent(payload));
}

function resetReportedErrors(): void {
  const lynxObj = globalThis.lynx as unknown as LynxWithReportErrorMock;
  lynxObj.reportError.mockClear();
  (globalThis as unknown as { __LYNX_REPORT_ERROR_CALLS: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
}

const MT_EVENT_TEMPLATE = '_et_mt_event';

function registerMTEventSlotsForTemplate(templateType: string, ...slotIndexes: number[]): void {
  __etAttrPlanMap[templateType] = slotIndexes.flatMap(slotIndex => [
    slotIndex,
    adaptMTEventAttrSlot,
  ]);
}

function registerMTEventSlots(...slotIndexes: number[]): void {
  registerMTEventSlotsForTemplate(MT_EVENT_TEMPLATE, ...slotIndexes);
}

function registerMTEventHandle(handleId: number, ...slotIndexes: number[]): void {
  registerMTEventSlots(...slotIndexes);
  initializeMainThreadDynamicAttrSlots(handleId, MT_EVENT_TEMPLATE, []);
}

function seedMTEventState(
  handleId: number,
  attrSlotIndex: number,
  value: Record<string, unknown>,
): void {
  registerMTEventHandle(handleId, attrSlotIndex);
  const attributeSlots: unknown[] = [];
  attributeSlots[attrSlotIndex] = { type: 'worklet', value };
  initializeMainThreadDynamicAttrSlots(handleId, MT_EVENT_TEMPLATE, attributeSlots);
}

describe('ElementTemplate patch stream (apply)', () => {
  const envManager = new ElementTemplateEnvManager();
  let hydrationData: SerializedElementTemplate[] = [];

  let onHydrate: (event: HydrateEvent) => void;
  let mockCreateTypedElementTemplate: ReportErrorMock;
  let mockSetAttribute: ReportErrorMock;
  let mockSetAttributeOfElementTemplate: ReportErrorMock;
  let mockInsertNodeToElementTemplate: ReportErrorMock;
  let mockRemoveNodeFromElementTemplate: ReportErrorMock;
  let mockFlushElementTree: ReportErrorMock;

  beforeEach(() => {
    vi.clearAllMocks();
    // mocks are already installed by setup.js beforeEach
    mockCreateTypedElementTemplate = lastMock!.mockCreateTypedElementTemplate as unknown as ReportErrorMock;
    mockSetAttribute = lastMock!.mockSetAttribute as unknown as ReportErrorMock;
    mockSetAttributeOfElementTemplate = lastMock!.mockSetAttributeOfElementTemplate as unknown as ReportErrorMock;
    mockInsertNodeToElementTemplate = lastMock!.mockInsertNodeToElementTemplate as unknown as ReportErrorMock;
    mockRemoveNodeFromElementTemplate = lastMock!.mockRemoveNodeFromElementTemplate as unknown as ReportErrorMock;
    mockFlushElementTree = lastMock!.mockFlushElementTree as unknown as ReportErrorMock;
    registerBuiltinRawTextTemplate();
    clearMainThreadDynamicAttrState();
    clearEtAttrPlanMap();

    hydrationData = [];
    envManager.resetEnv('background');
    envManager.setUseElementTemplate(true);

    onHydrate = vi.fn().mockImplementation((event: HydrateEvent) => {
      hydrationData.push(...event.data.instances);
    });
    lynx.getCoreContext().addEventListener(ElementTemplateLifecycleConstant.hydrate, onHydrate);
  });

  afterEach(() => {
    envManager.switchToBackground();
    lynx.getCoreContext().removeEventListener(ElementTemplateLifecycleConstant.hydrate, onHydrate);

    envManager.switchToMainThread();
    resetElementTemplatePatchListener();

    envManager.setUseElementTemplate(false);
  });

  function renderAndCollect(App: () => JSX.Element) {
    const jsx = <App />;
    root.render(jsx);
    envManager.switchToMainThread();
    root.render(jsx);
    renderPage();
    envManager.switchToBackground();

    const before = hydrationData[0]!;
    const backgroundRoot = __root as unknown as RootWithFirstChild;
    const after = backgroundRoot.firstChild;
    if (!after) {
      throw new Error('Missing background root child');
    }

    return { before, after };
  }

  it('reports missing reference handle without mutating the page', () => {
    function App() {
      return (
        <view>
          <view key='a' id='a' />
          <view key='b' id='b' />
        </view>
      );
    }

    const { before } = renderAndCollect(App);
    envManager.switchToMainThread();

    const beforeJSX = serializeToJSX(__page);
    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.insertNode,
      before.uid as number,
      9999,
      before.uid as number,
      9999,
    ]);

    expect(serializeToJSX(__page)).toBe(beforeJSX);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(reportError.mock.calls.length).toBeGreaterThan(0);
    resetReportedErrors();
  });

  it('uses page slot target id 0 for root insert and remove patches', () => {
    envManager.switchToMainThread();
    const pageRef = { __isNativeRef: true, id: 'page' } as unknown as ElementRef;
    const childRef = { __isNativeRef: true, id: 'root' } as unknown as ElementRef;
    setupPage(pageRef);
    elementTemplateRegistry.set(10, childRef);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.insertNode,
      0,
      0,
      10,
      0,
      ElementTemplateUpdateOps.removeNode,
      0,
      0,
      10,
      [10],
    ]);

    expect(mockInsertNodeToElementTemplate.mock.calls).toEqual([[pageRef, 0, childRef, null]]);
    expect(mockRemoveNodeFromElementTemplate.mock.calls).toEqual([[pageRef, 0, childRef]]);
    expect(elementTemplateRegistry.has(10)).toBe(false);
  });

  it('accepts commit context payload on update event', () => {
    function App() {
      const id = __BACKGROUND__ ? 'bg' : 'main';
      return <view id={id} />;
    }

    const { before } = renderAndCollect(App);
    const targetId = before.uid;
    if (typeof targetId !== 'number') {
      throw new Error('Missing uid on hydration payload');
    }
    const stream = [ElementTemplateUpdateOps.setAttribute, targetId, 0, 'bg'] as const;

    envManager.switchToMainThread();
    installElementTemplatePatchListener();
    mockSetAttributeOfElementTemplate.mockClear();
    mockFlushElementTree.mockClear();

    envManager.switchToBackground();
    dispatchElementTemplateUpdate({ ops: stream, flushOptions: {} });
    envManager.switchToMainThread();

    expect(mockSetAttributeOfElementTemplate.mock.calls.length).toBeGreaterThan(0);
    expect(mockFlushElementTree.mock.calls.length).toBeGreaterThan(0);
  });

  it('records main-thread dynamic attr state after setAttribute PAPI succeeds', () => {
    const targetId = 101;
    const nativeRef = {};
    const ctx = { _wkltId: 'tap' };
    elementTemplateRegistry.set(targetId, nativeRef as ElementRef);
    registerMTEventHandle(targetId, 0);

    envManager.switchToMainThread();
    installElementTemplatePatchListener();
    mockSetAttributeOfElementTemplate.mockClear();
    mockFlushElementTree.mockClear();

    envManager.switchToBackground();
    dispatchElementTemplateUpdate({
      ops: [ElementTemplateUpdateOps.setAttribute, targetId, 0, { type: 'worklet', value: ctx }],
      flushOptions: {},
    });
    envManager.switchToMainThread();

    expect(mockSetAttributeOfElementTemplate).toHaveBeenCalledTimes(1);
    expect(mockFlushElementTree).toHaveBeenCalledTimes(1);
    expect(getMainThreadDynamicAttrState(targetId, 0)).toEqual({
      kind: 'mt-event',
      nativeHeldValue: ctx,
    });
  });

  it('does not record wrapper-shaped values without direct MTEvent attr-plan eligibility', () => {
    const targetId = 120;
    const ctx = { _wkltId: 'ordinary-wrapper' };
    const hydrateCtx = vi.fn();
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _hydrateCtx: hydrateCtx,
    };
    elementTemplateRegistry.set(targetId, {} as ElementRef);

    try {
      envManager.switchToMainThread();
      installElementTemplatePatchListener();
      mockSetAttributeOfElementTemplate.mockClear();

      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [ElementTemplateUpdateOps.setAttribute, targetId, 0, { type: 'worklet', value: ctx }],
        flushOptions: {},
        isHydration: true,
      });
      envManager.switchToMainThread();

      expect(mockSetAttributeOfElementTemplate).toHaveBeenCalledTimes(1);
      expect(hydrateCtx).not.toHaveBeenCalled();
      expect(getMainThreadDynamicAttrState(targetId, 0)).toBeUndefined();
    } finally {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('records main-thread dynamic attr state after createTemplate PAPI succeeds', () => {
    const handleId = 107;
    const ctx = { _wkltId: 'created' };
    // The transform keys the attr plan by the full `${entry}:${key}` tag; the
    // main card uses the `__Card__` sentinel (normalized from a null bundleUrl).
    __etAttrPlanMap['__Card__:view'] = [0, adaptMTEventAttrSlot];
    registerTemplates([{
      templateId: 'view',
      compiledTemplate: {
        kind: 'element',
        type: 'view',
        attributesArray: [{
          kind: 'slot',
          key: 'main-thread:bindtap',
          attrSlotIndex: 0,
        }],
        children: [],
      },
    }]);

    envManager.switchToMainThread();
    installElementTemplatePatchListener();

    envManager.switchToBackground();
    dispatchElementTemplateUpdate({
      ops: [
        ElementTemplateUpdateOps.createTemplate,
        handleId,
        'view',
        null,
        [{ type: 'worklet', value: ctx }],
        [],
      ],
      flushOptions: {},
    });
    envManager.switchToMainThread();

    expect(getMainThreadDynamicAttrState(handleId, 0)).toEqual({
      kind: 'mt-event',
      nativeHeldValue: ctx,
    });
  });

  it('records dynamic-entry main-thread dynamic attr state after createTemplate PAPI succeeds', () => {
    const handleId = 108;
    const ctx = { _wkltId: 'dynamic-created' };
    registerMTEventSlotsForTemplate('lazy-entry:view', 0);
    registerTemplates([{
      templateId: 'view',
      compiledTemplate: {
        kind: 'element',
        type: 'view',
        attributesArray: [{
          kind: 'slot',
          key: 'main-thread:bindtap',
          attrSlotIndex: 0,
        }],
        children: [],
      },
    }]);

    envManager.switchToMainThread();
    installElementTemplatePatchListener();

    envManager.switchToBackground();
    dispatchElementTemplateUpdate({
      ops: [
        ElementTemplateUpdateOps.createTemplate,
        handleId,
        'view',
        'lazy-entry',
        [{ type: 'worklet', value: ctx }],
        [],
      ],
      flushOptions: {},
    });
    envManager.switchToMainThread();

    expect(getMainThreadDynamicAttrState(handleId, 0)).toEqual({
      kind: 'mt-event',
      nativeHeldValue: ctx,
    });
  });

  it('deletes main-thread dynamic attr state after a slot clear patch succeeds', () => {
    const targetId = 103;
    const nativeRef = {};
    elementTemplateRegistry.set(targetId, nativeRef as ElementRef);
    seedMTEventState(targetId, 0, { _wkltId: 'old' });

    envManager.switchToMainThread();
    installElementTemplatePatchListener();

    envManager.switchToBackground();
    dispatchElementTemplateUpdate({
      ops: [ElementTemplateUpdateOps.setAttribute, targetId, 0, null],
      flushOptions: {},
    });
    envManager.switchToMainThread();

    expect(getMainThreadDynamicAttrState(targetId, 0)).toBeUndefined();
  });

  it('deletes main-thread dynamic attr state for a removed subtree after patch succeeds', () => {
    const targetId = 104;
    const childId = 105;
    elementTemplateRegistry.set(targetId, {} as ElementRef);
    elementTemplateRegistry.set(childId, {} as ElementRef);
    seedMTEventState(childId, 0, { _wkltId: 'child' });

    envManager.switchToMainThread();
    installElementTemplatePatchListener();

    envManager.switchToBackground();
    dispatchElementTemplateUpdate({
      ops: [ElementTemplateUpdateOps.removeNode, targetId, 0, childId, [childId]],
      flushOptions: {},
    });
    envManager.switchToMainThread();

    expect(getMainThreadDynamicAttrState(childId, 0)).toBeUndefined();
  });

  it('hydrates MTEvent ctx after hydrate setAttribute PAPI succeeds', () => {
    const targetId = 109;
    const oldCtx = { _wkltId: 'tap', count: 1 };
    const nextCtx = { _wkltId: 'tap', count: 2 };
    const hydrateCtx = vi.fn();
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _hydrateCtx: hydrateCtx,
    };
    elementTemplateRegistry.set(targetId, {} as ElementRef);
    seedMTEventState(targetId, 0, oldCtx);

    try {
      envManager.switchToMainThread();
      installElementTemplatePatchListener();

      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [ElementTemplateUpdateOps.setAttribute, targetId, 0, { type: 'worklet', value: nextCtx }],
        flushOptions: {},
        isHydration: true,
      });
      envManager.switchToMainThread();

      expect(hydrateCtx).toHaveBeenCalledWith(nextCtx, oldCtx);
      expect(getMainThreadDynamicAttrState(targetId, 0)?.nativeHeldValue).toEqual(nextCtx);
      expect(getMainThreadDynamicAttrState(targetId, 0)?.nativeHeldValue).not.toBe(nextCtx);
    } finally {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('flushes delayed runOnBackground calls after hydration apply and before native flush', () => {
    const targetId = 118;
    const oldCtx = { _wkltId: 'tap', count: 1 };
    const nextCtx = { _wkltId: 'tap', count: 2 };
    const callOrder: string[] = [];
    const hydrateCtx = vi.fn(() => {
      callOrder.push('hydrate');
    });
    const runDelayedBackgroundFunctions = vi.fn(() => {
      callOrder.push('runOnBackground');
    });
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _hydrateCtx: hydrateCtx,
      _runOnBackgroundDelayImpl: {
        runDelayedBackgroundFunctions,
      },
    };
    elementTemplateRegistry.set(targetId, {} as ElementRef);
    seedMTEventState(targetId, 0, oldCtx);

    try {
      envManager.switchToMainThread();
      installElementTemplatePatchListener();
      mockFlushElementTree.mockImplementationOnce(() => {
        callOrder.push('flushElementTree');
      });

      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [ElementTemplateUpdateOps.setAttribute, targetId, 0, { type: 'worklet', value: nextCtx }],
        flushOptions: {},
        isHydration: true,
      });
      envManager.switchToMainThread();

      expect(hydrateCtx).toHaveBeenCalledWith(nextCtx, oldCtx);
      expect(runDelayedBackgroundFunctions).toHaveBeenCalledTimes(1);
      expect(callOrder).toEqual([
        'hydrate',
        'runOnBackground',
        'flushElementTree',
      ]);
    } finally {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('runs delayed runOnMainThread after hydration apply and delayed runOnBackground before native flush', () => {
    const targetId = 119;
    const oldCtx = { _wkltId: 'tap', count: 1 };
    const nextCtx = { _wkltId: 'tap', count: 2 };
    const mainThreadWorklet = { _wkltId: 'delayed-main-thread-function' };
    const callOrder: string[] = [];
    const hydrateCtx = vi.fn(() => {
      callOrder.push('hydrate');
    });
    const runDelayedBackgroundFunctions = vi.fn(() => {
      callOrder.push('runOnBackground');
    });
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _hydrateCtx: hydrateCtx,
      _runOnBackgroundDelayImpl: {
        runDelayedBackgroundFunctions,
      },
      _eomImpl: {
        setShouldFlush: vi.fn((value: boolean) => {
          callOrder.push(`eom:${String(value)}`);
        }),
      },
      _runRunOnMainThreadTask: vi.fn(() => {
        callOrder.push('runOnMainThread');
      }),
    };
    elementTemplateRegistry.set(targetId, {} as ElementRef);
    seedMTEventState(targetId, 0, oldCtx);

    try {
      envManager.switchToMainThread();
      installElementTemplatePatchListener();
      mockFlushElementTree.mockImplementationOnce(() => {
        callOrder.push('flushElementTree');
      });

      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [ElementTemplateUpdateOps.setAttribute, targetId, 0, { type: 'worklet', value: nextCtx }],
        flushOptions: {},
        isHydration: true,
        delayedRunOnMainThreadData: [
          {
            worklet: mainThreadWorklet,
            params: ['from-hydrate'],
            resolveId: 7,
          },
        ],
      });
      envManager.switchToMainThread();

      expect(hydrateCtx).toHaveBeenCalledWith(nextCtx, oldCtx);
      expect(runDelayedBackgroundFunctions).toHaveBeenCalledTimes(1);
      expect(globalThis.lynxWorkletImpl._runRunOnMainThreadTask).toHaveBeenCalledWith(
        mainThreadWorklet,
        ['from-hydrate'],
        7,
      );
      expect(callOrder).toEqual([
        'hydrate',
        'runOnBackground',
        'eom:false',
        'runOnMainThread',
        'eom:true',
        'flushElementTree',
      ]);
    } finally {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('reports delayed runOnMainThread errors and restores EOM before native flush', () => {
    const taskError = new Error('main thread task failed');
    const callOrder: string[] = [];
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _eomImpl: {
        setShouldFlush: vi.fn((value: boolean) => {
          callOrder.push(`eom:${String(value)}`);
        }),
      },
      _runRunOnMainThreadTask: vi.fn(() => {
        callOrder.push('runOnMainThread');
        throw taskError;
      }),
    };

    try {
      resetReportedErrors();
      envManager.switchToMainThread();
      installElementTemplatePatchListener();
      mockFlushElementTree.mockImplementationOnce(() => {
        callOrder.push('flushElementTree');
      });

      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [],
        flushOptions: {},
        delayedRunOnMainThreadData: [
          {
            worklet: { _wkltId: 'throwing-main-thread-function' },
            params: [],
            resolveId: 8,
          },
        ],
      });
      envManager.switchToMainThread();

      const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
      expect(reportError.mock.calls[0]?.[0]).toBe(taskError);
      expect(callOrder).toEqual([
        'eom:false',
        'runOnMainThread',
        'eom:true',
        'flushElementTree',
      ]);
    } finally {
      resetReportedErrors();
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('flushes delayed runOnBackground on empty hydration boundaries', () => {
    const callOrder: string[] = [];
    const runDelayedBackgroundFunctions = vi.fn(() => {
      callOrder.push('runOnBackground');
    });
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _runOnBackgroundDelayImpl: {
        runDelayedBackgroundFunctions,
      },
    };

    try {
      envManager.switchToMainThread();
      installElementTemplatePatchListener();
      mockFlushElementTree.mockImplementationOnce(() => {
        callOrder.push('flushElementTree');
      });

      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [],
        flushOptions: {},
        isHydration: true,
      });
      envManager.switchToMainThread();

      expect(runDelayedBackgroundFunctions).toHaveBeenCalledTimes(1);
      expect(callOrder).toEqual([
        'runOnBackground',
        'flushElementTree',
      ]);
    } finally {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('does not hydrate MTEvent ctx for ordinary update patches', () => {
    const targetId = 110;
    const oldCtx = { _wkltId: 'tap', count: 1 };
    const nextCtx = { _wkltId: 'tap', count: 2 };
    const hydrateCtx = vi.fn();
    const runDelayedBackgroundFunctions = vi.fn();
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _hydrateCtx: hydrateCtx,
      _runOnBackgroundDelayImpl: {
        runDelayedBackgroundFunctions,
      },
    };
    elementTemplateRegistry.set(targetId, {} as ElementRef);
    seedMTEventState(targetId, 0, oldCtx);

    try {
      envManager.switchToMainThread();
      installElementTemplatePatchListener();

      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [ElementTemplateUpdateOps.setAttribute, targetId, 0, { type: 'worklet', value: nextCtx }],
        flushOptions: {},
      });
      envManager.switchToMainThread();

      expect(hydrateCtx).not.toHaveBeenCalled();
      expect(runDelayedBackgroundFunctions).not.toHaveBeenCalled();
      expect(getMainThreadDynamicAttrState(targetId, 0)?.nativeHeldValue).toEqual(nextCtx);
      expect(getMainThreadDynamicAttrState(targetId, 0)?.nativeHeldValue).not.toBe(nextCtx);
    } finally {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('keeps main-thread dynamic attr state when update flush throws after setAttribute succeeds', () => {
    const targetId = 102;
    const nativeRef = {};
    const ctx = { _wkltId: 'tap' };
    elementTemplateRegistry.set(targetId, nativeRef as ElementRef);
    registerMTEventHandle(targetId, 0);

    envManager.switchToMainThread();
    installElementTemplatePatchListener();
    mockFlushElementTree.mockImplementationOnce(() => {
      throw new Error('flush failed');
    });

    expect(() => {
      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [ElementTemplateUpdateOps.setAttribute, targetId, 0, { type: 'worklet', value: ctx }],
        flushOptions: {},
      });
      envManager.switchToMainThread();
    }).toThrow('flush failed');

    expect(getMainThreadDynamicAttrState(targetId, 0)).toEqual({
      kind: 'mt-event',
      nativeHeldValue: ctx,
    });
  });

  it('hydrates MTEvent ctx when hydrate setAttribute succeeds even if flush throws', () => {
    const targetId = 111;
    const oldCtx = { _wkltId: 'tap', count: 1 };
    const nextCtx = { _wkltId: 'tap', count: 2 };
    const hydrateCtx = vi.fn();
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _hydrateCtx: hydrateCtx,
    };
    elementTemplateRegistry.set(targetId, {} as ElementRef);
    seedMTEventState(targetId, 0, oldCtx);

    try {
      envManager.switchToMainThread();
      installElementTemplatePatchListener();
      mockFlushElementTree.mockImplementationOnce(() => {
        throw new Error('flush failed');
      });

      expect(() => {
        envManager.switchToBackground();
        dispatchElementTemplateUpdate({
          ops: [ElementTemplateUpdateOps.setAttribute, targetId, 0, { type: 'worklet', value: nextCtx }],
          flushOptions: {},
          isHydration: true,
        });
        envManager.switchToMainThread();
      }).toThrow('flush failed');

      expect(hydrateCtx).toHaveBeenCalledWith(nextCtx, oldCtx);
      expect(getMainThreadDynamicAttrState(targetId, 0)?.nativeHeldValue).toEqual(nextCtx);
      expect(getMainThreadDynamicAttrState(targetId, 0)?.nativeHeldValue).not.toBe(nextCtx);
    } finally {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('does not hydrate MTEvent ctx for stale hydrate update payloads', () => {
    const targetId = 112;
    const oldCtx = { _wkltId: 'tap', count: 1 };
    const nextCtx = { _wkltId: 'tap', count: 2 };
    const staleReloadVersion = getReloadVersion();
    const hydrateCtx = vi.fn();
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _hydrateCtx: hydrateCtx,
    };
    elementTemplateRegistry.set(targetId, {} as ElementRef);
    seedMTEventState(targetId, 0, oldCtx);

    try {
      increaseReloadVersion();
      envManager.switchToMainThread();
      installElementTemplatePatchListener();

      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [ElementTemplateUpdateOps.setAttribute, targetId, 0, { type: 'worklet', value: nextCtx }],
        flushOptions: {},
        isHydration: true,
        reloadVersion: staleReloadVersion,
      });
      envManager.switchToMainThread();

      expect(hydrateCtx).not.toHaveBeenCalled();
      expect(getMainThreadDynamicAttrState(targetId, 0)?.nativeHeldValue).toBe(oldCtx);
    } finally {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('flushes hydration runOnBackground replay but aborts delayed main-thread tasks when a native patch op throws', () => {
    const targetId = 108;
    const nativeRef = {};
    const ctx = { _wkltId: 'tap' };
    const runDelayedBackgroundFunctions = vi.fn();
    const runRunOnMainThreadTask = vi.fn();
    const setShouldFlush = vi.fn();
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _runOnBackgroundDelayImpl: {
        runDelayedBackgroundFunctions,
      },
      _eomImpl: {
        setShouldFlush,
      },
      _runRunOnMainThreadTask: runRunOnMainThreadTask,
    };
    elementTemplateRegistry.set(targetId, nativeRef as ElementRef);
    registerMTEventHandle(targetId, 0);

    try {
      envManager.switchToMainThread();
      installElementTemplatePatchListener();
      mockSetAttributeOfElementTemplate.mockImplementationOnce(() => {
        throw new Error('setAttribute failed');
      });

      expect(() => {
        envManager.switchToBackground();
        dispatchElementTemplateUpdate({
          ops: [ElementTemplateUpdateOps.setAttribute, targetId, 0, { type: 'worklet', value: ctx }],
          flushOptions: {},
          isHydration: true,
          delayedRunOnMainThreadData: [
            {
              worklet: { _wkltId: 'should-not-run' },
              params: [],
              resolveId: 11,
            },
          ],
        });
        envManager.switchToMainThread();
      }).toThrow('setAttribute failed');

      expect(runDelayedBackgroundFunctions).toHaveBeenCalledTimes(1);
      expect(setShouldFlush).not.toHaveBeenCalled();
      expect(runRunOnMainThreadTask).not.toHaveBeenCalled();
      expect(getMainThreadDynamicAttrState(targetId, 0)).toBeUndefined();
    } finally {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('continues delayed lifecycle when patch apply reports a missing target', () => {
    const runDelayedBackgroundFunctions = vi.fn();
    const runRunOnMainThreadTask = vi.fn();
    const setShouldFlush = vi.fn();
    const worklet = { _wkltId: 'missing-target-main-thread-function' };
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _runOnBackgroundDelayImpl: {
        runDelayedBackgroundFunctions,
      },
      _eomImpl: {
        setShouldFlush,
      },
      _runRunOnMainThreadTask: runRunOnMainThreadTask,
    };

    try {
      resetReportedErrors();
      envManager.switchToMainThread();
      installElementTemplatePatchListener();
      mockFlushElementTree.mockClear();

      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [ElementTemplateUpdateOps.setAttribute, 404, 0, 'missing'],
        flushOptions: {},
        isHydration: true,
        delayedRunOnMainThreadData: [
          {
            worklet,
            params: [],
            resolveId: 9,
          },
        ],
      });
      envManager.switchToMainThread();

      const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
      expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('target handle 404 not found');
      expect(runDelayedBackgroundFunctions).toHaveBeenCalledTimes(1);
      expect(runRunOnMainThreadTask).toHaveBeenCalledWith(worklet, [], 9);
      expect(setShouldFlush.mock.calls).toEqual([[false], [true]]);
      expect(mockFlushElementTree).toHaveBeenCalledTimes(1);
    } finally {
      resetReportedErrors();
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('does not run delayed main-thread tasks for stale reload payloads', () => {
    const staleReloadVersion = getReloadVersion();
    const runRunOnMainThreadTask = vi.fn();
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _eomImpl: {
        setShouldFlush: vi.fn(),
      },
      _runRunOnMainThreadTask: runRunOnMainThreadTask,
    };

    try {
      increaseReloadVersion();
      envManager.switchToMainThread();
      installElementTemplatePatchListener();
      mockFlushElementTree.mockClear();

      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [],
        flushOptions: {},
        reloadVersion: staleReloadVersion,
        delayedRunOnMainThreadData: [
          {
            worklet: { _wkltId: 'stale-main-thread-function' },
            params: [],
            resolveId: 10,
          },
        ],
      });
      envManager.switchToMainThread();

      expect(runRunOnMainThreadTask).not.toHaveBeenCalled();
      expect(mockFlushElementTree).not.toHaveBeenCalled();
    } finally {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('does not record main-thread dynamic attr state when the patch target is missing', () => {
    const targetId = 106;
    const ctx = { _wkltId: 'tap' };

    envManager.switchToMainThread();
    installElementTemplatePatchListener();

    envManager.switchToBackground();
    dispatchElementTemplateUpdate({
      ops: [ElementTemplateUpdateOps.setAttribute, targetId, 0, { type: 'worklet', value: ctx }],
      flushOptions: {},
    });
    envManager.switchToMainThread();

    expect(getMainThreadDynamicAttrState(targetId, 0)).toBeUndefined();
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(`target handle ${targetId} not found`);
    resetReportedErrors();
  });

  it('hydrates successfully applied MTEvent slot when the same payload has a missing target op', () => {
    const targetId = 113;
    const missingTargetId = 114;
    const oldCtx = { _wkltId: 'tap', count: 1 };
    const nextCtx = { _wkltId: 'tap', count: 2 };
    const hydrateCtx = vi.fn();
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _hydrateCtx: hydrateCtx,
    };
    elementTemplateRegistry.set(targetId, {} as ElementRef);
    seedMTEventState(targetId, 0, oldCtx);

    try {
      envManager.switchToMainThread();
      installElementTemplatePatchListener();
      mockSetAttributeOfElementTemplate.mockClear();
      mockFlushElementTree.mockClear();

      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [
          ElementTemplateUpdateOps.setAttribute,
          targetId,
          0,
          { type: 'worklet', value: nextCtx },
          ElementTemplateUpdateOps.setAttribute,
          missingTargetId,
          0,
          'missing',
        ],
        flushOptions: {},
        isHydration: true,
      });
      envManager.switchToMainThread();

      expect(mockSetAttributeOfElementTemplate).toHaveBeenCalledTimes(1);
      expect(mockFlushElementTree).toHaveBeenCalledTimes(1);
      expect(hydrateCtx).toHaveBeenCalledWith(nextCtx, oldCtx);
      expect(getMainThreadDynamicAttrState(targetId, 0)?.nativeHeldValue).toEqual(nextCtx);
      expect(getMainThreadDynamicAttrState(targetId, 0)?.nativeHeldValue).not.toBe(nextCtx);
      const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
      expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
        `target handle ${missingTargetId} not found`,
      );
      resetReportedErrors();
    } finally {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('cleans removed MTEvent state when the same payload later has a missing target op', () => {
    const targetId = 115;
    const childId = 116;
    const missingTargetId = 117;
    const hydrateCtx = vi.fn();
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _hydrateCtx: hydrateCtx,
    };
    elementTemplateRegistry.set(targetId, {} as ElementRef);
    elementTemplateRegistry.set(childId, {} as ElementRef);
    seedMTEventState(childId, 0, { _wkltId: 'removed' });

    try {
      envManager.switchToMainThread();
      installElementTemplatePatchListener();
      mockRemoveNodeFromElementTemplate.mockClear();
      mockFlushElementTree.mockClear();

      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [
          ElementTemplateUpdateOps.removeNode,
          targetId,
          0,
          childId,
          [childId],
          ElementTemplateUpdateOps.setAttribute,
          missingTargetId,
          0,
          'missing',
        ],
        flushOptions: {},
        isHydration: true,
      });
      envManager.switchToMainThread();

      expect(mockRemoveNodeFromElementTemplate).toHaveBeenCalledTimes(1);
      expect(mockFlushElementTree).toHaveBeenCalledTimes(1);
      expect(hydrateCtx).not.toHaveBeenCalled();
      expect(elementTemplateRegistry.get(childId)).toBeUndefined();
      expect(getMainThreadDynamicAttrState(childId, 0)).toBeUndefined();
      const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
      expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
        `target handle ${missingTargetId} not found`,
      );
      resetReportedErrors();
    } finally {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('cleans removed MTEvent state when flush throws after remove succeeds', () => {
    const targetId = 118;
    const childId = 119;
    elementTemplateRegistry.set(targetId, {} as ElementRef);
    elementTemplateRegistry.set(childId, {} as ElementRef);
    seedMTEventState(childId, 0, { _wkltId: 'removed' });

    envManager.switchToMainThread();
    installElementTemplatePatchListener();
    mockRemoveNodeFromElementTemplate.mockClear();
    mockFlushElementTree.mockImplementationOnce(() => {
      throw new Error('flush failed');
    });

    expect(() => {
      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [ElementTemplateUpdateOps.removeNode, targetId, 0, childId, [childId]],
        flushOptions: {},
        isHydration: true,
      });
      envManager.switchToMainThread();
    }).toThrow('flush failed');

    expect(mockRemoveNodeFromElementTemplate).toHaveBeenCalledTimes(1);
    expect(elementTemplateRegistry.get(childId)).toBeUndefined();
    expect(getMainThreadDynamicAttrState(childId, 0)).toBeUndefined();
  });

  it('profiles patch update flowIds on main thread without passing them to __FlushElementTree', () => {
    function App() {
      const id = __BACKGROUND__ ? 'bg' : 'main';
      return <view id={id} />;
    }

    const { before } = renderAndCollect(App);
    const targetId = before.uid;
    if (typeof targetId !== 'number') {
      throw new Error('Missing uid on hydration payload');
    }
    const stream = [ElementTemplateUpdateOps.setAttribute, targetId, 0, 'bg'] as const;

    envManager.switchToMainThread();
    installElementTemplatePatchListener();
    const performance = lynx.performance;
    performance.profileStart.mockClear();
    performance.profileEnd.mockClear();
    mockFlushElementTree.mockClear();

    envManager.switchToBackground();
    dispatchElementTemplateUpdate({ ops: stream, flushOptions: {}, flowIds: [101, 202] });
    envManager.switchToMainThread();

    expect(performance.profileStart).toHaveBeenCalledWith('ReactLynx::patch', {
      flowId: 101,
      flowIds: [101, 202],
    });
    expect(performance.profileEnd).toHaveBeenCalledTimes(1);
    const lastFlushOptions = mockFlushElementTree.mock.calls.at(-1)?.[1] as { flowIds?: unknown };
    expect(lastFlushOptions.flowIds).toBeUndefined();
  });

  it('does not profile empty update payloads that only flush native options', () => {
    envManager.switchToMainThread();
    installElementTemplatePatchListener();
    const performance = lynx.performance;
    performance.profileStart.mockClear();
    performance.profileEnd.mockClear();
    mockFlushElementTree.mockClear();

    envManager.switchToBackground();
    dispatchElementTemplateUpdate({ ops: [], flushOptions: { triggerDataUpdated: true }, flowIds: [101, 202] });
    envManager.switchToMainThread();

    expect(performance.profileStart).not.toHaveBeenCalled();
    expect(performance.profileEnd).not.toHaveBeenCalled();
    expect(mockFlushElementTree.mock.calls).toHaveLength(1);
    expect(mockFlushElementTree.mock.calls[0]?.[1]).toEqual({ triggerDataUpdated: true });
  });

  it('flushes option-only update payloads with empty ops', () => {
    envManager.switchToMainThread();
    installElementTemplatePatchListener();
    const performance = lynx.performance;
    performance.profileStart.mockClear();
    performance.profileEnd.mockClear();
    mockFlushElementTree.mockClear();

    envManager.switchToBackground();
    dispatchElementTemplateUpdate({
      ops: [],
      flushOptions: { triggerDataUpdated: true },
      flowIds: [101, 202],
    });
    envManager.switchToMainThread();

    expect(performance.profileStart).not.toHaveBeenCalled();
    expect(performance.profileEnd).not.toHaveBeenCalled();
    expect(mockFlushElementTree.mock.calls).toHaveLength(1);
    expect(mockFlushElementTree.mock.calls[0]?.[1]).toEqual({ triggerDataUpdated: true });
  });

  it('reports illegal handleId 0 on create', () => {
    const jsx = <view />;
    root.render(jsx);
    envManager.switchToMainThread();
    root.render(jsx);
    renderPage();

    applyElementTemplateUpdateCommands(createRawTextOps(0, 'x'));

    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(reportError.mock.calls).toHaveLength(1);
    resetReportedErrors();
  });

  it('reports invalid non-integer handleId on create', () => {
    envManager.switchToMainThread();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTemplate,
      1.5,
      '_et_builtin_raw_text',
      null,
      ['x'],
      [],
    ]);

    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('invalid handleId 1.5');
    resetReportedErrors();
  });

  it('reports duplicate handleId on create', () => {
    envManager.switchToMainThread();
    const existingRef = { __isNativeRef: true, id: 'existing' } as unknown as ElementRef;
    elementTemplateRegistry.set(7, existingRef);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTemplate,
      7,
      '_et_builtin_raw_text',
      null,
      ['x'],
      [],
    ]);

    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('duplicate handleId 7');
    resetReportedErrors();
  });

  it('reports invalid non-array attributeSlots on create', () => {
    envManager.switchToMainThread();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTemplate,
      7,
      '_et_builtin_raw_text',
      null,
      'bad-attrs' as unknown as ElementTemplateUpdateCommandStream[number],
      [],
    ]);

    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
      'attributeSlots must be an array, null, or undefined',
    );
    resetReportedErrors();
  });

  it('reports invalid non-array elementSlots on create', () => {
    envManager.switchToMainThread();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTemplate,
      8,
      '_et_builtin_raw_text',
      null,
      [],
      'bad-slots' as unknown as ElementTemplateUpdateCommandStream[number],
    ]);

    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
      'elementSlots must be an array, null, or undefined',
    );
    resetReportedErrors();
  });

  it('creates templates with nullable and sparse element slots', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();
    registerTemplates([
      {
        templateId: '_et_sparse_slot_parent',
        compiledTemplate: {
          kind: 'element',
          type: 'view',
          attributesArray: [],
          children: [
            { kind: 'elementSlot', type: 'slot', elementSlotIndex: 0 },
            { kind: 'elementSlot', type: 'slot', elementSlotIndex: 1 },
            { kind: 'elementSlot', type: 'slot', elementSlotIndex: 2 },
          ],
        },
      },
    ]);

    const elementSlots: ElementTemplateHandleSlotsCommand = [];
    elementSlots[1] = [31];
    elementSlots[2] = null;

    const createTemplateMock = globalThis.__CreateElementTemplate as unknown as {
      mockClear: () => void;
      mock: { calls: unknown[][] };
    };
    createTemplateMock.mockClear();

    applyElementTemplateUpdateCommands([
      ...createRawTextOps(31, 'child'),
      ElementTemplateUpdateOps.createTemplate,
      32,
      '_et_sparse_slot_parent',
      null,
      [],
      elementSlots,
    ]);

    const parentCall = createTemplateMock.mock.calls.find((call) => call[0] === '_et_sparse_slot_parent');
    expect(parentCall).toBeDefined();
    const childRef = elementTemplateRegistry.get(31);
    const resolvedSlots = parentCall![3] as Array<ElementRef[] | null | undefined>;
    expect(0 in resolvedSlots).toBe(false);
    expect(resolvedSlots[1]).toEqual([childRef]);
    expect(2 in resolvedSlots).toBe(false);
    expect(elementTemplateRegistry.has(32)).toBe(true);
    expect((globalThis.lynx as unknown as LynxWithReportErrorMock).reportError.mock.calls).toHaveLength(0);
  });

  it('reports missing patch target', () => {
    const jsx = <view />;
    root.render(jsx);
    envManager.switchToMainThread();
    root.render(jsx);
    renderPage();

    applyElementTemplateUpdateCommands([ElementTemplateUpdateOps.setAttribute, 999, 0, 'a']);

    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(reportError.mock.calls).toHaveLength(1);
    resetReportedErrors();
  });

  it('creates typed elements with resolved slots and serializable command options', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();

    const slotChildRef = { __isNativeRef: true, id: 'slot-child' } as unknown as ElementRef;
    elementTemplateRegistry.set(11, slotChildRef);
    mockCreateTypedElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTypedElement,
      21,
      'typed-host',
      { id: 'typed-list' },
      [[11], null],
      {
        metadata: { itemCount: 1 },
        estimatedHeight: 80,
      },
    ]);

    expect(mockCreateTypedElementTemplate.mock.calls).toHaveLength(1);
    expect(mockCreateTypedElementTemplate.mock.calls[0]?.[0]).toBe('typed-host');
    expect(mockCreateTypedElementTemplate.mock.calls[0]?.[1]).toEqual({ id: 'typed-list' });
    expect(mockCreateTypedElementTemplate.mock.calls[0]?.[2]).toEqual([[slotChildRef]]);
    expect(mockCreateTypedElementTemplate.mock.calls[0]?.[3]).toBe(21);
    expect(mockCreateTypedElementTemplate.mock.calls[0]?.[4]).toEqual({
      metadata: { itemCount: 1 },
      estimatedHeight: 80,
    });
    expect(elementTemplateRegistry.has(21)).toBe(true);
  });

  it('creates exact typed lists with callbacks and logical children in options', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();

    const itemRef = { __isNativeRef: true, id: 'option-child', __mockNativeId: 101 } as unknown as ElementRef;
    elementTemplateRegistry.set(12, itemRef);
    mockCreateTypedElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTypedElement,
      28,
      'list',
      { id: 'typed-list' },
      [],
      {
        listChildren: [{ __etHandleRef: 12, type: '_et_item', platformInfo: { 'item-key': 'a' } }],
        estimatedHeight: 80,
      },
    ]);

    expect(mockCreateTypedElementTemplate.mock.calls).toHaveLength(1);
    expect(mockCreateTypedElementTemplate.mock.calls[0]?.[0]).toBe('list');
    expect(mockCreateTypedElementTemplate.mock.calls[0]?.[1]).toEqual({
      id: 'typed-list',
      'component-at-index': expect.any(Function),
      'component-at-indexes': expect.any(Function),
      'enqueue-component': expect.any(Function),
    });
    expect(mockCreateTypedElementTemplate.mock.calls[0]?.[2]).toBe(null);
    expect(mockCreateTypedElementTemplate.mock.calls[0]?.[3]).toBe(28);
    expect(mockCreateTypedElementTemplate.mock.calls[0]?.[4]).toEqual({
      listChildren: [itemRef],
      estimatedHeight: 80,
    });
    expect(mockSetAttributeOfElementTemplate.mock.calls).toEqual([[
      expect.anything(),
      0,
      {
        id: 'typed-list',
        'component-at-index': expect.any(Function),
        'component-at-indexes': expect.any(Function),
        'enqueue-component': expect.any(Function),
        'update-list-info': {
          insertAction: [{ position: 0, type: '_et_item', 'item-key': 'a' }],
          removeAction: [],
          updateAction: [],
        },
      },
      null,
    ]]);
    expect(elementTemplateRegistry.has(28)).toBe(true);
    const listRef = elementTemplateRegistry.get(28)!;
    const materializedListRef = {
      __isNativeRef: true,
      id: 'materialized-list',
      __mockNativeId: 1001,
    } as unknown as ElementRef;
    const componentAtIndex = (mockCreateTypedElementTemplate.mock.calls[0]![1] as Record<string, unknown>)[
      'component-at-index'
    ] as ComponentAtIndexCallback;

    mockInsertNodeToElementTemplate.mockClear();
    expect(componentAtIndex(materializedListRef, 7, 0, 88, false)).toBe(101);
    expect(mockInsertNodeToElementTemplate.mock.calls).toEqual([[listRef, 0, itemRef, null]]);
  });

  it('creates exact typed lists outside development using the internal listChildren contract', () => {
    const originalDev = globalThis.__DEV__;
    globalThis.__DEV__ = false;
    try {
      envManager.switchToMainThread();
      elementTemplateRegistry.clear();
      const itemRef = { __isNativeRef: true, id: 'option-child' } as unknown as ElementRef;
      elementTemplateRegistry.set(12, itemRef);
      mockCreateTypedElementTemplate.mockClear();

      applyElementTemplateUpdateCommands([
        ElementTemplateUpdateOps.createTypedElement,
        33,
        'list',
        null,
        [],
        {
          listChildren: [{ __etHandleRef: 12, type: '_et_item', platformInfo: {} }],
          estimatedHeight: 80,
        },
      ]);

      expect(mockCreateTypedElementTemplate.mock.calls).toHaveLength(1);
      expect(mockCreateTypedElementTemplate.mock.calls[0]?.[4]).toEqual({
        listChildren: [itemRef],
        estimatedHeight: 80,
      });
      expect(elementTemplateRegistry.has(33)).toBe(true);
    } finally {
      globalThis.__DEV__ = originalDev;
    }
  });

  it('creates exact typed lists with null visible element slots', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();
    mockCreateTypedElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTypedElement,
      29,
      'list',
      null,
      null,
      { listChildren: [] },
    ]);

    expect(mockCreateTypedElementTemplate.mock.calls).toHaveLength(1);
    expect(mockCreateTypedElementTemplate.mock.calls[0]?.[2]).toBe(null);
    expect(mockCreateTypedElementTemplate.mock.calls[0]?.[4]).toEqual({
      listChildren: [],
    });
    expect(elementTemplateRegistry.has(29)).toBe(true);
  });

  it('rejects exact typed list create without logical children options', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();
    mockCreateTypedElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTypedElement,
      32,
      'list',
      null,
      [],
      null,
    ]);

    expect(mockCreateTypedElementTemplate.mock.calls).toHaveLength(0);
    expect(elementTemplateRegistry.has(32)).toBe(false);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
      'typed list create must keep logical children in options.listChildren',
    );
    resetReportedErrors();
  });

  it('rejects exact typed list create with visible element slots', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();
    const slotChildRef = { __isNativeRef: true, id: 'slot-child' } as unknown as ElementRef;
    const itemRef = { __isNativeRef: true, id: 'item' } as unknown as ElementRef;
    elementTemplateRegistry.set(11, slotChildRef);
    elementTemplateRegistry.set(12, itemRef);
    mockCreateTypedElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTypedElement,
      30,
      'list',
      null,
      [[11]],
      { listChildren: [{ __etHandleRef: 12, type: '_et_item', platformInfo: {} }] },
    ]);

    expect(mockCreateTypedElementTemplate.mock.calls).toHaveLength(0);
    expect(elementTemplateRegistry.has(30)).toBe(false);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
      'typed list create must keep logical children in options.listChildren',
    );
    resetReportedErrors();
  });

  it('creates typed elements with no command options', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();
    mockCreateTypedElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTypedElement,
      23,
      'typed-host',
      null,
      [],
      null,
    ]);

    expect(mockCreateTypedElementTemplate.mock.calls[0]?.[1]).toBe(null);
    expect(mockCreateTypedElementTemplate.mock.calls[0]?.[4]).toBe(null);
    expect(elementTemplateRegistry.has(23)).toBe(true);
  });

  it('reports invalid typed create handleId', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();
    mockCreateTypedElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTypedElement,
      0,
      'typed-host',
      null,
      [],
      null,
    ]);

    expect(mockCreateTypedElementTemplate.mock.calls).toHaveLength(0);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('invalid handleId 0');
    resetReportedErrors();
  });

  it('reports invalid typed create elementSlots', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();
    mockCreateTypedElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTypedElement,
      28,
      'list',
      null,
      'bad-slots' as unknown as ElementTemplateUpdateCommandStream[number],
      null,
    ]);

    expect(mockCreateTypedElementTemplate.mock.calls).toHaveLength(0);
    expect(elementTemplateRegistry.has(28)).toBe(false);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
      'elementSlots must be an array, null, or undefined',
    );
    resetReportedErrors();
  });

  it('reports duplicate typed create handleId', () => {
    envManager.switchToMainThread();
    const existingRef = { __isNativeRef: true, id: 'existing' } as unknown as ElementRef;
    elementTemplateRegistry.set(26, existingRef);
    mockCreateTypedElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTypedElement,
      26,
      'typed-host',
      null,
      [],
      null,
    ]);

    expect(mockCreateTypedElementTemplate.mock.calls).toHaveLength(0);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('duplicate handleId 26');
    resetReportedErrors();
  });

  it('reports invalid non-array elementSlots on typed create', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();
    mockCreateTypedElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTypedElement,
      27,
      'typed-host',
      null,
      'bad-slots' as unknown as ElementTemplateUpdateCommandStream[number],
      null,
    ]);

    expect(mockCreateTypedElementTemplate.mock.calls).toHaveLength(0);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
      'elementSlots must be an array, null, or undefined',
    );
    resetReportedErrors();
  });

  it('skips typed create when element slot handles are unresolved', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();
    mockCreateTypedElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTypedElement,
      25,
      'typed-host',
      null,
      [[404]],
      null,
    ]);

    expect(mockCreateTypedElementTemplate.mock.calls).toHaveLength(0);
    expect(elementTemplateRegistry.has(25)).toBe(false);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('child handle 404 not found');
    resetReportedErrors();
  });

  it('skips typed list create when a logical child handle is unresolved', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();
    mockCreateTypedElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTypedElement,
      42,
      'list',
      null,
      [],
      { listChildren: [{ __etHandleRef: 404, type: '_et_item', platformInfo: {} }] },
    ]);

    expect(mockCreateTypedElementTemplate.mock.calls).toHaveLength(0);
    expect(elementTemplateRegistry.has(42)).toBe(false);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
      'typed list item 0 handle 404 not found',
    );
    resetReportedErrors();
  });

  it('skips typed list item patches when the item handle is unresolved', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();
    const listRef = { __isNativeRef: true, id: 'typed-list', __mockNativeId: 41 } as unknown as ElementRef;
    elementTemplateRegistry.set(41, listRef);
    registerElementTemplateListState(41, createElementTemplateListState([]), false, listRef);
    mockSetAttributeOfElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.insertTypedListItem,
      41,
      { __etHandleRef: 404, type: '_et_item', platformInfo: {} },
      0,
      ElementTemplateUpdateOps.updateTypedListItem,
      41,
      { __etHandleRef: 405, type: '_et_item', platformInfo: {} },
    ]);

    expect(mockSetAttributeOfElementTemplate.mock.calls).toHaveLength(0);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
      'typed list insert item handle 404 not found',
    );
    expect(String(reportError.mock.calls[1]?.[0]?.message ?? '')).toContain(
      'typed list update item handle 405 not found',
    );
    resetReportedErrors();
  });

  it('skips pending typed list flushes when the list handle is unresolved', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();
    const listRef = { __isNativeRef: true, id: 'typed-list' } as unknown as ElementRef;
    registerElementTemplateListState(91, createElementTemplateListState([]), true, listRef);
    mockSetAttributeOfElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([]);

    expect(mockSetAttributeOfElementTemplate.mock.calls).toHaveLength(0);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('typed list handle 91 not found');
    resetReportedErrors();
  });

  it('reports missing list item records when constructing typed list state', () => {
    expect(() => createElementTemplateListState([404])).toThrow(
      'Element Template typed list received a non-list-item root in logical slot $0.',
    );
  });

  it('sets typed slot 0 attributes through the standard attr-slot PAPI', () => {
    envManager.switchToMainThread();
    const targetRef = { __isNativeRef: true, id: 'typed-target' } as unknown as ElementRef;
    elementTemplateRegistry.set(31, targetRef);
    mockSetAttribute.mockClear();
    mockSetAttributeOfElementTemplate.mockClear();

    const updateListInfo = {
      insertAction: [],
      removeAction: [],
      updateAction: [],
    };
    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.setAttribute,
      31,
      0,
      { 'update-list-info': updateListInfo },
    ]);

    expect(mockSetAttributeOfElementTemplate.mock.calls).toEqual([[
      targetRef,
      0,
      { 'update-list-info': updateListInfo },
      null,
    ]]);
    expect(mockSetAttribute.mock.calls).toHaveLength(0);
  });

  it('keeps list callbacks when hydrated list attributes update through slot 0', () => {
    envManager.switchToMainThread();
    const listRef = { __isNativeRef: true, id: 'typed-list', __mockNativeId: 95 } as unknown as ElementRef;
    elementTemplateRegistry.set(29, listRef);
    registerElementTemplateListState(29, createElementTemplateListState([], { id: 'old' }), false, listRef);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.setAttribute,
      29,
      0,
      { id: 'next' },
    ]);

    expect(mockSetAttributeOfElementTemplate.mock.calls[0]).toEqual([
      listRef,
      0,
      {
        id: 'next',
        'component-at-index': expect.any(Function),
        'component-at-indexes': expect.any(Function),
        'enqueue-component': expect.any(Function),
      },
      null,
    ]);
  });

  it('clears typed slot 0 attributes through the standard attr-slot PAPI', () => {
    envManager.switchToMainThread();
    const targetRef = { __isNativeRef: true, id: 'typed-target' } as unknown as ElementRef;
    elementTemplateRegistry.set(32, targetRef);
    mockSetAttribute.mockClear();
    mockSetAttributeOfElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.setAttribute,
      32,
      0,
      null,
    ]);

    expect(mockSetAttributeOfElementTemplate.mock.calls).toEqual([[
      targetRef,
      0,
      null,
      null,
    ]]);
    expect(mockSetAttribute.mock.calls).toHaveLength(0);
  });

  it('applies incremental list insert before writing update-list-info', () => {
    envManager.switchToMainThread();
    const listRef = { __isNativeRef: true, id: 'typed-list', __mockNativeId: 100 } as unknown as ElementRef;
    const firstRef = { __isNativeRef: true, id: 'first', __mockNativeId: 101 } as unknown as ElementRef;
    const secondRef = { __isNativeRef: true, id: 'second', __mockNativeId: 102 } as unknown as ElementRef;
    elementTemplateRegistry.set(31, listRef);
    elementTemplateRegistry.set(32, firstRef);
    elementTemplateRegistry.set(33, secondRef);
    registerElementTemplateListItem(32, firstRef, {
      templateKey: '_et_item_a',
      platformInfo: { 'item-key': 'a' },
    });
    const state = createElementTemplateListState([32]);
    registerElementTemplateListState(31, state, false, listRef);
    const attrs = composeElementTemplateListAttributes({ id: 'feed' }, state);
    const componentAtIndex = attrs['component-at-index'] as ComponentAtIndexCallback;
    mockSetAttributeOfElementTemplate.mockImplementationOnce((...args: unknown[]) => {
      expect(componentAtIndex(listRef, 7, 1, 99, false)).toBe(102);
      expect(mockInsertNodeToElementTemplate.mock.calls[0]).toEqual([listRef, 0, secondRef, null]);
      lastMock!.mockSetAttributeOfElementTemplate(...args);
    });

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.insertTypedListItem,
      31,
      {
        __etHandleRef: 33,
        type: '_et_item_b',
        platformInfo: { 'item-key': 'b' },
      },
      0,
    ]);

    expect(mockSetAttributeOfElementTemplate.mock.calls[0]).toEqual([
      listRef,
      0,
      {
        id: 'feed',
        'component-at-index': attrs['component-at-index'],
        'component-at-indexes': attrs['component-at-indexes'],
        'enqueue-component': attrs['enqueue-component'],
        'update-list-info': {
          insertAction: [{ position: 1, type: '_et_item_b', 'item-key': 'b' }],
          removeAction: [],
          updateAction: [],
        },
      },
      null,
    ]);
    expect(mockRemoveNodeFromElementTemplate.mock.calls).toHaveLength(0);
    expect(elementTemplateRegistry.get(32)).toBe(firstRef);
  });

  it('preserves update-list-info when list attributes update after list mutation in the same stream', () => {
    envManager.switchToMainThread();
    const listRef = { __isNativeRef: true, id: 'typed-list', __mockNativeId: 105 } as unknown as ElementRef;
    const firstRef = { __isNativeRef: true, id: 'first', __mockNativeId: 106 } as unknown as ElementRef;
    const secondRef = { __isNativeRef: true, id: 'second', __mockNativeId: 107 } as unknown as ElementRef;
    elementTemplateRegistry.set(35, listRef);
    elementTemplateRegistry.set(36, firstRef);
    elementTemplateRegistry.set(37, secondRef);
    registerElementTemplateListItem(36, firstRef, {
      templateKey: '_et_item_a',
      platformInfo: { 'item-key': 'a' },
    });
    registerElementTemplateListState(
      35,
      createElementTemplateListState([36], { id: 'feed' }),
      false,
      listRef,
    );

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.insertTypedListItem,
      35,
      {
        __etHandleRef: 37,
        type: '_et_item_b',
        platformInfo: { 'item-key': 'b' },
      },
      0,
      ElementTemplateUpdateOps.setAttribute,
      35,
      0,
      { id: 'next' },
    ]);

    const attrWrite = mockSetAttributeOfElementTemplate.mock.calls[0]![2] as Record<string, unknown>;
    const finalWrite = mockSetAttributeOfElementTemplate.mock.calls[1]![2] as Record<string, unknown>;
    const updateListInfo = {
      insertAction: [{ position: 1, type: '_et_item_b', 'item-key': 'b' }],
      removeAction: [],
      updateAction: [],
    };
    expect(attrWrite).toEqual(expect.objectContaining({
      id: 'next',
      'component-at-index': expect.any(Function),
      'component-at-indexes': expect.any(Function),
      'enqueue-component': expect.any(Function),
    }));
    expect(attrWrite).not.toHaveProperty('update-list-info');
    expect(finalWrite).toEqual(expect.objectContaining({
      id: 'next',
      'update-list-info': updateListInfo,
      'component-at-index': attrWrite['component-at-index'],
      'component-at-indexes': attrWrite['component-at-indexes'],
      'enqueue-component': attrWrite['enqueue-component'],
    }));
  });

  it('coalesces multiple incremental list mutations into one Snapshot-shaped update-list-info write', () => {
    envManager.switchToMainThread();
    const listRef = { __isNativeRef: true, id: 'typed-list', __mockNativeId: 200 } as unknown as ElementRef;
    const refs = [201, 202, 203, 204, 205].map(id =>
      ({ __isNativeRef: true, id: `item-${id}`, __mockNativeId: id }) as unknown as ElementRef
    );
    elementTemplateRegistry.set(200, listRef);
    for (let index = 0; index < refs.length; index += 1) {
      const handleId = 201 + index;
      elementTemplateRegistry.set(handleId, refs[index]!);
      if (handleId <= 203) {
        registerElementTemplateListItem(handleId, refs[index]!, {
          templateKey: `_et_item_${handleId}`,
          platformInfo: { 'item-key': String(handleId) },
        });
      }
    }
    registerElementTemplateListState(200, createElementTemplateListState([201, 202, 203]), false, listRef);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.insertTypedListItem,
      200,
      { __etHandleRef: 204, type: '_et_item_204', platformInfo: { 'item-key': '204' } },
      202,
      ElementTemplateUpdateOps.insertTypedListItem,
      200,
      { __etHandleRef: 205, type: '_et_item_205', platformInfo: { 'item-key': '205' } },
      204,
      ElementTemplateUpdateOps.removeTypedListItem,
      200,
      202,
      [202],
      ElementTemplateUpdateOps.removeTypedListItem,
      200,
      203,
      [],
      ElementTemplateUpdateOps.insertTypedListItem,
      200,
      { __etHandleRef: 203, type: '_et_item_203', platformInfo: { 'item-key': '203' } },
      0,
    ]);

    expect(mockSetAttributeOfElementTemplate.mock.calls).toHaveLength(1);
    expect(mockSetAttributeOfElementTemplate.mock.calls[0]).toEqual([
      listRef,
      0,
      {
        'component-at-index': expect.any(Function),
        'component-at-indexes': expect.any(Function),
        'enqueue-component': expect.any(Function),
        'update-list-info': {
          insertAction: [
            { position: 1, type: '_et_item_205', 'item-key': '205' },
            { position: 2, type: '_et_item_204', 'item-key': '204' },
            { position: 3, type: '_et_item_203', 'item-key': '203' },
          ],
          removeAction: [1, 2],
          updateAction: [],
        },
      },
      null,
    ]);
    expect(mockInsertNodeToElementTemplate.mock.calls).toHaveLength(0);
    expect(mockRemoveNodeFromElementTemplate.mock.calls).toHaveLength(0);
  });

  it('coalesces platform info updates and indexes them after same-batch insertions', () => {
    envManager.switchToMainThread();
    const listRef = { __isNativeRef: true, id: 'typed-list', __mockNativeId: 210 } as unknown as ElementRef;
    const aRef = { __isNativeRef: true, id: 'a', __mockNativeId: 211 } as unknown as ElementRef;
    const bRef = { __isNativeRef: true, id: 'b', __mockNativeId: 212 } as unknown as ElementRef;
    const dRef = { __isNativeRef: true, id: 'd', __mockNativeId: 213 } as unknown as ElementRef;
    elementTemplateRegistry.set(210, listRef);
    elementTemplateRegistry.set(211, aRef);
    elementTemplateRegistry.set(212, bRef);
    elementTemplateRegistry.set(213, dRef);
    registerElementTemplateListItem(211, aRef, {
      templateKey: '_et_item_a',
      platformInfo: { 'item-key': 'a' },
    });
    registerElementTemplateListItem(212, bRef, {
      templateKey: '_et_item_b',
      platformInfo: { 'item-key': 'b' },
    });
    registerElementTemplateListState(210, createElementTemplateListState([211, 212]), false, listRef);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.insertTypedListItem,
      210,
      { __etHandleRef: 213, type: '_et_item_d', platformInfo: { 'item-key': 'd' } },
      212,
      ElementTemplateUpdateOps.updateTypedListItem,
      210,
      { __etHandleRef: 211, type: '_et_item_a', platformInfo: { 'item-key': 'a', 'full-span': true } },
      ElementTemplateUpdateOps.updateTypedListItem,
      210,
      { __etHandleRef: 212, type: '_et_item_b', platformInfo: { 'item-key': 'b', 'estimated-height': 42 } },
    ]);

    expect(mockSetAttributeOfElementTemplate.mock.calls).toHaveLength(1);
    expect(mockSetAttributeOfElementTemplate.mock.calls[0]![2]).toEqual(expect.objectContaining({
      'update-list-info': {
        insertAction: [{ position: 1, type: '_et_item_d', 'item-key': 'd' }],
        removeAction: [],
        updateAction: [
          { from: 0, to: 0, type: '_et_item_a', flush: false, 'item-key': 'a', 'full-span': true },
          { from: 2, to: 2, type: '_et_item_b', flush: false, 'item-key': 'b', 'estimated-height': 42 },
        ],
      },
    }));
  });

  it('skips no-op list item platform info updates', () => {
    envManager.switchToMainThread();
    const listRef = { __isNativeRef: true, id: 'typed-list', __mockNativeId: 214 } as unknown as ElementRef;
    const itemRef = { __isNativeRef: true, id: 'a', __mockNativeId: 2141 } as unknown as ElementRef;
    elementTemplateRegistry.set(214, listRef);
    elementTemplateRegistry.set(2141, itemRef);
    registerElementTemplateListItem(2141, itemRef, {
      templateKey: '_et_item_a',
      platformInfo: { 'item-key': 'a' },
    });
    registerElementTemplateListState(214, createElementTemplateListState([2141]), false, listRef);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.updateTypedListItem,
      214,
      { __etHandleRef: 2141, type: '_et_item_a', platformInfo: { 'item-key': 'a' } },
    ]);

    expect(mockSetAttributeOfElementTemplate.mock.calls).toHaveLength(0);
  });

  it('folds moved item platform info into the incremental insert action', () => {
    envManager.switchToMainThread();
    const listRef = { __isNativeRef: true, id: 'typed-list', __mockNativeId: 215 } as unknown as ElementRef;
    const aRef = { __isNativeRef: true, id: 'a', __mockNativeId: 216 } as unknown as ElementRef;
    const bRef = { __isNativeRef: true, id: 'b', __mockNativeId: 217 } as unknown as ElementRef;
    elementTemplateRegistry.set(215, listRef);
    elementTemplateRegistry.set(216, aRef);
    elementTemplateRegistry.set(217, bRef);
    registerElementTemplateListItem(216, aRef, {
      templateKey: '_et_item_a',
      platformInfo: { 'item-key': 'a' },
    });
    registerElementTemplateListItem(217, bRef, {
      templateKey: '_et_item_b',
      platformInfo: { 'item-key': 'b' },
    });
    registerElementTemplateListState(215, createElementTemplateListState([216, 217]), false, listRef);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.removeTypedListItem,
      215,
      217,
      [],
      ElementTemplateUpdateOps.insertTypedListItem,
      215,
      { __etHandleRef: 217, type: '_et_item_b', platformInfo: { 'item-key': 'b' } },
      216,
      ElementTemplateUpdateOps.updateTypedListItem,
      215,
      { __etHandleRef: 217, type: '_et_item_b', platformInfo: { 'item-key': 'b', 'full-span': true } },
    ]);

    expect(mockSetAttributeOfElementTemplate.mock.calls).toHaveLength(1);
    expect(mockSetAttributeOfElementTemplate.mock.calls[0]![2]).toEqual(expect.objectContaining({
      'update-list-info': {
        insertAction: [{ position: 0, type: '_et_item_b', 'item-key': 'b', 'full-span': true }],
        removeAction: [1],
        updateAction: [],
      },
    }));
  });

  it('places an insertion before a moved item at the moved item final position', () => {
    envManager.switchToMainThread();
    const listRef = { __isNativeRef: true, id: 'typed-list', __mockNativeId: 218 } as unknown as ElementRef;
    const aRef = { __isNativeRef: true, id: 'a', __mockNativeId: 2181 } as unknown as ElementRef;
    const bRef = { __isNativeRef: true, id: 'b', __mockNativeId: 2182 } as unknown as ElementRef;
    const cRef = { __isNativeRef: true, id: 'c', __mockNativeId: 2183 } as unknown as ElementRef;
    const xRef = { __isNativeRef: true, id: 'x', __mockNativeId: 2184 } as unknown as ElementRef;
    elementTemplateRegistry.set(218, listRef);
    elementTemplateRegistry.set(2181, aRef);
    elementTemplateRegistry.set(2182, bRef);
    elementTemplateRegistry.set(2183, cRef);
    elementTemplateRegistry.set(2184, xRef);
    registerElementTemplateListItem(2181, aRef, {
      templateKey: '_et_item_a',
      platformInfo: { 'item-key': 'a' },
    });
    registerElementTemplateListItem(2182, bRef, {
      templateKey: '_et_item_b',
      platformInfo: { 'item-key': 'b' },
    });
    registerElementTemplateListItem(2183, cRef, {
      templateKey: '_et_item_c',
      platformInfo: { 'item-key': 'c' },
    });
    registerElementTemplateListState(218, createElementTemplateListState([2181, 2182, 2183]), false, listRef);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.removeTypedListItem,
      218,
      2181,
      [],
      ElementTemplateUpdateOps.removeTypedListItem,
      218,
      2183,
      [2183],
      ElementTemplateUpdateOps.insertTypedListItem,
      218,
      { __etHandleRef: 2181, type: '_et_item_a', platformInfo: { 'item-key': 'a', 'reuse-identifier': 'next' } },
      0,
      ElementTemplateUpdateOps.insertTypedListItem,
      218,
      { __etHandleRef: 2184, type: '_et_item_x', platformInfo: { 'item-key': 'x' } },
      2181,
    ]);

    expect(mockSetAttributeOfElementTemplate.mock.calls).toHaveLength(1);
    expect(mockSetAttributeOfElementTemplate.mock.calls[0]![2]).toEqual(expect.objectContaining({
      'update-list-info': {
        insertAction: [
          { position: 1, type: '_et_item_x', 'item-key': 'x' },
          { position: 2, type: '_et_item_a', 'item-key': 'a', 'reuse-identifier': 'next' },
        ],
        removeAction: [0, 2],
        updateAction: [],
      },
    }));
  });

  it('flushes incremental list updates with the latest slot 0 attributes regardless of stream order', () => {
    envManager.switchToMainThread();
    const listRef = { __isNativeRef: true, id: 'typed-list', __mockNativeId: 220 } as unknown as ElementRef;
    const firstRef = { __isNativeRef: true, id: 'first', __mockNativeId: 221 } as unknown as ElementRef;
    const secondRef = { __isNativeRef: true, id: 'second', __mockNativeId: 222 } as unknown as ElementRef;
    elementTemplateRegistry.set(220, listRef);
    elementTemplateRegistry.set(221, firstRef);
    elementTemplateRegistry.set(222, secondRef);
    registerElementTemplateListItem(221, firstRef, {
      templateKey: '_et_item_a',
      platformInfo: { 'item-key': 'a' },
    });
    registerElementTemplateListState(220, createElementTemplateListState([221], { id: 'old' }), false, listRef);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.setAttribute,
      220,
      0,
      { id: 'intermediate' },
      ElementTemplateUpdateOps.insertTypedListItem,
      220,
      { __etHandleRef: 222, type: '_et_item_b', platformInfo: { 'item-key': 'b' } },
      0,
      ElementTemplateUpdateOps.setAttribute,
      220,
      0,
      { id: 'final' },
    ]);

    expect(mockSetAttributeOfElementTemplate.mock.calls).toHaveLength(3);
    const latestAttrWrite = mockSetAttributeOfElementTemplate.mock.calls[1]![2] as Record<string, unknown>;
    expect(mockSetAttributeOfElementTemplate.mock.calls[2]![2]).toEqual(expect.objectContaining({
      id: 'final',
      'update-list-info': {
        insertAction: [{ position: 1, type: '_et_item_b', 'item-key': 'b' }],
        removeAction: [],
        updateAction: [],
      },
      'component-at-index': latestAttrWrite['component-at-index'],
      'component-at-indexes': latestAttrWrite['component-at-indexes'],
      'enqueue-component': latestAttrWrite['enqueue-component'],
    }));
  });

  it('moves already attached same-list items when native requests the moved index first', () => {
    envManager.switchToMainThread();
    const listRef = { __isNativeRef: true, id: 'typed-list', __mockNativeId: 225 } as unknown as ElementRef;
    const aRef = { __isNativeRef: true, id: 'a', __mockNativeId: 226 } as unknown as ElementRef;
    const bRef = { __isNativeRef: true, id: 'b', __mockNativeId: 227 } as unknown as ElementRef;
    elementTemplateRegistry.set(225, listRef);
    elementTemplateRegistry.set(226, aRef);
    elementTemplateRegistry.set(227, bRef);
    registerElementTemplateListItem(226, aRef, {
      templateKey: '_et_item_a',
      platformInfo: { 'item-key': 'a' },
    });
    registerElementTemplateListItem(227, bRef, {
      templateKey: '_et_item_b',
      platformInfo: { 'item-key': 'b' },
    });
    const state = createElementTemplateListState([226, 227]);
    registerElementTemplateListState(225, state, false, listRef);
    const attrs = composeElementTemplateListAttributes(null, state);
    const componentAtIndex = attrs['component-at-index'] as ComponentAtIndexCallback;
    const enqueueComponent = attrs['enqueue-component'] as EnqueueComponentCallback;
    expect(componentAtIndex(listRef, 7, 0, 88, false)).toBe(226);
    expect(componentAtIndex(listRef, 7, 1, 89, false)).toBe(227);
    mockInsertNodeToElementTemplate.mockClear();
    mockRemoveNodeFromElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.removeTypedListItem,
      225,
      227,
      [],
      ElementTemplateUpdateOps.insertTypedListItem,
      225,
      { __etHandleRef: 227, type: '_et_item_b', platformInfo: { 'item-key': 'b' } },
      226,
    ]);
    mockInsertNodeToElementTemplate.mockClear();
    mockRemoveNodeFromElementTemplate.mockClear();

    expect(componentAtIndex(listRef, 7, 0, 90, false)).toBe(227);

    expect(mockInsertNodeToElementTemplate.mock.calls).toEqual([[listRef, 0, bRef, aRef]]);
    expect(mockRemoveNodeFromElementTemplate.mock.calls).toHaveLength(0);
    enqueueComponent(listRef, 7, 227);
    expect(mockRemoveNodeFromElementTemplate.mock.calls).toHaveLength(0);
    enqueueComponent(listRef, 7, 227);
    expect(mockRemoveNodeFromElementTemplate.mock.calls).toEqual([[listRef, 0, bRef]]);
  });

  it('places multiple attached same-list moves in final order on the first native request', () => {
    envManager.switchToMainThread();
    const listRef = { __isNativeRef: true, id: 'typed-list', __mockNativeId: 240 } as unknown as ElementRef;
    const aRef = { __isNativeRef: true, id: 'a', __mockNativeId: 241 } as unknown as ElementRef;
    const bRef = { __isNativeRef: true, id: 'b', __mockNativeId: 242 } as unknown as ElementRef;
    const cRef = { __isNativeRef: true, id: 'c', __mockNativeId: 243 } as unknown as ElementRef;
    elementTemplateRegistry.set(240, listRef);
    elementTemplateRegistry.set(241, aRef);
    elementTemplateRegistry.set(242, bRef);
    elementTemplateRegistry.set(243, cRef);
    registerElementTemplateListItem(241, aRef, {
      templateKey: '_et_item_a',
      platformInfo: { 'item-key': 'a' },
    });
    registerElementTemplateListItem(242, bRef, {
      templateKey: '_et_item_b',
      platformInfo: { 'item-key': 'b' },
    });
    registerElementTemplateListItem(243, cRef, {
      templateKey: '_et_item_c',
      platformInfo: { 'item-key': 'c' },
    });
    const state = createElementTemplateListState([241, 242, 243]);
    registerElementTemplateListState(240, state, false, listRef);
    const attrs = composeElementTemplateListAttributes(null, state);
    const componentAtIndex = attrs['component-at-index'] as ComponentAtIndexCallback;
    const enqueueComponent = attrs['enqueue-component'] as EnqueueComponentCallback;
    expect(componentAtIndex(listRef, 7, 0, 80, false)).toBe(241);
    expect(componentAtIndex(listRef, 7, 1, 81, false)).toBe(242);
    expect(componentAtIndex(listRef, 7, 2, 82, false)).toBe(243);
    mockInsertNodeToElementTemplate.mockClear();
    mockRemoveNodeFromElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.removeTypedListItem,
      240,
      243,
      [],
      ElementTemplateUpdateOps.insertTypedListItem,
      240,
      { __etHandleRef: 243, type: '_et_item_c', platformInfo: { 'item-key': 'c' } },
      241,
      ElementTemplateUpdateOps.removeTypedListItem,
      240,
      241,
      [],
      ElementTemplateUpdateOps.insertTypedListItem,
      240,
      { __etHandleRef: 241, type: '_et_item_a', platformInfo: { 'item-key': 'a' } },
      0,
    ]);
    mockInsertNodeToElementTemplate.mockClear();
    mockRemoveNodeFromElementTemplate.mockClear();

    expect(componentAtIndex(listRef, 7, 0, 90, false)).toBe(243);

    expect(mockInsertNodeToElementTemplate.mock.calls).toEqual([
      [listRef, 0, aRef, null],
      [listRef, 0, cRef, bRef],
    ]);
    enqueueComponent(listRef, 7, 243);
    enqueueComponent(listRef, 7, 241);
    expect(mockRemoveNodeFromElementTemplate.mock.calls).toHaveLength(0);
    expect(componentAtIndex(listRef, 7, 1, 91, false)).toBe(242);
  });

  it('preserves moved list item registry while lifetime removal releases removed item', () => {
    envManager.switchToMainThread();
    const listRef = { __isNativeRef: true, id: 'typed-list', __mockNativeId: 230 } as unknown as ElementRef;
    const firstRef = { __isNativeRef: true, id: 'first', __mockNativeId: 231 } as unknown as ElementRef;
    const secondRef = { __isNativeRef: true, id: 'second', __mockNativeId: 232 } as unknown as ElementRef;
    elementTemplateRegistry.set(230, listRef);
    elementTemplateRegistry.set(231, firstRef);
    elementTemplateRegistry.set(232, secondRef);
    registerElementTemplateListItem(231, firstRef, {
      templateKey: '_et_item_a',
      platformInfo: { 'item-key': 'a' },
    });
    registerElementTemplateListItem(232, secondRef, {
      templateKey: '_et_item_b',
      platformInfo: { 'item-key': 'b' },
    });
    const state = createElementTemplateListState([231, 232]);
    registerElementTemplateListState(230, state, false, listRef);
    const attrs = composeElementTemplateListAttributes(null, state);
    const componentAtIndex = attrs['component-at-index'] as ComponentAtIndexCallback;
    const enqueueComponent = attrs['enqueue-component'] as EnqueueComponentCallback;
    expect(componentAtIndex(listRef, 7, 1, 88, false)).toBe(232);
    mockInsertNodeToElementTemplate.mockClear();
    mockRemoveNodeFromElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.removeTypedListItem,
      230,
      232,
      [],
      ElementTemplateUpdateOps.insertTypedListItem,
      230,
      { __etHandleRef: 232, type: '_et_item_b', platformInfo: { 'item-key': 'b' } },
      231,
      ElementTemplateUpdateOps.removeTypedListItem,
      230,
      231,
      [231],
    ]);
    enqueueComponent(listRef, 7, 232);
    enqueueComponent(listRef, 7, 231);

    expect(mockSetAttributeOfElementTemplate.mock.calls[0]![2]).toEqual(expect.objectContaining({
      'update-list-info': {
        insertAction: [{ position: 0, type: '_et_item_b', 'item-key': 'b' }],
        removeAction: [0, 1],
        updateAction: [],
      },
    }));
    expect(mockRemoveNodeFromElementTemplate.mock.calls).toEqual([[listRef, 0, secondRef]]);
    expect(elementTemplateRegistry.get(231)).toBeUndefined();
    expect(elementTemplateRegistry.get(232)).toBe(secondRef);
  });

  it('keeps removed item callback lookup until native enqueue detaches it', () => {
    envManager.switchToMainThread();
    const listRef = { __isNativeRef: true, id: 'typed-list', __mockNativeId: 110 } as unknown as ElementRef;
    const firstRef = { __isNativeRef: true, id: 'first', __mockNativeId: 111 } as unknown as ElementRef;
    elementTemplateRegistry.set(41, listRef);
    elementTemplateRegistry.set(42, firstRef);
    registerElementTemplateListItem(42, firstRef, {
      templateKey: '_et_item_a',
      platformInfo: { 'item-key': 'a' },
    });
    const state = createElementTemplateListState([42]);
    registerElementTemplateListState(41, state, false, listRef);
    const attrs = composeElementTemplateListAttributes(null, state);
    const componentAtIndex = attrs['component-at-index'] as ComponentAtIndexCallback;

    expect(componentAtIndex(listRef, 7, 0, 88, false)).toBe(111);
    mockRemoveNodeFromElementTemplate.mockClear();
    let enqueueComponent: EnqueueComponentCallback | undefined;
    mockSetAttributeOfElementTemplate.mockImplementationOnce((...args: unknown[]) => {
      const attrs = args[2] as Record<string, unknown>;
      enqueueComponent = attrs['enqueue-component'] as EnqueueComponentCallback;
      enqueueComponent(listRef, 7, 111);
      lastMock!.mockSetAttributeOfElementTemplate(...args);
    });

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.removeTypedListItem,
      41,
      42,
      [42],
    ]);

    expect(mockRemoveNodeFromElementTemplate.mock.calls).toEqual([[listRef, 0, firstRef]]);
    expect(elementTemplateRegistry.get(42)).toBeUndefined();
    enqueueComponent!(listRef, 7, 111);
    expect(mockRemoveNodeFromElementTemplate.mock.calls).toHaveLength(1);
  });

  it('uses attached state rather than callback lookup presence to detach items', () => {
    envManager.switchToMainThread();
    const listRef = { __isNativeRef: true, id: 'typed-list', __mockNativeId: 140 } as unknown as ElementRef;
    const itemRef = { __isNativeRef: true, id: 'item', __mockNativeId: 141 } as unknown as ElementRef;
    elementTemplateRegistry.set(140, listRef);
    elementTemplateRegistry.set(141, itemRef);
    registerElementTemplateListItem(141, itemRef, {
      templateKey: '_et_item_a',
      platformInfo: { 'item-key': 'a' },
    });
    const state = createElementTemplateListState([141]);
    registerElementTemplateListState(140, state, false, listRef);
    const attrs = composeElementTemplateListAttributes(null, state);
    const componentAtIndex = attrs['component-at-index'] as ComponentAtIndexCallback;
    const enqueueComponent = attrs['enqueue-component'] as EnqueueComponentCallback;

    expect(componentAtIndex(listRef, 7, 0, 88, false)).toBe(141);
    state.items[0]!.attached = false;
    mockRemoveNodeFromElementTemplate.mockClear();

    enqueueComponent(listRef, 7, 141);
    enqueueComponent(listRef, 7, 141);

    expect(mockRemoveNodeFromElementTemplate.mock.calls).toHaveLength(0);
  });

  it('releases removed list item subtrees after the final update-list-info write', () => {
    envManager.switchToMainThread();
    const outerListRef = { __isNativeRef: true, id: 'outer-list', __mockNativeId: 300 } as unknown as ElementRef;
    const itemRef = { __isNativeRef: true, id: 'item', __mockNativeId: 301 } as unknown as ElementRef;
    const nestedListRef = { __isNativeRef: true, id: 'nested-list', __mockNativeId: 302 } as unknown as ElementRef;
    const nestedItemRef = { __isNativeRef: true, id: 'nested-item', __mockNativeId: 303 } as unknown as ElementRef;
    elementTemplateRegistry.set(300, outerListRef);
    elementTemplateRegistry.set(301, itemRef);
    elementTemplateRegistry.set(302, nestedListRef);
    elementTemplateRegistry.set(303, nestedItemRef);
    registerElementTemplateListItem(301, itemRef, {
      templateKey: '_et_item',
      platformInfo: { 'item-key': 'outer' },
    });
    registerElementTemplateListState(300, createElementTemplateListState([301]), false, outerListRef);
    registerElementTemplateListItem(303, nestedItemRef, {
      templateKey: '_et_nested_item',
      platformInfo: { 'item-key': 'nested' },
    });
    const nestedState = createElementTemplateListState([303]);
    registerElementTemplateListState(302, nestedState, false, nestedListRef);
    const nestedAttrs = composeElementTemplateListAttributes(null, nestedState);
    const nestedComponentAtIndex = nestedAttrs['component-at-index'] as ComponentAtIndexCallback;

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.removeTypedListItem,
      300,
      301,
      [301, 302, 303],
    ]);

    expect(mockSetAttributeOfElementTemplate.mock.calls[0]![0]).toBe(outerListRef);
    expect(elementTemplateRegistry.get(301)).toBeUndefined();
    expect(elementTemplateRegistry.get(302)).toBeUndefined();
    expect(elementTemplateRegistry.get(303)).toBeUndefined();
    expect(nestedComponentAtIndex(nestedListRef, 8, 0, 91, false)).toBe(-1);
    expect(mockInsertNodeToElementTemplate.mock.calls).toHaveLength(0);
  });

  it('drains pending item cleanup when the list holder is removed in the same patch', () => {
    envManager.switchToMainThread();
    const parentRef = { __isNativeRef: true, id: 'parent', __mockNativeId: 299 } as unknown as ElementRef;
    const listRef = { __isNativeRef: true, id: 'list', __mockNativeId: 300 } as unknown as ElementRef;
    const itemRef = { __isNativeRef: true, id: 'item', __mockNativeId: 301 } as unknown as ElementRef;
    const nestedListRef = { __isNativeRef: true, id: 'nested-list', __mockNativeId: 302 } as unknown as ElementRef;
    const nestedItemRef = { __isNativeRef: true, id: 'nested-item', __mockNativeId: 303 } as unknown as ElementRef;
    elementTemplateRegistry.set(299, parentRef);
    elementTemplateRegistry.set(300, listRef);
    elementTemplateRegistry.set(301, itemRef);
    elementTemplateRegistry.set(302, nestedListRef);
    elementTemplateRegistry.set(303, nestedItemRef);
    registerElementTemplateListItem(301, itemRef, {
      templateKey: '_et_item',
      platformInfo: { 'item-key': 'outer' },
    });
    registerElementTemplateListState(300, createElementTemplateListState([301]), false, listRef);
    registerElementTemplateListItem(303, nestedItemRef, {
      templateKey: '_et_nested_item',
      platformInfo: { 'item-key': 'nested' },
    });
    const nestedState = createElementTemplateListState([303]);
    registerElementTemplateListState(302, nestedState, false, nestedListRef);
    const nestedAttrs = composeElementTemplateListAttributes(null, nestedState);
    const nestedComponentAtIndex = nestedAttrs['component-at-index'] as ComponentAtIndexCallback;

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.removeTypedListItem,
      300,
      301,
      [301, 302, 303],
      ElementTemplateUpdateOps.removeNode,
      299,
      0,
      300,
      [300],
    ]);

    expect(mockRemoveNodeFromElementTemplate.mock.calls).toEqual([[parentRef, 0, listRef]]);
    expect(mockSetAttributeOfElementTemplate.mock.calls).toHaveLength(0);
    expect(elementTemplateRegistry.get(300)).toBeUndefined();
    expect(elementTemplateRegistry.get(301)).toBeUndefined();
    expect(elementTemplateRegistry.get(302)).toBeUndefined();
    expect(elementTemplateRegistry.get(303)).toBeUndefined();
    expect(nestedComponentAtIndex(nestedListRef, 8, 0, 91, false)).toBe(-1);
  });

  it('emits Snapshot-shaped update-list-info for incremental reorder with platform info changes', () => {
    envManager.switchToMainThread();
    const listRef = { __isNativeRef: true, id: 'typed-list', __mockNativeId: 115 } as unknown as ElementRef;
    const firstRef = { __isNativeRef: true, id: 'first', __mockNativeId: 116 } as unknown as ElementRef;
    const secondRef = { __isNativeRef: true, id: 'second', __mockNativeId: 117 } as unknown as ElementRef;
    elementTemplateRegistry.set(51, listRef);
    elementTemplateRegistry.set(52, firstRef);
    elementTemplateRegistry.set(53, secondRef);
    registerElementTemplateListItem(52, firstRef, {
      templateKey: '_et_item_a',
      platformInfo: { 'item-key': 'a', 'reuse-identifier': 'old' },
    });
    registerElementTemplateListItem(53, secondRef, {
      templateKey: '_et_item_b',
      platformInfo: { 'item-key': 'b' },
    });
    const state = createElementTemplateListState([52, 53]);
    registerElementTemplateListState(51, state, false, listRef);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.removeTypedListItem,
      51,
      52,
      [],
      ElementTemplateUpdateOps.insertTypedListItem,
      51,
      {
        __etHandleRef: 52,
        type: '_et_item_a',
        platformInfo: { 'item-key': 'a', 'reuse-identifier': 'old' },
      },
      0,
      ElementTemplateUpdateOps.updateTypedListItem,
      51,
      {
        __etHandleRef: 52,
        type: '_et_item_a',
        platformInfo: { 'item-key': 'a', 'reuse-identifier': 'new' },
      },
    ]);

    expect(mockSetAttributeOfElementTemplate.mock.calls[0]).toEqual([
      listRef,
      0,
      {
        'component-at-index': expect.any(Function),
        'component-at-indexes': expect.any(Function),
        'enqueue-component': expect.any(Function),
        'update-list-info': {
          insertAction: [{ position: 1, type: '_et_item_a', 'item-key': 'a', 'reuse-identifier': 'new' }],
          removeAction: [0],
          updateAction: [],
        },
      },
      null,
    ]);
  });

  it('emits Snapshot-shaped update-list-info for standalone platform info updates', () => {
    envManager.switchToMainThread();
    const listRef = { __isNativeRef: true, id: 'typed-list', __mockNativeId: 145 } as unknown as ElementRef;
    const itemRef = { __isNativeRef: true, id: 'item', __mockNativeId: 146 } as unknown as ElementRef;
    elementTemplateRegistry.set(81, listRef);
    elementTemplateRegistry.set(82, itemRef);
    registerElementTemplateListItem(82, itemRef, {
      templateKey: '_et_item',
      platformInfo: { 'item-key': 'a' },
    });
    const state = createElementTemplateListState([82]);
    registerElementTemplateListState(81, state, false, listRef);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.updateTypedListItem,
      81,
      {
        __etHandleRef: 82,
        type: '_et_item',
        platformInfo: { 'item-key': 'a', 'reuse-identifier': 'next' },
      },
    ]);

    expect(mockSetAttributeOfElementTemplate.mock.calls[0]).toEqual([
      listRef,
      0,
      {
        'component-at-index': expect.any(Function),
        'component-at-indexes': expect.any(Function),
        'enqueue-component': expect.any(Function),
        'update-list-info': {
          insertAction: [],
          removeAction: [],
          updateAction: [{
            from: 0,
            to: 0,
            type: '_et_item',
            flush: false,
            'item-key': 'a',
            'reuse-identifier': 'next',
          }],
        },
      },
      null,
    ]);
  });

  it('moves attached list items without attaching unrelated detached siblings', () => {
    envManager.switchToMainThread();
    const listRef = { __isNativeRef: true, id: 'typed-list', __mockNativeId: 135 } as unknown as ElementRef;
    const firstRef = { __isNativeRef: true, id: 'first', __mockNativeId: 136 } as unknown as ElementRef;
    const secondRef = { __isNativeRef: true, id: 'second', __mockNativeId: 137 } as unknown as ElementRef;
    elementTemplateRegistry.set(71, listRef);
    elementTemplateRegistry.set(72, firstRef);
    elementTemplateRegistry.set(73, secondRef);
    registerElementTemplateListItem(72, firstRef, {
      templateKey: '_et_item_a',
      platformInfo: { 'item-key': 'a' },
    });
    registerElementTemplateListItem(73, secondRef, {
      templateKey: '_et_item_b',
      platformInfo: { 'item-key': 'b' },
    });
    const state = createElementTemplateListState([72, 73]);
    registerElementTemplateListState(71, state, false, listRef);
    const attrs = composeElementTemplateListAttributes(null, state);
    const componentAtIndex = attrs['component-at-index'] as ComponentAtIndexCallback;

    expect(componentAtIndex(listRef, 7, 0, 91, false)).toBe(136);
    mockInsertNodeToElementTemplate.mockClear();
    mockFlushElementTree.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.removeTypedListItem,
      71,
      72,
      [],
      ElementTemplateUpdateOps.insertTypedListItem,
      71,
      {
        __etHandleRef: 72,
        type: '_et_item_a',
        platformInfo: { 'item-key': 'a' },
      },
      0,
    ]);
    mockInsertNodeToElementTemplate.mockClear();

    expect(componentAtIndex(listRef, 7, 1, 92, false)).toBe(136);
    expect(mockInsertNodeToElementTemplate.mock.calls).toEqual([[listRef, 0, firstRef, null]]);
  });

  it('treats same-key list item replacement with a new ref as remove and insert', () => {
    envManager.switchToMainThread();
    const listRef = { __isNativeRef: true, id: 'typed-list', __mockNativeId: 125 } as unknown as ElementRef;
    const oldRef = { __isNativeRef: true, id: 'old', __mockNativeId: 126 } as unknown as ElementRef;
    const nextRef = { __isNativeRef: true, id: 'next', __mockNativeId: 127 } as unknown as ElementRef;
    elementTemplateRegistry.set(61, listRef);
    elementTemplateRegistry.set(62, oldRef);
    elementTemplateRegistry.set(63, nextRef);
    registerElementTemplateListItem(62, oldRef, {
      templateKey: '_et_item',
      platformInfo: { 'item-key': 'same' },
    });
    const state = createElementTemplateListState([62]);
    registerElementTemplateListState(61, state, false, listRef);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.removeTypedListItem,
      61,
      62,
      [62],
      ElementTemplateUpdateOps.insertTypedListItem,
      61,
      {
        __etHandleRef: 63,
        type: '_et_item',
        platformInfo: { 'item-key': 'same' },
      },
      0,
    ]);

    expect(mockSetAttributeOfElementTemplate.mock.calls[0]![2]).toEqual(expect.objectContaining({
      'update-list-info': {
        insertAction: [{ position: 0, type: '_et_item', 'item-key': 'same' }],
        removeAction: [0],
        updateAction: [],
      },
    }));
    expect(elementTemplateRegistry.get(62)).toBeUndefined();
  });

  it('keeps destroyed typed list callbacks Snapshot-safe', () => {
    envManager.switchToMainThread();
    const listRef = 120 as unknown as ElementRef;
    const itemRef = 121 as unknown as ElementRef;
    registerElementTemplateListItem(121, itemRef, {
      templateKey: '_et_item',
      platformInfo: { 'item-key': 'a' },
    });
    const state = createElementTemplateListState([121]);
    registerElementTemplateListState(120, state, false, listRef);
    const attrs = composeElementTemplateListAttributes(null, state);
    const componentAtIndex = attrs['component-at-index'] as ComponentAtIndexCallback;
    const componentAtIndexes = attrs['component-at-indexes'] as ComponentAtIndexesCallback;
    const enqueueComponent = attrs['enqueue-component'] as EnqueueComponentCallback;

    markElementTemplateListDestroyed(120);

    expect(componentAtIndex(listRef, 7, 0, 99, false)).toBe(-1);
    componentAtIndexes(listRef, 7, [0], [99], false, true);
    enqueueComponent(listRef, 7, 121);

    expect(mockInsertNodeToElementTemplate.mock.calls).toHaveLength(0);
    expect(mockRemoveNodeFromElementTemplate.mock.calls).toHaveLength(0);
    expect(mockFlushElementTree.mock.calls).toHaveLength(0);
  });

  it('skips typed slot 0 attributes when the target handle is unresolved', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();
    mockSetAttribute.mockClear();
    mockSetAttributeOfElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.setAttribute,
      404,
      0,
      null,
    ]);

    expect(mockSetAttribute.mock.calls).toHaveLength(0);
    expect(mockSetAttributeOfElementTemplate.mock.calls).toHaveLength(0);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('target handle 404 not found');
    resetReportedErrors();
  });

  it('reports missing handle when resolving references', () => {
    const jsx = <view />;
    root.render(jsx);
    envManager.switchToMainThread();
    root.render(jsx);
    renderPage();

    applyElementTemplateUpdateCommands([ElementTemplateUpdateOps.insertNode, -1, 0, 999, 0]);

    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(reportError.mock.calls).toHaveLength(1);
    resetReportedErrors();
  });

  it('reports missing child handle on removeNode', () => {
    envManager.switchToMainThread();
    const targetRef = { __isNativeRef: true, id: 'target' } as unknown as ElementRef;
    const descendantRef = { __isNativeRef: true, id: 'descendant' } as unknown as ElementRef;
    elementTemplateRegistry.set(1, targetRef);
    elementTemplateRegistry.set(12, descendantRef);

    applyElementTemplateUpdateCommands([ElementTemplateUpdateOps.removeNode, 1, 0, 999, [12]]);

    expect(mockRemoveNodeFromElementTemplate.mock.calls).toHaveLength(0);
    expect(elementTemplateRegistry.has(12)).toBe(true);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('child handle 999 not found');
    resetReportedErrors();
  });

  it('reports missing target handle on removeNode without deleting subtree registry entries', () => {
    envManager.switchToMainThread();
    const childRef = { __isNativeRef: true, id: 'child' } as unknown as ElementRef;
    const descendantRef = { __isNativeRef: true, id: 'descendant' } as unknown as ElementRef;
    elementTemplateRegistry.set(11, childRef);
    elementTemplateRegistry.set(12, descendantRef);

    applyElementTemplateUpdateCommands([ElementTemplateUpdateOps.removeNode, 999, 0, 11, [11, 12]]);

    expect(mockRemoveNodeFromElementTemplate.mock.calls).toHaveLength(0);
    expect(elementTemplateRegistry.has(11)).toBe(true);
    expect(elementTemplateRegistry.has(12)).toBe(true);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('target handle 999 not found');
    resetReportedErrors();
  });

  it('removes registry entries for the detached subtree after native remove succeeds', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();

    const targetRef = { __isNativeRef: true, id: 'target' } as unknown as ElementRef;
    const beforeRef = { __isNativeRef: true, id: 'before' } as unknown as ElementRef;
    const childRef = { __isNativeRef: true, id: 'child' } as unknown as ElementRef;
    const descendantRef = { __isNativeRef: true, id: 'descendant' } as unknown as ElementRef;
    elementTemplateRegistry.set(1, targetRef);
    elementTemplateRegistry.set(10, beforeRef);
    elementTemplateRegistry.set(11, childRef);
    elementTemplateRegistry.set(12, descendantRef);

    const stream: ElementTemplateUpdateCommandStream = [
      ElementTemplateUpdateOps.insertNode,
      1,
      0,
      11,
      10,
      ElementTemplateUpdateOps.removeNode,
      1,
      0,
      11,
      [11, 12],
    ];

    applyElementTemplateUpdateCommands(stream);

    expect(mockInsertNodeToElementTemplate.mock.calls[0]?.[0]).toBe(targetRef);
    expect(mockInsertNodeToElementTemplate.mock.calls[0]?.[2]).toBe(childRef);
    expect(mockInsertNodeToElementTemplate.mock.calls[0]?.[3]).toBe(beforeRef);
    expect(mockRemoveNodeFromElementTemplate.mock.calls[0]?.[0]).toBe(targetRef);
    expect(mockRemoveNodeFromElementTemplate.mock.calls[0]?.[2]).toBe(childRef);
    expect(elementTemplateRegistry.has(1)).toBe(true);
    expect(elementTemplateRegistry.has(10)).toBe(true);
    expect(elementTemplateRegistry.has(11)).toBe(false);
    expect(elementTemplateRegistry.has(12)).toBe(false);
  });

  it('marks nested typed list state destroyed when removing a holder subtree', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();

    const targetRef = { __isNativeRef: true, id: 'target' } as unknown as ElementRef;
    const childRef = { __isNativeRef: true, id: 'child' } as unknown as ElementRef;
    const listRef = { __isNativeRef: true, id: 'typed-list', __mockNativeId: 132 } as unknown as ElementRef;
    const itemRef = { __isNativeRef: true, id: 'item', __mockNativeId: 131 } as unknown as ElementRef;
    elementTemplateRegistry.set(70, targetRef);
    elementTemplateRegistry.set(71, childRef);
    elementTemplateRegistry.set(72, listRef);
    elementTemplateRegistry.set(73, itemRef);
    registerElementTemplateListItem(73, itemRef, {
      templateKey: '_et_item',
      platformInfo: { 'item-key': 'a' },
    });
    const state = createElementTemplateListState([73]);
    registerElementTemplateListState(72, state, false, listRef);
    const attrs = composeElementTemplateListAttributes(null, state);
    const componentAtIndex = attrs['component-at-index'] as ComponentAtIndexCallback;
    const componentAtIndexes = attrs['component-at-indexes'] as ComponentAtIndexesCallback;
    const enqueueComponent = attrs['enqueue-component'] as EnqueueComponentCallback;

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.removeNode,
      70,
      0,
      71,
      [71, 72, 73],
    ]);

    expect(mockRemoveNodeFromElementTemplate.mock.calls).toEqual([[targetRef, 0, childRef]]);
    expect(elementTemplateRegistry.has(71)).toBe(false);
    expect(elementTemplateRegistry.has(72)).toBe(false);
    expect(elementTemplateRegistry.has(73)).toBe(false);
    mockRemoveNodeFromElementTemplate.mockClear();

    expect(componentAtIndex(listRef, 7, 0, 99, false)).toBe(-1);
    componentAtIndexes(listRef, 7, [0], [99], false, true);
    enqueueComponent(listRef, 7, 131);

    expect(mockInsertNodeToElementTemplate.mock.calls).toHaveLength(0);
    expect(mockRemoveNodeFromElementTemplate.mock.calls).toHaveLength(0);
    expect(mockFlushElementTree.mock.calls).toHaveLength(0);
  });

  it('creates builtin raw-text template from attributeSlots', () => {
    const jsx = <view />;
    root.render(jsx);
    envManager.switchToMainThread();
    root.render(jsx);
    renderPage();

    applyElementTemplateUpdateCommands(createRawTextOps(1, 'x'));

    expect(serializeToJSX(__page)).toMatchInlineSnapshot(`
      "<page>
        <view />
      </page>"
    `);
  });

  it('creates template with empty slots when payload is null', () => {
    const jsx = <view />;
    root.render(jsx);
    envManager.switchToMainThread();
    root.render(jsx);
    renderPage();

    const templateKey = (__page as unknown as PageWithChildren).children?.[0]?.templateId;
    if (!templateKey) {
      throw new Error('Missing templateId on first page child');
    }
    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTemplate,
      7,
      templateKey,
      null,
      null,
      null,
    ]);

    expect(serializeToJSX(__page)).toMatchInlineSnapshot(`
      "<page>
        <view />
      </page>"
    `);
  });

  it('normalizes undefined attribute slot values to null on create', () => {
    envManager.switchToMainThread();
    const createTemplateMock = globalThis.__CreateElementTemplate as unknown as {
      mockClear: () => void;
      mock: { calls: unknown[][] };
    };
    createTemplateMock.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTemplate,
      8,
      '_et_builtin_raw_text',
      null,
      [undefined, 'x'] as unknown as ElementTemplateUpdateCommandStream[number],
      [],
    ]);

    expect(createTemplateMock.mock.calls[0]?.[2]).toEqual([null, 'x']);
  });

  it('passes bundleUrl from createTemplate patch to native create', () => {
    envManager.switchToMainThread();
    const createTemplateMock = globalThis.__CreateElementTemplate as unknown as {
      mockClear: () => void;
      mock: { calls: unknown[][] };
    };
    createTemplateMock.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTemplate,
      9,
      '_et_builtin_raw_text',
      'dynamic-entry',
      ['x'],
      [],
    ]);

    expect(createTemplateMock.mock.calls[0]?.[1]).toBe('dynamic-entry');
  });

  it('reports unsupported opcodes', () => {
    applyElementTemplateUpdateCommands([999 as unknown as ElementTemplateUpdateCommandStream[number]]);

    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('opcode 999 is not supported');
    resetReportedErrors();
  });

  it('resolves elementSlots defensively for invalid payload members', () => {
    envManager.switchToMainThread();
    registerTemplates([
      {
        templateId: '_et_patch_parent',
        compiledTemplate: {
          kind: 'element',
          type: 'view',
          attributesArray: [],
          children: [{ kind: 'elementSlot', type: 'slot', elementSlotIndex: 0 }],
        },
      },
    ]);

    const childRef = { __isNativeRef: true, id: 'child' } as unknown as ElementRef;
    elementTemplateRegistry.set(11, childRef);
    const createTemplateMock = globalThis.__CreateElementTemplate as unknown as {
      mockClear: () => void;
      mock: { calls: unknown[][] };
    };
    createTemplateMock.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTemplate,
      21,
      '_et_patch_parent',
      null,
      [],
      [[11, 404], 'bad-slot' as unknown as number[]],
    ]);

    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('child handle 404 not found');
    expect(createTemplateMock.mock.calls).toHaveLength(0);
    resetReportedErrors();
  });

  it('still flushes update payloads with empty ops so flushOptions can reach native', () => {
    envManager.switchToMainThread();
    installElementTemplatePatchListener();
    mockSetAttributeOfElementTemplate.mockClear();
    mockInsertNodeToElementTemplate.mockClear();
    mockRemoveNodeFromElementTemplate.mockClear();
    mockFlushElementTree.mockClear();
    lynx.performance._markTiming.mockClear();

    envManager.switchToBackground();
    dispatchElementTemplateUpdate({
      ops: [],
      flushOptions: { triggerDataUpdated: true },
    });
    envManager.switchToMainThread();

    expect(mockSetAttributeOfElementTemplate.mock.calls).toHaveLength(0);
    expect(mockInsertNodeToElementTemplate.mock.calls).toHaveLength(0);
    expect(mockRemoveNodeFromElementTemplate.mock.calls).toHaveLength(0);
    expect(mockFlushElementTree.mock.calls).toHaveLength(1);
    expect(mockFlushElementTree.mock.calls[0]?.[1]).toEqual({ triggerDataUpdated: true });
    expect(lynx.performance._markTiming.mock.calls).toEqual([]);
  });
});
