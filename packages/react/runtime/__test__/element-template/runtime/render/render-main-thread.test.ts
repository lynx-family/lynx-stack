import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderMainThread } from '../../../../src/element-template/runtime/render/render-main-thread.js';
import { getReloadVersion } from '../../../../src/core/reload-version.js';
import {
  createElementTemplateListState,
  destroyAllElementTemplateListStates,
  registerElementTemplateListState,
} from '../../../../src/element-template/runtime/list/list.js';
import { setupPage } from '../../../../src/element-template/runtime/page/page.js';
import { setRoot } from '../../../../src/element-template/runtime/page/root-instance.js';
import { elementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';

vi.mock('../../../../src/element-template/runtime/render/render-to-opcodes.js', () => ({
  render: vi.fn(),
  registerSlot: vi.fn(),
}));

vi.mock('../../../../src/element-template/runtime/render/render-opcodes.js', () => ({
  renderOpcodesIntoElementTemplate: vi.fn(),
}));

import { render as mockRender } from '../../../../src/element-template/runtime/render/render-to-opcodes.js';
import { renderOpcodesIntoElementTemplate as mockRenderOpcodesIntoElementTemplate } from '../../../../src/element-template/runtime/render/render-opcodes.js';

describe('renderMainThread', () => {
  let dispatchEvent: ReturnType<typeof vi.fn>;
  let pageRef: ElementTemplateHandle;

  beforeEach(() => {
    vi.mocked(mockRender).mockReset();
    vi.mocked(mockRenderOpcodesIntoElementTemplate).mockReset();
    setRoot({ __jsx: { type: 'test-root' } });
    pageRef = { type: 'page', children: [] } as unknown as ElementTemplateHandle;
    setupPage(pageRef);
    globalThis.__MAIN_THREAD__ = true;
    globalThis.__BACKGROUND__ = false;
    dispatchEvent = vi.fn();
    globalThis.lynx = {
      ...(globalThis.lynx ?? {}),
      reportError: vi.fn(),
      getJSContext: vi.fn(() => ({
        dispatchEvent,
      })),
    } as typeof lynx;
    vi.stubGlobal('__InsertNodeToElementTemplate', vi.fn());
    vi.stubGlobal('__SetAttributeOfElementTemplate', vi.fn());
    vi.stubGlobal('__SerializeElementTemplate', vi.fn());
    elementTemplateRegistry.clear();
    destroyAllElementTemplateListStates();
    vi.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({ pageAttributes: null, rootRefs: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
    destroyAllElementTemplateListStates();
  });

  it('should report error when renderToOpcodes fails', () => {
    const reportErrorSpy = vi.fn();
    const serializedPage = {
      tag: 'page',
      attributes: null,
      childSlots: [[]],
      uid: 0,
    };
    (globalThis.lynx as typeof lynx & { reportError?: (error: Error) => void }).reportError = reportErrorSpy;

    vi.mocked(mockRender).mockImplementationOnce(() => {
      throw new Error('Render failed');
    });
    vi.mocked(__SerializeElementTemplate).mockReturnValue(
      serializedPage as unknown as ReturnType<typeof __SerializeElementTemplate>,
    );

    renderMainThread();

    expect(reportErrorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Render failed' }));
    expect(mockRenderOpcodesIntoElementTemplate).toHaveBeenCalledWith([]);
    expect(__SetAttributeOfElementTemplate).toHaveBeenCalledWith(pageRef, 0, null);
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
    const rootRefA = { type: 'ref-a' } as unknown as ElementTemplateHandle;
    const rootRefB = { type: 'ref-b' } as unknown as ElementTemplateHandle;
    const dispatchEvent = vi.fn();
    const serializedA = {
      templateKey: '_et_a',
      attributeSlots: [],
      childSlots: [],
      uid: -1,
    };
    const serializedB = {
      templateKey: '_et_b',
      attributeSlots: [],
      childSlots: [],
      uid: -2,
    };
    const serializedPage = {
      tag: 'page',
      attributes: null,
      childSlots: [[serializedA, serializedB]],
      uid: 0,
    };
    vi.mocked(mockRender).mockReturnValue(opcodes);
    vi.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({
      pageAttributes: null,
      rootRefs: [rootRefA, rootRefB],
    });
    (globalThis.lynx as typeof lynx & { getJSContext?: () => { dispatchEvent: typeof dispatchEvent } })
      .getJSContext = vi.fn(() => ({
        dispatchEvent,
      }));
    vi.mocked(__SerializeElementTemplate).mockReturnValue(
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
    expect(vi.mocked(__InsertNodeToElementTemplate).mock.invocationCallOrder[1]).toBeLessThan(
      vi.mocked(__SerializeElementTemplate).mock.invocationCallOrder[0]!,
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
    vi.mocked(mockRender).mockReturnValue([0, 'opcode']);
    vi.mocked(mockRenderOpcodesIntoElementTemplate).mockImplementationOnce(() => {
      throw new Error('Materialization failed');
    });

    expect(() => renderMainThread()).toThrow('Materialization failed');
    expect(__SetAttributeOfElementTemplate).not.toHaveBeenCalled();
    expect(__InsertNodeToElementTemplate).not.toHaveBeenCalled();
    expect(__SerializeElementTemplate).not.toHaveBeenCalled();
  });

  it('applies authored page attrs before inserting rendered roots', () => {
    const rootRef = { type: 'root-ref' } as unknown as ElementTemplateHandle;
    vi.mocked(mockRender).mockReturnValue([]);
    vi.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({
      pageAttributes: {
        id: 'screen',
        bindtap: '0:0:bindtap',
      },
      rootRefs: [rootRef],
    });
    vi.mocked(__SerializeElementTemplate).mockReturnValue(
      {
        tag: 'page',
        attributes: {
          id: 'screen',
          bindtap: '0:0:bindtap',
        },
        childSlots: [[{
          templateKey: '_et_root',
          attributeSlots: [],
          childSlots: [],
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
    );
    expect(vi.mocked(__SetAttributeOfElementTemplate).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(__InsertNodeToElementTemplate).mock.invocationCallOrder[0]!,
    );
    expect(vi.mocked(__InsertNodeToElementTemplate).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(__SerializeElementTemplate).mock.invocationCallOrder[0]!,
    );
  });

  it('flushes initial list metadata after page insertion and before serialize', () => {
    const rootRef = { type: 'root-ref' } as unknown as ElementTemplateHandle;
    const listRef = { type: 'list-ref' } as unknown as ElementTemplateHandle;
    const serializedPage = {
      tag: 'page',
      attributes: null,
      childSlots: [[{
        templateKey: '_et_root',
        attributeSlots: [],
        childSlots: [],
        uid: -1,
      }]],
      uid: 0,
    };
    vi.mocked(mockRender).mockReturnValue([]);
    vi.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({
      pageAttributes: null,
      rootRefs: [rootRef],
    });
    vi.mocked(__SerializeElementTemplate).mockReturnValue(
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
    );
    expect(vi.mocked(__InsertNodeToElementTemplate).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(__SetAttributeOfElementTemplate).mock.invocationCallOrder[1]!,
    );
    expect(vi.mocked(__SetAttributeOfElementTemplate).mock.invocationCallOrder[1]).toBeLessThan(
      vi.mocked(__SerializeElementTemplate).mock.invocationCallOrder[0]!,
    );
  });
});
