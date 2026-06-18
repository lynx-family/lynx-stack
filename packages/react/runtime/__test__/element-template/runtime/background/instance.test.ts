// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, describe, expect, it, rstest } from '@rstest/core';

import { globalCommitContext } from '../../../../src/element-template/background/commit-context.js';
import {
  markElementTemplateHydrated,
  resetElementTemplateCommitState,
} from '../../../../src/element-template/background/commit-hook.js';
import { destroyElementTemplateBackgroundRuntime } from '../../../../src/element-template/background/destroy.js';
import { setupBackgroundElementTemplateDocument } from '../../../../src/element-template/background/document.js';
import {
  BackgroundElementTemplateInstance,
  BackgroundListElementTemplateInstance,
  BackgroundTypedElementTemplateInstance,
  BUILTIN_RAW_TEXT_TEMPLATE_KEY,
} from '../../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../../src/element-template/background/manager.js';
import { clearEventState, getEventHandlerForEventValue } from '../../../../src/element-template/prop-adapters/event.js';
import { ElementTemplateUpdateOps } from '../../../../src/element-template/protocol/opcodes.js';
import {
  __etAttrPlanMap,
  adaptEventAttrSlot,
  adaptRefAttrSlot,
  adaptSpreadAttrSlot,
  clearEtAttrPlanMap,
} from '../../../../src/element-template/runtime/template/attr-slot-plan.js';
import { clearRefState, flushPendingRefs } from '../../../../src/element-template/prop-adapters/ref.js';

function createTextNode(text: string): BackgroundElementTemplateInstance {
  return new BackgroundElementTemplateInstance(BUILTIN_RAW_TEXT_TEMPLATE_KEY, [text]);
}

