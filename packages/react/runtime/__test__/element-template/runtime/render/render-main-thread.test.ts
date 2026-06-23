import { afterEach, beforeEach, describe, expect, it, rstest, rstest } from '@rstest/core';

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

rstest.mock('../../../../src/element-template/runtime/render/render-to-opcodes.js', () => ({
  render: rstest.fn(),
  registerSlot: rstest.fn(),
}));

rstest.mock('../../../../src/element-template/runtime/render/render-opcodes.js', () => ({
  renderOpcodesIntoElementTemplate: rstest.fn(),
}));

import { render as mockRender } from '../../../../src/element-template/runtime/render/render-to-opcodes.js';
import { renderOpcodesIntoElementTemplate as mockRenderOpcodesIntoElementTemplate } from '../../../../src/element-template/runtime/render/render-opcodes.js';

describe('renderMainThread', () => {
  beforeEach(() => {
    setRoot({ __jsx: { type: 'test-root' } });
    setupPage({ type: 'page', children: [] } as unknown as ElementRef);
    globalThis.__MAIN_THREAD__ = true;
    globalThis.__BACKGROUND__ = false;
    const dispatchEvent = rstest.fn();
    globalThis.lynx = {
      ...(globalThis.lynx ?? {}),
      reportError: rstest.fn(),
      getJSContext: rstest.fn(() => ({
        dispatchEvent,
      })),
    } as typeof lynx;
    rstest.stubGlobal('__InsertNodeToElementTemplate', rstest.fn());
    rstest.stubGlobal('__SetAttributeOfElementTemplate', rstest.fn());
    rstest.stubGlobal('__SerializeElementTemplate', rstest.fn());
    elementTemplateRegistry.clear();
    destroyAllElementTemplateListStates();
    rstest.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({ rootRefs: [] });
  });

  afterEach(() => {
    rstest.clearAllMocks();
    destroyAllElementTemplateListStates();
  });

  it('should report error when renderToOpcodes fails', () => {
    const reportErrorSpy = rstest.fn();
    (globalThis.lynx as typeof lynx & { reportError?: (error: Error) => void }).reportError = reportErrorSpy;

    rstest.mocked(mockRender).mockImplementationOnce(() => {
      throw new Error('Render failed');
    });

    renderMainThread();

    expect(reportErrorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Render failed' }));
  });

  it('should render opcodes into the current page and dispatch hydrate data', () => {
    const opcodes = [0, 'opcode'];
    const rootRefA = { type: 'ref-a' } as unknown as ElementRef;
    const rootRefB = { type: 'ref-b' } as unknown as ElementRef;
    const dispatchEvent = rstest.fn();
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
    rstest.mocked(mockRender).mockReturnValue(opcodes);
    rstest.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({
      rootRefs: [rootRefA, rootRefB],
    });
    (globalThis.lynx as typeof lynx & { getJSContext?: () => { dispatchEvent: typeof dispatchEvent } })
      .getJSContext = rstest.fn(() => ({
        dispatchEvent,
      }));
    rstest.mocked(__SerializeElementTemplate).mockImplementation((ref: ElementRef) => {
      if (ref === rootRefA) {
        return serializedA as unknown as ReturnType<typeof __SerializeElementTemplate>;
      }
      if (ref === rootRefB) {
        return serializedB as unknown as ReturnType<typeof __SerializeElementTemplate>;
      }
      throw new Error('Unexpected root ref.');
    });

    expect(() => renderMainThread()).not.toThrow();
    expect(mockRender).toHaveBeenCalledWith({ type: 'test-root' }, undefined);
    expect(mockRenderOpcodesIntoElementTemplate).toHaveBeenCalledWith(
      opcodes,
    );
    expect(__InsertNodeToElementTemplate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: 'page' }),
      0,
      rootRefA,
      null,
    );
    expect(__InsertNodeToElementTemplate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: 'page' }),
      0,
      rootRefB,
      null,
    );
    expect(__SerializeElementTemplate).toHaveBeenNthCalledWith(1, rootRefA);
    expect(__SerializeElementTemplate).toHaveBeenNthCalledWith(2, rootRefB);
    expect(dispatchEvent).toHaveBeenCalledWith({
      type: 'rLynxElementTemplateHydrate',
      data: {
        instances: [serializedA, serializedB],
        reloadVersion: getReloadVersion(),
      },
    });
  });

  it('flushes initial list metadata after page insertion and before serialize', () => {
    const rootRef = { type: 'root-ref' } as unknown as ElementRef;
    const listRef = { type: 'list-ref' } as unknown as ElementRef;
    const serialized = {
      templateKey: '_et_root',
      attributeSlots: [],
      elementSlots: [],
      uid: -1,
    };
    rstest.mocked(mockRender).mockReturnValue([]);
    rstest.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({
      rootRefs: [rootRef],
    });
    rstest.mocked(__SerializeElementTemplate).mockReturnValue(
      serialized as unknown as ReturnType<typeof __SerializeElementTemplate>,
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
    expect(rstest.mocked(__InsertNodeToElementTemplate).mock.invocationCallOrder[0]).toBeLessThan(
      rstest.mocked(__SetAttributeOfElementTemplate).mock.invocationCallOrder[0]!,
    );
    expect(rstest.mocked(__SetAttributeOfElementTemplate).mock.invocationCallOrder[0]).toBeLessThan(
      rstest.mocked(__SerializeElementTemplate).mock.invocationCallOrder[0]!,
    );
  });
});
