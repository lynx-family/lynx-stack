// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { hydrate as hydrateBackground } from '../../../../src/element-template/background/hydrate.js';
import type { BackgroundElementTemplateInstance } from '../../../../src/element-template/background/instance.js';
import { root } from '../../../../src/element-template/index.js';
import {
  installElementTemplatePatchListener,
  resetElementTemplatePatchListener,
} from '../../../../src/element-template/native/patch-listener.js';
import { ElementTemplateLifecycleConstant } from '../../../../src/element-template/protocol/lifecycle-constant.js';
import { ElementTemplateUpdateOps } from '../../../../src/element-template/protocol/opcodes.js';
import type {
  ElementTemplateUpdateCommandStream,
  SerializedElementTemplate,
} from '../../../../src/element-template/protocol/types.js';
import { __page } from '../../../../src/element-template/runtime/page/page.js';
import { __root } from '../../../../src/element-template/runtime/page/root-instance.js';
import { applyElementTemplateUpdateCommands } from '../../../../src/element-template/runtime/patch.js';
import { elementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';
import { ElementTemplateEnvManager } from '../../test-utils/debug/envManager.js';
import { extractSerializedHydrateInstances } from '../../test-utils/debug/hydratePayload.js';
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

function resetReportedErrors(): void {
  const lynxObj = globalThis.lynx as unknown as LynxWithReportErrorMock;
  lynxObj.reportError.mockClear();
  (globalThis as unknown as { __LYNX_REPORT_ERROR_CALLS: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
}

describe('ElementTemplate patch stream (apply)', () => {
  const envManager = new ElementTemplateEnvManager();
  let hydrationData: SerializedElementTemplate[] = [];

  let onHydrate: (event: { data: unknown }) => void;
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

    hydrationData = [];
    envManager.resetEnv('background');
    envManager.setUseElementTemplate(true);

    onHydrate = vi.fn().mockImplementation((event: { data: unknown }) => {
      hydrationData.push(...extractSerializedHydrateInstances(event.data));
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
    lynx.getCoreContext().dispatchEvent({
      type: ElementTemplateLifecycleConstant.update,
      data: { ops: stream, flushOptions: {} },
    });
    envManager.switchToMainThread();

    expect(mockSetAttributeOfElementTemplate.mock.calls.length).toBeGreaterThan(0);
    expect(mockFlushElementTree.mock.calls.length).toBeGreaterThan(0);
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
    lynx.getCoreContext().dispatchEvent({
      type: ElementTemplateLifecycleConstant.update,
      data: { ops: stream, flushOptions: {}, flowIds: [101, 202] },
    });
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
    lynx.getCoreContext().dispatchEvent({
      type: ElementTemplateLifecycleConstant.update,
      data: { ops: [], flushOptions: { triggerDataUpdated: true }, flowIds: [101, 202] },
    });
    envManager.switchToMainThread();

    expect(performance.profileStart).not.toHaveBeenCalled();
    expect(performance.profileEnd).not.toHaveBeenCalled();
    expect(mockFlushElementTree.mock.calls).toHaveLength(1);
    expect(mockFlushElementTree.mock.calls[0]?.[1]).toEqual({ triggerDataUpdated: true });
  });

  it('flushes option-only update payloads without ops', () => {
    envManager.switchToMainThread();
    installElementTemplatePatchListener();
    const performance = lynx.performance;
    performance.profileStart.mockClear();
    performance.profileEnd.mockClear();
    mockFlushElementTree.mockClear();

    envManager.switchToBackground();
    lynx.getCoreContext().dispatchEvent({
      type: ElementTemplateLifecycleConstant.update,
      data: { flushOptions: { triggerDataUpdated: true }, flowIds: [101, 202] },
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

  it('creates typed elements with resolved slots and command options', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();

    const slotChildRef = { __isNativeRef: true, id: 'slot-child' } as unknown as ElementRef;
    const optionChildRef = { __isNativeRef: true, id: 'option-child' } as unknown as ElementRef;
    elementTemplateRegistry.set(11, slotChildRef);
    elementTemplateRegistry.set(12, optionChildRef);
    mockCreateTypedElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTypedElement,
      21,
      'list',
      { id: 'typed-list' },
      [[11]],
      {
        listChildren: [{ __etHandleRef: 12 }],
        estimatedHeight: 80,
      },
    ]);

    expect(mockCreateTypedElementTemplate.mock.calls).toHaveLength(1);
    expect(mockCreateTypedElementTemplate.mock.calls[0]?.[0]).toBe('list');
    expect(mockCreateTypedElementTemplate.mock.calls[0]?.[1]).toEqual({ id: 'typed-list' });
    expect(mockCreateTypedElementTemplate.mock.calls[0]?.[2]).toEqual([[slotChildRef]]);
    expect(mockCreateTypedElementTemplate.mock.calls[0]?.[3]).toBe(21);
    expect(mockCreateTypedElementTemplate.mock.calls[0]?.[4]).toEqual({
      listChildren: [optionChildRef],
      estimatedHeight: 80,
    });
    expect(elementTemplateRegistry.has(21)).toBe(true);
  });

  it('creates typed elements with no command options', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();
    mockCreateTypedElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTypedElement,
      23,
      'list',
      null,
      [],
      null,
    ]);

    expect(mockCreateTypedElementTemplate.mock.calls[0]?.[1]).toBe(null);
    expect(mockCreateTypedElementTemplate.mock.calls[0]?.[4]).toBe(null);
    expect(elementTemplateRegistry.has(23)).toBe(true);
  });

  it('passes serializable typed options unchanged when listChildren is absent', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();
    mockCreateTypedElementTemplate.mockClear();

    const options = {
      metadata: { itemCount: 1 },
      estimatedHeight: 80,
    };
    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTypedElement,
      24,
      'list',
      null,
      [],
      options,
    ]);

    expect(mockCreateTypedElementTemplate.mock.calls[0]?.[4]).toEqual(options);
    expect(elementTemplateRegistry.has(24)).toBe(true);
  });

  it('reports invalid typed create handleId', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();
    mockCreateTypedElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTypedElement,
      0,
      'list',
      null,
      [],
      null,
    ]);

    expect(mockCreateTypedElementTemplate.mock.calls).toHaveLength(0);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('invalid handleId 0');
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
      'list',
      null,
      [],
      null,
    ]);

    expect(mockCreateTypedElementTemplate.mock.calls).toHaveLength(0);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('duplicate handleId 26');
    resetReportedErrors();
  });

  it('skips typed create when element slot handles are unresolved', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();
    mockCreateTypedElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTypedElement,
      25,
      'list',
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

  it('skips typed create when command option handles are unresolved', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();
    mockCreateTypedElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTypedElement,
      22,
      'list',
      null,
      [],
      { listChildren: [{ __etHandleRef: 404 }] },
    ]);

    expect(mockCreateTypedElementTemplate.mock.calls).toHaveLength(0);
    expect(elementTemplateRegistry.has(22)).toBe(false);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
      'options.listChildren[0] handle 404 not found',
    );
    resetReportedErrors();
  });

  it('skips typed create when command option handle refs are malformed', () => {
    envManager.switchToMainThread();
    elementTemplateRegistry.clear();
    mockCreateTypedElementTemplate.mockClear();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTypedElement,
      27,
      'list',
      null,
      [],
      { listChildren: [null] } as unknown as ElementTemplateUpdateCommandStream[number],
    ]);

    expect(mockCreateTypedElementTemplate.mock.calls).toHaveLength(0);
    expect(elementTemplateRegistry.has(27)).toBe(false);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain(
      'options.listChildren[0] must contain a valid __etHandleRef',
    );
    resetReportedErrors();
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

  it('drops unresolved element slot children without reporting in prod mode', () => {
    envManager.switchToMainThread();
    const originalDev = globalThis.__DEV__;
    globalThis.__DEV__ = false;
    const createTemplateMock = globalThis.__CreateElementTemplate as unknown as {
      mockClear: () => void;
      mock: { calls: unknown[][] };
    };
    createTemplateMock.mockClear();

    try {
      applyElementTemplateUpdateCommands([
        ElementTemplateUpdateOps.createTemplate,
        9,
        '_et_builtin_raw_text',
        null,
        ['x'],
        [[404]],
      ]);

      expect(createTemplateMock.mock.calls[0]?.[3]).toEqual([[]]);
      expect((globalThis.lynx as unknown as LynxWithReportErrorMock).reportError.mock.calls).toHaveLength(0);
    } finally {
      globalThis.__DEV__ = originalDev;
    }
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
    lynx.getCoreContext().dispatchEvent({
      type: ElementTemplateLifecycleConstant.update,
      data: {
        ops: [],
        flushOptions: { triggerDataUpdated: true },
      },
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
