// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { h } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderToElementTemplate } from '../../../../src/element-template/runtime/render/render-direct.js';
import { __ElementTemplatePage } from '../../../../src/element-template/runtime/page/authored-page.js';
import {
  destroyAllElementTemplateListStates,
  flushInitialElementTemplateListUpdates,
} from '../../../../src/element-template/runtime/list/list.js';
import { resetTemplateId } from '../../../../src/element-template/runtime/template/handle.js';
import { elementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';
import {
  __etAttrPlanMap,
  adaptEventAttrSlot,
  adaptRefAttrSlot,
  adaptSpreadAttrSlot,
  clearEtAttrPlanMap,
} from '../../../../src/element-template/runtime/template/attr-slot-plan.js';

describe('direct renderer native contracts', () => {
  const createElementTemplate = vi.fn();
  const createTypedElementTemplate = vi.fn();
  const getElementUniqueID = vi.fn();
  const insertNodeToElementTemplate = vi.fn();
  const removeNodeFromElementTemplate = vi.fn();
  const flushElementTree = vi.fn();
  const addEvent = vi.fn();

  beforeEach(() => {
    createElementTemplate.mockReset();
    createTypedElementTemplate.mockReset();
    getElementUniqueID.mockReset();
    insertNodeToElementTemplate.mockReset();
    removeNodeFromElementTemplate.mockReset();
    flushElementTree.mockReset();
    addEvent.mockReset();
    getElementUniqueID.mockImplementation((node: { __mockNativeId?: number }) => node.__mockNativeId);
    vi.stubGlobal('__CreateElementTemplate', createElementTemplate);
    vi.stubGlobal('__CreateTypedElementTemplate', createTypedElementTemplate);
    vi.stubGlobal('__GetElementUniqueID', getElementUniqueID);
    vi.stubGlobal('__InsertNodeToElementTemplate', insertNodeToElementTemplate);
    vi.stubGlobal('__RemoveNodeFromElementTemplate', removeNodeFromElementTemplate);
    vi.stubGlobal('__FlushElementTree', flushElementTree);
    vi.stubGlobal('__AddEvent', addEvent);
    elementTemplateRegistry.clear();
    destroyAllElementTemplateListStates();
    clearEtAttrPlanMap();
    resetTemplateId();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearEtAttrPlanMap();
  });

  it('creates root text through the builtin raw-text template with a handle id', () => {
    const rootTextRef = { kind: 'text-ref' };
    createElementTemplate.mockReturnValue(rootTextRef);

    const result = renderToElementTemplate('hello');

    expect(result.rootRefs).toEqual([rootTextRef]);
    expect(result.pageAttributes).toBeNull();
    expect(result.rootSubtreeHandles).toEqual([[]]);
    expect(createElementTemplate).toHaveBeenCalledWith(
      '_et_builtin_raw_text',
      null,
      ['hello'],
      [],
      -1,
    );
    expect(elementTemplateRegistry.get(-1)).toBe(rootTextRef);
  });

  it('returns singleton page attrs from the authored page', () => {
    const attributes = { id: 'screen' };

    const result = renderToElementTemplate(h(__ElementTemplatePage, { attributes }));

    expect(result).toMatchObject({
      pageAttributes: attributes,
      rootRefs: [],
      rootSubtreeHandles: [],
    });
  });

  it('materializes multiple roots inside one outermost page', () => {
    const firstRootRef = { kind: 'first-root-ref' };
    const secondRootRef = { kind: 'second-root-ref' };
    const attributes = { id: 'page' };
    createElementTemplate
      .mockReturnValueOnce(firstRootRef)
      .mockReturnValueOnce(secondRootRef);

    const result = renderToElementTemplate(
      h(__ElementTemplatePage, { attributes, $0: [h('_et_first_root', {}), h('_et_second_root', {})] }),
    );

    expect(result).toMatchObject({
      pageAttributes: attributes,
      rootRefs: [firstRootRef, secondRootRef],
      rootSubtreeHandles: [[], []],
    });
  });

  it('creates exact list through typed native create with slot-0 refs as listChildren', () => {
    const itemRef = { kind: 'item-ref' };
    const listRef = { kind: 'list-ref' };
    const handler = vi.fn();
    const attributes = {
      bindtap: handler,
      className: 'feed',
      id: 'typed-list',
    };
    createElementTemplate.mockReturnValueOnce(itemRef);
    createTypedElementTemplate.mockReturnValueOnce(listRef);

    const result = renderToElementTemplate(
      h('list', { attributes, $0: h('_et_item', { __listItemPlatformInfo: { 'item-key': 'a' } }) }),
    );

    expect(result.rootRefs).toEqual([listRef]);
    expect(result.rootSubtreeHandles).toEqual([[]]);
    expect(createElementTemplate).toHaveBeenCalledWith(
      '_et_item',
      null,
      null,
      null,
      -1,
    );
    expect(createElementTemplate.mock.invocationCallOrder[0]).toBeLessThan(
      createTypedElementTemplate.mock.invocationCallOrder[0]!,
    );
    const typedCreateCall = createTypedElementTemplate.mock.calls[0]!;
    expect(typedCreateCall[0]).toBe('list');
    expect(typedCreateCall[1]).toEqual({
      bindtap: '-2:0:bindtap',
      class: 'feed',
      id: 'typed-list',
      'component-at-index': expect.any(Function),
      'component-at-indexes': expect.any(Function),
      'enqueue-component': expect.any(Function),
    });
    expect(typedCreateCall[2]).toBe(null);
    expect(typedCreateCall[3]).toBe(-2);
    expect(typedCreateCall[4]).toEqual({ listChildren: [itemRef] });
    expect(flushInitialElementTemplateListUpdates()).toEqual([{
      uid: -2,
      attributes: {
        bindtap: '-2:0:bindtap',
        class: 'feed',
        id: 'typed-list',
        'component-at-index': expect.any(Function),
        'component-at-indexes': expect.any(Function),
        'enqueue-component': expect.any(Function),
        'update-list-info': {
          insertAction: [{ position: 0, type: '_et_item', 'item-key': 'a' }],
          removeAction: [],
          updateAction: [],
        },
      },
    }]);
    expect(elementTemplateRegistry.get(-1)).toBe(itemRef);
    expect(elementTemplateRegistry.get(-2)).toBe(listRef);
  });

  it('keeps compiled and typed attributes separate across nested hosts', () => {
    const itemRef = { kind: 'item-ref' };
    const listRef = { kind: 'list-ref' };
    const parentRef = { kind: 'parent-ref' };
    const handleTap = vi.fn();
    const parentAttributes = [handleTap, 'parent'];
    const itemAttributes = ['item'];
    const listAttributes = { id: 'feed', bindtap: handleTap };
    __etAttrPlanMap._et_parent = [0, adaptEventAttrSlot];
    createElementTemplate.mockReturnValueOnce(itemRef).mockReturnValueOnce(parentRef);
    createTypedElementTemplate.mockReturnValueOnce(listRef);

    const result = renderToElementTemplate(
      h('_et_parent', {
        attributeSlots: parentAttributes,
        $0: h('list', {
          attributes: listAttributes,
          $0: h('_et_item', {
            attributeSlots: itemAttributes,
            __listItemPlatformInfo: { 'item-key': 'a' },
          }),
        }),
      }),
    );

    expect(result.rootRefs).toEqual([parentRef]);
    expect(createElementTemplate).toHaveBeenNthCalledWith(1, '_et_item', null, itemAttributes, null, -1);
    expect(createTypedElementTemplate).toHaveBeenCalledWith(
      'list',
      {
        id: 'feed',
        bindtap: '-2:0:bindtap',
        'component-at-index': expect.any(Function),
        'component-at-indexes': expect.any(Function),
        'enqueue-component': expect.any(Function),
      },
      null,
      -2,
      { listChildren: [itemRef] },
    );
    expect(createElementTemplate).toHaveBeenNthCalledWith(
      2,
      '_et_parent',
      null,
      ['-3:0:', 'parent'],
      [[listRef]],
      -3,
    );
    expect(parentAttributes).toEqual([handleTap, 'parent']);
    expect(createElementTemplate.mock.calls[1]![2]).not.toBe(parentAttributes);
    expect(itemAttributes).toEqual(['item']);
    expect(listAttributes).toEqual({ id: 'feed', bindtap: handleTap });
    expect(addEvent).not.toHaveBeenCalled();
  });

  it('resets attribute payloads when siblings switch host types', () => {
    createElementTemplate.mockImplementation(type => ({ type }));
    createTypedElementTemplate.mockImplementation(type => ({ type }));

    renderToElementTemplate([
      h('_et_with_attrs', { attributeSlots: ['compiled'] }),
      h('list', {}),
      h('list', { attributes: { id: 'typed' } }),
      h('_et_without_attrs', {}),
    ]);

    expect(createElementTemplate).toHaveBeenNthCalledWith(1, '_et_with_attrs', null, ['compiled'], null, -1);
    expect(createTypedElementTemplate).toHaveBeenNthCalledWith(
      1,
      'list',
      {
        'component-at-index': expect.any(Function),
        'component-at-indexes': expect.any(Function),
        'enqueue-component': expect.any(Function),
      },
      null,
      -2,
      { listChildren: [] },
    );
    expect(createTypedElementTemplate).toHaveBeenNthCalledWith(
      2,
      'list',
      {
        id: 'typed',
        'component-at-index': expect.any(Function),
        'component-at-indexes': expect.any(Function),
        'enqueue-component': expect.any(Function),
      },
      null,
      -3,
      { listChildren: [] },
    );
    expect(createElementTemplate).toHaveBeenNthCalledWith(2, '_et_without_attrs', null, null, null, -4);
  });

  it('creates empty exact lists without logical children or typed attributes', () => {
    const listRef = { kind: 'list-ref' };
    createTypedElementTemplate.mockReturnValueOnce(listRef);

    const result = renderToElementTemplate(h('list', {}));

    expect(result.rootRefs).toEqual([listRef]);
    expect(result.rootSubtreeHandles).toEqual([[]]);
    expect(createTypedElementTemplate).toHaveBeenCalledWith(
      'list',
      {
        'component-at-index': expect.any(Function),
        'component-at-indexes': expect.any(Function),
        'enqueue-component': expect.any(Function),
      },
      null,
      -1,
      { listChildren: [] },
    );
    expect(flushInitialElementTemplateListUpdates()).toEqual([{
      uid: -1,
      attributes: {
        'component-at-index': expect.any(Function),
        'component-at-indexes': expect.any(Function),
        'enqueue-component': expect.any(Function),
        'update-list-info': {
          insertAction: [],
          removeAction: [],
          updateAction: [],
        },
      },
    }]);
  });

  it('installs first-screen list callbacks', () => {
    const itemARef = { kind: 'item-a-ref', __mockNativeId: 101 } as unknown as ElementTemplateHandle;
    const itemBRef = { kind: 'item-b-ref', __mockNativeId: 102 } as unknown as ElementTemplateHandle;
    const listRef = { kind: 'list-ref' } as unknown as ElementTemplateHandle;
    const materializedListRef = { kind: 'materialized-list-ref', __mockNativeId: 300 } as unknown as FiberElement;
    createElementTemplate
      .mockReturnValueOnce(itemARef)
      .mockReturnValueOnce(itemBRef);
    createTypedElementTemplate.mockReturnValueOnce(listRef);

    renderToElementTemplate(
      h('list', {
        attributes: {},
        $0: [
          h('_et_item_a', { __listItemPlatformInfo: { 'item-key': 'a' } }),
          h('_et_item_b', { __listItemPlatformInfo: { 'item-key': 'b' } }),
        ],
      }),
    );

    const attrs = createTypedElementTemplate.mock.calls[0]![1] as Record<string, (...args: unknown[]) => unknown>;
    const componentAtIndex = attrs['component-at-index']!;
    const componentAtIndexes = attrs['component-at-indexes']!;
    const enqueueComponent = attrs['enqueue-component']!;
    expect(componentAtIndex(materializedListRef, 9, 1, 72, true)).toBe(102);
    expect(insertNodeToElementTemplate).toHaveBeenLastCalledWith(
      listRef,
      0,
      itemBRef,
      null,
    );
    expect(flushElementTree).toHaveBeenLastCalledWith(itemBRef, {
      triggerLayout: true,
      operationID: 72,
      elementID: 102,
      listID: 9,
    });

    expect(componentAtIndex(materializedListRef, 9, 0, 71, true)).toBe(101);
    expect(insertNodeToElementTemplate).toHaveBeenLastCalledWith(
      listRef,
      0,
      itemARef,
      itemBRef,
    );
    expect(flushElementTree).toHaveBeenLastCalledWith(itemARef, {
      triggerLayout: true,
      operationID: 71,
      elementID: 101,
      listID: 9,
    });

    insertNodeToElementTemplate.mockClear();
    flushElementTree.mockClear();
    expect(() => componentAtIndex(materializedListRef, 9, 99, 73, true)).toThrow(
      'Element Template typed list item at index 99 was not found.',
    );
    expect(insertNodeToElementTemplate).not.toHaveBeenCalled();
    expect(flushElementTree).not.toHaveBeenCalled();

    expect(() => componentAtIndexes(materializedListRef, 9, [99], [84], false, true)).toThrow(
      'Element Template typed list item at index 99 was not found.',
    );
    expect(insertNodeToElementTemplate).not.toHaveBeenCalled();
    expect(flushElementTree).not.toHaveBeenCalled();

    enqueueComponent(materializedListRef, 9, 102);
    expect(removeNodeFromElementTemplate).toHaveBeenLastCalledWith(listRef, 0, itemBRef);
    expect(elementTemplateRegistry.get(-1)).toBe(itemARef);
    expect(elementTemplateRegistry.get(-2)).toBe(itemBRef);

    flushElementTree.mockClear();
    componentAtIndexes(materializedListRef, 9, [0, 1], [81, 82], true, false);
    expect(flushElementTree).toHaveBeenCalledWith(listRef, {
      triggerLayout: true,
      operationIDs: [81, 82],
      elementIDs: [101, 102],
      listID: 9,
    });
    expect(flushElementTree.mock.calls[0]![1]).not.toHaveProperty('listReuseNotification');

    enqueueComponent(materializedListRef, 9, 102);
    flushElementTree.mockClear();
    componentAtIndexes(materializedListRef, 9, [1], [83], true, true);
    expect(flushElementTree.mock.calls).toEqual([
      [itemBRef, { asyncFlush: true }],
      [listRef, {
        triggerLayout: true,
        operationIDs: [83],
        elementIDs: [102],
        listID: 9,
      }],
    ]);
  });

  it('prepares direct event slots before native create', () => {
    const rootRef = { kind: 'root-ref' };
    const handleTap = vi.fn();
    createElementTemplate.mockReturnValue(rootRef);
    __etAttrPlanMap._et_event = [
      0,
      adaptEventAttrSlot,
      2,
      adaptEventAttrSlot,
    ];

    const result = renderToElementTemplate(h('_et_event', { attributeSlots: [handleTap, 'title', 1] }));

    expect(result.rootRefs).toEqual([rootRef]);
    expect(createElementTemplate).toHaveBeenCalledWith(
      '_et_event',
      null,
      ['-1:0:', 'title', '-1:2:'],
      null,
      -1,
    );
    expect(addEvent).not.toHaveBeenCalled();
  });

  it('prepares attr plans when a template has no dynamic attribute slots', () => {
    const rootRef = { kind: 'root-ref' };
    createElementTemplate.mockReturnValue(rootRef);
    __etAttrPlanMap._et_event = [0, adaptEventAttrSlot];

    renderToElementTemplate(h('_et_event', {}));

    expect(createElementTemplate).toHaveBeenCalledWith(
      '_et_event',
      null,
      [null],
      null,
      -1,
    );
  });

  it('prepares empty direct event values as null before native create', () => {
    const rootRef = { kind: 'root-ref' };
    createElementTemplate.mockReturnValue(rootRef);
    __etAttrPlanMap._et_event = [
      0,
      adaptEventAttrSlot,
      1,
      adaptEventAttrSlot,
      2,
      adaptEventAttrSlot,
      3,
      adaptEventAttrSlot,
    ];

    renderToElementTemplate(h('_et_event', { attributeSlots: [null, undefined, false, true] }));

    expect(createElementTemplate).toHaveBeenCalledWith(
      '_et_event',
      null,
      [null, null, null, '-1:3:'],
      null,
      -1,
    );
    expect(addEvent).not.toHaveBeenCalled();
  });

  it('prepares direct ref values before native create', () => {
    const rootRef = { kind: 'root-ref' };
    const ref = vi.fn();
    createElementTemplate.mockReturnValue(rootRef);
    __etAttrPlanMap._et_ref = [0, adaptRefAttrSlot];

    renderToElementTemplate(h('_et_ref', { attributeSlots: [ref] }));

    expect(createElementTemplate).toHaveBeenCalledWith(
      '_et_ref',
      null,
      ['-1-0'],
      null,
      -1,
    );
    expect(ref).not.toHaveBeenCalled();
  });

  it('prepares spread event values before native create', () => {
    const rootRef = { kind: 'root-ref' };
    const handleTap = vi.fn();
    createElementTemplate.mockReturnValue(rootRef);
    __etAttrPlanMap._et_spread = [0, adaptSpreadAttrSlot];

    renderToElementTemplate(
      h('_et_spread', {
        attributeSlots: [{
          id: 'cta',
          className: 'primary',
          __self: 'debug-self',
          __source: { fileName: 'app.tsx' },
          bindtap: handleTap,
          catchtouchstart: false,
        }],
      }),
    );

    expect(createElementTemplate).toHaveBeenCalledWith(
      '_et_spread',
      null,
      [{ id: 'cta', class: 'primary', bindtap: '-1:0:bindtap', catchtouchstart: null }],
      null,
      -1,
    );
    expect(addEvent).not.toHaveBeenCalled();
  });

  it('prepares spread ref values before native create without leaking unsupported ref-like props', () => {
    const rootRef = { kind: 'root-ref' };
    const ref = vi.fn();
    createElementTemplate.mockReturnValue(rootRef);
    __etAttrPlanMap._et_spread = [0, adaptSpreadAttrSlot];

    renderToElementTemplate(
      h('_et_spread', { attributeSlots: [{ id: 'cta', ref, 'main-thread:ref': vi.fn(), 'worklet:ref': vi.fn() }] }),
    );

    expect(createElementTemplate).toHaveBeenCalledWith(
      '_et_spread',
      null,
      [{ id: 'cta', ref: '-1-0' }],
      null,
      -1,
    );
    expect(ref).not.toHaveBeenCalled();
  });
});
