import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderMainThread } from '../../../../src/element-template/runtime/render/render-main-thread.js';
import { setupPage } from '../../../../src/element-template/runtime/page/page.js';
import { setRoot } from '../../../../src/element-template/runtime/page/root-instance.js';

vi.mock('../../../../src/element-template/runtime/render/render-to-opcodes.js', () => ({
  render: vi.fn(),
  registerSlot: vi.fn(),
}));

vi.mock('../../../../src/element-template/runtime/render/render-opcodes.js', () => ({
  renderOpcodesIntoElementTemplate: vi.fn(),
}));

import {
  render as mockRender,
} from '../../../../src/element-template/runtime/render/render-to-opcodes.js';
import { renderOpcodesIntoElementTemplate as mockRenderOpcodesIntoElementTemplate } from '../../../../src/element-template/runtime/render/render-opcodes.js';

describe('renderMainThread', () => {
  beforeEach(() => {
    setRoot({ __jsx: { type: 'test-root' } });
    setupPage({ type: 'page', children: [] } as unknown as FiberElement);
    globalThis.__MAIN_THREAD__ = true;
    globalThis.__BACKGROUND__ = false;
    const dispatchEvent = vi.fn();
    globalThis.lynx = {
      ...(globalThis.lynx ?? {}),
      reportError: vi.fn(),
      getJSContext: vi.fn(() => ({
        dispatchEvent,
      })),
    } as typeof lynx;
    vi.stubGlobal('__AppendElement', vi.fn());
    vi.stubGlobal('__SerializeElementTemplate', vi.fn());
    vi.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({ rootRefs: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should report error when renderToOpcodes fails', () => {
    const reportErrorSpy = vi.fn();
    (globalThis.lynx as typeof lynx & { reportError?: (error: Error) => void }).reportError = reportErrorSpy;

    vi.mocked(mockRender).mockImplementationOnce(() => {
      throw new Error('Render failed');
    });

    renderMainThread();

    expect(reportErrorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'Render failed' }));
  });

  it('should render opcodes into the current page and dispatch hydrate data', () => {
    const opcodes = [0, 'opcode'];
    const rootRefA = { type: 'ref-a' } as unknown as ElementRef;
    const rootRefB = { type: 'ref-b' } as unknown as ElementRef;
    const dispatchEvent = vi.fn();
    const serializedA = {
      templateKey: '_et_a',
      attributeSlots: [],
      elementSlots: [],
      options: { handleId: -1 },
    };
    const serializedB = {
      templateKey: '_et_b',
      attributeSlots: [],
      elementSlots: [],
      options: { handleId: -2 },
    };
    vi.mocked(mockRender).mockReturnValue(opcodes);
    vi.mocked(mockRenderOpcodesIntoElementTemplate).mockReturnValue({
      rootRefs: [rootRefA, rootRefB],
    });
    (globalThis.lynx as typeof lynx & { getJSContext?: () => { dispatchEvent: typeof dispatchEvent } })
      .getJSContext = vi.fn(() => ({
        dispatchEvent,
      }));
    vi.mocked(__SerializeElementTemplate).mockImplementation((ref: ElementRef) => {
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
    expect(__AppendElement).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: 'page' }), rootRefA);
    expect(__AppendElement).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: 'page' }), rootRefB);
    expect(__SerializeElementTemplate).toHaveBeenNthCalledWith(1, rootRefA);
    expect(__SerializeElementTemplate).toHaveBeenNthCalledWith(2, rootRefB);
    expect(dispatchEvent).toHaveBeenCalledWith({
      type: 'rLynxElementTemplateHydrate',
      data: [serializedA, serializedB],
    });
  });
});
