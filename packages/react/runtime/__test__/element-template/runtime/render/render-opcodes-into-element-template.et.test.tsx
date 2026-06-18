// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, rstest } from '@rstest/core';

import { renderOpcodesIntoElementTemplate } from '../../../../src/element-template/runtime/render/render-opcodes.js';
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
import {
  __OpAttr,
  __OpBegin,
  __OpEnd,
  __OpSlot,
  __OpText,
} from '../../../../src/element-template/runtime/render/render-to-opcodes.js';

describe('renderOpcodesIntoElementTemplate', () => {
  const createElementTemplate = rstest.fn();
  const createTypedElementTemplate = rstest.fn();
  const getElementUniqueID = rstest.fn();
  const insertNodeToElementTemplate = rstest.fn();
  const removeNodeFromElementTemplate = rstest.fn();
  const flushElementTree = rstest.fn();
  const addEvent = rstest.fn();
  const onLifecycleEvent = rstest.fn();

  beforeEach(() => {
    createElementTemplate.mockReset();
    createTypedElementTemplate.mockReset();
    getElementUniqueID.mockReset();
    insertNodeToElementTemplate.mockReset();
    removeNodeFromElementTemplate.mockReset();
    flushElementTree.mockReset();
    addEvent.mockReset();
    onLifecycleEvent.mockReset();
    getElementUniqueID.mockImplementation((node: { __mockNativeId?: number }) => node.__mockNativeId);
    rstest.stubGlobal('__CreateElementTemplate', createElementTemplate);
    rstest.stubGlobal('__CreateTypedElementTemplate', createTypedElementTemplate);
    rstest.stubGlobal('__GetElementUniqueID', getElementUniqueID);
    rstest.stubGlobal('__InsertNodeToElementTemplate', insertNodeToElementTemplate);
    rstest.stubGlobal('__RemoveNodeFromElementTemplate', removeNodeFromElementTemplate);
    rstest.stubGlobal('__FlushElementTree', flushElementTree);
    rstest.stubGlobal('__AddEvent', addEvent);
    rstest.stubGlobal('__OnLifecycleEvent', onLifecycleEvent);
    elementTemplateRegistry.clear();
    destroyAllElementTemplateListStates();
    clearEtAttrPlanMap();
    resetTemplateId();
  });

  afterEach(() => {
    rstest.unstubAllGlobals();
    clearEtAttrPlanMap();
  });

  it('throws when popping the root frame', () => {
    expect(() => renderOpcodesIntoElementTemplate([__OpEnd])).toThrow(
      'Popped root frame',
    );
  });

  it('creates root text through the builtin raw-text template with a handle id', () => {
    const rootTextRef = { kind: 'text-ref' };
    createElementTemplate.mockReturnValue(rootTextRef);

    const result = renderOpcodesIntoElementTemplate([__OpText, 'hello']);

    expect(result.rootRefs).toEqual([rootTextRef]);
    expect(createElementTemplate).toHaveBeenCalledWith(
      '_et_builtin_raw_text',
      null,
      ['hello'],
      [],
      -1,
    );
    expect(elementTemplateRegistry.get(-1)).toBe(rootTextRef);
  });

  it('creates exact list through typed native create with slot-0 refs as listChildren', () => {
    const itemRef = { kind: 'item-ref' };
    const listRef = { kind: 'list-ref' };
    const attributes = { id: 'typed-list' };
    createElementTemplate.mockReturnValueOnce(itemRef);
    createTypedElementTemplate.mockReturnValueOnce(listRef);

    const result = renderOpcodesIntoElementTemplate([
      __OpBegin,
      { type: 'list' },
      __OpAttr,
      'typedAttributes',
      attributes,
      __OpSlot,
      0,
      __OpBegin,
      { type: '_et_item', props: { __listItemPlatformInfo: { 'item-key': 'a' } } },
      __OpEnd,
      __OpEnd,
    ]);

    expect(result.rootRefs).toEqual([listRef]);
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

  it('creates empty exact lists without logical children or typed attributes', () => {
    const listRef = { kind: 'list-ref' };
    createTypedElementTemplate.mockReturnValueOnce(listRef);

    const result = renderOpcodesIntoElementTemplate([
      __OpBegin,
      { type: 'list' },
      __OpEnd,
    ]);

    expect(result.rootRefs).toEqual([listRef]);
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

  it('installs Snapshot-aligned callbacks for first-screen typed list items', () => {
    const itemARef = { kind: 'item-a-ref', __mockNativeId: 101 };
    const itemBRef = { kind: 'item-b-ref', __mockNativeId: 102 };
    const listRef = { kind: 'list-ref', __mockNativeId: 200 };
    createElementTemplate
      .mockReturnValueOnce(itemARef)
      .mockReturnValueOnce(itemBRef);
    createTypedElementTemplate.mockReturnValueOnce(listRef);

    renderOpcodesIntoElementTemplate([
      __OpBegin,
      { type: 'list' },
      __OpAttr,
      'typedAttributes',
      {},
      __OpSlot,
      0,
      __OpBegin,
      { type: '_et_item_a', props: { __listItemPlatformInfo: { 'item-key': 'a' } } },
      __OpEnd,
      __OpBegin,
      { type: '_et_item_b', props: { __listItemPlatformInfo: { 'item-key': 'b' } } },
      __OpEnd,
      __OpEnd,
    ]);

    const attrs = createTypedElementTemplate.mock.calls[0]![1] as Record<string, (...args: unknown[]) => unknown>;
    const componentAtIndex = attrs['component-at-index']!;
    const componentAtIndexes = attrs['component-at-indexes']!;
    const enqueueComponent = attrs['enqueue-component']!;
    const materializedListRef = { kind: 'materialized-list-ref', __mockNativeId: 300 };

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

  it('rejects non-list-item roots in typed list logical children', () => {
    expect(() =>
      renderOpcodesIntoElementTemplate([
        __OpBegin,
        { type: 'list' },
        __OpSlot,
        0,
        __OpBegin,
        { type: '_et_view', props: {} },
        __OpEnd,
        __OpEnd,
      ])
    ).toThrow('Element Template typed list received a non-list-item root in logical slot $0.');
    expect(createElementTemplate).not.toHaveBeenCalled();
    expect(createTypedElementTemplate).not.toHaveBeenCalled();
  });

  it('rejects text roots in typed list logical children', () => {
    expect(() =>
      renderOpcodesIntoElementTemplate([
        __OpBegin,
        { type: 'list' },
        __OpSlot,
        0,
        __OpText,
        'row',
        __OpEnd,
      ])
    ).toThrow('Element Template typed list received text logical child.');
    expect(createElementTemplate).not.toHaveBeenCalled();
    expect(createTypedElementTemplate).not.toHaveBeenCalled();
  });

  it('rejects non-zero typed list logical slot opcodes in development', () => {
    expect(() =>
      renderOpcodesIntoElementTemplate([
        __OpBegin,
        { type: 'list' },
        __OpSlot,
        1,
        __OpBegin,
        { type: '_et_item', props: { __listItemPlatformInfo: { 'item-key': 'a' } } },
        __OpEnd,
        __OpEnd,
      ])
    ).toThrow('Element Template typed list only supports logical slot $0.');
    expect(createElementTemplate).not.toHaveBeenCalled();
    expect(createTypedElementTemplate).not.toHaveBeenCalled();
  });

  it('rejects deferred list item markers instead of entering Snapshot deferred flow', () => {
    expect(() =>
      renderOpcodesIntoElementTemplate([
        __OpBegin,
        { type: 'list' },
        __OpSlot,
        0,
        __OpBegin,
        {
          type: '_et_item',
          props: {
            __listItemPlatformInfo: { 'item-key': 'late' },
            isReady: 0,
          },
        },
        __OpEnd,
        __OpEnd,
      ])
    ).toThrow('Element Template typed list does not support deferred list items.');
    expect(createElementTemplate).not.toHaveBeenCalled();
    expect(createTypedElementTemplate).not.toHaveBeenCalled();
    expect(flushElementTree).not.toHaveBeenCalled();
    expect(onLifecycleEvent).not.toHaveBeenCalled();
  });

  it('prepares direct event slots before native create', () => {
    const rootRef = { kind: 'root-ref' };
    const handleTap = rstest.fn();
    createElementTemplate.mockReturnValue(rootRef);
    __etAttrPlanMap._et_event = [
      0,
      adaptEventAttrSlot,
      2,
      adaptEventAttrSlot,
    ];

    const result = renderOpcodesIntoElementTemplate([
      __OpBegin,
      { type: '_et_event' },
      __OpAttr,
      'attributeSlots',
      [handleTap, 'title', 1],
      __OpEnd,
    ]);

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

    renderOpcodesIntoElementTemplate([
      __OpBegin,
      { type: '_et_event' },
      __OpEnd,
    ]);

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

    renderOpcodesIntoElementTemplate([
      __OpBegin,
      { type: '_et_event' },
      __OpAttr,
      'attributeSlots',
      [null, undefined, false, true],
      __OpEnd,
    ]);

    expect(createElementTemplate).toHaveBeenCalledWith(
      '_et_event',
      null,
      [null, null, null, '-1:3:'],
      null,
      -1,
    );
    expect(addEvent).not.toHaveBeenCalled();
  });

  it('prepares attr plan slots when the opcode omits attributeSlots', () => {
    const rootRef = { kind: 'root-ref' };
    createElementTemplate.mockReturnValue(rootRef);
    __etAttrPlanMap._et_event = [0, adaptEventAttrSlot];

    renderOpcodesIntoElementTemplate([
      __OpBegin,
      { type: '_et_event' },
      __OpEnd,
    ]);

    expect(createElementTemplate).toHaveBeenCalledWith(
      '_et_event',
      null,
      [null],
      null,
      -1,
    );
  });

  it('prepares direct ref values before native create', () => {
    const rootRef = { kind: 'root-ref' };
    const ref = rstest.fn();
    createElementTemplate.mockReturnValue(rootRef);
    __etAttrPlanMap._et_ref = [0, adaptRefAttrSlot];

    renderOpcodesIntoElementTemplate([
      __OpBegin,
      { type: '_et_ref' },
      __OpAttr,
      'attributeSlots',
      [ref],
      __OpEnd,
    ]);

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
    const handleTap = rstest.fn();
    createElementTemplate.mockReturnValue(rootRef);
    __etAttrPlanMap._et_spread = [0, adaptSpreadAttrSlot];

    renderOpcodesIntoElementTemplate([
      __OpBegin,
      { type: '_et_spread' },
      __OpAttr,
      'attributeSlots',
      [{
        id: 'cta',
        className: 'primary',
        __self: 'debug-self',
        __source: { fileName: 'app.tsx' },
        bindtap: handleTap,
        catchtouchstart: false,
      }],
      __OpEnd,
    ]);

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
    const ref = rstest.fn();
    createElementTemplate.mockReturnValue(rootRef);
    __etAttrPlanMap._et_spread = [0, adaptSpreadAttrSlot];

    renderOpcodesIntoElementTemplate([
      __OpBegin,
      { type: '_et_spread' },
      __OpAttr,
      'attributeSlots',
      [{
        id: 'cta',
        ref,
        'main-thread:ref': rstest.fn(),
        'worklet:ref': rstest.fn(),
      }],
      __OpEnd,
    ]);

    expect(createElementTemplate).toHaveBeenCalledWith(
      '_et_spread',
      null,
      [{ id: 'cta', ref: '-1-0' }],
      null,
      -1,
    );
    expect(ref).not.toHaveBeenCalled();
  });

  it('throws when text is emitted outside of an element slot', () => {
    expect(() =>
      renderOpcodesIntoElementTemplate([
        __OpBegin,
        { type: '_et_parent' },
        __OpText,
        'hello',
        __OpEnd,
      ])
    ).toThrow('Template \'_et_parent\' received a text child outside of any element slot.');
  });

  it('throws when an element child is emitted outside of an element slot', () => {
    expect(() =>
      renderOpcodesIntoElementTemplate([
        __OpBegin,
        { type: '_et_parent' },
        __OpBegin,
        { type: '_et_child' },
        __OpSlot,
        0,
        __OpEnd,
        __OpEnd,
      ])
    ).toThrow('Template \'_et_parent\' received a child outside of any element slot.');
  });

  it('throws on unknown opcodes', () => {
    expect(() => renderOpcodesIntoElementTemplate([999])).toThrow(
      'Unknown opcode: 999',
    );
  });
});
