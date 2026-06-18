import { afterEach, beforeEach, describe, expect, it, rstest, rstest } from '@rstest/core';

// Spy-mock the render-to-opcodes module: every export is wrapped in a spy that
// preserves the original implementation. The test overrides `render` via
// `mockReturnValue`. (vitest's bare `rstest.mock(path, factory)` spread-of-actual
// does not survive rstest's static hoisting, so use the built-in spy mode.)
rstest.mock('../../../../src/element-template/runtime/render/render-to-opcodes.js', { spy: true });

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
import { elementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';
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
            { kind: 'slot', key: 'id', attrSlotIndex: 0 },
          ],
          children: [
            { kind: 'elementSlot', type: 'slot', elementSlotIndex: 0 },
          ],
        },
      },
    ]);

    resetTemplateId();
    elementTemplateRegistry.clear();
    setRoot({ __jsx: { type: 'test-root' } });
    setupPage({ type: 'page', children: [] } as unknown as ElementRef);
    globalThis.__MAIN_THREAD__ = true;
    globalThis.__BACKGROUND__ = false;
  });

  afterEach(() => {
    rstest.clearAllMocks();
    rstest.unstubAllGlobals();
    clearTemplates();
    elementTemplateRegistry.clear();
    resetTemplateId();
  });

  it('creates serializable root refs through the real ET create path', () => {
    const dispatchEvent = rstest.fn();
    (globalThis.lynx as typeof lynx & {
      getJSContext?: () => { dispatchEvent: typeof dispatchEvent };
    }).getJSContext = rstest.fn(() => ({ dispatchEvent }));

    rstest.mocked(mockRender).mockReturnValue([
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

    const dispatched = dispatchEvent.mock.calls[0]?.[0] as
      | { type: string; data: { instances?: unknown[]; reloadVersion?: unknown } }
      | undefined;
    expect(dispatched?.type).toBe('rLynxElementTemplateHydrate');
    expect(Array.isArray(dispatched?.data.instances)).toBe(true);
    expect(dispatched?.data.instances).toHaveLength(1);
    expect(typeof dispatched?.data.reloadVersion).toBe('number');

    const [rootSerialized] = dispatched!.data.instances as Array<Record<string, unknown>>;
    expect(rootSerialized).toMatchObject({
      templateKey: '_et_contract_root',
      attributeSlots: ['main', 'lazy-entry'],
      uid: -2,
    });

    expect(elementTemplateRegistry.get(-2)).toMatchObject({
      attributes: {
        id: 'main',
      },
    });

    const slotChildren = rootSerialized['elementSlots'] as unknown[][];
    expect(slotChildren[0]?.[0]).toMatchObject({
      templateKey: BUILTIN_RAW_TEXT_TEMPLATE_ID,
      attributeSlots: ['hello'],
      uid: -1,
    });
    expect(elementTemplateRegistry.get(-1)).toBeDefined();
    expect(elementTemplateRegistry.get(-2)).toBeDefined();
  });
});
