import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/element-template/runtime/render/render-to-opcodes.js', async () => {
  const actual = await vi.importActual('../../../../src/element-template/runtime/render/render-to-opcodes.js');
  return {
    ...actual,
    render: vi.fn(),
  };
});

import {
  __OpAttr,
  __OpBegin,
  __OpEnd,
  __OpSlot,
  __OpText,
  render as mockRender,
} from '../../../../src/element-template/runtime/render/render-to-opcodes.js';
import { renderMainThread } from '../../../../src/element-template/runtime/render/render-main-thread.js';
import { setupPage } from '../../../../src/element-template/runtime/page/page.js';
import { setRoot } from '../../../../src/element-template/runtime/page/root-instance.js';
import { resetTemplateId } from '../../../../src/element-template/runtime/template/handle.js';
import { ElementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';
import {
  BUILTIN_RAW_TEXT_TEMPLATE_ID,
  clearTemplates,
  registerBuiltinRawTextTemplate,
  registerTemplates,
} from '../../test-utils/debug/registry.js';
import { installMockNativePapi, lastMock } from '../../test-utils/mock/mockNativePapi.js';

describe('renderMainThread contract', () => {
  beforeEach(() => {
    installMockNativePapi({ clearTemplatesOnCleanup: true });
    clearTemplates();
    registerBuiltinRawTextTemplate();
    registerTemplates([
      {
        templateId: '_et_contract_root',
        compiledTemplate: {
          kind: 'element',
          type: 'view',
          attributesArray: [
            { kind: 'attribute', key: 'id', binding: 'slot', attrSlotIndex: 0 },
          ],
          children: [
            { kind: 'elementSlot', type: 'slot', elementSlotIndex: 0 },
          ],
        },
      },
    ]);

    resetTemplateId();
    ElementTemplateRegistry.clear();
    setRoot({ __jsx: { type: 'test-root' } });
    setupPage({ type: 'page', children: [] } as unknown as FiberElement);
    globalThis.__MAIN_THREAD__ = true;
    globalThis.__BACKGROUND__ = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    clearTemplates();
    ElementTemplateRegistry.clear();
    resetTemplateId();
  });

  it('creates serializable root refs through the real ET create path', () => {
    const dispatchEvent = vi.fn();
    (globalThis.lynx as typeof lynx & {
      getJSContext?: () => { dispatchEvent: typeof dispatchEvent };
    }).getJSContext = vi.fn(() => ({ dispatchEvent }));

    vi.mocked(mockRender).mockReturnValue([
      __OpBegin,
      { type: '_et_contract_root' },
      __OpAttr,
      'attributeSlots',
      ['main', 'lazy-entry'],
      __OpSlot,
      0,
      __OpText,
      'hello',
      __OpEnd,
    ]);

    renderMainThread();

    const nativeLog = lastMock!.nativeLog;
    expect(nativeLog).toContainEqual([
      '__CreateElementTemplate',
      BUILTIN_RAW_TEXT_TEMPLATE_ID,
      null,
      ['hello'],
      [],
      -1,
    ]);
    expect(nativeLog).toContainEqual([
      '__CreateElementTemplate',
      '_et_contract_root',
      null,
      ['main', 'lazy-entry'],
      [[expect.any(Object)]],
      -2,
    ]);

    const dispatched = dispatchEvent.mock.calls[0]?.[0] as { type: string; data: unknown[] } | undefined;
    expect(dispatched?.type).toBe('rLynxElementTemplateHydrate');
    expect(Array.isArray(dispatched?.data)).toBe(true);
    expect(dispatched?.data).toHaveLength(1);

    const [rootSerialized] = dispatched!.data as Array<Record<string, unknown>>;
    expect(rootSerialized).toMatchObject({
      templateKey: '_et_contract_root',
      attributeSlots: ['main', 'lazy-entry'],
      options: { handleId: -2 },
    });

    expect(ElementTemplateRegistry.get(-2)).toMatchObject({
      attributes: {
        id: 'main',
      },
    });

    const slotChildren = rootSerialized['elementSlots'] as unknown[][];
    expect(slotChildren[0]?.[0]).toMatchObject({
      kind: 'templateInstance',
      templateKey: BUILTIN_RAW_TEXT_TEMPLATE_ID,
      attributeSlots: ['hello'],
      options: { handleId: -1 },
    });
    expect(ElementTemplateRegistry.get(-1)).toBeDefined();
    expect(ElementTemplateRegistry.get(-2)).toBeDefined();
  });
});
