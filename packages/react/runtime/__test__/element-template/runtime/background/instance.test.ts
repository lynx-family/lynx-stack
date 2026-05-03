// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GlobalCommitContext } from '../../../../src/element-template/background/commit-context.js';
import {
  markElementTemplateHydrated,
  resetElementTemplateCommitState,
} from '../../../../src/element-template/background/commit-hook.js';
import {
  BackgroundElementTemplateInstance,
  BackgroundElementTemplateSlot,
  BUILTIN_RAW_TEXT_TEMPLATE_KEY,
} from '../../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../../src/element-template/background/manager.js';
import { ElementTemplateUpdateOps } from '../../../../src/element-template/protocol/opcodes.js';

function createTextNode(text: string): BackgroundElementTemplateInstance {
  return new BackgroundElementTemplateInstance(BUILTIN_RAW_TEXT_TEMPLATE_KEY, [text]);
}

describe('BackgroundElementTemplateInstance', () => {
  beforeEach(() => {
    backgroundElementTemplateInstanceManager.clear();
    backgroundElementTemplateInstanceManager.nextId = 0;
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
    GlobalCommitContext.ops = [];

    new BackgroundElementTemplateInstance('image', ['logo.png']);

    expect(GlobalCommitContext.ops).toEqual([]);
  });

  it('does not emit create for synthetic slot containers after hydration', () => {
    markElementTemplateHydrated();
    GlobalCommitContext.ops = [];

    new BackgroundElementTemplateSlot();

    expect(GlobalCommitContext.ops).toEqual([]);
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

    GlobalCommitContext.ops = [];
    child.parentNode?.removeChild(child);

    expect(slot.childNodes).toEqual([]);
    expect(child.parentNode).toBeNull();
    expect(parent.elementSlots[0]).toEqual([]);
    expect(GlobalCommitContext.ops).toEqual([
      4,
      parent.instanceId,
      0,
      child.instanceId,
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
      GlobalCommitContext.ops = [];

      parent.insertBefore(child, null, true);

      expect(parent.firstChild).toBe(child);
      expect(GlobalCommitContext.ops).toEqual([]);
    });

    it('emits create with initialized attrs before inserting a post-hydration template', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const slot = new BackgroundElementTemplateSlot();
      slot.setAttribute('id', 0);
      parent.appendChild(slot);
      parent.emitCreate();

      markElementTemplateHydrated();
      GlobalCommitContext.ops = [];

      const child = new BackgroundElementTemplateInstance('image');
      child.setAttribute('attributeSlots', ['logo.png']);

      expect(GlobalCommitContext.ops).toEqual([]);

      slot.appendChild(child);

      expect(GlobalCommitContext.ops).toEqual([
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

    it('defers nested slot inserts until the owner template is created', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const slot = new BackgroundElementTemplateSlot();
      slot.setAttribute('id', 0);
      parent.appendChild(slot);
      parent.emitCreate();

      markElementTemplateHydrated();
      GlobalCommitContext.ops = [];

      const owner = new BackgroundElementTemplateInstance('view');
      const ownerSlot = new BackgroundElementTemplateSlot();
      ownerSlot.setAttribute('id', 0);
      owner.appendChild(ownerSlot);
      const nested = createTextNode('nested');
      ownerSlot.appendChild(nested);

      expect(GlobalCommitContext.ops).toEqual([]);

      slot.appendChild(owner);

      expect(GlobalCommitContext.ops).toEqual([
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
      GlobalCommitContext.ops = [];

      const child = new BackgroundElementTemplateInstance('view');
      child.elementSlots.length = 1;
      slot.appendChild(child);

      const serializedSlots = GlobalCommitContext.ops[5] as unknown[];
      expect(GlobalCommitContext.ops[0]).toBe(1);
      expect(GlobalCommitContext.ops[1]).toBe(child.instanceId);
      expect(serializedSlots).toHaveLength(1);
      expect(0 in serializedSlots).toBe(false);
      expect(GlobalCommitContext.ops.slice(6)).toEqual([
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
      slot.appendChild(child);

      GlobalCommitContext.ops = [];
      slot.removeChild(child);

      expect(parent.elementSlots[0]).toEqual([]);
      expect(GlobalCommitContext.ops).toEqual([
        4,
        parent.instanceId,
        0,
        child.instanceId,
      ]);
    });

    it('supports silent removal from a slot container', () => {
      const parent = new BackgroundElementTemplateInstance('view');
      const slot = new BackgroundElementTemplateSlot();
      slot.setAttribute('id', 0);
      parent.appendChild(slot);
      const child = new BackgroundElementTemplateInstance('text');
      slot.appendChild(child);

      GlobalCommitContext.ops = [];
      slot.removeChild(child, true);

      expect(parent.elementSlots[0]).toEqual([]);
      expect(GlobalCommitContext.ops).toEqual([]);
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
    GlobalCommitContext.ops = [];

    instance.emitCreate();

    expect(GlobalCommitContext.ops).toEqual([
      1,
      instance.instanceId,
      'view',
      null,
      [null],
      [],
    ]);
  });

  it('does not append create options metadata to update commands', () => {
    const instance = new BackgroundElementTemplateInstance('view');
    instance.setAttribute('options', {
      cssId: 100,
      entryName: 'lazy-entry',
      preserveMe: 'kept',
    });
    GlobalCommitContext.ops = [];

    instance.emitCreate();

    expect(GlobalCommitContext.ops).toEqual([
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
    GlobalCommitContext.ops = [];

    instance.emitCreate();
    instance.emitCreate();

    expect(GlobalCommitContext.ops).toEqual([
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
    GlobalCommitContext.ops = [];

    instance.text = 'ignored';

    expect(instance.attributeSlots).toEqual([]);
    expect(GlobalCommitContext.ops).toEqual([]);
  });

  it('defers raw-text patches until inserting a post-hydration text node', () => {
    const parent = new BackgroundElementTemplateInstance('view');
    const slot = new BackgroundElementTemplateSlot();
    slot.setAttribute('id', 0);
    parent.appendChild(slot);
    parent.emitCreate();

    markElementTemplateHydrated();
    GlobalCommitContext.ops = [];

    const textNode = createTextNode('');
    textNode.text = 'deferred';

    expect(GlobalCommitContext.ops).toEqual([]);

    slot.appendChild(textNode);

    expect(GlobalCommitContext.ops).toEqual([
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
    GlobalCommitContext.ops = [];

    textNode.data = 'new';

    expect(textNode.attributeSlots).toEqual(['new']);
    expect(GlobalCommitContext.ops).toEqual([
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
    GlobalCommitContext.ops = [];

    textNode.text = 'same';

    expect(textNode.attributeSlots).toEqual(['same']);
    expect(GlobalCommitContext.ops).toEqual([]);
  });

  it('should ignore non-slot attribute writes on raw-text nodes', () => {
    const textNode = createTextNode('');
    textNode.setAttribute('style', { color: 'red' });
    expect(textNode.attributeSlots).toEqual(['']);
  });
});

describe('BackgroundElementTemplateInstance Shadow State', () => {
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

  it('emits null when an existing attribute slot is removed after hydration', () => {
    const instance = new BackgroundElementTemplateInstance('view', ['old']);
    instance.emitCreate();
    markElementTemplateHydrated();
    GlobalCommitContext.ops = [];

    instance.setAttribute('attributeSlots', []);

    expect(instance.attributeSlots).toEqual([]);
    expect(GlobalCommitContext.ops).toEqual([
      ElementTemplateUpdateOps.setAttribute,
      instance.instanceId,
      0,
      null,
    ]);
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

  it('should aggregate slotChildren correctly', () => {
    const root = new BackgroundElementTemplateInstance('element-template-view');

    const slot1 = new BackgroundElementTemplateSlot();
    slot1.setAttribute('id', 0);
    const text1 = createTextNode('Hello');
    slot1.appendChild(text1);

    const slot2 = new BackgroundElementTemplateSlot();
    slot2.setAttribute('id', 1);
    const text2 = createTextNode('World');
    const view2 = new BackgroundElementTemplateInstance('view');
    slot2.appendChild(text2);
    slot2.appendChild(view2);

    root.appendChild(slot1);
    root.appendChild(slot2);

    const slotChildren = root.slotChildren;
    expect(slotChildren.size).toBe(2);

    expect(slotChildren.get(0)).toEqual([text1]);
    expect(slotChildren.get(1)).toEqual([text2, view2]);
    expect(root.elementSlots[0]).toEqual([text1]);
    expect(root.elementSlots[1]).toEqual([text2, view2]);
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

  it('should ignore non-slot direct children (though technically invalid)', () => {
    const root = new BackgroundElementTemplateInstance('element-template-view');
    const view = new BackgroundElementTemplateInstance('view');
    root.appendChild(view);

    // Should assume it is a slot but fail to get partId or valid id
    const slotChildren = root.slotChildren;
    expect(slotChildren.size).toBe(0);
  });

  it('should ignore slot with default partId (-1)', () => {
    const root = new BackgroundElementTemplateInstance('element-template-view');
    const slot = new BackgroundElementTemplateSlot();
    slot.appendChild(createTextNode('Hello'));
    root.appendChild(slot);

    const slotChildren = root.slotChildren;
    expect(slotChildren.size).toBe(0);
  });
});