describe('BackgroundElementTemplateInstance', () => {
  beforeEach(() => {
    globalThis.__MAIN_THREAD__ = false;
    globalThis.__BACKGROUND__ = true;
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;
    clearEtAttrPlanMap();
    clearEventState();
    clearRefState();
    resetElementTemplateCommitState();
  });

  it('should create an instance with correct type and id', () => {
    const instance = new BackgroundElementTemplateInstance('view');
    expect(instance.type).toBe('view');
    expect(instance.instanceId).toBe(1);
  });

  it('should increment id for new instances', () => {
    const instance1 = new BackgroundElementTemplateInstance('view');
    const instance2 = new BackgroundElementTemplateInstance('text');
    expect(instance1.instanceId).toBe(1);
    expect(instance2.instanceId).toBe(2);
  });

  it('does not emit create before hydration', () => {
    globalCommitContext.ops = [];

    new BackgroundElementTemplateInstance('image', ['logo.png']);

    expect(globalCommitContext.ops).toEqual([]);
  });

  it('creates exact list hosts through the list-specific background instance', () => {
    const doc = setupBackgroundElementTemplateDocument();

    expect(doc.createElement('list')).toBeInstanceOf(BackgroundListElementTemplateInstance);
    expect(doc.createElement('list')).toBeInstanceOf(BackgroundTypedElementTemplateInstance);
    expect(doc.createElement('_et_item')).toBeInstanceOf(BackgroundElementTemplateInstance);
    expect(doc.createElement('_et_item')).not.toBeInstanceOf(BackgroundTypedElementTemplateInstance);
  });

  it('emits exact list create as typed holder with logical children in command options', () => {
    const list = new BackgroundListElementTemplateInstance();
    const item = new BackgroundElementTemplateInstance('_et_list_item');
    list.setAttribute('attributes', { id: 'feed' });
    list.appendChild(item);
    globalCommitContext.ops = [];

    list.emitCreate();

    expect(globalCommitContext.ops).toEqual([
      ElementTemplateUpdateOps.createTypedElement,
      list.instanceId,
      'list',
      { id: 'feed' },
      null,
      {
        listChildren: [{
          __etHandleRef: item.instanceId,
          type: '_et_list_item',
          platformInfo: {},
        }],
      },
    ]);
  });

  it('emits generic typed element create with standard attribute slots and no runtime options', () => {
    const typed = new BackgroundTypedElementTemplateInstance('x-host');
    typed.setAttribute('attributeSlots', ['title']);
    globalCommitContext.ops = [];

    typed.emitCreate();

    expect(globalCommitContext.ops).toEqual([
      ElementTemplateUpdateOps.createTypedElement,
      typed.instanceId,
      'x-host',
      null,
      null,
      null,
    ]);

    globalCommitContext.ops = [];
    typed.emitCreate();

    expect(globalCommitContext.ops).toEqual([]);
  });

  it('reports illegal typed element handle ids on create', () => {
    const oldReportError = lynx.reportError;
    const reportError = rstest.fn();
    lynx.reportError = reportError;

    try {
      const typed = new BackgroundTypedElementTemplateInstance('x-host');
      typed.instanceId = 0;
      globalCommitContext.ops = [];

      typed.emitCreate();

      expect(globalCommitContext.ops).toEqual([]);
      expect(String(reportError.mock.calls[0]?.[0]?.message ?? '')).toContain('illegal handleId 0');
    } finally {
      lynx.reportError = oldReportError;
      (globalThis as { __LYNX_REPORT_ERROR_CALLS?: Error[] }).__LYNX_REPORT_ERROR_CALLS = [];
    }
  });

  it('patches hydrated typed attributes through slot 0', () => {
    const list = new BackgroundListElementTemplateInstance();
    const oldListId = list.instanceId;
    backgroundElementTemplateInstanceManager.updateId(oldListId, -10);
    list.markMaterializedByHydration();
    markElementTemplateHydrated();
    globalCommitContext.ops = [];

    list.setAttribute('attributes', { id: 'next' });

    expect(globalCommitContext.ops).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      -10,
      0,
      { id: 'next' },
    ]);
  });

  it('emits logical list insertions as incremental typed list item patches', () => {
    const list = new BackgroundListElementTemplateInstance();
    const oldListId = list.instanceId;
    backgroundElementTemplateInstanceManager.updateId(oldListId, -10);
    list.markMaterializedByHydration();
    const first = new BackgroundElementTemplateInstance('_et_item_a');
    first.setAttribute('__listItemPlatformInfo', { 'item-key': 'a' });
    list.appendChild(first);
    const oldFirstId = first.instanceId;
    backgroundElementTemplateInstanceManager.updateId(oldFirstId, -11);
    first.markMaterializedByHydration();
    const second = new BackgroundElementTemplateInstance('_et_item_b');
    second.setAttribute('__listItemPlatformInfo', { 'item-key': 'b' });
    markElementTemplateHydrated();
    globalCommitContext.ops = [];

    list.insertBefore(second, first);

    expect(globalCommitContext.ops).toEqual([
      ElementTemplateUpdateOps.createTemplate,
      second.instanceId,
      '_et_item_b',
      null,
      [],
      [],
      ElementTemplateUpdateOps.insertTypedListItem,
      -10,
      {
        __etHandleRef: second.instanceId,
        type: '_et_item_b',
        platformInfo: { 'item-key': 'b' },
      },
      -11,
    ]);
  });

  it('emits logical list updates when list item platform info changes', () => {
    const list = new BackgroundListElementTemplateInstance();
    const oldListId = list.instanceId;
    backgroundElementTemplateInstanceManager.updateId(oldListId, -10);
    list.markMaterializedByHydration();
    const item = new BackgroundElementTemplateInstance('_et_item_a');
    item.setAttribute('__listItemPlatformInfo', { 'item-key': 'a' });
    list.appendChild(item);
    const oldItemId = item.instanceId;
    backgroundElementTemplateInstanceManager.updateId(oldItemId, -11);
    item.markMaterializedByHydration();
    markElementTemplateHydrated();
    globalCommitContext.ops = [];

    item.setAttribute('__listItemPlatformInfo', { 'item-key': 'a', 'estimated-height': 42 });

    expect(globalCommitContext.ops).toEqual([
      ElementTemplateUpdateOps.updateTypedListItem,
      -10,
      {
        __etHandleRef: -11,
        type: '_et_item_a',
        platformInfo: { 'item-key': 'a', 'estimated-height': 42 },
      },
    ]);
  });

  it('keeps typed list item remove and update silent before hydration', () => {
    const list = new BackgroundListElementTemplateInstance();
    backgroundElementTemplateInstanceManager.updateId(list.instanceId, -10);
    list.markMaterializedByHydration();
    const item = new BackgroundElementTemplateInstance('_et_item_a');
    list.appendChild(item);
    backgroundElementTemplateInstanceManager.updateId(item.instanceId, -11);
    item.markMaterializedByHydration();
    globalCommitContext.ops = [];

    item.setAttribute('__listItemPlatformInfo', { 'item-key': 'a' });
    list.removeChild(item);

    expect(globalCommitContext.ops).toEqual([]);
  });

  it('queues lifetime cleanup when logically removing a hydrated list item', () => {
    const cleanup = rstest.fn();
    const ref = rstest.fn(() => cleanup);
    __etAttrPlanMap._et_item_a = [0, adaptRefAttrSlot];
    const list = new BackgroundListElementTemplateInstance();
    backgroundElementTemplateInstanceManager.updateId(list.instanceId, -10);
    list.markMaterializedByHydration();
    const item = new BackgroundElementTemplateInstance('_et_item_a');
    list.appendChild(item);
    backgroundElementTemplateInstanceManager.updateId(item.instanceId, -11);
    item.markMaterializedByHydration();
    markElementTemplateHydrated();
    item.setAttribute('attributeSlots', [ref]);
    flushPendingRefs();
    ref.mockClear();
    globalCommitContext.ops = [];

    list.removeChild(item);
    flushPendingRefs();

    expect(globalCommitContext.ops).toEqual([
      ElementTemplateUpdateOps.removeTypedListItem,
      -10,
      -11,
      [-11],
    ]);
    expect(globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown).toEqual([item]);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(ref).not.toHaveBeenCalled();
  });

  it('keeps silent list removals out of lifetime cleanup', () => {
    const list = new BackgroundListElementTemplateInstance();
    backgroundElementTemplateInstanceManager.updateId(list.instanceId, -10);
    list.markMaterializedByHydration();
    const item = new BackgroundElementTemplateInstance('_et_item_a');
    list.appendChild(item);
    backgroundElementTemplateInstanceManager.updateId(item.instanceId, -11);
    item.markMaterializedByHydration();
    markElementTemplateHydrated();
    globalCommitContext.ops = [];

    list.removeChild(item, true);

    expect(globalCommitContext.ops).toEqual([]);
    expect(globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown).toEqual([]);
  });

  it('emits logical updates for both lists when an item moves across typed lists', () => {
    const oldList = new BackgroundListElementTemplateInstance();
    const newList = new BackgroundListElementTemplateInstance();
    backgroundElementTemplateInstanceManager.updateId(oldList.instanceId, -10);
    backgroundElementTemplateInstanceManager.updateId(newList.instanceId, -20);
    oldList.markMaterializedByHydration();
    newList.markMaterializedByHydration();
    const item = new BackgroundElementTemplateInstance('_et_item_a');
    item.setAttribute('__listItemPlatformInfo', { 'item-key': 'a' });
    oldList.appendChild(item);
    backgroundElementTemplateInstanceManager.updateId(item.instanceId, -11);
    item.markMaterializedByHydration();
    markElementTemplateHydrated();
    globalCommitContext.ops = [];

    newList.appendChild(item);

    expect(globalCommitContext.ops).toEqual([
      ElementTemplateUpdateOps.removeTypedListItem,
      -10,
      -11,
      [],
      ElementTemplateUpdateOps.insertTypedListItem,
      -20,
      {
        __etHandleRef: -11,
        type: '_et_item_a',
        platformInfo: { 'item-key': 'a' },
      },
      0,
    ]);
  });

  it('emits incremental list mutations instead of full children snapshots during one render', () => {
    const list = new BackgroundListElementTemplateInstance();
    backgroundElementTemplateInstanceManager.updateId(list.instanceId, -10);
    list.markMaterializedByHydration();
    const first = new BackgroundElementTemplateInstance('_et_item_a');
    const second = new BackgroundElementTemplateInstance('_et_item_b');
    const third = new BackgroundElementTemplateInstance('_et_item_c');
    list.appendChild(first);
    list.appendChild(second);
    backgroundElementTemplateInstanceManager.updateId(first.instanceId, -11);
    backgroundElementTemplateInstanceManager.updateId(second.instanceId, -12);
    first.markMaterializedByHydration();
    second.markMaterializedByHydration();
    markElementTemplateHydrated();
    globalCommitContext.ops = [];

    list.insertBefore(third, second);
    list.removeChild(first);
    second.setAttribute('__listItemPlatformInfo', { 'item-key': 'b', 'full-span': true });

    expect(globalCommitContext.ops).toEqual([
      ElementTemplateUpdateOps.createTemplate,
      third.instanceId,
      '_et_item_c',
      null,
      [],
      [],
      ElementTemplateUpdateOps.insertTypedListItem,
      -10,
      {
        __etHandleRef: third.instanceId,
        type: '_et_item_c',
        platformInfo: {},
      },
      -12,
      ElementTemplateUpdateOps.removeTypedListItem,
      -10,
      -11,
      [-11],
      ElementTemplateUpdateOps.updateTypedListItem,
      -10,
      {
        __etHandleRef: -12,
        type: '_et_item_b',
        platformInfo: { 'item-key': 'b', 'full-span': true },
      },
    ]);
  });

  it('exposes DOM-compatible tree accessors for Preact removal paths', () => {
    const parent = new BackgroundElementTemplateInstance('view');
    const child = new BackgroundElementTemplateInstance('image');
    parent.appendChild(child);

    expect(parent.childNodes).toEqual([child]);

    markElementTemplateHydrated();
    parent.markMaterializedByHydration();
    child.markMaterializedByHydration();
    globalCommitContext.ops = [];
    child.parentNode?.removeChild(child);

    expect(parent.childNodes).toEqual([]);
    expect(child.parentNode).toBeNull();
    expect(parent.elementSlots[0]).toBeUndefined();
    expect(globalCommitContext.ops).toEqual([
      4,
      parent.instanceId,
      0,
      child.instanceId,
      [child.instanceId],
    ]);
  });

  describe('appendChild', () => {
    it('should append child correctly', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const child = new BackgroundElementTemplateInstance('text');
      parent.appendChild(child);

      expect(parent.firstChild).toBe(child);
      expect(parent.lastChild).toBe(child);
      expect(child.parent).toBe(parent);
    });

    it('should append multiple children correctly', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const child1 = new BackgroundElementTemplateInstance('text');
      const child2 = new BackgroundElementTemplateInstance('image');

      parent.appendChild(child1);
      parent.appendChild(child2);

      expect(parent.firstChild).toBe(child1);
      expect(parent.lastChild).toBe(child2);
      expect(child1.nextSibling).toBe(child2);
      expect(child2.previousSibling).toBe(child1);
    });

    it('should reparent child from old parent', () => {
      const parent1 = new BackgroundElementTemplateInstance('view');
      const parent2 = new BackgroundElementTemplateInstance('view');
      const child = new BackgroundElementTemplateInstance('text');

      parent1.appendChild(child);
      parent2.appendChild(child);

      expect(parent1.firstChild).toBeNull();
      expect(parent1.lastChild).toBeNull();
      expect(parent2.firstChild).toBe(child);
      expect(parent2.lastChild).toBe(child);
      expect(child.parent).toBe(parent2);
    });
  });

  describe('insertBefore', () => {
    it('should insert before existing child', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const child1 = new BackgroundElementTemplateInstance('text');
      const child2 = new BackgroundElementTemplateInstance('image');

      parent.appendChild(child1);
      parent.insertBefore(child2, child1);

      expect(parent.firstChild).toBe(child2);
      expect(parent.lastChild).toBe(child1);
      expect(child2.nextSibling).toBe(child1);
      expect(child1.previousSibling).toBe(child2);
    });

    it('should append if beforeChild is null', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const child = new BackgroundElementTemplateInstance('text');
      parent.insertBefore(child, null);

      expect(parent.firstChild).toBe(child);
      expect(parent.lastChild).toBe(child);
    });

    it('supports silent append on regular parents', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const child = new BackgroundElementTemplateInstance('text');
      globalCommitContext.ops = [];

      parent.insertBefore(child, null, true);

      expect(parent.firstChild).toBe(child);
      expect(globalCommitContext.ops).toEqual([]);
    });

    it('emits create with initialized attrs before inserting a post-hydration template', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      parent.emitCreate();

      markElementTemplateHydrated();
      globalCommitContext.ops = [];

      const child = new BackgroundElementTemplateInstance('image');
      child.setAttribute('attributeSlots', ['logo.png']);

      expect(globalCommitContext.ops).toEqual([]);

      parent.appendChild(child);

      expect(globalCommitContext.ops).toEqual([
        1,
        child.instanceId,
        'image',
        null,
        ['logo.png'],
        [],
        3,
        parent.instanceId,
        0,
        child.instanceId,
        0,
      ]);
    });

    it('queues direct ref attach when inserting a post-hydration template', () => {
      const ref = rstest.fn();
      __etAttrPlanMap.view = [0, adaptRefAttrSlot];
      const parent = new BackgroundElementTemplateInstance('view');
      parent.emitCreate();

      markElementTemplateHydrated();
      globalCommitContext.ops = [];

      const child = new BackgroundElementTemplateInstance('view');
      child.setAttribute('attributeSlots', [ref]);
      parent.appendChild(child);
      flushPendingRefs();

      expect(globalCommitContext.ops).toEqual([
        1,
        child.instanceId,
        'view',
        null,
        [`${child.instanceId}-0`],
        [],
        3,
        parent.instanceId,
        0,
        child.instanceId,
        0,
      ]);
      expect(ref).toHaveBeenCalledWith(expect.objectContaining({
        selector: `[ref=${child.instanceId}-0]`,
      }));
    });

    it('does not detach refs that never attached on a post-hydration unmaterialized subtree', () => {
      // Regression: post-hydration `setAttribute` runs with
      // ref publishing disabled on unmaterialized children (attach is deferred
      // to `emitCreate`). If `removeChild` unconditionally queues a cleanup,
      // the ref observes a spurious detach for an attach that never fired.
      const ref = rstest.fn();
      __etAttrPlanMap.view = [0, adaptRefAttrSlot];
      markElementTemplateHydrated();
      const parent = new BackgroundElementTemplateInstance('view');
      const child = new BackgroundElementTemplateInstance('view');
      child.setAttribute('attributeSlots', [ref]);
      parent.appendChild(child);
      flushPendingRefs();
      expect(ref).not.toHaveBeenCalled();

      parent.removeChild(child);
      flushPendingRefs();

      expect(ref).not.toHaveBeenCalled();
    });

    it('does not re-attach stable direct refs when moving an existing hydrated child', () => {
      const ref = rstest.fn();
      __etAttrPlanMap.view = [0, adaptRefAttrSlot];
      const parent = new BackgroundElementTemplateInstance('view');
      const before = new BackgroundElementTemplateInstance('view');
      const child = new BackgroundElementTemplateInstance('view');
      child.setAttribute('attributeSlots', [ref]);
      parent.appendChild(before);
      parent.appendChild(child);

      markElementTemplateHydrated();
      parent.markMaterializedByHydration();
      before.markMaterializedByHydration();
      child.markMaterializedByHydration();
      child.prepareAttributeSlotsForNative();
      flushPendingRefs();
      ref.mockClear();
      globalCommitContext.ops = [];

      parent.insertBefore(child, before);
      flushPendingRefs();

      expect(globalCommitContext.ops).toEqual([
        3,
        parent.instanceId,
        0,
        child.instanceId,
        before.instanceId,
      ]);
      expect(ref).not.toHaveBeenCalled();
    });

    it('defers nested slot inserts until the owner template is created', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      parent.emitCreate();

      markElementTemplateHydrated();
      globalCommitContext.ops = [];

      const owner = new BackgroundElementTemplateInstance('view');
      const nested = createTextNode('nested');
      owner.appendChild(nested);

      expect(globalCommitContext.ops).toEqual([]);

      parent.appendChild(owner);

      expect(globalCommitContext.ops).toEqual([
        1,
        nested.instanceId,
        BUILTIN_RAW_TEXT_TEMPLATE_KEY,
        null,
        ['nested'],
        [],
        1,
        owner.instanceId,
        'view',
        null,
        [],
        [[nested.instanceId]],
        3,
        parent.instanceId,
        0,
        owner.instanceId,
        0,
      ]);
    });

    it('skips sparse child slots when creating a post-hydration template recursively', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      parent.emitCreate();

      markElementTemplateHydrated();
      globalCommitContext.ops = [];

      const grandchild = new BackgroundElementTemplateInstance('view');
      grandchild.__slotIndex = 1;
      const child = new BackgroundElementTemplateInstance('view');
      child.appendChild(grandchild);

      parent.appendChild(child);

      const serializedSlots = globalCommitContext.ops[11] as unknown[];
      expect(globalCommitContext.ops[6]).toBe(1);
      expect(globalCommitContext.ops[7]).toBe(child.instanceId);
      expect(serializedSlots).toHaveLength(2);
      expect(0 in serializedSlots).toBe(false);
      expect(1 in serializedSlots).toBe(true);
      expect(serializedSlots[1]).toEqual([grandchild.instanceId]);
      expect(globalCommitContext.ops.slice(12)).toEqual([
        3,
        parent.instanceId,
        0,
        child.instanceId,
        0,
      ]);
    });

    it('should move existing child if re-inserted', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const child1 = new BackgroundElementTemplateInstance('text');
      const child2 = new BackgroundElementTemplateInstance('image');

      parent.appendChild(child1);
      parent.appendChild(child2);
      // Move child2 before child1
      parent.insertBefore(child2, child1);

      expect(parent.firstChild).toBe(child2);
      expect(parent.lastChild).toBe(child1);
      expect(child2.nextSibling).toBe(child1);
    });

    it('should insert between two nodes', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const child1 = new BackgroundElementTemplateInstance('text');
      const child2 = new BackgroundElementTemplateInstance('image');
      const child3 = new BackgroundElementTemplateInstance('view');

      parent.appendChild(child1);
      parent.appendChild(child2);

      // Insert child3 before child2. child2 has previousSibling child1.
      parent.insertBefore(child3, child2);

      expect(parent.firstChild).toBe(child1);
      expect(parent.lastChild).toBe(child2);
      expect(child1.nextSibling).toBe(child3);
      expect(child3.nextSibling).toBe(child2);
      expect(child3.previousSibling).toBe(child1);
      expect(child2.previousSibling).toBe(child3);
    });

    it('should reparent child before target in new parent', () => {
      const parent1 = new BackgroundElementTemplateInstance('view');
      const parent2 = new BackgroundElementTemplateInstance('view');
      const child1 = new BackgroundElementTemplateInstance('text');
      const child2 = new BackgroundElementTemplateInstance('image');
      const mover = new BackgroundElementTemplateInstance('view');

      parent1.appendChild(mover);
      parent2.appendChild(child1);
      parent2.appendChild(child2);

      parent2.insertBefore(mover, child2);

      expect(parent1.firstChild).toBeNull();
      expect(parent1.lastChild).toBeNull();
      expect(parent2.firstChild).toBe(child1);
      expect(child1.nextSibling).toBe(mover);
      expect(mover.nextSibling).toBe(child2);
      expect(child2.previousSibling).toBe(mover);
      expect(mover.parent).toBe(parent2);
    });

    it('should reject a reference node from another parent', () => {
      const parent1 = new BackgroundElementTemplateInstance('view');
      const parent2 = new BackgroundElementTemplateInstance('view');
      const child = new BackgroundElementTemplateInstance('text');
      const foreign = new BackgroundElementTemplateInstance('image');

      parent1.appendChild(child);
      parent2.appendChild(foreign);

      expect(() => parent1.insertBefore(child, foreign)).toThrow(
        'Reference node is not a child of this parent',
      );
    });

    it('should reject inserting a node before itself', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const child = new BackgroundElementTemplateInstance('text');
      parent.appendChild(child);

      expect(() => parent.insertBefore(child, child)).toThrow(
        'Cannot insert a node before itself',
      );
    });

    it('emits beforeId=0 when the reference child lives in a different slot', () => {
      // Slot ordering is per-slot, so a beforeChild from another slot has no
      // meaning for the new child's position. Falling back to 0 keeps the
      // main-thread insert as an append within the destination slot.
      const parent = new BackgroundElementTemplateInstance('view');
      const slot0Anchor = new BackgroundElementTemplateInstance('view');
      slot0Anchor.__slotIndex = 0;
      parent.appendChild(slot0Anchor);

      markElementTemplateHydrated();
      parent.markMaterializedByHydration();
      slot0Anchor.markMaterializedByHydration();
      globalCommitContext.ops = [];

      const newChild = new BackgroundElementTemplateInstance('text');
      newChild.__slotIndex = 1;

      parent.insertBefore(newChild, slot0Anchor);

      expect(globalCommitContext.ops).toEqual([
        ElementTemplateUpdateOps.createTemplate,
        newChild.instanceId,
        'text',
        null,
        [],
        [],
        ElementTemplateUpdateOps.insertNode,
        parent.instanceId,
        1,
        newChild.instanceId,
        0,
      ]);
    });

    it('keeps beforeId pointing at the reference child when slots match', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const anchor = new BackgroundElementTemplateInstance('view');
      anchor.__slotIndex = 1;
      parent.appendChild(anchor);

      markElementTemplateHydrated();
      parent.markMaterializedByHydration();
      anchor.markMaterializedByHydration();
      globalCommitContext.ops = [];

      const newChild = new BackgroundElementTemplateInstance('text');
      newChild.__slotIndex = 1;

      parent.insertBefore(newChild, anchor);

      expect(globalCommitContext.ops).toEqual([
        ElementTemplateUpdateOps.createTemplate,
        newChild.instanceId,
        'text',
        null,
        [],
        [],
        ElementTemplateUpdateOps.insertNode,
        parent.instanceId,
        1,
        newChild.instanceId,
        anchor.instanceId,
      ]);
    });

    it('does not emit create for a root-handle child inserted after hydration', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      parent.emitCreate();
      markElementTemplateHydrated();

      const child = new BackgroundElementTemplateInstance('root');
      backgroundElementTemplateInstanceManager.values.delete(child.instanceId);
      child.instanceId = 0;
      globalCommitContext.ops = [];

      parent.appendChild(child);

      expect(globalCommitContext.ops).toHaveLength(5);
      expect(globalCommitContext.ops[0]).toBe(ElementTemplateUpdateOps.insertNode);
      expect(backgroundElementTemplateInstanceManager.get(0)).toBeUndefined();
    });

    it('recreates a detached materialized subtree before reattaching it', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const child = new BackgroundElementTemplateInstance('view');
      const grandchild = createTextNode('inside');
      child.appendChild(grandchild);
      parent.appendChild(child);

      markElementTemplateHydrated();
      parent.markMaterializedByHydration();
      child.markMaterializedByHydration();
      grandchild.markMaterializedByHydration();
      globalCommitContext.ops = [];

      parent.removeChild(child);
      expect(globalCommitContext.ops).toEqual([
        ElementTemplateUpdateOps.removeNode,
        parent.instanceId,
        0,
        child.instanceId,
        [child.instanceId, grandchild.instanceId],
      ]);

      globalCommitContext.ops = [];
      parent.appendChild(child);

      expect(globalCommitContext.ops).toEqual([
        ElementTemplateUpdateOps.createTemplate,
        grandchild.instanceId,
        BUILTIN_RAW_TEXT_TEMPLATE_KEY,
        null,
        ['inside'],
        [],
        ElementTemplateUpdateOps.createTemplate,
        child.instanceId,
        'view',
        null,
        [],
        [[grandchild.instanceId]],
        ElementTemplateUpdateOps.insertNode,
        parent.instanceId,
        0,
        child.instanceId,
        0,
      ]);
    });

    it('recreates detached hydrated subtrees with native negative handles', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const child = new BackgroundElementTemplateInstance('view');
      const grandchild = createTextNode('inside');
      child.appendChild(grandchild);
      parent.appendChild(child);
      backgroundElementTemplateInstanceManager.updateId(child.instanceId, -2);
      backgroundElementTemplateInstanceManager.updateId(grandchild.instanceId, -3);

      markElementTemplateHydrated();
      parent.markMaterializedByHydration();
      child.markMaterializedByHydration();
      grandchild.markMaterializedByHydration();

      parent.removeChild(child);
      globalCommitContext.ops = [];
      parent.appendChild(child);

      expect(globalCommitContext.ops).toEqual([
        ElementTemplateUpdateOps.createTemplate,
        -3,
        BUILTIN_RAW_TEXT_TEMPLATE_KEY,
        null,
        ['inside'],
        [],
        ElementTemplateUpdateOps.createTemplate,
        -2,
        'view',
        null,
        [],
        [[-3]],
        ElementTemplateUpdateOps.insertNode,
        parent.instanceId,
        0,
        -2,
        0,
      ]);
    });
  });

  describe('removeChild', () => {
    it('should remove child correctly', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const child = new BackgroundElementTemplateInstance('text');
      parent.appendChild(child);
      parent.removeChild(child);

      expect(parent.firstChild).toBeNull();
      expect(parent.lastChild).toBeNull();
      expect(child.parent).toBeNull();
    });

    it('should update siblings when removing middle child', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const child1 = new BackgroundElementTemplateInstance('text');
      const child2 = new BackgroundElementTemplateInstance('image');
      const child3 = new BackgroundElementTemplateInstance('view');

      parent.appendChild(child1);
      parent.appendChild(child2);
      parent.appendChild(child3);

      parent.removeChild(child2);

      expect(child1.nextSibling).toBe(child3);
      expect(child3.previousSibling).toBe(child1);
      expect(parent.firstChild).toBe(child1);
      expect(parent.lastChild).toBe(child3);
    });

    it('should update head when removing first child', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const child1 = new BackgroundElementTemplateInstance('text');
      const child2 = new BackgroundElementTemplateInstance('image');

      parent.appendChild(child1);
      parent.appendChild(child2);

      parent.removeChild(child1);

      expect(parent.firstChild).toBe(child2);
      expect(parent.lastChild).toBe(child2);
      expect(child2.previousSibling).toBeNull();
    });

    it('should update tail when removing last child', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const child1 = new BackgroundElementTemplateInstance('text');
      const child2 = new BackgroundElementTemplateInstance('image');

      parent.appendChild(child1);
      parent.appendChild(child2);

      parent.removeChild(child2);

      expect(parent.firstChild).toBe(child1);
      expect(parent.lastChild).toBe(child1);
      expect(child1.nextSibling).toBeNull();
    });

    it('should throw error if removing non-child', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const other = new BackgroundElementTemplateInstance('text');
      expect(() => parent.removeChild(other)).toThrow('Node is not a child of this parent');
    });

    it('emits remove ops when removing from a slot container', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const child = new BackgroundElementTemplateInstance('text');
      const grandchild = new BackgroundElementTemplateInstance('text');
      child.appendChild(grandchild);
      parent.appendChild(child);

      markElementTemplateHydrated();
      parent.markMaterializedByHydration();
      child.markMaterializedByHydration();
      grandchild.markMaterializedByHydration();
      globalCommitContext.ops = [];
      parent.removeChild(child);

      expect(parent.elementSlots[0]).toBeUndefined();
      expect(globalCommitContext.ops).toEqual([
        4,
        parent.instanceId,
        0,
        child.instanceId,
        [child.instanceId, grandchild.instanceId],
      ]);
      expect(globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown).toEqual([child]);
    });

    it('queues direct ref cleanup when removing a hydrated subtree', () => {
      const cleanup = rstest.fn();
      const ref = rstest.fn(() => cleanup);
      __etAttrPlanMap.view = [0, adaptRefAttrSlot];
      const parent = new BackgroundElementTemplateInstance('view');
      const child = new BackgroundElementTemplateInstance('view');
      parent.appendChild(child);

      markElementTemplateHydrated();
      parent.markMaterializedByHydration();
      child.markMaterializedByHydration();
      child.setAttribute('attributeSlots', [ref]);
      flushPendingRefs();
      ref.mockClear();
      globalCommitContext.ops = [];

      parent.removeChild(child);
      flushPendingRefs();

      expect(globalCommitContext.ops).toEqual([
        4,
        parent.instanceId,
        0,
        child.instanceId,
        [child.instanceId],
      ]);
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(ref).not.toHaveBeenCalled();
    });

    it('queues direct object ref cleanup when removing a hydrated subtree', () => {
      const ref = { current: null };
      __etAttrPlanMap.view = [0, adaptRefAttrSlot];
      const parent = new BackgroundElementTemplateInstance('view');
      const child = new BackgroundElementTemplateInstance('view');
      parent.appendChild(child);

      markElementTemplateHydrated();
      parent.markMaterializedByHydration();
      child.markMaterializedByHydration();
      child.setAttribute('attributeSlots', [ref]);
      flushPendingRefs();
      expect(ref.current).toMatchObject({ selector: `[ref=${child.instanceId}-0]` });
      globalCommitContext.ops = [];

      parent.removeChild(child);
      flushPendingRefs();

      expect(ref.current).toBeNull();
    });

    it('queues all direct and spread ref cleanups when removing a hydrated subtree', () => {
      const directRef = rstest.fn();
      const cleanup = rstest.fn();
      const spreadRef = rstest.fn(() => cleanup);
      __etAttrPlanMap.view = [0, adaptRefAttrSlot, 1, adaptSpreadAttrSlot];
      const parent = new BackgroundElementTemplateInstance('view');
      const child = new BackgroundElementTemplateInstance('view');
      parent.appendChild(child);

      markElementTemplateHydrated();
      parent.markMaterializedByHydration();
      child.markMaterializedByHydration();
      child.setAttribute('attributeSlots', [directRef, { ref: spreadRef }]);
      flushPendingRefs();
      expect(directRef).toHaveBeenCalledTimes(1);
      expect(spreadRef).toHaveBeenCalledTimes(1);
      directRef.mockClear();
      spreadRef.mockClear();

      parent.removeChild(child);
      flushPendingRefs();

      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(spreadRef).not.toHaveBeenCalled();
      expect(directRef).toHaveBeenCalledWith(null);
    });

    it('queues nested direct and spread ref cleanup when removing a hydrated subtree', () => {
      const childCleanup = rstest.fn();
      const childRef = rstest.fn(() => childCleanup);
      const directGrandchildRef = rstest.fn();
      const grandchildCleanup = rstest.fn();
      const grandchildSpreadRef = rstest.fn(() => grandchildCleanup);
      __etAttrPlanMap.view = [0, adaptRefAttrSlot, 1, adaptSpreadAttrSlot];
      const parent = new BackgroundElementTemplateInstance('view');
      const child = new BackgroundElementTemplateInstance('view');
      const grandchild = new BackgroundElementTemplateInstance('view');
      child.appendChild(grandchild);
      parent.appendChild(child);

      markElementTemplateHydrated();
      parent.markMaterializedByHydration();
      child.markMaterializedByHydration();
      grandchild.markMaterializedByHydration();
      child.setAttribute('attributeSlots', [childRef]);
      grandchild.setAttribute('attributeSlots', [
        directGrandchildRef,
        { ref: grandchildSpreadRef },
      ]);
      flushPendingRefs();
      expect(childRef).toHaveBeenCalledTimes(1);
      expect(directGrandchildRef).toHaveBeenCalledTimes(1);
      expect(grandchildSpreadRef).toHaveBeenCalledTimes(1);
      childRef.mockClear();
      directGrandchildRef.mockClear();
      grandchildSpreadRef.mockClear();
      globalCommitContext.ops = [];

      parent.removeChild(child);
      flushPendingRefs();

      expect(globalCommitContext.ops).toEqual([
        4,
        parent.instanceId,
        0,
        child.instanceId,
        [child.instanceId, grandchild.instanceId],
      ]);
      expect(childCleanup).toHaveBeenCalledTimes(1);
      expect(grandchildCleanup).toHaveBeenCalledTimes(1);
      expect(childRef).not.toHaveBeenCalled();
      expect(grandchildSpreadRef).not.toHaveBeenCalled();
      expect(directGrandchildRef).toHaveBeenCalledWith(null);
    });

    it('does not repeat direct function ref cleanup for detached subtrees on destroy', () => {
      const cleanup = rstest.fn();
      const ref = rstest.fn(() => cleanup);
      __etAttrPlanMap.view = [0, adaptRefAttrSlot];
      const parent = new BackgroundElementTemplateInstance('view');
      const child = new BackgroundElementTemplateInstance('view');
      parent.appendChild(child);

      markElementTemplateHydrated();
      parent.markMaterializedByHydration();
      child.markMaterializedByHydration();
      child.setAttribute('attributeSlots', [ref]);
      flushPendingRefs();
      expect(ref).toHaveBeenCalledTimes(1);

      parent.removeChild(child);
      flushPendingRefs();
      expect(cleanup).toHaveBeenCalledTimes(1);

      destroyElementTemplateBackgroundRuntime();

      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(ref).toHaveBeenCalledTimes(1);
    });

    it('does not emit patches for pre-hydration slot mutations', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const child = new BackgroundElementTemplateInstance('text');
      const childId = child.instanceId;

      globalCommitContext.ops = [];
      child.setAttribute('attributeSlots', ['pending']);
      parent.appendChild(child);
      parent.removeChild(child);

      expect(parent.elementSlots[0]).toBeUndefined();
      expect(globalCommitContext.ops).toEqual([]);
      expect(globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown).toEqual([]);
      expect(backgroundElementTemplateInstanceManager.get(childId)).toBeUndefined();
    });

    it('cleans pre-hydration direct refs when removing a slot child before hydrate', () => {
      const ref = { current: null };
      __etAttrPlanMap.view = [0, adaptRefAttrSlot];
      const parent = new BackgroundElementTemplateInstance('view');
      const child = new BackgroundElementTemplateInstance('view');
      const childId = child.instanceId;

      parent.appendChild(child);
      child.setAttribute('attributeSlots', [ref]);
      flushPendingRefs();
      expect(ref.current).toMatchObject({ selector: `[ref=${child.instanceId}-0]` });

      globalCommitContext.ops = [];
      parent.removeChild(child);
      flushPendingRefs();

      expect(ref.current).toBeNull();
      expect(parent.elementSlots[0]).toBeUndefined();
      expect(globalCommitContext.ops).toEqual([]);
      expect(backgroundElementTemplateInstanceManager.get(childId)).toBeUndefined();
    });

    it('invokes a callback ref cleanup exactly once on pre-hydration removal', () => {
      // Regression: an earlier rewrite left a redundant `queueRefCleanupForSubtree`
      // inside the pre-hydration branch in addition to the unconditional one
      // emitted at the end of `removeChild`, so callback ref cleanups fired twice.
      const cleanup = rstest.fn();
      const ref = rstest.fn(() => cleanup);
      __etAttrPlanMap.view = [0, adaptRefAttrSlot];
      const parent = new BackgroundElementTemplateInstance('view');
      const child = new BackgroundElementTemplateInstance('view');
      parent.appendChild(child);
      child.setAttribute('attributeSlots', [ref]);
      flushPendingRefs();
      ref.mockClear();

      parent.removeChild(child);
      flushPendingRefs();

      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(ref).not.toHaveBeenCalled();
    });

    it('supports silent removal from a slot container', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const child = new BackgroundElementTemplateInstance('text');
      parent.appendChild(child);

      globalCommitContext.ops = [];
      parent.removeChild(child, true);

      expect(parent.elementSlots[0]).toBeUndefined();
      expect(globalCommitContext.ops).toEqual([]);
      expect(globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown).toEqual([]);
    });
  });

  it('should be registered with manager upon creation', () => {
    const instance = new BackgroundElementTemplateInstance('view');
    expect(backgroundElementTemplateInstanceManager.get(instance.instanceId)).toBe(instance);
  });

  it('should tear down correctly', () => {
    const parent = new BackgroundElementTemplateInstance('view');
    const child = new BackgroundElementTemplateInstance('text');
    parent.appendChild(child);

    const parentId = parent.instanceId;
    const childId = child.instanceId;

    expect(backgroundElementTemplateInstanceManager.get(parentId)).toBe(parent);
    expect(backgroundElementTemplateInstanceManager.get(childId)).toBe(child);

    parent.tearDown();

    // Check manager clean up
    expect(backgroundElementTemplateInstanceManager.get(parentId)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(childId)).toBeUndefined();

    // Check reference clean up
    expect(parent.firstChild).toBeNull();
    expect(child.parent).toBeNull();
  });

  it('clears direct object refs when removing from the root container', () => {
    const ref = { current: null };
    __etAttrPlanMap.view = [0, adaptRefAttrSlot];
    const root = new BackgroundElementTemplateInstance('root');
    const instance = new BackgroundElementTemplateInstance('view');
    backgroundElementTemplateInstanceManager.updateId(instance.instanceId, -2);
    root.appendChild(instance);
    instance.markMaterializedByHydration();
    markElementTemplateHydrated();
    instance.setAttribute('attributeSlots', [ref]);
    flushPendingRefs();
    expect(ref.current).toMatchObject({ selector: '[ref=-2-0]' });

    root.removeChild(instance);
    flushPendingRefs();

    expect(ref.current).toBeNull();
  });

  it('reports error for emitCreate with illegal handleId 0 in dev', () => {
    const lynxObj = globalThis.lynx as typeof lynx & { reportError?: (error: Error) => void };
    const oldReportError = lynxObj.reportError;
    const reportErrorSpy = rstest.fn();
    lynxObj.reportError = reportErrorSpy;

    const instance = new BackgroundElementTemplateInstance('view');
    instance.instanceId = 0;
    instance.emitCreate();

    expect(reportErrorSpy).toHaveBeenCalledTimes(1);

    lynxObj.reportError = oldReportError;
  });

  it('does not register the root handle when hydration marks it materialized', () => {
    const instance = new BackgroundElementTemplateInstance('root');
    const originalId = instance.instanceId;
    backgroundElementTemplateInstanceManager.values.delete(originalId);
    instance.instanceId = 0;

    instance.markMaterializedByHydration();

    expect(backgroundElementTemplateInstanceManager.get(0)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(originalId)).toBeUndefined();
  });

  it('normalizes undefined attributeSlots before emitting create', () => {
    const instance = new BackgroundElementTemplateInstance('view');
    instance.setAttribute('attributeSlots', [undefined]);
    globalCommitContext.ops = [];

    instance.emitCreate();

    expect(globalCommitContext.ops).toEqual([
      1,
      instance.instanceId,
      'view',
      null,
      [null],
      [],
    ]);
  });

  it('queues direct ref attach when preparing hydrated attribute slots', () => {
    const ref = rstest.fn();
    __etAttrPlanMap.view = [0, adaptRefAttrSlot];
    const instance = new BackgroundElementTemplateInstance('view', [ref]);
    backgroundElementTemplateInstanceManager.updateId(instance.instanceId, -2);

    instance.prepareAttributeSlotsForNative();
    flushPendingRefs();

    expect(instance.attributeSlots).toEqual(['-2-0']);
    expect(ref).toHaveBeenCalledWith(expect.objectContaining({
      selector: '[ref=-2-0]',
    }));
  });

  it('queues direct ref changes without emitting native ops when marker is unchanged', () => {
    const oldRef = rstest.fn();
    const newRef = rstest.fn();
    __etAttrPlanMap.view = [0, adaptRefAttrSlot];
    const instance = new BackgroundElementTemplateInstance('view');
    backgroundElementTemplateInstanceManager.updateId(instance.instanceId, -2);
    instance.markMaterializedByHydration();
    markElementTemplateHydrated();

    instance.setAttribute('attributeSlots', [oldRef]);
    flushPendingRefs();
    oldRef.mockClear();
    globalCommitContext.ops = [];

    instance.setAttribute('attributeSlots', [newRef]);
    flushPendingRefs();

    expect(globalCommitContext.ops).toEqual([]);
    expect(oldRef).toHaveBeenCalledWith(null);
    expect(newRef).toHaveBeenCalledWith(expect.objectContaining({
      selector: '[ref=-2-0]',
    }));
  });

  it('queues spread ref attach/update/detach from raw ref identity', () => {
    const oldRef = rstest.fn();
    const newRef = rstest.fn();
    __etAttrPlanMap.view = [0, adaptSpreadAttrSlot];
    const instance = new BackgroundElementTemplateInstance('view');
    backgroundElementTemplateInstanceManager.updateId(instance.instanceId, -2);
    instance.markMaterializedByHydration();
    markElementTemplateHydrated();

    instance.setAttribute('attributeSlots', [{ id: 'cta', ref: oldRef }]);
    flushPendingRefs();
    expect(instance.attributeSlots).toEqual([{ id: 'cta', ref: '-2-0' }]);
    expect(oldRef).toHaveBeenCalledWith(expect.objectContaining({
      selector: '[ref=-2-0]',
    }));
    oldRef.mockClear();
    globalCommitContext.ops = [];

    instance.setAttribute('attributeSlots', [{ id: 'cta-next', ref: oldRef }]);
    flushPendingRefs();

    expect(globalCommitContext.ops).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      -2,
      0,
      { id: 'cta-next', ref: '-2-0' },
    ]);
    expect(oldRef).not.toHaveBeenCalled();
    globalCommitContext.ops = [];

    instance.setAttribute('attributeSlots', [{ id: 'cta-next', ref: newRef }]);
    flushPendingRefs();

    expect(globalCommitContext.ops).toEqual([]);
    expect(oldRef).toHaveBeenCalledWith(null);
    expect(newRef).toHaveBeenCalledWith(expect.objectContaining({
      selector: '[ref=-2-0]',
    }));
    newRef.mockClear();

    instance.setAttribute('attributeSlots', [{ id: 'cta-next' }]);
    flushPendingRefs();

    expect(newRef).toHaveBeenCalledWith(null);
  });

  it('queues direct and spread refs independently in descriptor order', () => {
    const directRef = rstest.fn();
    const spreadRef = rstest.fn();
    __etAttrPlanMap.view = [0, adaptRefAttrSlot, 1, adaptSpreadAttrSlot];
    const instance = new BackgroundElementTemplateInstance('view');
    backgroundElementTemplateInstanceManager.updateId(instance.instanceId, -2);
    instance.markMaterializedByHydration();
    markElementTemplateHydrated();

    instance.setAttribute('attributeSlots', [directRef, { ref: spreadRef }]);
    flushPendingRefs();

    expect(instance.attributeSlots).toEqual(['-2-0', { ref: '-2-1' }]);
    expect(directRef).toHaveBeenCalledWith(expect.objectContaining({
      selector: '[ref=-2-0]',
    }));
    expect(spreadRef).toHaveBeenCalledWith(expect.objectContaining({
      selector: '[ref=-2-1]',
    }));

    directRef.mockClear();
    spreadRef.mockClear();
    instance.setAttribute('attributeSlots', [directRef, {}]);
    flushPendingRefs();

    expect(spreadRef).toHaveBeenCalledWith(null);
    expect(directRef).not.toHaveBeenCalled();
  });

  it('does not let explicit undefined spread refs detach sibling direct refs', () => {
    const directRef = rstest.fn();
    __etAttrPlanMap.view = [0, adaptRefAttrSlot, 1, adaptSpreadAttrSlot];
    const instance = new BackgroundElementTemplateInstance('view');
    backgroundElementTemplateInstanceManager.updateId(instance.instanceId, -2);
    instance.markMaterializedByHydration();
    markElementTemplateHydrated();

    instance.setAttribute('attributeSlots', [directRef, { ref: undefined }]);
    flushPendingRefs();

    expect(instance.attributeSlots).toEqual(['-2-0', { ref: null }]);
    expect(directRef).toHaveBeenCalledWith(expect.objectContaining({
      selector: '[ref=-2-0]',
    }));
  });

  it('keeps a stable direct ref attached while spread ref presence changes', () => {
    const ref = rstest.fn();
    __etAttrPlanMap.view = [0, adaptRefAttrSlot, 1, adaptSpreadAttrSlot];
    const instance = new BackgroundElementTemplateInstance('view');
    backgroundElementTemplateInstanceManager.updateId(instance.instanceId, -2);
    instance.markMaterializedByHydration();
    markElementTemplateHydrated();

    instance.setAttribute('attributeSlots', [ref, {}]);
    flushPendingRefs();
    expect(ref).toHaveBeenCalledWith(expect.objectContaining({
      selector: '[ref=-2-0]',
    }));
    ref.mockClear();

    instance.setAttribute('attributeSlots', [ref, { ref: undefined }]);
    flushPendingRefs();
    expect(ref).not.toHaveBeenCalled();
    ref.mockClear();

    instance.setAttribute('attributeSlots', [ref, {}]);
    flushPendingRefs();

    expect(instance.attributeSlots).toEqual(['-2-0', {}]);
    expect(ref).not.toHaveBeenCalled();
  });

  it('queues spread and later direct refs independently', () => {
    const spreadRef = rstest.fn();
    const directRef = rstest.fn();
    __etAttrPlanMap.view = [0, adaptSpreadAttrSlot, 1, adaptRefAttrSlot];
    const instance = new BackgroundElementTemplateInstance('view');
    backgroundElementTemplateInstanceManager.updateId(instance.instanceId, -2);
    instance.markMaterializedByHydration();
    markElementTemplateHydrated();

    instance.setAttribute('attributeSlots', [{ ref: spreadRef }, directRef]);
    flushPendingRefs();

    expect(instance.attributeSlots).toEqual([{ ref: '-2-0' }, '-2-1']);
    expect(spreadRef).toHaveBeenCalledWith(expect.objectContaining({
      selector: '[ref=-2-0]',
    }));
    expect(directRef).toHaveBeenCalledWith(expect.objectContaining({
      selector: '[ref=-2-1]',
    }));
  });

  it('ignores legacy create options metadata props', () => {
    const instance = new BackgroundElementTemplateInstance('view');
    instance.setAttribute('options', {
      cssId: 100,
      entryName: 'lazy-entry',
      preserveMe: 'kept',
    });
    globalCommitContext.ops = [];

    instance.emitCreate();

    expect(globalCommitContext.ops).toEqual([
      1,
      instance.instanceId,
      'view',
      null,
      [],
      [],
    ]);
  });

  it('does not emit duplicate create ops for the same instance', () => {
    const instance = new BackgroundElementTemplateInstance('view');
    globalCommitContext.ops = [];

    instance.emitCreate();
    instance.emitCreate();

    expect(globalCommitContext.ops).toEqual([
      1,
      instance.instanceId,
      'view',
      null,
      [],
      [],
    ]);
  });

  it('ignores text writes for non-raw-text instances', () => {
    const instance = new BackgroundElementTemplateInstance('view');
    globalCommitContext.ops = [];

    instance.text = 'ignored';

    expect(instance.attributeSlots).toEqual([]);
    expect(globalCommitContext.ops).toEqual([]);
  });

  it('defers raw-text patches until inserting a post-hydration text node', () => {
    const parent = new BackgroundElementTemplateInstance('view');
    parent.emitCreate();

    markElementTemplateHydrated();
    globalCommitContext.ops = [];

    const textNode = createTextNode('');
    textNode.text = 'deferred';

    expect(globalCommitContext.ops).toEqual([]);

    parent.appendChild(textNode);

    expect(globalCommitContext.ops).toEqual([
      1,
      textNode.instanceId,
      BUILTIN_RAW_TEXT_TEMPLATE_KEY,
      null,
      ['deferred'],
      [],
      3,
      parent.instanceId,
      0,
      textNode.instanceId,
      0,
    ]);
  });

  it('ignores spread-like shadow keys', () => {
    const instance = new BackgroundElementTemplateInstance('view');
    instance.setAttribute('__spread', { id: 'ignored' });
    instance.setAttribute('elementSlots', []);
    instance.setAttribute('children', []);

    expect(instance.attributeSlots).toEqual([]);
    expect(instance.elementSlots).toEqual([]);
  });
});

