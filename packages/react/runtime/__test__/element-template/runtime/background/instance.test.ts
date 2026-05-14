// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { globalCommitContext } from '../../../../src/element-template/background/commit-context.js';
import {
  markElementTemplateHydrated,
  resetElementTemplateCommitState,
} from '../../../../src/element-template/background/commit-hook.js';
import { destroyElementTemplateBackgroundRuntime } from '../../../../src/element-template/background/destroy.js';
import {
  BackgroundElementTemplateInstance,
  BackgroundElementTemplateSlot,
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

  it('does not emit create for synthetic slot containers after hydration', () => {
    markElementTemplateHydrated();
    globalCommitContext.ops = [];

    new BackgroundElementTemplateSlot();

    expect(globalCommitContext.ops).toEqual([]);
  });

  it('exposes DOM-compatible tree accessors for Preact removal paths', () => {
    const parent = new BackgroundElementTemplateInstance('view');
    const slot = new BackgroundElementTemplateSlot();
    slot.setAttribute('id', 0);
    parent.appendChild(slot);
    const child = new BackgroundElementTemplateInstance('image');
    slot.appendChild(child);

    expect(parent.childNodes).toEqual([slot]);
    expect(slot.childNodes).toEqual([child]);

    markElementTemplateHydrated();
    parent.markMaterializedByHydration();
    child.markMaterializedByHydration();
    globalCommitContext.ops = [];
    child.parentNode?.removeChild(child);

    expect(slot.childNodes).toEqual([]);
    expect(child.parentNode).toBeNull();
    expect(parent.elementSlots[0]).toEqual([]);
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
      const slot = new BackgroundElementTemplateSlot();
      slot.setAttribute('id', 0);
      parent.appendChild(slot);
      parent.emitCreate();

      markElementTemplateHydrated();
      globalCommitContext.ops = [];

      const child = new BackgroundElementTemplateInstance('image');
      child.setAttribute('attributeSlots', ['logo.png']);

      expect(globalCommitContext.ops).toEqual([]);

      slot.appendChild(child);

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
      const ref = vi.fn();
      __etAttrPlanMap.view = [0, adaptRefAttrSlot];
      const parent = new BackgroundElementTemplateInstance('view');
      const slot = new BackgroundElementTemplateSlot();
      slot.setAttribute('id', 0);
      parent.appendChild(slot);
      parent.emitCreate();

      markElementTemplateHydrated();
      globalCommitContext.ops = [];

      const child = new BackgroundElementTemplateInstance('view');
      child.setAttribute('attributeSlots', [ref]);
      slot.appendChild(child);
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

    it('does not re-attach stable direct refs when moving an existing hydrated child', () => {
      const ref = vi.fn();
      __etAttrPlanMap.view = [0, adaptRefAttrSlot];
      const parent = new BackgroundElementTemplateInstance('view');
      const slot = new BackgroundElementTemplateSlot();
      slot.setAttribute('id', 0);
      parent.appendChild(slot);
      const before = new BackgroundElementTemplateInstance('view');
      const child = new BackgroundElementTemplateInstance('view');
      child.setAttribute('attributeSlots', [ref]);
      slot.appendChild(before);
      slot.appendChild(child);

      markElementTemplateHydrated();
      parent.markMaterializedByHydration();
      before.markMaterializedByHydration();
      child.markMaterializedByHydration();
      child.prepareAttributeSlotsForNative();
      flushPendingRefs();
      ref.mockClear();
      globalCommitContext.ops = [];

      slot.insertBefore(child, before);
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
      const slot = new BackgroundElementTemplateSlot();
      slot.setAttribute('id', 0);
      parent.appendChild(slot);
      parent.emitCreate();

      markElementTemplateHydrated();
      globalCommitContext.ops = [];

      const owner = new BackgroundElementTemplateInstance('view');
      const ownerSlot = new BackgroundElementTemplateSlot();
      ownerSlot.setAttribute('id', 0);
      owner.appendChild(ownerSlot);
      const nested = createTextNode('nested');
      ownerSlot.appendChild(nested);

      expect(globalCommitContext.ops).toEqual([]);

      slot.appendChild(owner);

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
      const slot = new BackgroundElementTemplateSlot();
      slot.setAttribute('id', 0);
      parent.appendChild(slot);
      parent.emitCreate();

      markElementTemplateHydrated();
      globalCommitContext.ops = [];

      const child = new BackgroundElementTemplateInstance('view');
      child.elementSlots.length = 1;
      slot.appendChild(child);

      const serializedSlots = globalCommitContext.ops[5] as unknown[];
      expect(globalCommitContext.ops[0]).toBe(1);
      expect(globalCommitContext.ops[1]).toBe(child.instanceId);
      expect(serializedSlots).toHaveLength(1);
      expect(0 in serializedSlots).toBe(false);
      expect(globalCommitContext.ops.slice(6)).toEqual([
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
      const slot = new BackgroundElementTemplateSlot();
      slot.setAttribute('id', 0);
      parent.appendChild(slot);
      const child = new BackgroundElementTemplateInstance('text');
      const childSlot = new BackgroundElementTemplateSlot();
      childSlot.setAttribute('id', 0);
      const grandchild = new BackgroundElementTemplateInstance('text');
      child.appendChild(childSlot);
      childSlot.appendChild(grandchild);
      slot.appendChild(child);

      markElementTemplateHydrated();
      parent.markMaterializedByHydration();
      child.markMaterializedByHydration();
      grandchild.markMaterializedByHydration();
      globalCommitContext.ops = [];
      slot.removeChild(child);

      expect(parent.elementSlots[0]).toEqual([]);
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
      const cleanup = vi.fn();
      const ref = vi.fn(() => cleanup);
      __etAttrPlanMap.view = [0, adaptRefAttrSlot];
      const parent = new BackgroundElementTemplateInstance('view');
      const slot = new BackgroundElementTemplateSlot();
      slot.setAttribute('id', 0);
      parent.appendChild(slot);
      const child = new BackgroundElementTemplateInstance('view');
      slot.appendChild(child);

      markElementTemplateHydrated();
      parent.markMaterializedByHydration();
      child.markMaterializedByHydration();
      child.setAttribute('attributeSlots', [ref]);
      flushPendingRefs();
      ref.mockClear();
      globalCommitContext.ops = [];

      slot.removeChild(child);
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
      const slot = new BackgroundElementTemplateSlot();
      slot.setAttribute('id', 0);
      parent.appendChild(slot);
      const child = new BackgroundElementTemplateInstance('view');
      slot.appendChild(child);

      markElementTemplateHydrated();
      parent.markMaterializedByHydration();
      child.markMaterializedByHydration();
      child.setAttribute('attributeSlots', [ref]);
      flushPendingRefs();
      expect(ref.current).toMatchObject({ selector: `[ref=${child.instanceId}-0]` });
      globalCommitContext.ops = [];

      slot.removeChild(child);
      flushPendingRefs();

      expect(ref.current).toBeNull();
    });

    it('queues the final effective spread ref cleanup when removing a hydrated subtree', () => {
      const directRef = vi.fn();
      const cleanup = vi.fn();
      const spreadRef = vi.fn(() => cleanup);
      __etAttrPlanMap.view = [0, adaptRefAttrSlot, 1, adaptSpreadAttrSlot];
      const parent = new BackgroundElementTemplateInstance('view');
      const slot = new BackgroundElementTemplateSlot();
      slot.setAttribute('id', 0);
      parent.appendChild(slot);
      const child = new BackgroundElementTemplateInstance('view');
      slot.appendChild(child);

      markElementTemplateHydrated();
      parent.markMaterializedByHydration();
      child.markMaterializedByHydration();
      child.setAttribute('attributeSlots', [directRef, { ref: spreadRef }]);
      flushPendingRefs();
      expect(directRef).not.toHaveBeenCalled();
      expect(spreadRef).toHaveBeenCalledTimes(1);
      spreadRef.mockClear();

      slot.removeChild(child);
      flushPendingRefs();

      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(spreadRef).not.toHaveBeenCalled();
      expect(directRef).not.toHaveBeenCalled();
    });

    it('queues nested direct and spread ref cleanup when removing a hydrated subtree', () => {
      const childCleanup = vi.fn();
      const childRef = vi.fn(() => childCleanup);
      const ignoredDirectGrandchildRef = vi.fn();
      const grandchildCleanup = vi.fn();
      const grandchildSpreadRef = vi.fn(() => grandchildCleanup);
      __etAttrPlanMap.view = [0, adaptRefAttrSlot, 1, adaptSpreadAttrSlot];
      const parent = new BackgroundElementTemplateInstance('view');
      const slot = new BackgroundElementTemplateSlot();
      slot.setAttribute('id', 0);
      parent.appendChild(slot);
      const child = new BackgroundElementTemplateInstance('view');
      const childSlot = new BackgroundElementTemplateSlot();
      childSlot.setAttribute('id', 0);
      const grandchild = new BackgroundElementTemplateInstance('view');
      child.appendChild(childSlot);
      childSlot.appendChild(grandchild);
      slot.appendChild(child);

      markElementTemplateHydrated();
      parent.markMaterializedByHydration();
      child.markMaterializedByHydration();
      grandchild.markMaterializedByHydration();
      child.setAttribute('attributeSlots', [childRef]);
      grandchild.setAttribute('attributeSlots', [
        ignoredDirectGrandchildRef,
        { ref: grandchildSpreadRef },
      ]);
      flushPendingRefs();
      expect(childRef).toHaveBeenCalledTimes(1);
      expect(grandchildSpreadRef).toHaveBeenCalledTimes(1);
      expect(ignoredDirectGrandchildRef).not.toHaveBeenCalled();
      childRef.mockClear();
      grandchildSpreadRef.mockClear();
      globalCommitContext.ops = [];

      slot.removeChild(child);
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
      expect(ignoredDirectGrandchildRef).not.toHaveBeenCalled();
    });

    it('does not repeat direct function ref cleanup for detached subtrees on destroy', () => {
      const cleanup = vi.fn();
      const ref = vi.fn(() => cleanup);
      __etAttrPlanMap.view = [0, adaptRefAttrSlot];
      const parent = new BackgroundElementTemplateInstance('view');
      const slot = new BackgroundElementTemplateSlot();
      slot.setAttribute('id', 0);
      parent.appendChild(slot);
      const child = new BackgroundElementTemplateInstance('view');
      slot.appendChild(child);

      markElementTemplateHydrated();
      parent.markMaterializedByHydration();
      child.markMaterializedByHydration();
      child.setAttribute('attributeSlots', [ref]);
      flushPendingRefs();
      expect(ref).toHaveBeenCalledTimes(1);

      slot.removeChild(child);
      flushPendingRefs();
      expect(cleanup).toHaveBeenCalledTimes(1);

      destroyElementTemplateBackgroundRuntime();

      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(ref).toHaveBeenCalledTimes(1);
    });

    it('does not emit patches for pre-hydration slot mutations', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const slot = new BackgroundElementTemplateSlot();
      slot.setAttribute('id', 0);
      parent.appendChild(slot);
      const child = new BackgroundElementTemplateInstance('text');
      const childId = child.instanceId;

      globalCommitContext.ops = [];
      child.setAttribute('attributeSlots', ['pending']);
      slot.appendChild(child);
      slot.removeChild(child);

      expect(parent.elementSlots[0]).toEqual([]);
      expect(globalCommitContext.ops).toEqual([]);
      expect(globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown).toEqual([]);
      expect(backgroundElementTemplateInstanceManager.get(childId)).toBeUndefined();
    });

    it('cleans pre-hydration direct refs when removing a slot child before hydrate', () => {
      const ref = { current: null };
      __etAttrPlanMap.view = [0, adaptRefAttrSlot];
      const parent = new BackgroundElementTemplateInstance('view');
      const slot = new BackgroundElementTemplateSlot();
      slot.setAttribute('id', 0);
      parent.appendChild(slot);
      const child = new BackgroundElementTemplateInstance('view');
      const childId = child.instanceId;

      slot.appendChild(child);
      child.setAttribute('attributeSlots', [ref]);
      flushPendingRefs();
      expect(ref.current).toMatchObject({ selector: `[ref=${child.instanceId}-0]` });

      globalCommitContext.ops = [];
      slot.removeChild(child);
      flushPendingRefs();

      expect(ref.current).toBeNull();
      expect(parent.elementSlots[0]).toEqual([]);
      expect(globalCommitContext.ops).toEqual([]);
      expect(backgroundElementTemplateInstanceManager.get(childId)).toBeUndefined();
    });

    it('supports silent removal from a slot container', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const slot = new BackgroundElementTemplateSlot();
      slot.setAttribute('id', 0);
      parent.appendChild(slot);
      const child = new BackgroundElementTemplateInstance('text');
      slot.appendChild(child);

      globalCommitContext.ops = [];
      slot.removeChild(child, true);

      expect(parent.elementSlots[0]).toEqual([]);
      expect(globalCommitContext.ops).toEqual([]);
      expect(globalCommitContext.nonPayload.removedSubtreesAwaitingTeardown).toEqual([]);
    });

    it('clears cached elementSlots when removing a slot child', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const slot = new BackgroundElementTemplateSlot();
      slot.setAttribute('id', 1);
      parent.appendChild(slot);

      expect(parent.elementSlots[1]).toEqual([]);

      parent.removeChild(slot, true);

      expect(parent.elementSlots[1]).toEqual([]);
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
    const reportErrorSpy = vi.fn();
    lynxObj.reportError = reportErrorSpy;

    const instance = new BackgroundElementTemplateInstance('view');
    instance.instanceId = 0;
    instance.emitCreate();

    expect(reportErrorSpy).toHaveBeenCalledTimes(1);

    lynxObj.reportError = oldReportError;
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
    const ref = vi.fn();
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
    const oldRef = vi.fn();
    const newRef = vi.fn();
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
    const oldRef = vi.fn();
    const newRef = vi.fn();
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

  it('uses the final direct/spread ref value in descriptor order', () => {
    const directRef = vi.fn();
    const spreadRef = vi.fn();
    __etAttrPlanMap.view = [0, adaptRefAttrSlot, 1, adaptSpreadAttrSlot];
    const instance = new BackgroundElementTemplateInstance('view');
    backgroundElementTemplateInstanceManager.updateId(instance.instanceId, -2);
    instance.markMaterializedByHydration();
    markElementTemplateHydrated();

    instance.setAttribute('attributeSlots', [directRef, { ref: spreadRef }]);
    flushPendingRefs();

    expect(instance.attributeSlots).toEqual(['-2-0', { ref: '-2-1' }]);
    expect(directRef).not.toHaveBeenCalled();
    expect(spreadRef).toHaveBeenCalledWith(expect.objectContaining({
      selector: '[ref=-2-1]',
    }));

    spreadRef.mockClear();
    instance.setAttribute('attributeSlots', [directRef, {}]);
    flushPendingRefs();

    expect(spreadRef).toHaveBeenCalledWith(null);
    expect(directRef).toHaveBeenCalledWith(expect.objectContaining({
      selector: '[ref=-2-0]',
    }));
  });

  it('treats explicit undefined spread ref as overriding an earlier direct ref', () => {
    const directRef = vi.fn();
    __etAttrPlanMap.view = [0, adaptRefAttrSlot, 1, adaptSpreadAttrSlot];
    const instance = new BackgroundElementTemplateInstance('view');
    backgroundElementTemplateInstanceManager.updateId(instance.instanceId, -2);
    instance.markMaterializedByHydration();
    markElementTemplateHydrated();

    instance.setAttribute('attributeSlots', [directRef, { ref: undefined }]);
    flushPendingRefs();

    expect(instance.attributeSlots).toEqual(['-2-0', { ref: null }]);
    expect(directRef).not.toHaveBeenCalled();
  });

  it('reattaches a stable direct ref after explicit undefined spread ref is removed', () => {
    const ref = vi.fn();
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
    expect(ref).toHaveBeenCalledWith(null);
    ref.mockClear();

    instance.setAttribute('attributeSlots', [ref, {}]);
    flushPendingRefs();

    expect(instance.attributeSlots).toEqual(['-2-0', {}]);
    expect(ref).toHaveBeenCalledWith(expect.objectContaining({
      selector: '[ref=-2-0]',
    }));
  });

  it('lets a later direct ref override an earlier spread ref', () => {
    const spreadRef = vi.fn();
    const directRef = vi.fn();
    __etAttrPlanMap.view = [0, adaptSpreadAttrSlot, 1, adaptRefAttrSlot];
    const instance = new BackgroundElementTemplateInstance('view');
    backgroundElementTemplateInstanceManager.updateId(instance.instanceId, -2);
    instance.markMaterializedByHydration();
    markElementTemplateHydrated();

    instance.setAttribute('attributeSlots', [{ ref: spreadRef }, directRef]);
    flushPendingRefs();

    expect(instance.attributeSlots).toEqual([{ ref: '-2-0' }, '-2-1']);
    expect(spreadRef).not.toHaveBeenCalled();
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
    const slot = new BackgroundElementTemplateSlot();
    slot.setAttribute('id', 0);
    parent.appendChild(slot);
    parent.emitCreate();

    markElementTemplateHydrated();
    globalCommitContext.ops = [];

    const textNode = createTextNode('');
    textNode.text = 'deferred';

    expect(globalCommitContext.ops).toEqual([]);

    slot.appendChild(textNode);

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

describe('BackgroundElementTemplateSlot', () => {
  it('should have correct type', () => {
    const slot = new BackgroundElementTemplateSlot();
    expect(slot.type).toBe('slot');
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

    const handler = vi.fn();
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

    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
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

    const handler = vi.fn();
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

    const handler = vi.fn();
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
    const handler = vi.fn();
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
    const handler = vi.fn();
    instance.setAttribute('attributeSlots', [handler]);
    const eventValue = `${instance.instanceId}:0:`;

    instance.tearDown();

    expect(getEventHandlerForEventValue(eventValue)).toBeUndefined();
  });

  it('clears event handlers when the background runtime is destroyed', () => {
    __etAttrPlanMap.view = [0, adaptEventAttrSlot];
    markElementTemplateHydrated();
    const instance = new BackgroundElementTemplateInstance('view');
    const handler = vi.fn();
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

    const handleTap = vi.fn();
    const handleTouch = vi.fn();
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

    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
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

    const handleTap = vi.fn();
    const handleTouch = vi.fn();
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
    const handleTap = vi.fn();
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
    const handleTap = vi.fn();
    instance.setAttribute('attributeSlots', [{ bindtap: handleTap }]);
    const eventValue = `${instance.instanceId}:0:bindtap`;

    instance.tearDown();

    expect(getEventHandlerForEventValue(eventValue)).toBeUndefined();
  });

  it('clears spread event handlers when the background runtime is destroyed', () => {
    __etAttrPlanMap.view = [0, adaptSpreadAttrSlot];
    markElementTemplateHydrated();
    const instance = new BackgroundElementTemplateInstance('view');
    const handleTap = vi.fn();
    instance.setAttribute('attributeSlots', [{ bindtap: handleTap }]);
    const eventValue = `${instance.instanceId}:0:bindtap`;

    destroyElementTemplateBackgroundRuntime();

    expect(getEventHandlerForEventValue(eventValue)).toBeUndefined();
  });
});

describe('BackgroundElementTemplateSlot Children', () => {
  it('should update partId for slot when setAttribute is called', () => {
    const slot = new BackgroundElementTemplateSlot();
    slot.setAttribute('id', 10);
    expect(slot.partId).toBe(10);
  });

  it('should clear the previous slot index when partId changes after attachment', () => {
    const root = new BackgroundElementTemplateInstance('element-template-view');
    const slot = new BackgroundElementTemplateSlot();
    const text = createTextNode('move');
    slot.setAttribute('id', 0);
    slot.appendChild(text);
    root.appendChild(slot);

    slot.setAttribute('id', 1);

    expect(root.elementSlots[0]).toEqual([]);
    expect(root.elementSlots[1]).toEqual([text]);
  });

  it('should keep elementSlots in sync when slot is attached after children exist', () => {
    const root = new BackgroundElementTemplateInstance('element-template-view');
    const slot = new BackgroundElementTemplateSlot();
    const text = createTextNode('late');

    slot.setAttribute('id', 2);
    slot.appendChild(text);
    root.appendChild(slot);

    expect(root.elementSlots[2]).toEqual([text]);
  });

  it('should move slot children to the new slot index when partId changes', () => {
    const root = new BackgroundElementTemplateInstance('element-template-view');
    const slot = new BackgroundElementTemplateSlot();
    const text = createTextNode('move');

    slot.setAttribute('id', 0);
    slot.appendChild(text);
    root.appendChild(slot);
    slot.setAttribute('id', 3);

    expect(root.elementSlots[0]).toEqual([]);
    expect(root.elementSlots[3]).toEqual([text]);
  });

  it('should detach a moved child from the old slot shadow state when silent reparenting', () => {
    const root = new BackgroundElementTemplateInstance('element-template-view');
    const slotA = new BackgroundElementTemplateSlot();
    const slotB = new BackgroundElementTemplateSlot();
    const text = createTextNode('move');

    slotA.setAttribute('id', 0);
    slotB.setAttribute('id', 1);
    root.appendChild(slotA);
    root.appendChild(slotB);
    slotA.appendChild(text);

    slotB.insertBefore(text, null, true);

    expect(root.elementSlots[0]).toEqual([]);
    expect(root.elementSlots[1]).toEqual([text]);
    expect(slotA.firstChild).toBeNull();
    expect(slotB.firstChild).toBe(text);
  });

  it('should detach a moved child from the old parent slot shadow state', () => {
    const rootA = new BackgroundElementTemplateInstance('element-template-view');
    const rootB = new BackgroundElementTemplateInstance('element-template-view');
    const slotA = new BackgroundElementTemplateSlot();
    const slotB = new BackgroundElementTemplateSlot();
    const text = createTextNode('move');

    slotA.setAttribute('id', 0);
    slotB.setAttribute('id', 0);
    rootA.appendChild(slotA);
    rootB.appendChild(slotB);
    slotA.appendChild(text);

    slotB.insertBefore(text, null, true);

    expect(rootA.elementSlots[0]).toEqual([]);
    expect(rootB.elementSlots[0]).toEqual([text]);
    expect(slotA.firstChild).toBeNull();
    expect(slotB.firstChild).toBe(text);
  });

  it('does not create an element slot entry for non-slot direct children', () => {
    const root = new BackgroundElementTemplateInstance('element-template-view');
    const view = new BackgroundElementTemplateInstance('view');
    root.appendChild(view);

    expect(root.elementSlots).toEqual([]);
  });

  it('does not create an element slot entry for slot with default partId', () => {
    const root = new BackgroundElementTemplateInstance('element-template-view');
    const slot = new BackgroundElementTemplateSlot();
    slot.appendChild(createTextNode('Hello'));
    root.appendChild(slot);

    expect(root.elementSlots).toEqual([]);
  });
});
