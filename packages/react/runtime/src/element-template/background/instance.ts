// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { clearAttributeSlotEventHandlers, prepareAttributeSlots as prepareRawAttributeSlots } from './attr-slots.js';
import { globalCommitContext, markRemovedSubtreeForCurrentCommit } from './commit-context.js';
import { isElementTemplateHydrated } from './commit-hook.js';
import { backgroundElementTemplateInstanceManager } from './manager.js';
import { isDirectOrDeepEqual } from '../../utils.js';
import { ElementTemplateUpdateOps } from '../protocol/opcodes.js';
import type { ElementTemplateUpdateCommandStream, SerializableValue } from '../protocol/types.js';

function pushOp(...items: ElementTemplateUpdateCommandStream): void {
  globalCommitContext.ops.push(...items);
}

export const BUILTIN_RAW_TEXT_TEMPLATE_KEY = '_et_builtin_raw_text';

function isBuiltinRawTextTemplateKey(type: string): boolean {
  return type === BUILTIN_RAW_TEXT_TEMPLATE_KEY;
}

function stringifyRawTextValue(value: SerializableValue | undefined): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function syncElementSlotChildren(
  parent: BackgroundElementTemplateInstance | null,
  slotId: number,
  children: BackgroundElementTemplateInstance[],
): void {
  if (!parent || slotId < 0) {
    return;
  }
  parent.elementSlots[slotId] = [...children];
}

export class BackgroundElementTemplateInstance {
  public instanceId: number = 0; // Assigned by manager
  public type: string;

  public parent: BackgroundElementTemplateInstance | null = null;
  public firstChild: BackgroundElementTemplateInstance | null = null;
  public lastChild: BackgroundElementTemplateInstance | null = null;
  public nextSibling: BackgroundElementTemplateInstance | null = null;
  public previousSibling: BackgroundElementTemplateInstance | null = null;

  // Shadow State for Hydration
  public attributeSlots: SerializableValue[];
  public elementSlots: BackgroundElementTemplateInstance[][] = [];
  private rawAttributeSlots: readonly unknown[] | undefined;
  private hasEmittedCreate = false;

  get parentNode(): BackgroundElementTemplateInstance | null {
    return this.parent;
  }

  get childNodes(): BackgroundElementTemplateInstance[] {
    const nodes: BackgroundElementTemplateInstance[] = [];
    let child = this.firstChild;
    while (child) {
      nodes.push(child);
      child = child.nextSibling;
    }
    return nodes;
  }

  public nodeType: number;

  constructor(
    type: string,
    initialAttributeSlots?: SerializableValue[],
  ) {
    this.type = type;
    this.nodeType = isBuiltinRawTextTemplateKey(type) ? 3 : 1;
    backgroundElementTemplateInstanceManager.register(this);
    if (initialAttributeSlots) {
      const preparedSlots = prepareRawAttributeSlots(
        this.type,
        this.instanceId,
        initialAttributeSlots,
        isElementTemplateHydrated(),
      );
      this.attributeSlots = preparedSlots;
      if (preparedSlots !== initialAttributeSlots) {
        this.rawAttributeSlots = initialAttributeSlots;
      }
    } else {
      this.attributeSlots = [];
    }
  }

  emitCreate(): void {
    if (this.hasEmittedCreate) {
      return;
    }
    if (this.instanceId === 0 && __DEV__) {
      lynx.reportError(new Error('ElementTemplate patch has illegal handleId 0.'));
      return;
    }

    pushOp(
      ElementTemplateUpdateOps.createTemplate,
      this.instanceId,
      this.type,
      null,
      this.attributeSlots,
      this.elementSlots.map((children) => children.map((child) => child.instanceId)),
    );
    this.hasEmittedCreate = true;
  }

  private isPendingCreate(): boolean {
    return this.instanceId > 0 && !this.hasEmittedCreate;
  }

  private canEmitPatch(): boolean {
    // Background tree construction is local until hydrate binds it to main-thread
    // instances. Only hydrated and already-created owners can emit update ops.
    return isElementTemplateHydrated() && !this.isPendingCreate();
  }

  // DOM API for Preact
  appendChild(child: BackgroundElementTemplateInstance): void {
    this.insertBefore(child, null);
  }

