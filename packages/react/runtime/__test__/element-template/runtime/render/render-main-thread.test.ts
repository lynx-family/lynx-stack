import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';

import { renderMainThread } from '../../../../src/element-template/runtime/render/render-main-thread.js';
import { getReloadVersion } from '../../../../src/core/reload-version.js';
import {
  createElementTemplateListState,
  destroyAllElementTemplateListStates,
  registerElementTemplateListState,
} from '../../../../src/element-template/runtime/list/list.js';
import { setupPage } from '../../../../src/element-template/runtime/page/page.js';
import { setRoot } from '../../../../src/element-template/runtime/page/root-instance.js';
import {
  __etAttrPlanMap,
  adaptMTRefAttrSlot,
  clearEtAttrPlanMap,
} from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import {
  clearMainThreadDynamicAttrState,
  getMainThreadDynamicAttrState,
  initializeMainThreadDynamicAttrSlots,
} from '../../../../src/element-template/runtime/template/main-thread-dynamic-attr-state.js';
import { elementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';

rs.mock('../../../../src/element-template/runtime/render/render-to-opcodes.js', () => ({
  render: rs.fn(),
  registerSlot: rs.fn(),
}));

rs.mock('../../../../src/element-template/runtime/render/render-opcodes.js', () => ({
  renderOpcodesIntoElementTemplate: rs.fn(),
}));

import { render as mockRender } from '../../../../src/element-template/runtime/render/render-to-opcodes.js';
import { renderOpcodesIntoElementTemplate as mockRenderOpcodesIntoElementTemplate } from '../../../../src/element-template/runtime/render/render-opcodes.js';

describe('renderMainThread', () => {
  let dispatchEvent: ReturnType<typeof rs.fn>;
  let pageRef: ElementRef;

  beforeEach(() => {
    rs.mocked(mockRender).mockReset();
    rs.mocked(mockRenderOpcodesIntoElementTemplate).mockReset();
    setRoot({ __jsx: { type: 'test-root' } });
    pageRef = { type: 'page', children: [] } as unknown as ElementRef;
    setupPage(pageRef);
    globalThis.__MAIN_THREAD__ = true;
    globalThis.__BACKGROUND__ = false;
    dispatchEvent = rs.fn();
    globalThis.lynx = {
      ...(globalThis.lynx ?? {}),
      reportError: rs.fn(),
      getJSContext: rs.fn(() => ({
        dispatchEvent,
      })),
    } as typeof lynx;
    rs.stubGlobal('__InsertNodeToElementTemplate', rs.fn());
    rs.stubGlobal('__SetAttributeOfElementTemplate', rs.fn());
    rs.stubGlobal('__SerializeElementTemplate', rs.fn());
    elementTemplateRegistry.clear();
    destroyAllElementTemplateListStates();
    clearMainThreadDynamicAttrState();
    clearEtAttrPlanMap();
    rs.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({
      pageAttributes: null,
      rootRefs: [],
      rootSubtreeHandles: [],
    });
  });

  afterEach(() => {
    rs.clearAllMocks();
    destroyAllElementTemplateListStates();
    clearMainThreadDynamicAttrState();
    clearEtAttrPlanMap();
  });

  it('should report error when renderToOpcodes fails', () => {
    const reportErrorSpy = rs.fn();
    const serializedPage = {
      tag: 'page',
      attributes: null,
      elementSlots: [[]],
      uid: 0,
    };
    (globalThis.lynx as typeof lynx & { reportError?: (error: Error) => void }).reportError = reportErrorSpy;

    rs.mocked(mockRender).mockImplementationOnce(() => {
      throw new Error('Render failed');
    });
    rs.mocked(__SerializeElementTemplate).mockReturnValue(
      serializedPage as unknown as ReturnType<typeof __SerializeElementTemplate>,
    );

    renderMainThread();

    expect(reportErrorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Render failed' }));
    expect(mockRenderOpcodesIntoElementTemplate).toHaveBeenCalledWith([]);
    expect(__SetAttributeOfElementTemplate).toHaveBeenCalledWith(pageRef, 0, null, null);
    expect(__InsertNodeToElementTemplate).not.toHaveBeenCalled();
    expect(__SerializeElementTemplate).toHaveBeenCalledWith(pageRef);
    expect(dispatchEvent).toHaveBeenCalledWith({
      type: 'rLynxElementTemplateHydrate',
      data: {
        page: serializedPage,
        reloadVersion: getReloadVersion(),
      },
    });
  });

  it('should render opcodes into the current page and dispatch hydrate data', () => {
    const opcodes = [0, 'opcode'];
    const rootRefA = { type: 'ref-a' } as unknown as ElementRef;
    const rootRefB = { type: 'ref-b' } as unknown as ElementRef;
    const dispatchEvent = rs.fn();
    const serializedA = {
      templateKey: '_et_a',
      attributeSlots: [],
      elementSlots: [],
      uid: -1,
    };
    const serializedB = {
      templateKey: '_et_b',
      attributeSlots: [],
      elementSlots: [],
      uid: -2,
    };
    const serializedPage = {
      tag: 'page',
      attributes: null,
      elementSlots: [[serializedA, serializedB]],
      uid: 0,
    };
    rs.mocked(mockRender).mockReturnValue(opcodes);
    rs.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({
      pageAttributes: null,
      rootRefs: [rootRefA, rootRefB],
      rootSubtreeHandles: [[], []],
    });
    (globalThis.lynx as typeof lynx & { getJSContext?: () => { dispatchEvent: typeof dispatchEvent } })
      .getJSContext = rs.fn(() => ({
        dispatchEvent,
      }));
    rs.mocked(__SerializeElementTemplate).mockReturnValue(
      serializedPage as unknown as ReturnType<typeof __SerializeElementTemplate>,
    );

    expect(() => renderMainThread()).not.toThrow();
    expect(mockRender).toHaveBeenCalledWith({ type: 'test-root' }, undefined);
    expect(mockRenderOpcodesIntoElementTemplate).toHaveBeenCalledWith(
      opcodes,
    );
    expect(__InsertNodeToElementTemplate).toHaveBeenNthCalledWith(
      1,
      pageRef,
      0,
      rootRefA,
      null,
    );
    expect(__InsertNodeToElementTemplate).toHaveBeenNthCalledWith(
      2,
      pageRef,
      0,
      rootRefB,
      null,
    );
    expect(__SerializeElementTemplate).toHaveBeenCalledTimes(1);
    expect(__SerializeElementTemplate).toHaveBeenCalledWith(pageRef);
    expect(rs.mocked(__InsertNodeToElementTemplate).mock.invocationCallOrder[1]).toBeLessThan(
      rs.mocked(__SerializeElementTemplate).mock.invocationCallOrder[0]!,
    );
    expect(dispatchEvent).toHaveBeenCalledWith({
      type: 'rLynxElementTemplateHydrate',
      data: {
        page: serializedPage,
        reloadVersion: getReloadVersion(),
      },
    });
  });

  it('does not commit the physical page when opcode materialization fails', () => {
    rs.mocked(mockRender).mockReturnValue([0, 'opcode']);
    rs.mocked(mockRenderOpcodesIntoElementTemplate).mockImplementationOnce(() => {
      throw new Error('Materialization failed');
    });

    expect(() => renderMainThread()).toThrow('Materialization failed');
    expect(__SetAttributeOfElementTemplate).not.toHaveBeenCalled();
    expect(__InsertNodeToElementTemplate).not.toHaveBeenCalled();
    expect(__SerializeElementTemplate).not.toHaveBeenCalled();
  });

  it('applies authored page attrs before inserting rendered roots', () => {
    const rootRef = { type: 'root-ref' } as unknown as ElementRef;
    rs.mocked(mockRender).mockReturnValue([]);
    rs.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({
      pageAttributes: {
        id: 'screen',
        bindtap: '0:0:bindtap',
      },
      rootRefs: [rootRef],
      rootSubtreeHandles: [[]],
    });
    rs.mocked(__SerializeElementTemplate).mockReturnValue(
      {
        tag: 'page',
        attributes: {
          id: 'screen',
          bindtap: '0:0:bindtap',
        },
        elementSlots: [[{
          templateKey: '_et_root',
          attributeSlots: [],
          elementSlots: [],
          uid: -1,
        }]],
        uid: 0,
      } as unknown as ReturnType<typeof __SerializeElementTemplate>,
    );

    renderMainThread();

    expect(__SetAttributeOfElementTemplate).toHaveBeenCalledWith(
      pageRef,
      0,
      {
        id: 'screen',
        bindtap: '0:0:bindtap',
      },
      null,
    );
    expect(rs.mocked(__SetAttributeOfElementTemplate).mock.invocationCallOrder[0]).toBeLessThan(
      rs.mocked(__InsertNodeToElementTemplate).mock.invocationCallOrder[0]!,
    );
    expect(rs.mocked(__InsertNodeToElementTemplate).mock.invocationCallOrder[0]).toBeLessThan(
      rs.mocked(__SerializeElementTemplate).mock.invocationCallOrder[0]!,
    );
  });

  it('flushes initial list metadata after page insertion and before serialize', () => {
    const rootRef = { type: 'root-ref' } as unknown as ElementRef;
    const listRef = { type: 'list-ref' } as unknown as ElementRef;
    const serializedPage = {
      tag: 'page',
      attributes: null,
      elementSlots: [[{
        templateKey: '_et_root',
        attributeSlots: [],
        elementSlots: [],
        uid: -1,
      }]],
      uid: 0,
    };
    rs.mocked(mockRender).mockReturnValue([]);
    rs.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({
      pageAttributes: null,
      rootRefs: [rootRef],
      rootSubtreeHandles: [[]],
    });
    rs.mocked(__SerializeElementTemplate).mockReturnValue(
      serializedPage as unknown as ReturnType<typeof __SerializeElementTemplate>,
    );
    elementTemplateRegistry.set(-2, listRef);
    registerElementTemplateListState(
      -2,
      createElementTemplateListState([], { id: 'feed' }),
      true,
      listRef,
    );

    renderMainThread();

    expect(__SetAttributeOfElementTemplate).toHaveBeenCalledWith(
      listRef,
      0,
      {
        id: 'feed',
        'component-at-index': expect.any(Function),
        'component-at-indexes': expect.any(Function),
        'enqueue-component': expect.any(Function),
        'update-list-info': {
          insertAction: [],
          removeAction: [],
          updateAction: [],
        },
      },
      null,
    );
    expect(rs.mocked(__InsertNodeToElementTemplate).mock.invocationCallOrder[0]).toBeLessThan(
      rs.mocked(__SetAttributeOfElementTemplate).mock.invocationCallOrder[1]!,
    );
    expect(rs.mocked(__SetAttributeOfElementTemplate).mock.invocationCallOrder[1]).toBeLessThan(
      rs.mocked(__SerializeElementTemplate).mock.invocationCallOrder[0]!,
    );
  });

  it('skips the initial list attribute flush when the handle has no native ref', () => {
    const rootRef = { type: 'root-ref' } as unknown as ElementRef;
    const listRef = { type: 'list-ref' } as unknown as ElementRef;
    const serializedPage = {
      tag: 'page',
      attributes: null,
      elementSlots: [[{
        templateKey: '_et_root',
        attributeSlots: [],
        elementSlots: [],
        uid: -1,
      }]],
      uid: 0,
    };
    rs.mocked(mockRender).mockReturnValue([]);
    rs.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({
      pageAttributes: null,
      rootRefs: [rootRef],
      rootSubtreeHandles: [[]],
    });
    rs.mocked(__SerializeElementTemplate).mockReturnValue(
      serializedPage as unknown as ReturnType<typeof __SerializeElementTemplate>,
    );
    registerElementTemplateListState(
      -2,
      createElementTemplateListState([], { id: 'feed' }),
      true,
      listRef,
    );

    renderMainThread();

    expect(__SetAttributeOfElementTemplate).not.toHaveBeenCalledWith(
      listRef,
      0,
      expect.anything(),
      null,
    );
  });

  it('attaches root MTRef state only after page insertion succeeds', () => {
    const rootRef = { type: 'root-ref' } as unknown as ElementRef;
    const ref = { _wvid: 80 };
    const updateWorkletRef = rs.fn();
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _refImpl: { updateWorkletRef },
    } as typeof globalThis.lynxWorkletImpl;
    __etAttrPlanMap._et_ref = [0, adaptMTRefAttrSlot];
    initializeMainThreadDynamicAttrSlots(
      -1,
      '_et_ref',
      [{ type: 'main-thread-ref', value: ref }],
    );
    rs.mocked(mockRender).mockReturnValue([]);
    rs.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({
      pageAttributes: null,
      rootRefs: [rootRef],
      rootSubtreeHandles: [[{ uid: -1, ref: rootRef }]],
    });
    rs.mocked(__SerializeElementTemplate).mockReturnValue({
      tag: 'page',
      attributes: null,
      elementSlots: [[{
        templateKey: '_et_ref',
        uid: -1,
      }]],
      uid: 0,
    } as ReturnType<typeof __SerializeElementTemplate>);

    try {
      renderMainThread();

      expect(updateWorkletRef).toHaveBeenCalledWith(ref, rootRef);
      expect(rs.mocked(__InsertNodeToElementTemplate).mock.invocationCallOrder[0]).toBeLessThan(
        updateWorkletRef.mock.invocationCallOrder[0]!,
      );
      expect(getMainThreadDynamicAttrState(-1, 0)).toEqual({
        kind: 'mt-ref',
        value: ref,
      });
    } finally {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('keeps root MTRef state blocked when page insertion throws', () => {
    const rootRef = { type: 'root-ref' } as unknown as ElementRef;
    const ref = { _wvid: 81 };
    const updateWorkletRef = rs.fn();
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _refImpl: { updateWorkletRef },
    } as typeof globalThis.lynxWorkletImpl;
    __etAttrPlanMap._et_ref = [0, adaptMTRefAttrSlot];
    initializeMainThreadDynamicAttrSlots(
      -1,
      '_et_ref',
      [{ type: 'main-thread-ref', value: ref }],
    );
    rs.mocked(mockRender).mockReturnValue([]);
    rs.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({
      pageAttributes: null,
      rootRefs: [rootRef],
      rootSubtreeHandles: [[{ uid: -1, ref: rootRef }]],
    });
    rs.mocked(__InsertNodeToElementTemplate).mockImplementationOnce(() => {
      throw new Error('insert root failed');
    });

    try {
      expect(() => renderMainThread()).toThrow('insert root failed');
      expect(updateWorkletRef).not.toHaveBeenCalled();
      expect(getMainThreadDynamicAttrState(-1, 0)).toEqual({
        kind: 'mt-ref',
        value: ref,
      });
    } finally {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });
});
