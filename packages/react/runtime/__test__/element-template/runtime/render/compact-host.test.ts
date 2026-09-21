// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createContext, h, options } from 'preact';
import { useContext, useId, useState } from '@lynx-js/react/lepus/hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __etHost } from '../../../../src/element-template/runtime/render/host.js';
import { destroyAllElementTemplateListStates } from '../../../../src/element-template/runtime/list/list.js';
import { renderToElementTemplate } from '../../../../src/element-template/runtime/render/render-direct.js';
import { createElementTemplatePage, setupPage } from '../../../../src/element-template/runtime/page/page.js';
import {
  __etAttrPlanMap,
  adaptEventAttrSlot,
  adaptMTRefAttrSlot,
  clearEtAttrPlanMap,
} from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import { resetTemplateId } from '../../../../src/element-template/runtime/template/handle.js';
import { clearMainThreadDynamicAttrState } from '../../../../src/element-template/runtime/template/main-thread-dynamic-attr-state.js';
import { elementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';
import { registerBuiltinRawTextTemplate, registerTemplates } from '../../test-utils/debug/registry.js';

beforeEach(() => {
  globalThis.__MAIN_THREAD__ = true;
  globalThis.__BACKGROUND__ = false;
  resetTemplateId();
  elementTemplateRegistry.clear();
  clearEtAttrPlanMap();
  clearMainThreadDynamicAttrState();
  registerBuiltinRawTextTemplate();
  registerTemplates([
    {
      templateId: '_et_compact_root',
      compiledTemplate: {
        kind: 'element',
        type: 'view',
        children: [{ kind: 'childSlot', type: 'slot', elementSlotIndex: 0 }],
      },
    },
    {
      templateId: '_et_compact_leaf',
      compiledTemplate: {
        kind: 'element',
        type: 'view',
        attributesArray: [{ kind: 'slot', key: 'id', attrSlotIndex: 0 }],
      },
    },
  ]);
  setupPage(createElementTemplatePage());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  clearEtAttrPlanMap();
  clearMainThreadDynamicAttrState();
  destroyAllElementTemplateListStates();
});

describe.each([['compact', undefined], ['plain', true]] as const)(
  '%s host direct materialization',
  (_name, plain) => {
    it('defers compact host creation and preserves reusable sparse inputs and explicit key', () => {
      vi.stubGlobal('__DEV__', false);
      const create = vi.spyOn(globalThis, '__CreateElementTemplate');
      const attrs = ['leaf'];
      const leaf = __etHost(
        '__Card__:_et_compact_leaf',
        '_et_compact_leaf',
        '__Card__',
        'key',
        attrs,
        undefined,
        undefined,
        plain,
      );
      const children = [leaf];
      const slots = [, children, false];
      const host = __etHost(
        '__Card__:_et_compact_root',
        '_et_compact_root',
        '__Card__',
        undefined,
        undefined,
        slots,
        undefined,
        plain,
      );
      expect(create).not.toHaveBeenCalled();
      expect(leaf.key).toBe('key');
      expect(leaf).not.toHaveProperty('props');
      for (let i = 0; i < 2; i++) {
        renderToElementTemplate(host);
        const args = create.mock.calls.at(-1)!;
        expect(args.slice(0, 3)).toEqual(['_et_compact_root', null, null]);
        expect(args[3]).toHaveLength(2);
        expect(Object.hasOwn(args[3]!, 0)).toBe(false);
        expect(args[3]![1]).toHaveLength(1);
        expect(slots).toEqual([, [leaf], false]);
        expect(attrs).toEqual(['leaf']);
        expect(leaf).not.toHaveProperty('props');
      }
    });

    it('keeps hooks and component/native ordering through compact host ancestry', () => {
      const Context = createContext('default');
      const order: string[] = [];
      const ids: string[] = [];
      const create = globalThis.__CreateElementTemplate;
      vi.spyOn(globalThis, '__CreateElementTemplate').mockImplementation((...args) => {
        order.push('create:' + args[0]);
        return create(...args);
      });
      function Child({ value }: { value: string }) {
        order.push('render:' + value);
        ids.push(useId());
        const context = useContext(Context);
        const [state] = useState(value);
        return __etHost(
          '__Card__:_et_compact_leaf',
          '_et_compact_leaf',
          '__Card__',
          undefined,
          [context + state],
          undefined,
          undefined,
          plain,
        );
      }
      const host = __etHost(
        '__Card__:_et_compact_root',
        '_et_compact_root',
        '__Card__',
        undefined,
        undefined,
        [[
          h(Child, { value: 'a' }),
          h(Child, { value: 'b' }),
        ]],
        undefined,
        plain,
      );
      const afterDiff = vi.fn();
      const previousDiffed = options.diffed;
      options.diffed = afterDiff;
      let result: ReturnType<typeof renderToElementTemplate>;
      try {
        result = renderToElementTemplate(h(Context.Provider, { value: 'provided:', children: host as never }));
      } finally {
        options.diffed = previousDiffed;
      }
      expect(afterDiff).toHaveBeenCalledWith(host);
      expect(order).toEqual([
        'render:a',
        'create:_et_compact_leaf',
        'render:b',
        'create:_et_compact_leaf',
        'create:_et_compact_root',
      ]);
      expect(new Set(ids).size).toBe(2);
      expect(__SerializeElementTemplate(result.rootRefs[0]!)).toMatchObject({
        childSlots: [[{ attributeSlots: ['provided:a'] }, { attributeSlots: ['provided:b'] }]],
      });
    });

    it('prepares compact host events and MTRefs without changing input attributes', () => {
      const mtRef = { _wvid: 123 };
      const attrs = [1, mtRef];
      __etAttrPlanMap['__Card__:_et_compact_leaf'] = [0, adaptEventAttrSlot, 1, adaptMTRefAttrSlot];
      const create = vi.spyOn(globalThis, '__CreateElementTemplate');
      const host = __etHost(
        '__Card__:_et_compact_leaf',
        '_et_compact_leaf',
        '__Card__',
        undefined,
        attrs,
        undefined,
        undefined,
      );
      const parent = __etHost(
        '__Card__:_et_compact_root',
        '_et_compact_root',
        '__Card__',
        undefined,
        undefined,
        [[
          host,
        ]],
        undefined,
        plain,
      );
      const result = renderToElementTemplate(parent);
      expect(create.mock.calls[0]!.slice(0, 3)).toEqual(['_et_compact_leaf', null, ['-1:0:', null]]);
      expect(result.rootSubtreeHandles).toEqual([[{ uid: -1, ref: create.mock.results[0]!.value }]]);
      expect(attrs).toEqual([1, mtRef]);
    });
  },
);