  insertBefore(
    child: BackgroundElementTemplateInstance,
    beforeChild: BackgroundElementTemplateInstance | null,
    silent?: boolean,
  ): void {
    if (beforeChild === child) {
      throw new Error('Cannot insert a node before itself');
    }
    if (beforeChild && beforeChild.parent !== this) {
      throw new Error('Reference node is not a child of this parent');
    }

    if (child.parent) {
      child.parent.removeChild(child, true);
    }

    child.parent = this;

    if (beforeChild) {
      child.nextSibling = beforeChild;
      child.previousSibling = beforeChild.previousSibling;

      if (beforeChild.previousSibling) {
        beforeChild.previousSibling.nextSibling = child;
      } else {
        this.firstChild = child;
      }
      beforeChild.previousSibling = child;
    } else {
      if (this.lastChild) {
        this.lastChild.nextSibling = child;
        child.previousSibling = this.lastChild;
      } else {
        this.firstChild = child;
      }
      this.lastChild = child;
      child.nextSibling = null;
    }

    if (child instanceof BackgroundElementTemplateSlot) {
      syncElementSlotChildren(this, child.partId, collectChildren(child));
    }

    if (this instanceof BackgroundElementTemplateSlot) {
      const slotId = this.partId;
      const parent = this.parent;
      if (parent) {
        syncElementSlotChildren(parent, slotId, collectChildren(this));
      }
      if (silent) {
        return;
      }
      if (slotId !== -1 && parent) {
        if (!parent.canEmitPatch()) {
          return;
        }
        const beforeId = beforeChild ? beforeChild.instanceId : 0;
        emitCreateRecursive(child);
        pushOp(
          ElementTemplateUpdateOps.insertNode,
          parent.instanceId,
          slotId,
          child.instanceId,
          beforeId,
        );
      }
      return;
    }

    if (silent) {
      return;
    }
  }

  removeChild(child: BackgroundElementTemplateInstance, silent?: boolean): void {
    if (child.parent !== this) {
      throw new Error('Node is not a child of this parent');
    }

    if (child.previousSibling) {
      child.previousSibling.nextSibling = child.nextSibling;
    } else {
      this.firstChild = child.nextSibling;
    }

    if (child.nextSibling) {
      child.nextSibling.previousSibling = child.previousSibling;
    } else {
      this.lastChild = child.previousSibling;
    }

    child.parent = null;
    child.nextSibling = null;
    child.previousSibling = null;

    if (child instanceof BackgroundElementTemplateSlot && child.partId >= 0) {
      this.elementSlots[child.partId] = [];
    }

    if (this instanceof BackgroundElementTemplateSlot) {
      const slotId = this.partId;
      const parent = this.parent;
      if (parent) {
        syncElementSlotChildren(parent, slotId, collectChildren(this));
      }
      if (silent) {
        return;
      }
      if (slotId !== -1 && parent) {
        if (!parent.canEmitPatch()) {
          if (child.isPendingCreate()) {
            // A never-created subtree has no main-thread registry entry, so it
            // can be released from the background manager without delayed cleanup.
            child.tearDown();
          }
          return;
        }
        pushOp(
          ElementTemplateUpdateOps.removeNode,
          parent.instanceId,
          slotId,
          child.instanceId,
          collectElementTemplateSubtreeHandleIds(child),
        );
        // The removed JS object graph may outlive the detach until GC, so keep
        // it pending and tear it down on the Snapshot-aligned delayed boundary.
        markRemovedSubtreeForCurrentCommit(child);
      }
      return;
    }

    if (silent) {
      return;
    }
  }

  tearDown(): void {
    // Recursively tear down children first
    let child = this.firstChild;
    while (child) {
      const next = child.nextSibling;
      child.tearDown();
      child = next;
    }

    // Clear references
    this.parent = null;
    this.firstChild = null;
    this.lastChild = null;
    this.previousSibling = null;
    this.nextSibling = null;

    this.attributeSlots = [];
    this.rawAttributeSlots = undefined;
    this.elementSlots = [];

    // Remove from manager
    if (this.instanceId) {
      clearAttributeSlotEventHandlers(this.type, this.instanceId);
      backgroundElementTemplateInstanceManager.values.delete(this.instanceId);
    }
  }

  markCreateEmittedForHydration(): void {
    // Hydration binds this object to a template that already exists on the main
    // thread; future updates must treat it as created without emitting create.
    this.hasEmittedCreate = true;
  }