describe('Background raw-text instance', () => {
  it('should have correct type and text', () => {
    const textNode = createTextNode('hello');
    expect(textNode.type).toBe(BUILTIN_RAW_TEXT_TEMPLATE_KEY);
    expect(textNode.text).toBe('hello');
    expect(textNode.nodeType).toBe(3);
    expect(textNode.attributeSlots).toEqual(['hello']);
  });

  it('should update text via setAttribute', () => {
    const textNode = createTextNode('');
    textNode.setAttribute('0', 'world');
    expect(textNode.text).toBe('world');
    expect(textNode.attributeSlots).toEqual(['world']);

    textNode.setAttribute('data', 'demo');
    expect(textNode.text).toBe('demo');
    expect(textNode.attributeSlots).toEqual(['demo']);
  });

  it('should update text via data property', () => {
    const textNode = createTextNode('');
    textNode.data = 'world';
    expect(textNode.text).toBe('world');
    expect(textNode.data).toBe('world');
  });

  it('emits setAttribute when existing raw-text data changes after hydration', () => {
    const textNode = createTextNode('old');
    textNode.emitCreate();
    markElementTemplateHydrated();
    globalCommitContext.ops = [];

    textNode.data = 'new';

    expect(textNode.attributeSlots).toEqual(['new']);
    expect(globalCommitContext.ops).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      textNode.instanceId,
      0,
      'new',
    ]);
  });

  it('stringifies numeric raw-text slot values', () => {
    const textNode = new BackgroundElementTemplateInstance(
      BUILTIN_RAW_TEXT_TEMPLATE_KEY,
      [1 as unknown as string],
    );
    expect(textNode.text).toBe('1');
  });

  it('does not emit a patch when setting the same text value', () => {
    const textNode = createTextNode('same');
    globalCommitContext.ops = [];

    textNode.text = 'same';

    expect(textNode.attributeSlots).toEqual(['same']);
    expect(globalCommitContext.ops).toEqual([]);
  });

  it('should ignore non-slot attribute writes on raw-text nodes', () => {
    const textNode = createTextNode('');
    textNode.setAttribute('style', { color: 'red' });
    expect(textNode.attributeSlots).toEqual(['']);
  });
});

