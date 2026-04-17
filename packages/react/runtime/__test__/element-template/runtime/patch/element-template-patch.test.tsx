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
import { ElementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';
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

function createRawTextOps(id: number, text: string) {
  return [
    ElementTemplateUpdateOps.createTemplate,
    id,
    '__et_builtin_raw_text__',
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
  let mockSetAttributeOfElementTemplate: ReportErrorMock;
  let mockInsertNodeToElementTemplate: ReportErrorMock;
  let mockRemoveNodeFromElementTemplate: ReportErrorMock;
  let mockFlushElementTree: ReportErrorMock;

  beforeEach(() => {
    vi.clearAllMocks();
    // mocks are already installed by setup.js beforeEach
    mockSetAttributeOfElementTemplate = lastMock!.mockSetAttributeOfElementTemplate as unknown as ReportErrorMock;
    mockInsertNodeToElementTemplate = lastMock!.mockInsertNodeToElementTemplate as unknown as ReportErrorMock;
    mockRemoveNodeFromElementTemplate = lastMock!.mockRemoveNodeFromElementTemplate as unknown as ReportErrorMock;
    mockFlushElementTree = lastMock!.mockFlushElementTree as unknown as ReportErrorMock;
    registerBuiltinRawTextTemplate();

    hydrationData = [];
    envManager.resetEnv('background');
    envManager.setUseElementTemplate(true);

    onHydrate = vi.fn().mockImplementation((event: { data: unknown }) => {
      const data = event.data;
      if (Array.isArray(data)) {
        for (const item of data) {
          hydrationData.push(item as SerializedElementTemplate);
        }
      }
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
      before.options?.handleId as number,
      9999,
      before.options?.handleId as number,
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
    const targetId = before.options?.handleId;
    if (typeof targetId !== 'number') {
      throw new Error('Missing handleId on hydration payload');
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
    const targetId = before.options?.handleId;
    if (typeof targetId !== 'number') {
      throw new Error('Missing handleId on hydration payload');
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
      data: { flushOptions: {}, flowIds: [101, 202] },
    });
    envManager.switchToMainThread();

    expect(performance.profileStart).not.toHaveBeenCalled();
    expect(performance.profileEnd).not.toHaveBeenCalled();
    expect(mockFlushElementTree.mock.calls).toHaveLength(1);
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
      '__et_builtin_raw_text__',
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
    ElementTemplateRegistry.set(7, existingRef);

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTemplate,
      7,
      '__et_builtin_raw_text__',
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
      '__et_builtin_raw_text__',
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
      '__et_builtin_raw_text__',
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

  it('passes css scope metadata through create options during patch apply', () => {
    envManager.switchToMainThread();

    applyElementTemplateUpdateCommands([
      ElementTemplateUpdateOps.createTemplate,
      9,
      '__et_builtin_raw_text__',
      null,
      ['x'],
      [],
      {
        cssId: 100,
        entryName: 'lazy-entry',
      },
    ]);

    expect(lastMock!.nativeLog).toContainEqual([
      '__CreateElementTemplate',
      '__et_builtin_raw_text__',
      null,
      ['x'],
      [],
      {
        handleId: 9,
        cssId: 100,
        entryName: 'lazy-entry',
      },
    ]);
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
    ElementTemplateRegistry.set(1, targetRef);

    applyElementTemplateUpdateCommands([ElementTemplateUpdateOps.removeNode, 1, 0, 999]);

    expect(mockRemoveNodeFromElementTemplate.mock.calls).toHaveLength(0);
    const reportError = (globalThis.lynx as unknown as LynxWithReportErrorMock).reportError;
    expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('child handle 999 not found');
    resetReportedErrors();
  });

  it('resolves insert/remove references from registry', () => {
    envManager.switchToMainThread();
    ElementTemplateRegistry.clear();

    const targetRef = { __isNativeRef: true, id: 'target' } as unknown as ElementRef;
    const beforeRef = { __isNativeRef: true, id: 'before' } as unknown as ElementRef;
    const childRef = { __isNativeRef: true, id: 'child' } as unknown as ElementRef;
    ElementTemplateRegistry.set(1, targetRef);
    ElementTemplateRegistry.set(10, beforeRef);
    ElementTemplateRegistry.set(11, childRef);

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
    ];

    applyElementTemplateUpdateCommands(stream);

    expect(mockInsertNodeToElementTemplate.mock.calls[0]?.[0]).toBe(targetRef);
    expect(mockInsertNodeToElementTemplate.mock.calls[0]?.[2]).toBe(childRef);
    expect(mockInsertNodeToElementTemplate.mock.calls[0]?.[3]).toBe(beforeRef);
    expect(mockRemoveNodeFromElementTemplate.mock.calls[0]?.[0]).toBe(targetRef);
    expect(mockRemoveNodeFromElementTemplate.mock.calls[0]?.[2]).toBe(childRef);
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
      '__et_builtin_raw_text__',
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
        '__et_builtin_raw_text__',
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
          tag: 'view',
          attributesArray: [],
          children: [{ kind: 'elementSlot', tag: 'slot', elementSlotIndex: 0 }],
        },
      },
    ]);

    const childRef = { __isNativeRef: true, id: 'child' } as unknown as ElementRef;
    ElementTemplateRegistry.set(11, childRef);
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

  it('still flushes update payloads without ops so flushOptions can reach native', () => {
    envManager.switchToMainThread();
    installElementTemplatePatchListener();
    mockSetAttributeOfElementTemplate.mockClear();
    mockInsertNodeToElementTemplate.mockClear();
    mockRemoveNodeFromElementTemplate.mockClear();
    mockFlushElementTree.mockClear();

    envManager.switchToBackground();
    lynx.getCoreContext().dispatchEvent({
      type: ElementTemplateLifecycleConstant.update,
      data: { flushOptions: {} },
    });
    envManager.switchToMainThread();

    expect(mockSetAttributeOfElementTemplate.mock.calls).toHaveLength(0);
    expect(mockInsertNodeToElementTemplate.mock.calls).toHaveLength(0);
    expect(mockRemoveNodeFromElementTemplate.mock.calls).toHaveLength(0);
    expect(mockFlushElementTree.mock.calls).toHaveLength(1);
    expect(mockFlushElementTree.mock.calls[0]?.[1]).toEqual({});
  });
});
