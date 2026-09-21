import 'preact/debug';
import { expect, it, vi } from 'vitest';

import { __etHost } from '../../../../src/element-template/runtime/render/host.js';
import { renderToElementTemplate } from '../../../../src/element-template/runtime/render/render-direct.js';
import { elementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';
import { registerTemplates } from '../../test-utils/debug/registry.js';

it.each([false, true])('preact/debug - compact host children with duplicate keys: %s', (duplicate) => {
  globalThis.__MAIN_THREAD__ = true;
  globalThis.__BACKGROUND__ = false;
  elementTemplateRegistry.clear();
  registerTemplates([
    {
      templateId: '_et_debug_root',
      compiledTemplate: {
        kind: 'element',
        type: 'view',
        children: [{ kind: 'childSlot', type: 'slot', elementSlotIndex: 0 }],
      },
    },
    { templateId: '_et_debug_leaf', compiledTemplate: { kind: 'element', type: 'view' } },
  ]);
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const children = ['first', duplicate ? 'first' : 'second'].map(key =>
    __etHost('_et_debug_leaf', '_et_debug_leaf', '__Card__', key, undefined, undefined, undefined)
  );
  const host = __etHost('_et_debug_root', '_et_debug_root', '__Card__', undefined, undefined, [children], undefined);
  try {
    const result = renderToElementTemplate(host);
    expect(__SerializeElementTemplate(result.rootRefs[0]!).childSlots?.[0]).toHaveLength(2);
    if (duplicate) {
      expect(error).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('same key attribute: "first"'));
      expect(error.mock.calls[0]![0]).toContain('<_et_debug_root');
    } else {
      expect(error).not.toHaveBeenCalled();
    }
  } finally {
    error.mockRestore();
  }
});