  prepareAttributeSlotsForNative(): void {
    if (!this.rawAttributeSlots) {
      return;
    }
    this.attributeSlots = prepareRawAttributeSlots(
      this.type,
      this.instanceId,
      this.rawAttributeSlots,
      true,
    );
  }

  setAttribute(key: string, value: unknown): void {
    if (isBuiltinRawTextTemplateKey(this.type) && (key === '0' || key === 'data')) {
      this.text = String(value);
    } else if (key === 'attributeSlots' && Array.isArray(value)) {
      const previousSlots = this.attributeSlots;
      const isHydrated = isElementTemplateHydrated();
      const canEmitPatch = isHydrated && !this.isPendingCreate();
      const nextSlots = prepareRawAttributeSlots(
        this.type,
        this.instanceId,
        value,
        isHydrated,
      );
      this.rawAttributeSlots = nextSlots === value ? undefined : value;
      const maxLength = Math.max(previousSlots.length, nextSlots.length);
      this.attributeSlots = nextSlots;
      for (let slotIndex = 0; slotIndex < maxLength; slotIndex += 1) {
        const previousValue = previousSlots[slotIndex];
        const nextValue = nextSlots[slotIndex];
        if (isDirectOrDeepEqual(previousValue, nextValue)) {
          continue;
        }
        if (!canEmitPatch) {
          continue;
        }
        pushOp(
          ElementTemplateUpdateOps.setAttribute,
          this.instanceId,
          slotIndex,
          nextValue ?? null,
        );
      }
    } else if (key === 'id' && this instanceof BackgroundElementTemplateSlot) {
      const previousPartId = this.partId;
      this.partId = Number(value);
      if (this.parent && previousPartId >= 0 && previousPartId !== this.partId) {
        this.parent.elementSlots[previousPartId] = [];
      }
      syncElementSlotChildren(this.parent, this.partId, collectChildren(this));
    } else {
      return;
    }
  }

  get text(): string {
    return stringifyRawTextValue(this.attributeSlots[0]);
  }
  set text(value: string) {
    if (!isBuiltinRawTextTemplateKey(this.type)) {
      return;
    }
    const text = String(value);
    if (this.attributeSlots[0] === text) {
      return;
    }
    this.rawAttributeSlots = undefined;
    this.attributeSlots = [text];
    if (!this.canEmitPatch()) {
      return;
    }
    pushOp(ElementTemplateUpdateOps.setAttribute, this.instanceId, 0, text);
  }

  get data(): string {
    return this.text;
  }
  set data(value: string) {
    this.text = value;
  }
}

export class BackgroundElementTemplateSlot extends BackgroundElementTemplateInstance {
  public partId: number = -1;

  constructor() {
    super('slot');
  }
}

export function collectElementTemplateSubtreeHandleIds(
  root: BackgroundElementTemplateInstance,
): number[] {
  const handles: number[] = [];
  collectElementTemplateSubtreeHandleIdsImpl(root, handles);
  return handles;
}

function collectElementTemplateSubtreeHandleIdsImpl(
  instance: BackgroundElementTemplateInstance,
  handles: number[],
): void {
  if (!(instance instanceof BackgroundElementTemplateSlot) && instance.instanceId !== 0) {
    handles.push(instance.instanceId);
  }
  let child = instance.firstChild;
  while (child) {
    collectElementTemplateSubtreeHandleIdsImpl(child, handles);
    child = child.nextSibling;
  }
}

function emitCreateRecursive(instance: BackgroundElementTemplateInstance): void {
  if (
    !isElementTemplateHydrated()
    || instance.instanceId < 0
    || instance instanceof BackgroundElementTemplateSlot
  ) {
    return;
  }

  for (const slotChildren of instance.elementSlots) {
    if (!slotChildren) {
      continue;
    }
    for (const child of slotChildren) {
      emitCreateRecursive(child);
    }
  }
  instance.emitCreate();
}

function collectChildren(slot: BackgroundElementTemplateSlot): BackgroundElementTemplateInstance[] {
  const res: BackgroundElementTemplateInstance[] = [];
  let child = slot.firstChild;
  while (child) {
    res.push(child);
    child = child.nextSibling;
  }
  return res;
}
