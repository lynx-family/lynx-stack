// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Component, createContext, h, options } from 'preact';
import { useContext, useState } from 'preact/hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DIFF2 } from '../../../../src/shared/render-constants.js';
import { destroyAllElementTemplateListStates } from '../../../../src/element-template/runtime/list/list.js';
import { renderToString } from '../../../../src/element-template/runtime/render/render-to-opcodes.js';
import { __ElementTemplatePage } from '../../../../src/element-template/runtime/page/authored-page.js';
import { createElementTemplatePage, setupPage } from '../../../../src/element-template/runtime/page/page.js';
import { setRoot } from '../../../../src/element-template/runtime/page/root-instance.js';
import { renderMainThread } from '../../../../src/element-template/runtime/render/render-main-thread.js';
import { renderToElementTemplate } from '../../../../src/element-template/runtime/render/render-direct.js';
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
      templateId: '_et_direct_root',
      compiledTemplate: {
        kind: 'element',
        type: 'view',
        children: [{ kind: 'childSlot', type: 'slot', elementSlotIndex: 0 }],
      },
    },
    {
      templateId: '_et_direct_leaf',
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
  clearEtAttrPlanMap();
  clearMainThreadDynamicAttrState();
  destroyAllElementTemplateListStates();
});

describe('direct first-screen materialization', () => {
  it('creates completed hosts before later sibling render, but commits roots and MTRefs afterward', () => {
    const events: string[] = [];
    const mtRef = { _wvid: 123 };
    const previousWorkletImpl = globalThis.lynxWorkletImpl;
    globalThis.lynxWorkletImpl = {
      ...previousWorkletImpl,
      _refImpl: { updateWorkletRef: () => events.push('attach-ref') },
    } as typeof globalThis.lynxWorkletImpl;
    __etAttrPlanMap['__Card__:_et_direct_leaf'] = [1, adaptMTRefAttrSlot];
    const create = globalThis.__CreateElementTemplate;
    vi.spyOn(globalThis, '__CreateElementTemplate').mockImplementation((...args) => {
      events.push(`create:${args[0]}`);
      return create(...args);
    });
    const insert = globalThis.__InsertNodeToElementTemplate;
    vi.spyOn(globalThis, '__InsertNodeToElementTemplate').mockImplementation((...args) => {
      events.push('commit-root');
      return insert(...args);
    });
    function First() {
      events.push('render-first');
      return h('__Card__:_et_direct_leaf', { attributeSlots: ['first', mtRef] });
    }
    function Second() {
      events.push('render-second');
      return h('__Card__:_et_direct_leaf', { attributeSlots: ['second'] });
    }
    setRoot({ __jsx: h('_et_direct_root', { $0: [h(First, null), h(Second, null)] }) });

    try {
      renderMainThread();
      expect(events).toEqual([
        'render-first',
        'create:_et_direct_leaf',
        'render-second',
        'create:_et_direct_leaf',
        'create:_et_direct_root',
        'commit-root',
        'attach-ref',
      ]);
    } finally {
      globalThis.lynxWorkletImpl = previousWorkletImpl;
    }
  });

  it('preserves context, class derived state, function hooks and transparent authored page metadata', () => {
    const Context = createContext('default');
    class Derived extends Component<{ initial: number }, { value: number }> {
      static getDerivedStateFromProps(props: { initial: number }) {
        return { value: props.initial + 1 };
      }
      override render() {
        return h(Reader, { value: this.state.value });
      }
    }
    function Reader(props: { value: number }) {
      const context = useContext(Context);
      const [value] = useState(props.value);
      return h('__Card__:_et_direct_leaf', { attributeSlots: [`${context}:${value}`] });
    }
    const result = renderToElementTemplate(
      h(__ElementTemplatePage, {
        attributes: { id: 'page-id' },
        $0: h(Context.Provider, { value: 'provided', children: h(Derived, { initial: 41 }) }),
      }),
      undefined,
    );

    expect(result.pageAttributes).toEqual({ id: 'page-id' });
    expect(__SerializeElementTemplate(result.rootRefs[0]!)).toMatchObject({
      templateKey: '_et_direct_leaf',
      attributeSlots: ['provided:42'],
    });
  });

  it('renders numeric slots in order even when named props were inserted in reverse order', () => {
    registerTemplates([{
      templateId: '_et_direct_slots',
      compiledTemplate: {
        kind: 'element',
        type: 'view',
        children: [
          { kind: 'childSlot', type: 'slot', elementSlotIndex: 0 },
          { kind: 'childSlot', type: 'slot', elementSlotIndex: 1 },
        ],
      },
    }]);
    const order: number[] = [];
    function Child({ index }: { index: number }) {
      order.push(index);
      return h('_et_direct_leaf', { attributeSlots: [String(index)] });
    }
    const result = renderToElementTemplate(
      h('_et_direct_slots', {
        $1: h(Child, { index: 1 }),
        $0: h(Child, { index: 0 }),
      }),
      undefined,
    );

    expect(order).toEqual([0, 1]);
    expect(__SerializeElementTemplate(result.rootRefs[0]!)).toMatchObject({
      childSlots: [
        [{ templateKey: '_et_direct_leaf', attributeSlots: ['0'] }],
        [{ templateKey: '_et_direct_leaf', attributeSlots: ['1'] }],
      ],
    });
  });

  it.each([
    { name: 'missing', props: {}, childSlots: null },
    { name: 'null', props: { $0: null }, childSlots: null },
    { name: 'undefined', props: { $0: undefined }, childSlots: null },
    { name: 'true', props: { $0: true }, childSlots: null },
    { name: 'false', props: { $0: false }, childSlots: null },
    { name: 'multiple empty slots', props: { $3: false, $1: true, $2: undefined, $0: null }, childSlots: null },
    { name: 'empty array', props: { $0: [] }, childSlots: [[]] },
    { name: 'empty string', props: { $0: '' }, childSlots: [[]] },
    { name: 'function', props: { $0: () => {} }, childSlots: [[]] },
  ])('preserves the native child-slot shape for $name children', ({ props, childSlots }) => {
    const create = vi.spyOn(globalThis, '__CreateElementTemplate');

    const result = renderToElementTemplate(h('_et_direct_root', props));

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[3]).toStrictEqual(childSlots);
    expect(__SerializeElementTemplate(result.rootRefs[0]!)).toMatchObject({ childSlots: [[]] });
  });

  it.each([null, undefined, true, false])('preserves sparse slots and omits a trailing %s slot', (trailing) => {
    registerTemplates([{
      templateId: '_et_direct_sparse',
      compiledTemplate: {
        kind: 'element',
        type: 'view',
        children: [
          { kind: 'childSlot', type: 'slot', elementSlotIndex: 0 },
          { kind: 'childSlot', type: 'slot', elementSlotIndex: 2 },
          { kind: 'childSlot', type: 'slot', elementSlotIndex: 4 },
        ],
      },
    }]);
    const create = vi.spyOn(globalThis, '__CreateElementTemplate');

    const result = renderToElementTemplate(h('_et_direct_sparse', {
      $4: trailing,
      $2: h('_et_direct_leaf', { attributeSlots: ['child'] }),
      $0: null,
    }));

    expect(create.mock.calls.map(args => args[0])).toEqual(['_et_direct_leaf', '_et_direct_sparse']);
    const childSlots = new Array<ElementTemplateHandle[]>(3);
    childSlots[2] = [create.mock.results[0]!.value];
    expect(create.mock.calls[1]?.[3]).toStrictEqual(childSlots);
    expect(__SerializeElementTemplate(result.rootRefs[0]!).childSlots?.[2]).toMatchObject([
      { templateKey: '_et_direct_leaf', attributeSlots: ['child'] },
    ]);
  });

  it('keeps reused vnode child arrays separate from each render native child slots', () => {
    const leaf = h('_et_direct_leaf', { attributeSlots: ['child'] });
    const nestedChildren = ['text'];
    const children = [leaf, false, nestedChildren];
    const vnode = h('_et_direct_root', { $0: children });
    const create = vi.spyOn(globalThis, '__CreateElementTemplate');

    const first = renderToElementTemplate(vnode);
    const second = renderToElementTemplate(vnode);

    expect(vnode.props['$0']).toBe(children);
    expect(children).toEqual([leaf, false, nestedChildren]);
    expect(nestedChildren).toEqual(['text']);
    const rootCalls = create.mock.calls.filter(args => args[0] === '_et_direct_root');
    expect(rootCalls).toHaveLength(2);
    const firstSlots = rootCalls[0]![3]!;
    const secondSlots = rootCalls[1]![3]!;
    expect(firstSlots).not.toBe(children);
    expect(firstSlots[0]).not.toBe(children);
    expect(secondSlots).not.toBe(firstSlots);
    expect(secondSlots[0]).not.toBe(firstSlots[0]);
    expect(secondSlots[0]?.[0]).not.toBe(firstSlots[0]?.[0]);
    for (const result of [first, second]) {
      expect(__SerializeElementTemplate(result.rootRefs[0]!)).toMatchObject({
        childSlots: [[
          { templateKey: '_et_direct_leaf', attributeSlots: ['child'] },
          { templateKey: '_et_builtin_raw_text', attributeSlots: ['text'] },
        ]],
      });
    }
  });

  it('keeps a reused vnode attribute array raw while preparing handle-specific event markers', () => {
    const callback = vi.fn();
    const attributes = ['ready', callback];
    __etAttrPlanMap['__Card__:_et_direct_leaf'] = [1, adaptEventAttrSlot];
    const vnode = h('__Card__:_et_direct_leaf', { attributeSlots: attributes });
    const create = vi.spyOn(globalThis, '__CreateElementTemplate');

    renderToElementTemplate(vnode, undefined);
    renderToElementTemplate(vnode, undefined);

    expect(attributes).toEqual(['ready', callback]);
    expect(create.mock.calls[0]?.[2]).not.toBe(attributes);
    expect(create.mock.calls[1]?.[2]).not.toBe(attributes);
    expect(create.mock.calls[0]?.[2]?.[1]).not.toEqual(create.mock.calls[1]?.[2]?.[1]);
  });

  it('runs the shared second diff hook in both direct and opcode traversals', () => {
    const hooks = options as typeof options & { [DIFF2]?: (vnode: unknown, context: unknown) => void };
    const previous = hooks[DIFF2];
    const diff = vi.fn();
    hooks[DIFF2] = diff;
    const vnode = h('_et_direct_leaf', { attributeSlots: ['hook'] });
    try {
      renderToString(vnode);
      renderToElementTemplate(vnode);
      expect(diff).toHaveBeenCalledTimes(2);
      expect(diff).toHaveBeenNthCalledWith(1, vnode, {});
      expect(diff).toHaveBeenNthCalledWith(2, vnode, {});
    } finally {
      hooks[DIFF2] = previous;
    }
  });

  it.each([null, undefined, true, false, '', () => {}])('ignores a non-rendering root value (%s)', (value) => {
    const create = vi.spyOn(globalThis, '__CreateElementTemplate');
    expect(renderToElementTemplate(value)).toMatchObject({
      pageAttributes: null,
      rootRefs: [],
      rootSubtreeHandles: [],
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('creates root text without a materialized host wrapper', () => {
    const result = renderToElementTemplate('root text');
    expect(result.rootSubtreeHandles).toEqual([[]]);
    expect(__SerializeElementTemplate(result.rootRefs[0]!)).toMatchObject({
      templateKey: '_et_builtin_raw_text',
      attributeSlots: ['root text'],
    });
  });

  it.each([
    [h('view', {}), 'uncompiled host vnode: view'],
    [{ type: 42, props: {} }, 'invalid vnode'],
  ])('rejects an unsupported host input', (vnode, message) => {
    expect(() => renderToElementTemplate(vnode)).toThrow(message as string);
  });

  it.each([
    [
      h('_et_direct_root', { $0: h(__ElementTemplatePage, { $0: null }) }),
      'must be the outermost element',
    ],
    [
      [h(__ElementTemplatePage, { $0: null }), h(__ElementTemplatePage, { $0: null })],
      'does not support multiple authored <page /> elements',
    ],
    [
      [h('_et_direct_leaf', {}), h(__ElementTemplatePage, { $0: null })],
      'must wrap all materialized roots',
    ],
    [
      [h(__ElementTemplatePage, { $0: null }), h('_et_direct_leaf', {})],
      'must wrap all materialized roots',
    ],
    [
      [h(__ElementTemplatePage, { $0: null }), 'outside page'],
      'must wrap all materialized roots',
    ],
  ])('rejects an authored page outside its root boundary', (vnode, message) => {
    expect(() => renderToElementTemplate(vnode)).toThrow(message as string);
  });

  it('passes typed-list item handles in logical order while keeping item refs detached', () => {
    const create = vi.spyOn(globalThis, '__CreateTypedElementTemplate');
    const result = renderToElementTemplate(h('list', {
      attributes: { id: 'feed' },
      $0: [
        h('_et_direct_leaf', { attributeSlots: ['a'], __listItemPlatformInfo: { 'item-key': 'a' } }),
        h('_et_direct_leaf', { attributeSlots: ['b'], __listItemPlatformInfo: { 'item-key': 'b' } }),
      ],
    }));
    expect(create).toHaveBeenCalledWith(
      'list',
      expect.objectContaining({ id: 'feed', 'component-at-index': expect.any(Function) }),
      null,
      -3,
      { listChildren: [elementTemplateRegistry.get(-1), elementTemplateRegistry.get(-2)] },
    );
    expect(result.rootRefs).toEqual([elementTemplateRegistry.get(-3)]);
    expect(result.rootSubtreeHandles).toEqual([[]]);
  });

  it.each([undefined, true, false])('creates an empty typed list for a non-rendering slot (%s)', (children) => {
    const create = vi.spyOn(globalThis, '__CreateTypedElementTemplate');
    const result = renderToElementTemplate(h('list', { $0: children }));
    expect(create.mock.calls[0]?.[4]).toEqual({ listChildren: [] });
    expect(result.rootRefs).toHaveLength(1);
  });

  it.each([
    [{ $1: h('_et_direct_leaf', {}) }, 'only supports logical slot $0'],
    [{ $0: 'text item' }, 'received text logical child'],
    [{ $0: h('_et_direct_leaf', {}) }, 'received a non-list-item root'],
    [
      { $0: h('_et_direct_leaf', { isReady: false, __listItemPlatformInfo: {} }) },
      'does not support deferred list items',
    ],
  ])('rejects unsupported typed-list children', (props, message) => {
    expect(() => renderToElementTemplate(h('list', props))).toThrow(message as string);
  });

  it('reports native creation failures at the lifecycle boundary and serializes an empty page', () => {
    const reportError = vi.spyOn(lynx, 'reportError').mockImplementation(() => {});
    vi.spyOn(globalThis, '__CreateElementTemplate').mockImplementation(() => {
      throw new Error('native create failed');
    });
    const attributes = vi.spyOn(globalThis, '__SetAttributeOfElementTemplate');
    const insert = vi.spyOn(globalThis, '__InsertNodeToElementTemplate');
    const serialize = vi.spyOn(globalThis, '__SerializeElementTemplate');
    setRoot({ __jsx: h('__Card__:_et_direct_leaf', { attributeSlots: ['ready'] }) });

    renderMainThread();
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: 'native create failed' }));
    expect(attributes).toHaveBeenCalledTimes(1);
    expect(insert).not.toHaveBeenCalled();
    expect(serialize).toHaveBeenCalledTimes(1);
    expect(serialize.mock.results[0]?.value).toMatchObject({ tag: 'page', attributes: null, childSlots: null });
  });

  it('does not attach a completed earlier sibling if a later component throws', () => {
    const insert = vi.spyOn(globalThis, '__InsertNodeToElementTemplate');
    const serialize = vi.spyOn(globalThis, '__SerializeElementTemplate');
    const reportError = vi.spyOn(lynx, 'reportError').mockImplementation(() => {});
    function Failure(): never {
      throw new Error('later sibling failed');
    }
    setRoot({ __jsx: [h('__Card__:_et_direct_leaf', { attributeSlots: ['ready'] }), h(Failure, null)] });

    renderMainThread();

    expect(insert).not.toHaveBeenCalled();
    expect(serialize).toHaveBeenCalledTimes(1);
    expect(serialize.mock.results[0]?.value).toMatchObject({ tag: 'page', attributes: null, childSlots: null });
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: 'later sibling failed' }));
    // Native creation can precede the failure, but no root from that pass commits.
    reportError.mockClear();
  });
});