describe('BackgroundElementTemplateInstance Shadow State', () => {
  beforeEach(() => {
    globalThis.__MAIN_THREAD__ = false;
    globalThis.__BACKGROUND__ = true;
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;
    clearEtAttrPlanMap();
    clearEventState();
    resetElementTemplateCommitState();
  });

  it('should cache attributeSlots without decoding compiled template attrs', () => {
    const instance = new BackgroundElementTemplateInstance('view');
    const slots = ['logo.png', { id: 'ignored' }] as const;

    instance.setAttribute('attributeSlots', [...slots]);

    expect(instance.attributeSlots).toEqual(slots);
  });

  it('should update attributeSlots when setAttribute("attributeSlots", ...) is called', () => {
    const instance = new BackgroundElementTemplateInstance('view');
    const slots = [{ id: 'a' }, { class: 'foo' }] as const;
    instance.setAttribute('attributeSlots', [...slots]);

    expect(instance.attributeSlots).toEqual(slots);
  });

  it('keeps raw initial planned attribute slots for later native prepare', () => {
    __etAttrPlanMap.view = [0, adaptEventAttrSlot];
    const instance = new BackgroundElementTemplateInstance('view', [true]);
    instance.instanceId = -10;

    instance.prepareAttributeSlotsForNative();

    expect(instance.attributeSlots).toEqual(['-10:0:']);
  });

  it('emits null when an existing attribute slot is removed after hydration', () => {
    const instance = new BackgroundElementTemplateInstance('view', ['old']);
    instance.emitCreate();
    markElementTemplateHydrated();
    globalCommitContext.ops = [];

    instance.setAttribute('attributeSlots', []);

    expect(instance.attributeSlots).toEqual([]);
    expect(globalCommitContext.ops).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      instance.instanceId,
      0,
      null,
    ]);
  });

  it('does not patch equivalent null and undefined attribute slots after hydration', () => {
    const instance = new BackgroundElementTemplateInstance('view', [null]);
    instance.emitCreate();
    markElementTemplateHydrated();
    globalCommitContext.ops = [];

    instance.setAttribute('attributeSlots', [undefined]);

    expect(instance.attributeSlots).toEqual([null]);
    expect(globalCommitContext.ops).toEqual([]);
  });

  it('prepares event attribute slots after hydration and resolves the handler by event value', () => {
    __etAttrPlanMap.view = [0, adaptEventAttrSlot];
    const instance = new BackgroundElementTemplateInstance('view');
    instance.emitCreate();
    markElementTemplateHydrated();
    globalCommitContext.ops = [];

    const handler = rstest.fn();
    instance.setAttribute('attributeSlots', [handler]);

    const eventValue = `${instance.instanceId}:0:`;
    expect(instance.attributeSlots).toEqual([eventValue]);
    expect(getEventHandlerForEventValue(eventValue)).toBe(handler);
    expect(globalCommitContext.ops).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      instance.instanceId,
      0,
      eventValue,
    ]);
  });

  it('uses the latest raw event handler without patching native when the event value is unchanged', () => {
    __etAttrPlanMap.view = [0, adaptEventAttrSlot];
    const instance = new BackgroundElementTemplateInstance('view');
    instance.emitCreate();
    markElementTemplateHydrated();

    const firstHandler = rstest.fn();
    const secondHandler = rstest.fn();
    instance.setAttribute('attributeSlots', [firstHandler]);
    globalCommitContext.ops = [];

    instance.setAttribute('attributeSlots', [secondHandler]);

    const eventValue = `${instance.instanceId}:0:`;
    expect(instance.attributeSlots).toEqual([eventValue]);
    expect(getEventHandlerForEventValue(eventValue)).toBe(secondHandler);
    expect(globalCommitContext.ops).toEqual([]);
  });

  it('drops a stale handler when an event slot becomes a non-function marker', () => {
    __etAttrPlanMap.view = [0, adaptEventAttrSlot];
    const instance = new BackgroundElementTemplateInstance('view');
    instance.emitCreate();
    markElementTemplateHydrated();

    const handler = rstest.fn();
    instance.setAttribute('attributeSlots', [handler]);
    const eventValue = `${instance.instanceId}:0:`;
    globalCommitContext.ops = [];

    instance.setAttribute('attributeSlots', [true]);

    expect(instance.attributeSlots).toEqual([eventValue]);
    expect(getEventHandlerForEventValue(eventValue)).toBeUndefined();
    expect(globalCommitContext.ops).toEqual([]);
  });

  it('removes the raw event handler and patches null when the event slot is cleared', () => {
    __etAttrPlanMap.view = [0, adaptEventAttrSlot];
    const instance = new BackgroundElementTemplateInstance('view');
    instance.emitCreate();
    markElementTemplateHydrated();

    const handler = rstest.fn();
    instance.setAttribute('attributeSlots', [handler]);
    const eventValue = `${instance.instanceId}:0:`;
    globalCommitContext.ops = [];

    instance.setAttribute('attributeSlots', [false]);

    expect(instance.attributeSlots).toEqual([null]);
    expect(getEventHandlerForEventValue(eventValue)).toBeUndefined();
    expect(globalCommitContext.ops).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      instance.instanceId,
      0,
      null,
    ]);
  });

  it('emits prepared event values instead of handler functions in create payloads', () => {
    __etAttrPlanMap.view = [0, adaptEventAttrSlot];
    markElementTemplateHydrated();
    const instance = new BackgroundElementTemplateInstance('view');
    const handler = rstest.fn();
    instance.setAttribute('attributeSlots', [handler]);
    globalCommitContext.ops = [];

    instance.emitCreate();

    const eventValue = `${instance.instanceId}:0:`;
    expect(getEventHandlerForEventValue(eventValue)).toBe(handler);
    expect(globalCommitContext.ops).toEqual([
      ElementTemplateUpdateOps.createTemplate,
      instance.instanceId,
      'view',
      null,
      [eventValue],
      [],
    ]);
  });

  it('clears event handlers owned by an instance when it is torn down', () => {
    __etAttrPlanMap.view = [0, adaptEventAttrSlot];
    markElementTemplateHydrated();
    const instance = new BackgroundElementTemplateInstance('view');
    const handler = rstest.fn();
    instance.setAttribute('attributeSlots', [handler]);
    const eventValue = `${instance.instanceId}:0:`;

    instance.tearDown();

    expect(getEventHandlerForEventValue(eventValue)).toBeUndefined();
  });

  it('clears event handlers when the background runtime is destroyed', () => {
    __etAttrPlanMap.view = [0, adaptEventAttrSlot];
    markElementTemplateHydrated();
    const instance = new BackgroundElementTemplateInstance('view');
    const handler = rstest.fn();
    instance.setAttribute('attributeSlots', [handler]);
    const eventValue = `${instance.instanceId}:0:`;

    destroyElementTemplateBackgroundRuntime();

    expect(getEventHandlerForEventValue(eventValue)).toBeUndefined();
  });

  it('prepares spread event keys after hydration and registers handlers by event value', () => {
    __etAttrPlanMap.view = [0, adaptSpreadAttrSlot];
    const instance = new BackgroundElementTemplateInstance('view');
    instance.emitCreate();
    markElementTemplateHydrated();
    globalCommitContext.ops = [];

    const handleTap = rstest.fn();
    const handleTouch = rstest.fn();
    instance.setAttribute('attributeSlots', [{
      id: 'cta',
      bindtap: handleTap,
      catchtouchstart: handleTouch,
    }]);

    const bindtapValue = `${instance.instanceId}:0:bindtap`;
    const catchTouchValue = `${instance.instanceId}:0:catchtouchstart`;
    const preparedSpread = {
      id: 'cta',
      bindtap: bindtapValue,
      catchtouchstart: catchTouchValue,
    };
    expect(instance.attributeSlots).toEqual([preparedSpread]);
    expect(getEventHandlerForEventValue(bindtapValue)).toBe(handleTap);
    expect(getEventHandlerForEventValue(catchTouchValue)).toBe(handleTouch);
    expect(globalCommitContext.ops).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      instance.instanceId,
      0,
      preparedSpread,
    ]);
  });

  it('updates spread event handlers without patching native when the prepared spread value is unchanged', () => {
    __etAttrPlanMap.view = [0, adaptSpreadAttrSlot];
    const instance = new BackgroundElementTemplateInstance('view');
    instance.emitCreate();
    markElementTemplateHydrated();

    const firstHandler = rstest.fn();
    const secondHandler = rstest.fn();
    instance.setAttribute('attributeSlots', [{ id: 'cta', bindtap: firstHandler }]);
    globalCommitContext.ops = [];

    instance.setAttribute('attributeSlots', [{ id: 'cta', bindtap: secondHandler }]);

    const eventValue = `${instance.instanceId}:0:bindtap`;
    expect(instance.attributeSlots).toEqual([{ id: 'cta', bindtap: eventValue }]);
    expect(getEventHandlerForEventValue(eventValue)).toBe(secondHandler);
    expect(globalCommitContext.ops).toEqual([]);
  });

  it('patches the whole spread slot when event keys change and cleans removed handlers', () => {
    __etAttrPlanMap.view = [0, adaptSpreadAttrSlot];
    const instance = new BackgroundElementTemplateInstance('view');
    instance.emitCreate();
    markElementTemplateHydrated();

    const handleTap = rstest.fn();
    const handleTouch = rstest.fn();
    instance.setAttribute('attributeSlots', [{ id: 'cta', bindtap: handleTap }]);
    const removedEventValue = `${instance.instanceId}:0:bindtap`;
    globalCommitContext.ops = [];

    instance.setAttribute('attributeSlots', [{ id: 'cta', catchtouchstart: handleTouch }]);

    const nextEventValue = `${instance.instanceId}:0:catchtouchstart`;
    const preparedSpread = { id: 'cta', catchtouchstart: nextEventValue };
    expect(instance.attributeSlots).toEqual([preparedSpread]);
    expect(getEventHandlerForEventValue(removedEventValue)).toBeUndefined();
    expect(getEventHandlerForEventValue(nextEventValue)).toBe(handleTouch);
    expect(globalCommitContext.ops).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      instance.instanceId,
      0,
      preparedSpread,
    ]);
  });

  it('emits prepared spread values instead of handler functions in create payloads', () => {
    __etAttrPlanMap.view = [0, adaptSpreadAttrSlot];
    markElementTemplateHydrated();
    const instance = new BackgroundElementTemplateInstance('view');
    const handleTap = rstest.fn();
    instance.setAttribute('attributeSlots', [{ id: 'cta', bindtap: handleTap }]);
    globalCommitContext.ops = [];

    instance.emitCreate();

    const eventValue = `${instance.instanceId}:0:bindtap`;
    const preparedSpread = { id: 'cta', bindtap: eventValue };
    expect(getEventHandlerForEventValue(eventValue)).toBe(handleTap);
    expect(globalCommitContext.ops).toEqual([
      ElementTemplateUpdateOps.createTemplate,
      instance.instanceId,
      'view',
      null,
      [preparedSpread],
      [],
    ]);
  });

  it('clears spread event handlers owned by an instance when it is torn down', () => {
    __etAttrPlanMap.view = [0, adaptSpreadAttrSlot];
    markElementTemplateHydrated();
    const instance = new BackgroundElementTemplateInstance('view');
    const handleTap = rstest.fn();
    instance.setAttribute('attributeSlots', [{ bindtap: handleTap }]);
    const eventValue = `${instance.instanceId}:0:bindtap`;

    instance.tearDown();

    expect(getEventHandlerForEventValue(eventValue)).toBeUndefined();
  });

  it('clears spread event handlers when the background runtime is destroyed', () => {
    __etAttrPlanMap.view = [0, adaptSpreadAttrSlot];
    markElementTemplateHydrated();
    const instance = new BackgroundElementTemplateInstance('view');
    const handleTap = rstest.fn();
    instance.setAttribute('attributeSlots', [{ bindtap: handleTap }]);
    const eventValue = `${instance.instanceId}:0:bindtap`;

    destroyElementTemplateBackgroundRuntime();

    expect(getEventHandlerForEventValue(eventValue)).toBeUndefined();
  });
});

