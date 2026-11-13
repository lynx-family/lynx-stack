// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  installElementTemplateRefInitValueListener,
  resetElementTemplateRefInitValueListener,
} from '../../../../src/element-template/main-thread-ref-init-value.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JsFunctionLifecycleManager } from '../../../../src/worklet-runtime/jsFunctionLifecycle.js';
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
  ElementTemplateHydrateCommitContext,
  ElementTemplateHandleSlotsCommand,
  ElementTemplateUpdateCommandStream,
  ElementTemplateUpdateCommitContext,
  SerializedEtNode,
} from '../../../../src/element-template/protocol/types.js';
import {
  createElementTemplateUpdateEvent,
  parseElementTemplateUpdateEventPayload,
} from '../../../../src/element-template/protocol/update-event.js';
import { __page, setupPage } from '../../../../src/element-template/runtime/page/page.js';
import { __root } from '../../../../src/element-template/runtime/page/root-instance.js';
import { applyElementTemplateUpdateCommands } from '../../../../src/element-template/runtime/patch.js';
import {
  composeElementTemplateListAttributes,
  createElementTemplateListState,
  markElementTemplateListDestroyed,
  registerElementTemplateListState,
  updateElementTemplateListAttributes,
} from '../../../../src/element-template/runtime/list/list.js';
import {
  attachMainThreadDynamicAttrRefsForSubtree,
  applyPendingMainThreadRefAttachments,
  clearMainThreadDynamicAttrState,
  detachMainThreadDynamicAttrRefsForSubtree,
  getMainThreadDynamicAttrState,
  initializeMainThreadDynamicAttrSlots,
} from '../../../../src/element-template/runtime/template/main-thread-dynamic-attr-state.js';
import {
  __etAttrPlanMap,
  adaptMTEventAttrSlot,
  adaptMTRefAttrSlot,
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

type HydrateEvent = { data: ElementTemplateHydrateCommitContext };
type HydrateInstances = SerializedEtNode[];

function createMockElementTemplateHandle(id: string, nativeId?: number): ElementTemplateHandle {
  const handle = { __isNativeRef: true, id, __mockNativeId: nativeId };
  return handle as unknown as ElementTemplateHandle;
}

function createRawTextOps(id: number, text: string) {
  return [
    ElementTemplateUpdateOps.createTemplate,
    id,
    '_et_builtin_raw_text',
    null,
    [text],
    [],
    null,
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
const MT_REF_TEMPLATE = '_et_mt_ref';
const REF_TARGET = { id: 'materialized-ref-node' } as unknown as ElementRef;

function registerMTEventSlotsForTemplate(templateType: string, ...slotIndexes: number[]): void {
  __etAttrPlanMap[templateType] = slotIndexes.flatMap(slotIndex => [
    slotIndex,
    adaptMTEventAttrSlot,
  ]);
}

function registerMTEventSlots(...slotIndexes: number[]): void {
  registerMTEventSlotsForTemplate(MT_EVENT_TEMPLATE, ...slotIndexes);
}

function registerMTRefSlotsForTemplate(templateType: string, ...slotIndexes: number[]): void {
  __etAttrPlanMap[templateType] = slotIndexes.flatMap(slotIndex => [
    slotIndex,
    adaptMTRefAttrSlot,
  ]);
}

function registerMTRefSlots(...slotIndexes: number[]): void {
  registerMTRefSlotsForTemplate(MT_REF_TEMPLATE, ...slotIndexes);
}

function seedMTEventState(
  handleId: number,
  attrSlotIndex: number,
  value: Record<string, unknown>,
): void {
  registerMTEventSlots(attrSlotIndex);
  const attributeSlots: unknown[] = [];
  attributeSlots[attrSlotIndex] = { type: 'worklet', value };
  initializeMainThreadDynamicAttrSlots(handleId, MT_EVENT_TEMPLATE, attributeSlots);
}

function seedMTRefState(
  handleId: number,
  attrSlotIndex: number,
  value: Record<string, unknown>,
  nativeRef: ElementTemplateHandle,
): void {
  registerMTRefSlots(attrSlotIndex);
  const attributeSlots: unknown[] = [];
  attributeSlots[attrSlotIndex] = { type: 'main-thread-ref', value };
  initializeMainThreadDynamicAttrSlots(handleId, MT_REF_TEMPLATE, attributeSlots);
  attachMainThreadDynamicAttrRefsForSubtree([{ uid: handleId, ref: nativeRef }]);
  vi.mocked(__GetElementByAttrSlot).mockReturnValue(REF_TARGET);
  applyPendingMainThreadRefAttachments();
}

function installWorkletRefRuntime(): {
  updateWorkletRef: ReturnType<typeof vi.fn>;
  restore: () => void;
} {
  const previousWorkletImpl = globalThis.lynxWorkletImpl;
  const updateWorkletRef = vi.fn();
  globalThis.lynxWorkletImpl = {
    ...previousWorkletImpl,
    _refImpl: {
      updateWorkletRef,
    },
  };
  return {
    updateWorkletRef,
    restore: () => {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    },
  };
}

function createMainThreadRefImplMock(clearFirstScreenWorkletRefMap = vi.fn()) {
  return { clearFirstScreenWorkletRefMap };
}

describe('ElementTemplate patch stream (apply)', () => {
  const envManager = new ElementTemplateEnvManager();
  let hydrationData: HydrateInstances = [];

  let onHydrate: (event: HydrateEvent) => void;
  let mockCreateElementTemplate: ReportErrorMock;
  let mockCreateTypedElementTemplate: ReportErrorMock;
  let mockSetAttribute: ReportErrorMock;
  let mockSetElementTemplateAttributeSlot: ReportErrorMock;
  let mockInsertElementTemplateNodeIntoSlot: ReportErrorMock;
  let mockRemoveElementTemplateNodeFromSlot: ReportErrorMock;
  let mockFlushElementTree: ReportErrorMock;

  beforeEach(() => {
    vi.clearAllMocks();
    // mocks are already installed by setup.js beforeEach
    mockCreateElementTemplate = lastMock!.mockCreateCompiledElementTemplate as unknown as ReportErrorMock;
    mockCreateTypedElementTemplate = lastMock!.mockCreateTypedElementTemplate as unknown as ReportErrorMock;
    mockSetAttribute = lastMock!.mockSetAttribute as unknown as ReportErrorMock;
    mockSetElementTemplateAttributeSlot = lastMock!.mockSetElementTemplateAttributeSlot as unknown as ReportErrorMock;
    mockInsertElementTemplateNodeIntoSlot = lastMock!
      .mockInsertElementTemplateNodeIntoSlot as unknown as ReportErrorMock;
    mockRemoveElementTemplateNodeFromSlot = lastMock!
      .mockRemoveElementTemplateNodeFromSlot as unknown as ReportErrorMock;
    mockFlushElementTree = lastMock!.mockFlushElementTree as unknown as ReportErrorMock;
    registerBuiltinRawTextTemplate();
    clearMainThreadDynamicAttrState();
    clearEtAttrPlanMap();

    hydrationData = [];
    envManager.resetEnv('background');
    envManager.setUseElementTemplate(true);

    onHydrate = vi.fn().mockImplementation((event: HydrateEvent) => {
      hydrationData.push(...(event.data.page.childSlots?.[0] ?? []));
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
      before.uid,
      9999,
      before.uid,
      9999,
      [],
    ]);

    expect(serializeToJSX(__page)).toBe(beforeJSX);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
      'reference handle 9999 not found',
    );
    resetReportedErrors();
  });

  it('resolves page target id 0 and uses the generic attr and root patch paths', () => {
    envManager.switchToMainThread();
    const pageRef = createMockElementTemplateHandle('page');
    const childRef = createMockElementTemplateHandle('root');
    setupPage(pageRef);
    elementTemplateRegistry.set(10, childRef);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.setAttribute,
      0,
      0,
      { id: 'background' },
      ElementTemplateUpdateOps.insertNode,
      0,
      0,
      10,
      0,
      [10],
      ElementTemplateUpdateOps.removeNode,
      0,
      0,
      10,
      [10],
    ]);

    expect(mockSetElementTemplateAttributeSlot.mock.calls).toEqual([[pageRef, 0, { id: 'background' }]]);
    expect(mockInsertElementTemplateNodeIntoSlot.mock.calls).toEqual([[pageRef, 0, childRef, null]]);
    expect(mockRemoveElementTemplateNodeFromSlot.mock.calls).toEqual([[pageRef, 0, childRef]]);
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
    mockSetElementTemplateAttributeSlot.mockClear();
    mockFlushElementTree.mockClear();

    envManager.switchToBackground();
    dispatchElementTemplateUpdate({ ops: stream, flushOptions: {} });
    envManager.switchToMainThread();

    expect(mockSetElementTemplateAttributeSlot.mock.calls.length).toBeGreaterThan(0);
    expect(mockFlushElementTree.mock.calls.length).toBeGreaterThan(0);
  });

  it.each([false, true])('tracks setter input before Native and commits only on success (throws=%s)', (throws) => {
    const previous = globalThis.lynxWorkletImpl;
    const manager = new JsFunctionLifecycleManager();
    const hydrate = vi.fn();
    globalThis.lynxWorkletImpl = { ...previous, _jsFunctionLifecycleManager: manager, _hydrateCtx: hydrate };
    const oldCtx = { _wkltId: 'tap', _execId: 30 };
    const nextCtx = { _wkltId: 'tap', _execId: 31 };
    elementTemplateRegistry.set(101, {} as ElementTemplateHandle);
    seedMTEventState(101, 0, oldCtx);
    const retain = vi.spyOn(manager, 'addRef');
    const error = new Error('setter failed');
    mockSetElementTemplateAttributeSlot.mockImplementationOnce((_native, _slot, value) => {
      expect(value.value).toBe(nextCtx);
      expect(retain).toHaveBeenCalledExactlyOnceWith(31, nextCtx);
      expect(getMainThreadDynamicAttrState(101, 0)?.nativeHeldValue).toBe(oldCtx);
      if (throws) throw error;
    });
    try {
      const apply = () =>
        applyElementTemplateUpdateCommands([
          ElementTemplateUpdateOps.setMainThreadEvent,
          101,
          0,
          { type: 'worklet', value: nextCtx },
        ], true);
      if (throws) expect(apply).toThrow(error);
      else apply();
      expect(getMainThreadDynamicAttrState(101, 0)?.nativeHeldValue).toBe(throws ? oldCtx : nextCtx);
      expect(retain).toHaveBeenCalledExactlyOnceWith(31, nextCtx);
      if (throws) expect(hydrate).not.toHaveBeenCalled();
      else expect(hydrate).toHaveBeenCalledExactlyOnceWith(nextCtx, oldCtx);
    } finally {
      manager.dispose();
      globalThis.lynxWorkletImpl = previous;
    }
  });

  it('records MTEvent state after setMainThreadEvent PAPI succeeds', () => {
    const targetId = 101;
    const nativeRef = {};
    const ctx = { _wkltId: 'tap' };
    elementTemplateRegistry.set(targetId, nativeRef as ElementTemplateHandle);

    envManager.switchToMainThread();
    installElementTemplatePatchListener();
    mockSetElementTemplateAttributeSlot.mockClear();
    mockFlushElementTree.mockClear();

    envManager.switchToBackground();
    dispatchElementTemplateUpdate({
      ops: [ElementTemplateUpdateOps.setMainThreadEvent, targetId, 0, { type: 'worklet', value: ctx }],
      flushOptions: {},
    });
    envManager.switchToMainThread();

    expect(mockSetElementTemplateAttributeSlot).toHaveBeenCalledTimes(1);
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
      _refImpl: createMainThreadRefImplMock(),
    };
    elementTemplateRegistry.set(targetId, {} as ElementTemplateHandle);

    try {
      envManager.switchToMainThread();
      installElementTemplatePatchListener();
      mockSetElementTemplateAttributeSlot.mockClear();

      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [ElementTemplateUpdateOps.setAttribute, targetId, 0, { type: 'worklet', value: ctx }],
        flushOptions: {},
        isHydration: true,
      });
      envManager.switchToMainThread();

      expect(mockSetElementTemplateAttributeSlot).toHaveBeenCalledTimes(1);
      expect(hydrateCtx).not.toHaveBeenCalled();
      expect(getMainThreadDynamicAttrState(targetId, 0)).toBeUndefined();
    } finally {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('passes wrapper-shaped ordinary attribute values through without MTRef attr-plan eligibility', () => {
    const targetId = 125;
    const nativeRef = {};
    const ordinaryValue = { type: 'main-thread-ref', value: { _wvid: 12 } };
    elementTemplateRegistry.set(targetId, nativeRef as ElementTemplateHandle);

    envManager.switchToMainThread();
    installElementTemplatePatchListener();
    mockSetElementTemplateAttributeSlot.mockClear();

    envManager.switchToBackground();
    dispatchElementTemplateUpdate({
      ops: [ElementTemplateUpdateOps.setAttribute, targetId, 0, ordinaryValue],
      flushOptions: {},
    });
    envManager.switchToMainThread();

    expect(mockSetElementTemplateAttributeSlot).toHaveBeenCalledWith(nativeRef, 0, ordinaryValue);
    expect(getMainThreadDynamicAttrState(targetId, 0)).toBeUndefined();
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
        null,
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
        null,
      ],
      flushOptions: {},
    });
    envManager.switchToMainThread();

    expect(getMainThreadDynamicAttrState(handleId, 0)).toEqual({
      kind: 'mt-event',
      nativeHeldValue: ctx,
    });
  });

  it('initializes object MTRef detached after createTemplate and strips the native slot payload', () => {
    const handleId = 121;
    const ref = { _wvid: 7 };
    const { updateWorkletRef, restore } = installWorkletRefRuntime();
    __etAttrPlanMap['__Card__:view'] = [0, adaptMTRefAttrSlot];
    registerTemplates([{
      templateId: 'view',
      compiledTemplate: {
        kind: 'element',
        type: 'view',
        attributesArray: [{
          kind: 'slot',
          key: 'main-thread:ref',
          attrSlotIndex: 0,
        }],
        children: [],
      },
    }]);

    try {
      envManager.switchToMainThread();
      installElementTemplatePatchListener();

      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [
          ElementTemplateUpdateOps.createTemplate,
          handleId,
          'view',
          null,
          [{ type: 'main-thread-ref', value: ref }],
          [],
          null,
        ],
        flushOptions: {},
      });
      envManager.switchToMainThread();

      const nativeRef = elementTemplateRegistry.get(handleId);
      expect(nativeRef).toBeDefined();
      expect(mockCreateElementTemplate.mock.calls.at(-1)?.[2]).toEqual([null]);
      expect(updateWorkletRef).not.toHaveBeenCalled();
      expect(getMainThreadDynamicAttrState(handleId, 0)).toEqual({
        kind: 'mt-ref',
        value: ref,
      });
    } finally {
      restore();
    }
  });

  it('attaches an object MTRef only after insertNode PAPI succeeds', () => {
    const handleId = 125;
    const parentId = 126;
    const ref = { _wvid: 70 };
    const { updateWorkletRef, restore } = installWorkletRefRuntime();
    const parentRef = {} as ElementTemplateHandle;
    elementTemplateRegistry.set(parentId, parentRef);
    __etAttrPlanMap['__Card__:view'] = [0, adaptMTRefAttrSlot];
    registerTemplates([{
      templateId: 'view',
      compiledTemplate: {
        kind: 'element',
        type: 'view',
        attributesArray: [{
          kind: 'slot',
          key: 'main-thread:ref',
          attrSlotIndex: 0,
        }],
        children: [],
      },
    }]);

    try {
      envManager.switchToMainThread();

      applyElementTemplateUpdateCommands([
        ElementTemplateUpdateOps.createTemplate,
        handleId,
        'view',
        null,
        [{ type: 'main-thread-ref', value: ref }],
        [],
        null,
      ]);

      const nativeRef = elementTemplateRegistry.get(handleId);
      expect(nativeRef).toBeDefined();
      expect(mockCreateElementTemplate.mock.calls.at(-1)?.[2]).toEqual([null]);
      expect(updateWorkletRef).not.toHaveBeenCalled();
      expect(getMainThreadDynamicAttrState(handleId, 0)).toEqual({
        kind: 'mt-ref',
        value: ref,
      });

      applyElementTemplateUpdateCommands([
        ElementTemplateUpdateOps.insertNode,
        parentId,
        0,
        handleId,
        0,
        [handleId],
      ]);

      expect(mockInsertElementTemplateNodeIntoSlot).toHaveBeenCalledWith(parentRef, 0, nativeRef, null);
      expect(updateWorkletRef).not.toHaveBeenCalled();
      applyPendingMainThreadRefAttachments();
      const target = vi.mocked(__GetElementByAttrSlot).mock.results.at(-1)!.value;
      expect(target).not.toBe(nativeRef);
      expect(updateWorkletRef).toHaveBeenCalledWith(ref, target);
      expect(getMainThreadDynamicAttrState(handleId, 0)).toEqual({
        kind: 'mt-ref',
        value: ref,
      });
    } finally {
      restore();
    }
  });

  it('keeps an object MTRef blocked when insertNode PAPI throws', () => {
    const handleId = 127;
    const parentId = 128;
    const ref = { _wvid: 71 };
    const { updateWorkletRef, restore } = installWorkletRefRuntime();
    elementTemplateRegistry.set(parentId, {} as ElementTemplateHandle);
    __etAttrPlanMap['__Card__:view'] = [0, adaptMTRefAttrSlot];
    registerTemplates([{
      templateId: 'view',
      compiledTemplate: {
        kind: 'element',
        type: 'view',
        attributesArray: [{ kind: 'slot', key: 'main-thread:ref', attrSlotIndex: 0 }],
        children: [],
      },
    }]);

    try {
      envManager.switchToMainThread();
      applyElementTemplateUpdateCommands([
        ElementTemplateUpdateOps.createTemplate,
        handleId,
        'view',
        null,
        [{ type: 'main-thread-ref', value: ref }],
        [],
        null,
      ]);
      mockInsertElementTemplateNodeIntoSlot.mockImplementationOnce(() => {
        throw new Error('insert failed');
      });

      expect(() =>
        applyElementTemplateUpdateCommands([
          ElementTemplateUpdateOps.insertNode,
          parentId,
          0,
          handleId,
          0,
          [handleId],
        ])
      ).toThrow('insert failed');

      expect(updateWorkletRef).not.toHaveBeenCalled();
      expect(getMainThreadDynamicAttrState(handleId, 0)).toEqual({
        kind: 'mt-ref',
        value: ref,
      });
    } finally {
      restore();
    }
  });

  it('deletes MTEvent state after a slot clear patch succeeds', () => {
    const targetId = 103;
    const nativeRef = {};
    elementTemplateRegistry.set(targetId, nativeRef as ElementTemplateHandle);
    seedMTEventState(targetId, 0, { _wkltId: 'old' });

    envManager.switchToMainThread();
    installElementTemplatePatchListener();

    envManager.switchToBackground();
    dispatchElementTemplateUpdate({
      ops: [ElementTemplateUpdateOps.setMainThreadEvent, targetId, 0, null],
      flushOptions: {},
    });
    envManager.switchToMainThread();

    expect(getMainThreadDynamicAttrState(targetId, 0)).toBeUndefined();
  });

  it('cleans object MTRef without forwarding the value to native', () => {
    const targetId = 122;
    const nativeRef = {};
    const ref = { _wvid: 8 };
    const { updateWorkletRef, restore } = installWorkletRefRuntime();
    elementTemplateRegistry.set(targetId, nativeRef as ElementTemplateHandle);
    seedMTRefState(targetId, 0, ref, nativeRef as ElementTemplateHandle);

    try {
      envManager.switchToMainThread();
      installElementTemplatePatchListener();

      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [ElementTemplateUpdateOps.setMainThreadRef, targetId, 0, null],
        flushOptions: {},
      });
      envManager.switchToMainThread();

      expect(mockSetElementTemplateAttributeSlot).not.toHaveBeenCalled();
      expect(updateWorkletRef).toHaveBeenCalledWith(ref, null);
      expect(getMainThreadDynamicAttrState(targetId, 0)).toBeUndefined();
    } finally {
      restore();
    }
  });

  it('applies an empty MTRef hydration clear without forwarding it to native', () => {
    const targetId = 131;
    elementTemplateRegistry.set(targetId, {} as ElementTemplateHandle);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.setMainThreadRef,
      targetId,
      0,
      null,
    ], true);

    expect(mockSetElementTemplateAttributeSlot).not.toHaveBeenCalled();
    expect(getMainThreadDynamicAttrState(targetId, 0)).toBeUndefined();
  });

  it('cleans and remounts callback MTRef without forwarding the value to native', () => {
    const targetId = 123;
    const nativeRef = {};
    const oldCleanup = vi.fn();
    const nextCleanup = vi.fn();
    const oldCallback = { _wkltId: 'old-ref-callback' };
    const nextCallback = { _wkltId: 'next-ref-callback' };
    const previousRunWorklet = globalThis.runWorklet;
    elementTemplateRegistry.set(targetId, nativeRef as ElementTemplateHandle);
    globalThis.runWorklet = vi.fn(() => oldCleanup);
    seedMTRefState(targetId, 0, oldCallback, nativeRef as ElementTemplateHandle);
    globalThis.runWorklet = vi.fn(() => nextCleanup);
    const runWorklet = globalThis.runWorklet as ReturnType<typeof vi.fn>;

    try {
      envManager.switchToMainThread();
      installElementTemplatePatchListener();

      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [
          ElementTemplateUpdateOps.setMainThreadRef,
          targetId,
          0,
          { type: 'main-thread-ref', value: nextCallback },
        ],
        flushOptions: {},
      });
      envManager.switchToMainThread();

      expect(mockSetElementTemplateAttributeSlot).not.toHaveBeenCalled();
      expect(oldCleanup).toHaveBeenCalledTimes(1);
      const mountedCallback = runWorklet.mock.calls[0]?.[0] as typeof nextCallback;
      expect(mountedCallback).toEqual(expect.objectContaining({
        _wkltId: 'next-ref-callback',
      }));
      expect(runWorklet.mock.calls[0]?.[1]).toEqual([{ elementRefptr: REF_TARGET }]);
      expect(mountedCallback).toHaveProperty('_unmount', nextCleanup);
      expect(nextCallback).not.toHaveProperty('_unmount');
      expect(getMainThreadDynamicAttrState(targetId, 0)).toEqual({
        kind: 'mt-ref',
        value: mountedCallback,
      });
      applyElementTemplateUpdateCommands([ElementTemplateUpdateOps.setMainThreadRef, targetId, 0, null]);
      expect(nextCleanup).toHaveBeenCalledOnce();
    } finally {
      globalThis.runWorklet = previousRunWorklet;
    }
  });

  it('hydrates callback MTRef ctx without legacy delayed event replay', () => {
    const targetId = 129;
    const nativeRef = {} as ElementTemplateHandle;
    const oldCleanup = vi.fn();
    const nextCleanup = vi.fn();
    const oldCallback = { _wkltId: 'ref-callback', version: 1 };
    const nextCallback = { _wkltId: 'ref-callback', version: 2 };
    const hydrateCtx = vi.fn();
    const runDelayedWorklet = vi.fn();
    const previousRunWorklet = globalThis.runWorklet;
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    elementTemplateRegistry.set(targetId, nativeRef);
    globalThis.runWorklet = vi.fn(() => oldCleanup);
    seedMTRefState(targetId, 0, oldCallback, nativeRef);
    globalThis.runWorklet = vi.fn(() => nextCleanup);
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _hydrateCtx: hydrateCtx,
      _eventDelayImpl: { runDelayedWorklet },
    };

    try {
      applyElementTemplateUpdateCommands([
        ElementTemplateUpdateOps.setMainThreadRef,
        targetId,
        0,
        { type: 'main-thread-ref', value: nextCallback },
      ], true);

      applyPendingMainThreadRefAttachments();
      expect(hydrateCtx).toHaveBeenCalledWith(nextCallback, oldCallback);
      expect(runDelayedWorklet).not.toHaveBeenCalled();
      expect(oldCleanup).toHaveBeenCalledTimes(1);
      expect(globalThis.runWorklet).toHaveBeenCalledWith(nextCallback, [{ elementRefptr: REF_TARGET }]);
    } finally {
      globalThis.runWorklet = previousRunWorklet;
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('hydrates callback MTRef ctx while a list item is detached without remounting it', () => {
    const targetId = 130;
    const nativeRef = {} as ElementTemplateHandle;
    const oldCallback = { _wkltId: 'ref-callback', version: 1 };
    const nextCallback = { _wkltId: 'ref-callback', version: 2 };
    const hydrateCtx = vi.fn();
    const oldCleanup = vi.fn();
    const previousRunWorklet = globalThis.runWorklet;
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    elementTemplateRegistry.set(targetId, nativeRef);
    globalThis.runWorklet = vi.fn(() => oldCleanup);
    seedMTRefState(targetId, 0, oldCallback, nativeRef);
    detachMainThreadDynamicAttrRefsForSubtree([{ uid: targetId, ref: nativeRef }]);
    globalThis.runWorklet = vi.fn();
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _hydrateCtx: hydrateCtx,
    };

    try {
      applyElementTemplateUpdateCommands([
        ElementTemplateUpdateOps.setMainThreadRef,
        targetId,
        0,
        { type: 'main-thread-ref', value: nextCallback },
      ], true);

      applyPendingMainThreadRefAttachments();
      expect(hydrateCtx).toHaveBeenCalledWith(nextCallback, oldCallback);
      expect(globalThis.runWorklet).not.toHaveBeenCalled();
      expect(getMainThreadDynamicAttrState(targetId, 0)).toEqual({
        kind: 'mt-ref',
        value: nextCallback,
      });
    } finally {
      globalThis.runWorklet = previousRunWorklet;
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('does not send a Gesture update to Native when the target is missing', () => {
    envManager.switchToMainThread();
    installElementTemplatePatchListener();
    envManager.switchToBackground();
    dispatchElementTemplateUpdate({
      ops: [ElementTemplateUpdateOps.setGesture, 124, 0, null],
      flushOptions: {},
    });
    envManager.switchToMainThread();
    expect(mockSetElementTemplateAttributeSlot).not.toHaveBeenCalled();
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('target handle 124 not found');
    resetReportedErrors();
  });

  it('does not update MTRef state when the target is missing', () => {
    const targetId = 124;
    const ref = { _wvid: 9 };
    const { updateWorkletRef, restore } = installWorkletRefRuntime();

    try {
      envManager.switchToMainThread();
      installElementTemplatePatchListener();

      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [
          ElementTemplateUpdateOps.setMainThreadRef,
          targetId,
          0,
          { type: 'main-thread-ref', value: ref },
        ],
        flushOptions: {},
      });
      envManager.switchToMainThread();

      expect(mockSetElementTemplateAttributeSlot).not.toHaveBeenCalled();
      expect(updateWorkletRef).not.toHaveBeenCalled();
      expect(getMainThreadDynamicAttrState(targetId, 0)).toBeUndefined();
      resetReportedErrors();
    } finally {
      restore();
    }
  });

  it('deletes main-thread dynamic attr state for a removed subtree after patch succeeds', () => {
    const targetId = 104;
    const childId = 105;
    elementTemplateRegistry.set(targetId, {} as ElementTemplateHandle);
    elementTemplateRegistry.set(childId, {} as ElementTemplateHandle);
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

  it('cleans object MTRef for a removed subtree after patch succeeds', () => {
    const targetId = 126;
    const childId = 127;
    const targetRef = {};
    const childRef = {};
    const ref = { _wvid: 10 };
    const { updateWorkletRef, restore } = installWorkletRefRuntime();
    elementTemplateRegistry.set(targetId, targetRef as ElementTemplateHandle);
    elementTemplateRegistry.set(childId, childRef as ElementTemplateHandle);
    seedMTRefState(childId, 0, ref, childRef as ElementTemplateHandle);

    try {
      envManager.switchToMainThread();
      installElementTemplatePatchListener();

      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [ElementTemplateUpdateOps.removeNode, targetId, 0, childId, [childId]],
        flushOptions: {},
      });
      envManager.switchToMainThread();

      expect(mockRemoveElementTemplateNodeFromSlot).toHaveBeenCalledWith(targetRef, 0, childRef);
      expect(updateWorkletRef).toHaveBeenCalledWith(ref, null);
      expect(getMainThreadDynamicAttrState(childId, 0)).toBeUndefined();
    } finally {
      restore();
    }
  });

  it('hydrates MTEvent ctx after setMainThreadEvent PAPI succeeds', () => {
    const targetId = 109;
    const oldCtx = { _wkltId: 'tap', count: 1 };
    const nextCtx = { _wkltId: 'tap', count: 2 };
    const hydrateCtx = vi.fn();
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _hydrateCtx: hydrateCtx,
      _refImpl: createMainThreadRefImplMock(),
    };
    elementTemplateRegistry.set(targetId, {} as ElementTemplateHandle);
    seedMTEventState(targetId, 0, oldCtx);

    try {
      envManager.switchToMainThread();
      installElementTemplatePatchListener();

      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [ElementTemplateUpdateOps.setMainThreadEvent, targetId, 0, { type: 'worklet', value: nextCtx }],
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
    const clearFirstScreenWorkletRefMap = vi.fn(() => {
      callOrder.push('clearFirstScreenRefs');
    });
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _hydrateCtx: hydrateCtx,
      _refImpl: createMainThreadRefImplMock(clearFirstScreenWorkletRefMap),
      _runOnBackgroundDelayImpl: {
        runDelayedBackgroundFunctions,
      },
    };
    elementTemplateRegistry.set(targetId, {} as ElementTemplateHandle);
    seedMTEventState(targetId, 0, oldCtx);

    try {
      envManager.switchToMainThread();
      installElementTemplatePatchListener();
      mockFlushElementTree.mockImplementationOnce(() => {
        callOrder.push('flushElementTree');
      });

      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [ElementTemplateUpdateOps.setMainThreadEvent, targetId, 0, { type: 'worklet', value: nextCtx }],
        flushOptions: {},
        isHydration: true,
      });
      envManager.switchToMainThread();

      expect(hydrateCtx).toHaveBeenCalledWith(nextCtx, oldCtx);
      expect(runDelayedBackgroundFunctions).toHaveBeenCalledTimes(1);
      expect(callOrder).toEqual([
        'hydrate',
        'runOnBackground',
        'clearFirstScreenRefs',
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
    const clearFirstScreenWorkletRefMap = vi.fn(() => {
      callOrder.push('clearFirstScreenRefs');
    });
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _hydrateCtx: hydrateCtx,
      _refImpl: createMainThreadRefImplMock(clearFirstScreenWorkletRefMap),
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
    elementTemplateRegistry.set(targetId, {} as ElementTemplateHandle);
    seedMTEventState(targetId, 0, oldCtx);

    try {
      envManager.switchToMainThread();
      installElementTemplatePatchListener();
      mockFlushElementTree.mockImplementationOnce(() => {
        callOrder.push('flushElementTree');
      });

      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [ElementTemplateUpdateOps.setMainThreadEvent, targetId, 0, { type: 'worklet', value: nextCtx }],
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
        'clearFirstScreenRefs',
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
    const clearFirstScreenWorkletRefMap = vi.fn(() => {
      callOrder.push('clearFirstScreenRefs');
    });
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _refImpl: createMainThreadRefImplMock(clearFirstScreenWorkletRefMap),
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
        'clearFirstScreenRefs',
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
    elementTemplateRegistry.set(targetId, {} as ElementTemplateHandle);
    seedMTEventState(targetId, 0, oldCtx);

    try {
      envManager.switchToMainThread();
      installElementTemplatePatchListener();

      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [ElementTemplateUpdateOps.setMainThreadEvent, targetId, 0, { type: 'worklet', value: nextCtx }],
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

  it('keeps MTEvent state when update flush throws after its PAPI succeeds', () => {
    const targetId = 102;
    const nativeRef = {};
    const ctx = { _wkltId: 'tap' };
    elementTemplateRegistry.set(targetId, nativeRef as ElementTemplateHandle);

    envManager.switchToMainThread();
    installElementTemplatePatchListener();
    mockFlushElementTree.mockImplementationOnce(() => {
      throw new Error('flush failed');
    });

    expect(() => {
      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [ElementTemplateUpdateOps.setMainThreadEvent, targetId, 0, { type: 'worklet', value: ctx }],
        flushOptions: {},
      });
      envManager.switchToMainThread();
    }).toThrow('flush failed');

    expect(getMainThreadDynamicAttrState(targetId, 0)).toEqual({
      kind: 'mt-event',
      nativeHeldValue: ctx,
    });
  });

  it('hydrates MTEvent ctx when its PAPI succeeds even if flush throws', () => {
    const targetId = 111;
    const oldCtx = { _wkltId: 'tap', count: 1 };
    const nextCtx = { _wkltId: 'tap', count: 2 };
    const hydrateCtx = vi.fn();
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _hydrateCtx: hydrateCtx,
      _refImpl: createMainThreadRefImplMock(),
    };
    elementTemplateRegistry.set(targetId, {} as ElementTemplateHandle);
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
          ops: [ElementTemplateUpdateOps.setMainThreadEvent, targetId, 0, { type: 'worklet', value: nextCtx }],
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
    elementTemplateRegistry.set(targetId, {} as ElementTemplateHandle);
    seedMTEventState(targetId, 0, oldCtx);

    try {
      increaseReloadVersion();
      envManager.switchToMainThread();
      installElementTemplatePatchListener();

      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [ElementTemplateUpdateOps.setMainThreadEvent, targetId, 0, { type: 'worklet', value: nextCtx }],
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
      _refImpl: createMainThreadRefImplMock(),
      _runOnBackgroundDelayImpl: {
        runDelayedBackgroundFunctions,
      },
      _eomImpl: {
        setShouldFlush,
      },
      _runRunOnMainThreadTask: runRunOnMainThreadTask,
    };
    elementTemplateRegistry.set(targetId, nativeRef as ElementTemplateHandle);

    try {
      envManager.switchToMainThread();
      installElementTemplatePatchListener();
      mockSetElementTemplateAttributeSlot.mockImplementationOnce(() => {
        throw new Error('setAttribute failed');
      });

      expect(() => {
        envManager.switchToBackground();
        dispatchElementTemplateUpdate({
          ops: [ElementTemplateUpdateOps.setMainThreadEvent, targetId, 0, { type: 'worklet', value: ctx }],
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
      expect(globalThis.lynxWorkletImpl._refImpl.clearFirstScreenWorkletRefMap).toHaveBeenCalledTimes(1);
      expect(setShouldFlush).not.toHaveBeenCalled();
      expect(runRunOnMainThreadTask).not.toHaveBeenCalled();
      expect(getMainThreadDynamicAttrState(targetId, 0)).toBeUndefined();
    } finally {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('cleans hydration handoff and propagates a ref callback error without running later work', () => {
    const handle = { id: 'throwing-ref-template' } as unknown as ElementTemplateHandle;
    const target = { id: 'inner-node' } as unknown as ElementRef;
    const callback = { _wkltId: 'throwing-ref' };
    const callbackError = new Error('ref callback failed');
    const runDelayedBackgroundFunctions = vi.fn();
    const clearFirstScreenWorkletRefMap = vi.fn();
    const runRunOnMainThreadTask = vi.fn();
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    const previousRunWorklet = globalThis.runWorklet;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _refImpl: { ...createMainThreadRefImplMock(), clearFirstScreenWorkletRefMap },
      _runOnBackgroundDelayImpl: { runDelayedBackgroundFunctions },
      _runRunOnMainThreadTask: runRunOnMainThreadTask,
    };
    globalThis.runWorklet = vi.fn(() => {
      throw callbackError;
    });
    try {
      registerMTRefSlots(0);
      initializeMainThreadDynamicAttrSlots(193, MT_REF_TEMPLATE, [{ type: 'main-thread-ref', value: callback }]);
      attachMainThreadDynamicAttrRefsForSubtree([{ uid: 193, ref: handle }]);
      vi.mocked(__GetElementByAttrSlot).mockReturnValue(target);
      envManager.switchToMainThread();
      installElementTemplatePatchListener();
      mockFlushElementTree.mockClear();
      expect(() => {
        envManager.switchToBackground();
        dispatchElementTemplateUpdate({
          ops: [],
          isHydration: true,
          flushOptions: {},
          delayedRunOnMainThreadData: [{ worklet: { _wkltId: 'should-not-run' }, params: [], resolveId: 33 }],
        });
        envManager.switchToMainThread();
      }).toThrow(callbackError);
      expect(globalThis.runWorklet).toHaveBeenCalledWith(callback, [{ elementRefptr: target }]);
      expect(runDelayedBackgroundFunctions).toHaveBeenCalledTimes(1);
      expect(clearFirstScreenWorkletRefMap).toHaveBeenCalledTimes(1);
      expect(runRunOnMainThreadTask).not.toHaveBeenCalled();
      expect(mockFlushElementTree).not.toHaveBeenCalled();
    } finally {
      globalThis.runWorklet = previousRunWorklet;
      clearMainThreadDynamicAttrState();
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
      _refImpl: createMainThreadRefImplMock(),
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

  it('delivers pending targets before hydration handoff and delayed tasks, then flushes their writes', () => {
    const callOrder: string[] = [];
    const handle = { id: 'pending-template' } as unknown as ElementTemplateHandle;
    const target = { id: 'inner-node' } as unknown as ElementRef;
    const ref = { _wvid: 91 };
    const worklet = { _wkltId: 'uses-hydrated-ref' };
    const updateWorkletRef = vi.fn(() => callOrder.push('attach'));
    const clearFirstScreenWorkletRefMap = vi.fn(() => callOrder.push('clear-first-screen'));
    const runDelayedBackgroundFunctions = vi.fn(() => callOrder.push('background-handoff'));
    const runRunOnMainThreadTask = vi.fn(() => {
      expect(updateWorkletRef).toHaveBeenCalledWith(ref, target);
      callOrder.push('task');
    });
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _refImpl: { updateWorkletRef, clearFirstScreenWorkletRefMap },
      _runOnBackgroundDelayImpl: { runDelayedBackgroundFunctions },
      _eomImpl: { setShouldFlush: vi.fn() },
      _runRunOnMainThreadTask: runRunOnMainThreadTask,
    };
    try {
      registerMTRefSlots(0);
      initializeMainThreadDynamicAttrSlots(191, MT_REF_TEMPLATE, [{ type: 'main-thread-ref', value: ref }]);
      attachMainThreadDynamicAttrRefsForSubtree([{ uid: 191, ref: handle }]);
      vi.mocked(__GetElementByAttrSlot).mockReturnValue(target);
      mockFlushElementTree.mockImplementationOnce(() => callOrder.push('initial-flush'));
      envManager.switchToMainThread();
      installElementTemplatePatchListener();
      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [],
        isHydration: true,
        flushOptions: { emptyPatch: true },
        delayedRunOnMainThreadData: [{ worklet, params: [], resolveId: 31 }],
      });
      envManager.switchToMainThread();
      expect(callOrder).toEqual(['attach', 'background-handoff', 'clear-first-screen', 'task', 'initial-flush']);
      expect(runRunOnMainThreadTask).toHaveBeenCalledWith(worklet, [], 31);
      expect(mockFlushElementTree).toHaveBeenCalledOnce();
      expect(mockFlushElementTree.mock.calls[0]![1]).toEqual({ emptyPatch: true });
    } finally {
      clearMainThreadDynamicAttrState();
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('delivers refs synchronously before a later delayed-task payload', () => {
    const handleId = 192;
    const handle = { id: 'pending-template' } as unknown as ElementTemplateHandle;
    const target = { id: 'inner-node' } as unknown as ElementRef;
    const ref = { _wvid: 92 };
    const worklet = { _wkltId: 'later-payload-uses-ref' };
    const updateWorkletRef = vi.fn();
    const runRunOnMainThreadTask = vi.fn(() => expect(updateWorkletRef).toHaveBeenCalledWith(ref, target));
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _refImpl: { updateWorkletRef },
      _eomImpl: { setShouldFlush: vi.fn() },
      _runRunOnMainThreadTask: runRunOnMainThreadTask,
    };
    try {
      elementTemplateRegistry.set(handleId, handle);
      registerMTRefSlots(0);
      attachMainThreadDynamicAttrRefsForSubtree([{ uid: handleId, ref: handle }]);
      vi.mocked(__GetElementByAttrSlot).mockReturnValue(target);
      envManager.switchToMainThread();
      installElementTemplatePatchListener();
      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [ElementTemplateUpdateOps.setMainThreadRef, handleId, 0, { type: 'main-thread-ref', value: ref }],
        flushOptions: {},
      });
      envManager.switchToMainThread();
      expect(updateWorkletRef).toHaveBeenCalledWith(ref, target);
      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [],
        flushOptions: { emptyPatch: true },
        delayedRunOnMainThreadData: [{ worklet, params: [], resolveId: 32 }],
      });
      envManager.switchToMainThread();
      expect(runRunOnMainThreadTask).toHaveBeenCalledWith(worklet, [], 32);
      expect(__GetElementByAttrSlot).toHaveBeenCalledOnce();
      expect(updateWorkletRef).toHaveBeenCalledOnce();
      expect(mockFlushElementTree.mock.calls).toEqual([[undefined, {}], [undefined, { emptyPatch: true }]]);
    } finally {
      clearMainThreadDynamicAttrState();
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('applies independent ref initialization before delayed main-thread tasks', () => {
    const callOrder: string[] = [];
    const updateWorkletRefInitValueChanges = vi.fn(() => {
      callOrder.push('init-patch');
    });
    const runRunOnMainThreadTask = vi.fn(() => {
      callOrder.push('runOnMainThread');
    });
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _refImpl: {
        updateWorkletRefInitValueChanges,
      },
      _eomImpl: {
        setShouldFlush: vi.fn(),
      },
      _runRunOnMainThreadTask: runRunOnMainThreadTask,
    };

    try {
      envManager.switchToMainThread();
      installElementTemplateRefInitValueListener();
      installElementTemplatePatchListener();
      mockFlushElementTree.mockImplementationOnce(() => {
        callOrder.push('flushElementTree');
      });

      envManager.switchToBackground();
      lynx.getCoreContext().dispatchEvent({
        type: ElementTemplateLifecycleConstant.updateMTRefInitValue,
        data: JSON.stringify([[1, 'same-payload-init']]),
      });
      dispatchElementTemplateUpdate({
        ops: [],
        flushOptions: {},
        delayedRunOnMainThreadData: [
          {
            worklet: { _wkltId: 'same-payload-main-thread-function' },
            params: [],
            resolveId: 10,
          },
        ],
      });
      envManager.switchToMainThread();

      expect(updateWorkletRefInitValueChanges).toHaveBeenCalledWith([[1, 'same-payload-init']]);
      expect(runRunOnMainThreadTask).toHaveBeenCalledTimes(1);
      expect(callOrder).toEqual([
        'init-patch',
        'runOnMainThread',
        'flushElementTree',
      ]);
    } finally {
      resetElementTemplateRefInitValueListener();
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('does not run delayed main-thread tasks for stale reload payloads', () => {
    const staleReloadVersion = getReloadVersion();
    const runRunOnMainThreadTask = vi.fn();
    const updateWorkletRefInitValueChanges = vi.fn();
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _refImpl: {
        updateWorkletRefInitValueChanges,
      },
      _eomImpl: {
        setShouldFlush: vi.fn(),
      },
      _runRunOnMainThreadTask: runRunOnMainThreadTask,
    };

    try {
      increaseReloadVersion();
      envManager.switchToMainThread();
      installElementTemplateRefInitValueListener();
      installElementTemplatePatchListener();
      mockFlushElementTree.mockClear();

      envManager.switchToBackground();
      lynx.getCoreContext().dispatchEvent({
        type: ElementTemplateLifecycleConstant.updateMTRefInitValue,
        data: JSON.stringify([[1, 'stale-init']]),
      });
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

      expect(updateWorkletRefInitValueChanges).toHaveBeenCalledWith([[1, 'stale-init']]);
      expect(runRunOnMainThreadTask).not.toHaveBeenCalled();
      expect(mockFlushElementTree).not.toHaveBeenCalled();
    } finally {
      resetElementTemplateRefInitValueListener();
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
      ops: [ElementTemplateUpdateOps.setMainThreadEvent, targetId, 0, { type: 'worklet', value: ctx }],
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
      _refImpl: createMainThreadRefImplMock(),
    };
    elementTemplateRegistry.set(targetId, {} as ElementTemplateHandle);
    seedMTEventState(targetId, 0, oldCtx);

    try {
      envManager.switchToMainThread();
      installElementTemplatePatchListener();
      mockSetElementTemplateAttributeSlot.mockClear();
      mockFlushElementTree.mockClear();

      envManager.switchToBackground();
      dispatchElementTemplateUpdate({
        ops: [
          ElementTemplateUpdateOps.setMainThreadEvent,
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

      expect(mockSetElementTemplateAttributeSlot).toHaveBeenCalledTimes(1);
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
      _refImpl: createMainThreadRefImplMock(),
    };
    elementTemplateRegistry.set(targetId, {} as ElementTemplateHandle);
    elementTemplateRegistry.set(childId, {} as ElementTemplateHandle);
    seedMTEventState(childId, 0, { _wkltId: 'removed' });

    try {
      envManager.switchToMainThread();
      installElementTemplatePatchListener();
      mockRemoveElementTemplateNodeFromSlot.mockClear();
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

      expect(mockRemoveElementTemplateNodeFromSlot).toHaveBeenCalledTimes(1);
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
    elementTemplateRegistry.set(targetId, {} as ElementTemplateHandle);
    elementTemplateRegistry.set(childId, {} as ElementTemplateHandle);
    seedMTEventState(childId, 0, { _wkltId: 'removed' });

    envManager.switchToMainThread();
    installElementTemplatePatchListener();
    mockRemoveElementTemplateNodeFromSlot.mockClear();
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

    expect(mockRemoveElementTemplateNodeFromSlot).toHaveBeenCalledTimes(1);
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
      null,
    ]);

    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('invalid handleId 1.5');
    resetReportedErrors();
  });

  it('reports duplicate handleId on create', () => {
    envManager.switchToMainThread();
    const existingRef = createMockElementTemplateHandle('existing');
    elementTemplateRegistry.set(7, existingRef);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTemplate,
      7,
      '_et_builtin_raw_text',
      null,
      ['x'],
      [],
      null,
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
      null,
    ]);

    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
      'attributeSlots must be an array, null, or undefined',
    );
    resetReportedErrors();
  });

  it('reports invalid non-array childSlots on create', () => {
    envManager.switchToMainThread();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTemplate,
      8,
      '_et_builtin_raw_text',
      null,
      [],
      'bad-slots' as unknown as ElementTemplateUpdateCommandStream[number],
      null,
    ]);

    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
      'childSlots must be an array, null, or undefined',
    );
    resetReportedErrors();
  });

  it('creates templates with nullable and sparse child slots', () => {
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
            { kind: 'childSlot', type: 'slot', elementSlotIndex: 0 },
            { kind: 'childSlot', type: 'slot', elementSlotIndex: 1 },
            { kind: 'childSlot', type: 'slot', elementSlotIndex: 2 },
          ],
        },
      },
    ]);

    const childSlots: ElementTemplateHandleSlotsCommand = [];
    childSlots[1] = [31];
    childSlots[2] = null;

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
      childSlots,
      null,
    ]);

    const parentCall = createTemplateMock.mock.calls.find((call) => call[0] === '_et_sparse_slot_parent');
    expect(parentCall).toBeDefined();
    const childRef = elementTemplateRegistry.get(31);
    const resolvedSlots = parentCall![3] as Array<ElementTemplateHandle[] | null | undefined>;
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

    const slotChildRef = createMockElementTemplateHandle('slot-child');
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

  it('creates a typed list with logical children in slot 0', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();

    const itemRef = createMockElementTemplateHandle('logical-child', 101);
    elementTemplateRegistry.set(12, itemRef);
    mockCreateTypedElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTypedElement,
      28,
      'list',
      { id: 'typed-list' },
      [[12], null],
      { estimatedHeight: 80 },
    ]);

    expect(mockCreateTypedElementTemplate.mock.calls).toEqual([[
      'list',
      {
        id: 'typed-list',
        'component-at-index': expect.any(Function),
        'component-at-indexes': expect.any(Function),
        'enqueue-component': expect.any(Function),
      },
      [[itemRef]],
      28,
      { estimatedHeight: 80 },
    ]]);
    expect(mockSetElementTemplateAttributeSlot.mock.calls).toHaveLength(0);
    expect(elementTemplateRegistry.has(28)).toBe(true);

    const listRef = elementTemplateRegistry.get(28);
    const createdAttributes = mockCreateTypedElementTemplate.mock.calls[0]?.[1] as Record<string, unknown>;
    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.setAttribute,
      28,
      0,
      { id: 'updated-list' },
    ]);

    expect(mockSetElementTemplateAttributeSlot.mock.calls).toEqual([[
      listRef,
      0,
      {
        id: 'updated-list',
        'component-at-index': createdAttributes['component-at-index'],
        'component-at-indexes': createdAttributes['component-at-indexes'],
        'enqueue-component': createdAttributes['enqueue-component'],
      },
    ]]);
  });

  it('creates a typed list outside development', () => {
    const originalDev = globalThis.__DEV__;
    globalThis.__DEV__ = false;
    try {
      envManager.switchToMainThread();
      elementTemplateRegistry.clear();
      const itemRef = createMockElementTemplateHandle('logical-child');
      elementTemplateRegistry.set(12, itemRef);
      mockCreateTypedElementTemplate.mockClear();

      applyElementTemplateUpdateCommands([
        ElementTemplateUpdateOps.createTypedElement,
        33,
        'list',
        null,
        [[12]],
        { estimatedHeight: 80 },
      ]);

      expect(mockCreateTypedElementTemplate.mock.calls).toEqual([[
        'list',
        {
          'component-at-index': expect.any(Function),
          'component-at-indexes': expect.any(Function),
          'enqueue-component': expect.any(Function),
        },
        [[itemRef]],
        33,
        { estimatedHeight: 80 },
      ]]);
      expect(elementTemplateRegistry.has(33)).toBe(true);
    } finally {
      globalThis.__DEV__ = originalDev;
    }
  });

  it('creates a typed list with null child slots', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();
    mockCreateTypedElementTemplate.mockClear();

    const stream: ElementTemplateUpdateCommandStream = [
      ElementTemplateUpdateOps.createTypedElement,
      29,
      'list',
      null,
      null,
      {},
    ];
    vi.mocked(__CreateTypedElementTemplate).mockReturnValueOnce(null as unknown as ElementTemplateHandle);
    applyElementTemplateUpdateCommands(stream);

    expect(elementTemplateRegistry.has(29)).toBe(false);
    expect(updateElementTemplateListAttributes(29, null)).toBeNull();
    mockCreateTypedElementTemplate.mockClear();

    applyElementTemplateUpdateCommands(stream);

    expect(mockCreateTypedElementTemplate.mock.calls).toEqual([[
      'list',
      {
        'component-at-index': expect.any(Function),
        'component-at-indexes': expect.any(Function),
        'enqueue-component': expect.any(Function),
      },
      null,
      29,
      {},
    ]]);
    expect(elementTemplateRegistry.has(29)).toBe(true);
  });

  it('creates an empty typed list without command options', () => {
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

    expect(mockCreateTypedElementTemplate.mock.calls).toEqual([[
      'list',
      {
        'component-at-index': expect.any(Function),
        'component-at-indexes': expect.any(Function),
        'enqueue-component': expect.any(Function),
      },
      [],
      32,
      null,
    ]]);
    expect(elementTemplateRegistry.has(32)).toBe(true);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(reportError.mock.calls).toHaveLength(0);
  });

  it('rejects typed list create with logical children outside slot 0', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();
    const firstItemRef = createMockElementTemplateHandle('first-item');
    const secondItemRef = createMockElementTemplateHandle('second-item');
    elementTemplateRegistry.set(11, firstItemRef);
    elementTemplateRegistry.set(12, secondItemRef);
    mockCreateTypedElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTypedElement,
      30,
      'list',
      null,
      [[11], [12]],
      {},
    ]);

    expect(mockCreateTypedElementTemplate.mock.calls).toHaveLength(0);
    expect(elementTemplateRegistry.has(30)).toBe(false);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
      'only supports logical slot 0',
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

  it('reports invalid typed create childSlots', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();
    mockCreateTypedElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTypedElement,
      28,
      'typed-host',
      null,
      'bad-slots' as unknown as ElementTemplateUpdateCommandStream[number],
      null,
    ]);

    expect(mockCreateTypedElementTemplate.mock.calls).toHaveLength(0);
    expect(elementTemplateRegistry.has(28)).toBe(false);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
      'childSlots must be an array, null, or undefined',
    );
    resetReportedErrors();
  });

  it('reports duplicate typed create handleId', () => {
    envManager.switchToMainThread();
    const existingRef = createMockElementTemplateHandle('existing');
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

  it('reports invalid non-array childSlots on typed create', () => {
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
      'childSlots must be an array, null, or undefined',
    );
    resetReportedErrors();
  });

  it('skips typed create when child slot handles are unresolved', () => {
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
      [[404]],
      {},
    ]);

    expect(mockCreateTypedElementTemplate.mock.calls).toHaveLength(0);
    expect(elementTemplateRegistry.has(42)).toBe(false);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('child handle 404 not found');
    resetReportedErrors();
  });

  it('skips typed list item updates when the item handle is unresolved', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();
    const listRef = createMockElementTemplateHandle('typed-list', 41);
    elementTemplateRegistry.set(41, listRef);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.updateTypedListItem,
      41,
      { __etHandleRef: 405, type: '_et_item', platformInfo: {}, subtreeHandleIds: null },
    ]);

    expect(__SetListItemInfoOfTemplate).not.toHaveBeenCalled();
    expect(mockSetElementTemplateAttributeSlot.mock.calls).toHaveLength(0);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(reportError.mock.calls).toHaveLength(1);
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
      'typed list update item handle 405 not found',
    );
    resetReportedErrors();
  });

  it('sets typed slot 0 attributes through the standard attr-slot PAPI', () => {
    envManager.switchToMainThread();
    const targetRef = createMockElementTemplateHandle('typed-target');
    elementTemplateRegistry.set(31, targetRef);
    mockSetAttribute.mockClear();
    mockSetElementTemplateAttributeSlot.mockClear();

    const attributes = { id: 'updated-list' };
    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.setAttribute,
      31,
      0,
      attributes,
    ]);

    expect(mockSetElementTemplateAttributeSlot.mock.calls).toEqual([[
      targetRef,
      0,
      attributes,
    ]]);
    expect(mockSetAttribute.mock.calls).toHaveLength(0);
  });

  it('keeps list callbacks when hydrated list attributes update through slot 0', () => {
    envManager.switchToMainThread();
    const listRef = createMockElementTemplateHandle('typed-list', 95);
    elementTemplateRegistry.set(29, listRef);
    const state = createElementTemplateListState();
    registerElementTemplateListState(29, state, listRef);
    const initialAttributes = composeElementTemplateListAttributes({ id: 'old', class: 'initial' }, state);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.setAttribute,
      29,
      0,
      { id: 'next' },
    ]);

    expect(mockSetElementTemplateAttributeSlot.mock.calls[0]).toEqual([
      listRef,
      0,
      {
        id: 'next',
        'component-at-index': initialAttributes['component-at-index'],
        'component-at-indexes': initialAttributes['component-at-indexes'],
        'enqueue-component': initialAttributes['enqueue-component'],
      },
    ]);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.setAttribute,
      29,
      0,
      null,
    ]);

    expect(mockSetElementTemplateAttributeSlot.mock.calls[1]).toEqual([
      listRef,
      0,
      {
        'component-at-index': initialAttributes['component-at-index'],
        'component-at-indexes': initialAttributes['component-at-indexes'],
        'enqueue-component': initialAttributes['enqueue-component'],
      },
    ]);
  });

  it('clears typed slot 0 attributes through the standard attr-slot PAPI', () => {
    envManager.switchToMainThread();
    const targetRef = createMockElementTemplateHandle('typed-target');
    elementTemplateRegistry.set(32, targetRef);
    mockSetAttribute.mockClear();
    mockSetElementTemplateAttributeSlot.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.setAttribute,
      32,
      0,
      null,
    ]);

    expect(mockSetElementTemplateAttributeSlot.mock.calls).toEqual([[
      targetRef,
      0,
      null,
    ]]);
    expect(mockSetAttribute.mock.calls).toHaveLength(0);
  });

  it('inserts logical List items through the standard child-slot PAPI', () => {
    envManager.switchToMainThread();
    const listRef = createMockElementTemplateHandle('typed-list', 100);
    const firstRef = createMockElementTemplateHandle('first', 101);
    const secondRef = createMockElementTemplateHandle('second', 102);
    elementTemplateRegistry.set(31, listRef);
    elementTemplateRegistry.set(32, firstRef);
    elementTemplateRegistry.set(33, secondRef);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.insertNode,
      31,
      0,
      33,
      32,
      null,
    ]);

    expect(mockInsertElementTemplateNodeIntoSlot.mock.calls).toEqual([[
      listRef,
      0,
      secondRef,
      firstRef,
    ]]);
    expect(mockSetElementTemplateAttributeSlot.mock.calls).toHaveLength(0);
    expect(mockRemoveElementTemplateNodeFromSlot.mock.calls).toHaveLength(0);
    expect(elementTemplateRegistry.get(32)).toBe(firstRef);
  });

  it('skips native platform info updates when the payload omits platform info', () => {
    envManager.switchToMainThread();
    const listRef = createMockElementTemplateHandle('typed-list', 214);
    const itemRef = createMockElementTemplateHandle('a', 2141);
    elementTemplateRegistry.set(214, listRef);
    elementTemplateRegistry.set(2141, itemRef);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.updateTypedListItem,
      214,
      { __etHandleRef: 2141, type: '_et_item_a', platformInfo: null, subtreeHandleIds: null },
    ]);

    expect(__SetListItemInfoOfTemplate).not.toHaveBeenCalled();
    expect(mockSetElementTemplateAttributeSlot.mock.calls).toHaveLength(0);
  });

  it('keeps list callbacks stable after removing a logical item', () => {
    envManager.switchToMainThread();
    const listRef = createMockElementTemplateHandle('typed-list', 110);
    const itemRef = createMockElementTemplateHandle('item', 111);
    const materializedList = { id: 'materialized-list' } as unknown as FiberElement;
    elementTemplateRegistry.set(41, listRef);
    elementTemplateRegistry.set(42, itemRef);
    const state = createElementTemplateListState();
    registerElementTemplateListState(41, state, listRef);
    const attrs = composeElementTemplateListAttributes(null, state);
    const componentAtIndex = attrs['component-at-index'] as ComponentAtIndexCallback;
    const enqueueComponent = attrs['enqueue-component'] as EnqueueComponentCallback;

    expect(componentAtIndex(materializedList, 7, 0, 88, false)).toBe(-1);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.removeNode,
      41,
      0,
      42,
      [42],
    ]);

    expect(mockRemoveElementTemplateNodeFromSlot.mock.calls).toEqual([[listRef, 0, itemRef]]);
    expect(elementTemplateRegistry.get(42)).toBeUndefined();
    expect(state.destroyed).toBe(false);
    expect(state.holderRef).toBe(listRef);
    expect(state.callbacks.componentAtIndex).toBe(componentAtIndex);
    expect(state.callbacks.enqueueComponent).toBe(enqueueComponent);
    mockRemoveElementTemplateNodeFromSlot.mockClear();

    enqueueComponent(materializedList, 7, 111);
    enqueueComponent(materializedList, 7, 111);

    expect(mockInsertElementTemplateNodeIntoSlot.mock.calls).toHaveLength(0);
    expect(mockRemoveElementTemplateNodeFromSlot.mock.calls).toHaveLength(0);
    expect(mockFlushElementTree.mock.calls).toHaveLength(0);
    expect(mockSetElementTemplateAttributeSlot.mock.calls).toHaveLength(0);
  });

  it('keeps typed list callbacks free of JS mounting and recycling', () => {
    envManager.switchToMainThread();
    const listRef = createMockElementTemplateHandle('typed-list', 140);
    const materializedList = { id: 'materialized-list' } as unknown as FiberElement;
    const state = createElementTemplateListState();
    registerElementTemplateListState(140, state, listRef);
    const attrs = composeElementTemplateListAttributes(null, state);
    const componentAtIndex = attrs['component-at-index'] as ComponentAtIndexCallback;
    const componentAtIndexes = attrs['component-at-indexes'] as ComponentAtIndexesCallback;
    const enqueueComponent = attrs['enqueue-component'] as EnqueueComponentCallback;

    expect(state).toEqual({
      listHandleId: 140,
      holderRef: listRef,
      destroyed: false,
      callbacks: {
        componentAtIndex,
        componentAtIndexes,
        enqueueComponent,
      },
    });
    expect(componentAtIndex(materializedList, 7, 0, 88, false)).toBe(-1);
    componentAtIndexes(materializedList, 7, [0, 1], [88, 89], false, true);
    enqueueComponent(materializedList, 7, 141);
    enqueueComponent(materializedList, 7, 141);
    enqueueComponent(materializedList, 7, 999);

    expect(mockInsertElementTemplateNodeIntoSlot.mock.calls).toHaveLength(0);
    expect(mockRemoveElementTemplateNodeFromSlot.mock.calls).toHaveLength(0);
    expect(mockFlushElementTree.mock.calls).toHaveLength(0);
  });

  it('releases removed List item subtrees after the native child-slot remove succeeds', () => {
    envManager.switchToMainThread();
    const outerListRef = createMockElementTemplateHandle('outer-list', 300);
    const itemRef = createMockElementTemplateHandle('item', 301);
    const nestedListRef = createMockElementTemplateHandle('nested-list', 302);
    const nestedItemRef = createMockElementTemplateHandle('nested-item', 303);
    elementTemplateRegistry.set(300, outerListRef);
    elementTemplateRegistry.set(301, itemRef);
    elementTemplateRegistry.set(302, nestedListRef);
    elementTemplateRegistry.set(303, nestedItemRef);
    const nestedState = createElementTemplateListState();
    registerElementTemplateListState(302, nestedState, nestedListRef);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.removeNode,
      300,
      0,
      301,
      [301, 302, 303],
    ]);

    expect(mockRemoveElementTemplateNodeFromSlot.mock.calls).toEqual([[outerListRef, 0, itemRef]]);
    expect(elementTemplateRegistry.get(301)).toBeUndefined();
    expect(elementTemplateRegistry.get(302)).toBeUndefined();
    expect(elementTemplateRegistry.get(303)).toBeUndefined();
    expect(nestedState.destroyed).toBe(true);
    expect(nestedState.holderRef).toBeNull();
    expect(mockSetElementTemplateAttributeSlot.mock.calls).toHaveLength(0);
  });

  it('forwards List item platform info updates to native', () => {
    envManager.switchToMainThread();
    const listRef = createMockElementTemplateHandle('typed-list', 145);
    const itemRef = createMockElementTemplateHandle('item', 146);
    elementTemplateRegistry.set(81, listRef);
    elementTemplateRegistry.set(82, itemRef);
    const platformInfo = { 'item-key': 'a', 'reuse-identifier': 'next' };

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.updateTypedListItem,
      81,
      {
        __etHandleRef: 82,
        type: '_et_item',
        platformInfo,
        subtreeHandleIds: null,
      },
    ]);

    expect(vi.mocked(__SetListItemInfoOfTemplate).mock.calls).toEqual([[itemRef, platformInfo]]);
    expect(mockSetElementTemplateAttributeSlot.mock.calls).toHaveLength(0);
  });

  it('keeps destroyed typed list callbacks Snapshot-safe', () => {
    envManager.switchToMainThread();
    const listRef = 120 as unknown as ElementTemplateHandle;
    const state = createElementTemplateListState();
    registerElementTemplateListState(120, state, listRef);
    const attrs = composeElementTemplateListAttributes(null, state);
    const componentAtIndex = attrs['component-at-index'] as ComponentAtIndexCallback;
    const componentAtIndexes = attrs['component-at-indexes'] as ComponentAtIndexesCallback;
    const enqueueComponent = attrs['enqueue-component'] as EnqueueComponentCallback;
    const materializedList = { id: 'materialized-list' } as unknown as FiberElement;

    markElementTemplateListDestroyed(120);

    expect(state.destroyed).toBe(true);
    expect(state.holderRef).toBeNull();
    expect(componentAtIndex(materializedList, 7, 0, 99, false)).toBe(-1);
    componentAtIndexes(materializedList, 7, [0], [99], false, true);
    enqueueComponent(materializedList, 7, 121);

    expect(mockInsertElementTemplateNodeIntoSlot.mock.calls).toHaveLength(0);
    expect(mockRemoveElementTemplateNodeFromSlot.mock.calls).toHaveLength(0);
    expect(mockFlushElementTree.mock.calls).toHaveLength(0);
  });

  it('skips typed slot 0 attributes when the target handle is unresolved', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();
    mockSetAttribute.mockClear();
    mockSetElementTemplateAttributeSlot.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.setAttribute,
      404,
      0,
      null,
    ]);

    expect(mockSetAttribute.mock.calls).toHaveLength(0);
    expect(mockSetElementTemplateAttributeSlot.mock.calls).toHaveLength(0);
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

    applyElementTemplateUpdateCommands([ElementTemplateUpdateOps.insertNode, -1, 0, 999, 0, []]);

    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(reportError.mock.calls).toHaveLength(1);
    resetReportedErrors();
  });

  it('reports a missing insert reference before calling the native PAPI', () => {
    envManager.switchToMainThread();
    const targetRef = { __isNativeRef: true, id: 'target' } as unknown as ElementTemplateHandle;
    const childRef = { __isNativeRef: true, id: 'child' } as unknown as ElementTemplateHandle;
    elementTemplateRegistry.set(600, targetRef);
    elementTemplateRegistry.set(601, childRef);
    mockInsertElementTemplateNodeIntoSlot.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.insertNode,
      600,
      0,
      601,
      999,
      [601],
    ]);

    expect(mockInsertElementTemplateNodeIntoSlot.mock.calls).toHaveLength(0);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('reference handle 999 not found');
    resetReportedErrors();
  });

  it('reports a missing insert subtree handle before calling the native PAPI', () => {
    envManager.switchToMainThread();
    const targetRef = { __isNativeRef: true, id: 'target' } as unknown as ElementTemplateHandle;
    const childRef = { __isNativeRef: true, id: 'child' } as unknown as ElementTemplateHandle;
    elementTemplateRegistry.set(600, targetRef);
    elementTemplateRegistry.set(601, childRef);
    mockInsertElementTemplateNodeIntoSlot.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.insertNode,
      600,
      0,
      601,
      0,
      [999],
    ]);

    expect(mockInsertElementTemplateNodeIntoSlot.mock.calls).toHaveLength(0);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('insert subtree handle 999 not found');
    resetReportedErrors();
  });

  it('reports missing child handle on removeNode', () => {
    envManager.switchToMainThread();
    const targetRef = createMockElementTemplateHandle('target');
    const descendantRef = createMockElementTemplateHandle('descendant');
    elementTemplateRegistry.set(1, targetRef);
    elementTemplateRegistry.set(12, descendantRef);

    applyElementTemplateUpdateCommands([ElementTemplateUpdateOps.removeNode, 1, 0, 999, [12]]);

    expect(mockRemoveElementTemplateNodeFromSlot.mock.calls).toHaveLength(0);
    expect(elementTemplateRegistry.has(12)).toBe(true);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('child handle 999 not found');
    resetReportedErrors();
  });

  it('reports missing target handle on removeNode without deleting subtree registry entries', () => {
    envManager.switchToMainThread();
    const childRef = createMockElementTemplateHandle('child');
    const descendantRef = createMockElementTemplateHandle('descendant');
    elementTemplateRegistry.set(11, childRef);
    elementTemplateRegistry.set(12, descendantRef);

    applyElementTemplateUpdateCommands([ElementTemplateUpdateOps.removeNode, 999, 0, 11, [11, 12]]);

    expect(mockRemoveElementTemplateNodeFromSlot.mock.calls).toHaveLength(0);
    expect(elementTemplateRegistry.has(11)).toBe(true);
    expect(elementTemplateRegistry.has(12)).toBe(true);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('target handle 999 not found');
    resetReportedErrors();
  });

  it('removes registry entries for the detached subtree after native remove succeeds', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();

    const targetRef = createMockElementTemplateHandle('target');
    const beforeRef = createMockElementTemplateHandle('before');
    const childRef = createMockElementTemplateHandle('child');
    const descendantRef = createMockElementTemplateHandle('descendant');
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
      [11, 12],
      ElementTemplateUpdateOps.removeNode,
      1,
      0,
      11,
      [11, 12],
    ];

    applyElementTemplateUpdateCommands(stream);

    expect(mockInsertElementTemplateNodeIntoSlot.mock.calls[0]?.[0]).toBe(targetRef);
    expect(mockInsertElementTemplateNodeIntoSlot.mock.calls[0]?.[2]).toBe(childRef);
    expect(mockInsertElementTemplateNodeIntoSlot.mock.calls[0]?.[3]).toBe(beforeRef);
    expect(mockRemoveElementTemplateNodeFromSlot.mock.calls[0]?.[0]).toBe(targetRef);
    expect(mockRemoveElementTemplateNodeFromSlot.mock.calls[0]?.[2]).toBe(childRef);
    expect(elementTemplateRegistry.has(1)).toBe(true);
    expect(elementTemplateRegistry.has(10)).toBe(true);
    expect(elementTemplateRegistry.has(11)).toBe(false);
    expect(elementTemplateRegistry.has(12)).toBe(false);
  });

  it('marks nested typed list state destroyed when removing a holder subtree', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();

    const targetRef = createMockElementTemplateHandle('target');
    const childRef = createMockElementTemplateHandle('child');
    const listRef = createMockElementTemplateHandle('typed-list', 132);
    const itemRef = createMockElementTemplateHandle('item', 131);
    elementTemplateRegistry.set(70, targetRef);
    elementTemplateRegistry.set(71, childRef);
    elementTemplateRegistry.set(72, listRef);
    elementTemplateRegistry.set(73, itemRef);
    const state = createElementTemplateListState();
    registerElementTemplateListState(72, state, listRef);
    const attrs = composeElementTemplateListAttributes(null, state);
    const componentAtIndex = attrs['component-at-index'] as ComponentAtIndexCallback;
    const componentAtIndexes = attrs['component-at-indexes'] as ComponentAtIndexesCallback;
    const enqueueComponent = attrs['enqueue-component'] as EnqueueComponentCallback;
    const materializedList = { id: 'materialized-list' } as unknown as FiberElement;

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.removeNode,
      70,
      0,
      71,
      [71, 72, 73],
    ]);

    expect(mockRemoveElementTemplateNodeFromSlot.mock.calls).toEqual([[targetRef, 0, childRef]]);
    expect(elementTemplateRegistry.has(71)).toBe(false);
    expect(elementTemplateRegistry.has(72)).toBe(false);
    expect(elementTemplateRegistry.has(73)).toBe(false);
    expect(state.destroyed).toBe(true);
    expect(state.holderRef).toBeNull();
    mockRemoveElementTemplateNodeFromSlot.mockClear();

    expect(componentAtIndex(materializedList, 7, 0, 99, false)).toBe(-1);
    componentAtIndexes(materializedList, 7, [0], [99], false, true);
    enqueueComponent(materializedList, 7, 131);

    expect(mockInsertElementTemplateNodeIntoSlot.mock.calls).toHaveLength(0);
    expect(mockRemoveElementTemplateNodeFromSlot.mock.calls).toHaveLength(0);
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
      null,
    ]);

    expect(serializeToJSX(__page)).toMatchInlineSnapshot(`
      "<page>
        <view />
      </page>"
    `);
  });

  it('reuses create attribute slots normalized by the update transport', () => {
    envManager.switchToMainThread();
    const createTemplateMock = globalThis.__CreateElementTemplate as unknown as {
      mockClear: () => void;
      mock: { calls: unknown[][] };
    };
    createTemplateMock.mockClear();

    const rawSlots = [undefined, 'x'];
    rawSlots.length = 3;
    const event = createElementTemplateUpdateEvent({
      ops: [
        ElementTemplateUpdateOps.createTemplate,
        8,
        '_et_builtin_raw_text',
        null,
        rawSlots as unknown as ElementTemplateUpdateCommandStream[number],
        [],
        null,
      ],
      flushOptions: {},
    });
    const payload = parseElementTemplateUpdateEventPayload(event.data);
    const attributeSlots = payload.ops[4];
    expect(attributeSlots).toEqual([null, 'x', null]);

    applyElementTemplateUpdateCommands(payload.ops);

    expect(createTemplateMock.mock.calls[0]?.[2]).toBe(attributeSlots);
  });

  it('passes bundleUrl and List item platform info from createTemplate to native create', () => {
    envManager.switchToMainThread();
    const createTemplateMock = globalThis.__CreateElementTemplate as unknown as {
      mockClear: () => void;
      mock: { calls: unknown[][] };
    };
    createTemplateMock.mockClear();
    const options = { __listItemPlatformInfo: { 'item-key': 'a', 'reuse-identifier': 'item' } };

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTemplate,
      9,
      '_et_builtin_raw_text',
      'dynamic-entry',
      ['x'],
      [],
      options,
    ]);

    expect(createTemplateMock.mock.calls).toEqual([[
      '_et_builtin_raw_text',
      'dynamic-entry',
      ['x'],
      [],
      9,
      options,
    ]]);
  });

  it('reports unsupported opcodes', () => {
    applyElementTemplateUpdateCommands([999 as unknown as ElementTemplateUpdateCommandStream[number]]);

    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('opcode 999 is not supported');
    resetReportedErrors();
  });

  it('resolves childSlots defensively for invalid payload members', () => {
    envManager.switchToMainThread();
    registerTemplates([
      {
        templateId: '_et_patch_parent',
        compiledTemplate: {
          kind: 'element',
          type: 'view',
          attributesArray: [],
          children: [{ kind: 'childSlot', type: 'slot', elementSlotIndex: 0 }],
        },
      },
    ]);

    const childRef = createMockElementTemplateHandle('child');
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
      null,
    ]);

    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('child handle 404 not found');
    expect(createTemplateMock.mock.calls).toHaveLength(0);
    resetReportedErrors();
  });

  it('still flushes update payloads with empty ops so flushOptions can reach native', () => {
    envManager.switchToMainThread();
    installElementTemplatePatchListener();
    mockSetElementTemplateAttributeSlot.mockClear();
    mockInsertElementTemplateNodeIntoSlot.mockClear();
    mockRemoveElementTemplateNodeFromSlot.mockClear();
    mockFlushElementTree.mockClear();
    lynx.performance._markTiming.mockClear();

    envManager.switchToBackground();
    dispatchElementTemplateUpdate({
      ops: [],
      flushOptions: { triggerDataUpdated: true },
    });
    envManager.switchToMainThread();

    expect(mockSetElementTemplateAttributeSlot.mock.calls).toHaveLength(0);
    expect(mockInsertElementTemplateNodeIntoSlot.mock.calls).toHaveLength(0);
    expect(mockRemoveElementTemplateNodeFromSlot.mock.calls).toHaveLength(0);
    expect(mockFlushElementTree.mock.calls).toHaveLength(1);
    expect(mockFlushElementTree.mock.calls[0]?.[1]).toEqual({ triggerDataUpdated: true });
    expect(lynx.performance._markTiming.mock.calls).toEqual([]);
  });
});