describe('BackgroundElementTemplateInstance slot-index children', () => {
  it('should clear the previous slot index when partId changes after attachment', () => {
    const root = new BackgroundElementTemplateInstance('element-template-view');
    const text = createTextNode('move');

    root.appendChild(text);

    text.__slotIndex = 1;

    expect(root.elementSlots[0]).toBeUndefined();
    expect(root.elementSlots[1]).toEqual([text]);
  });

  it('should keep elementSlots in sync when slot is attached after children exist', () => {
    const root = new BackgroundElementTemplateInstance('element-template-view');
    const text = createTextNode('late');

    text.__slotIndex = 2;
    root.appendChild(text);

    expect(root.elementSlots[2]).toEqual([text]);
  });

  it('should move slot children to the new slot index when partId changes', () => {
    const root = new BackgroundElementTemplateInstance('element-template-view');
    const text = createTextNode('move');

    text.__slotIndex = 0;
    root.appendChild(text);
    text.__slotIndex = 3;

    expect(root.elementSlots[0]).toBeUndefined();
    expect(root.elementSlots[3]).toEqual([text]);
  });

  it('should detach a moved child from the old slot shadow state when silent reparenting', () => {
    const root = new BackgroundElementTemplateInstance('element-template-view');
    const text = createTextNode('move');

    root.appendChild(text);

    text.__slotIndex = 1;
    root.insertBefore(text, null, true);

    expect(root.elementSlots[0]).toBeUndefined();
    expect(root.elementSlots[1]).toEqual([text]);
    expect(root.firstChild).toBe(text);
  });

  it('should detach a moved child from the old parent slot shadow state', () => {
    const rootA = new BackgroundElementTemplateInstance('element-template-view');
    const rootB = new BackgroundElementTemplateInstance('element-template-view');
    const text = createTextNode('move');

    rootA.appendChild(text);

    rootB.insertBefore(text, null, true);

    expect(rootA.elementSlots).toEqual([]);
    expect(rootB.firstChild).toBe(text);
  });

  it('should append to elementSlots', () => {
    const root = new BackgroundElementTemplateInstance('element-template-view');
    const view = new BackgroundElementTemplateInstance('view');
    root.appendChild(view);

    expect(root.elementSlots[0]).toEqual([view]);
  });

  it('should append to elementSlots with custom slot index', () => {
    const root = new BackgroundElementTemplateInstance('element-template-view');
    const text = createTextNode('Hello');
    text.__slotIndex = 1;
    root.appendChild(text);

    expect(root.elementSlots[0]).toBeUndefined();
    expect(root.elementSlots[1]).toEqual([text]);
  });
});
