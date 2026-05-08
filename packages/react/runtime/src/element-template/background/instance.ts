// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { GlobalCommitContext, markRemovedSubtreeForCurrentCommit } from './commit-context.js';
import { isElementTemplateHydrated } from './commit-hook.js';
import { backgroundElementTemplateInstanceManager } from './manager.js';
import { isDirectOrDeepEqual } from '../../utils.js';
import { ElementTemplateUpdateOps } from '../protocol/opcodes.js';
import type { ElementTemplateUpdateCommandStream, RuntimeOptions, SerializableValue } from '../protocol/types.js';

function pushOp(...items: ElementTemplateUpdateCommandStream): void {
  GlobalCommitContext.ops.push(...items);
}

export const BUILTIN_RAW_TEXT_TEMPLATE_KEY = '__et_builtin_raw_text__';

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

function normalizeAttributeSlots(
  slots: readonly (SerializableValue | undefined)[],
): SerializableValue[] {
  return slots.map((slot) => normalizeAttributeSlotValue(slot));
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
  public attributeSlots: SerializableValue[] = [];
  public elementSlots: BackgroundElementTemplateInstance[][] = [];
  public options: RuntimeOptions | undefined;
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

  // 2. Slot State: aggregate children by slotId
  get slotChildren(): Map<number, BackgroundElementTemplateInstance[]> {
    const map = new Map<number, BackgroundElementTemplateInstance[]>();
    for (let slotId = 0; slotId < this.elementSlots.length; slotId += 1) {
      const children = this.elementSlots[slotId];
      if (children) {
        map.set(slotId, [...children]);
      }
    }
    return map;
  }

  public nodeType: number;

  constructor(
    type: string,
    initialAttributeSlots?: SerializableValue[],
    initialOptions?: RuntimeOptions,
  ) {
    this.type = type;
    this.nodeType = isBuiltinRawTextTemplateKey(type) ? 3 : 1;
    this.attributeSlots = initialAttributeSlots ? normalizeAttributeSlots(initialAttributeSlots) : [];
    this.options = initialOptions;
    backgroundElementTemplateInstanceManager.register(this);
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
      normalizeAttributeSlots(this.attributeSlots),
      this.elementSlots.map((children) => children.map((child) => child.instanceId)),
    );
    this.hasEmittedCreate = true;
  }

  private isPendingCreate(): boolean {
    return isElementTemplateHydrated()
      && this.instanceId > 0
      && !this.hasEmittedCreate;
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
        if (parent.isPendingCreate()) {
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
    this.elementSlots = [];
    this.options = undefined;

    // Remove from manager
    if (this.instanceId) {
      backgroundElementTemplateInstanceManager.values.delete(this.instanceId);
    }
  }

  markCreateEmittedForHydration(): void {
    // Hydration binds this object to a template that already exists on the main
    // thread; future updates must treat it as created without emitting create.
    this.hasEmittedCreate = true;
  }

  setAttribute(key: string, value: unknown): void {
    if (isBuiltinRawTextTemplateKey(this.type) && (key === '0' || key === 'data')) {
      this.text = String(value);
    } else if (key === 'attributeSlots' && Array.isArray(value)) {
      const previousSlots = this.attributeSlots;
      const nextSlots = normalizeAttributeSlots(value as Array<SerializableValue | undefined>);
      const maxLength = Math.max(previousSlots.length, nextSlots.length);
      this.attributeSlots = nextSlots;
      for (let slotIndex = 0; slotIndex < maxLength; slotIndex += 1) {
        const previousValue = previousSlots[slotIndex];
        const nextValue = nextSlots[slotIndex];
        if (isDirectOrDeepEqual(previousValue, nextValue)) {
          continue;
        }
        if (this.isPendingCreate()) {
          continue;
        }
        pushOp(
          ElementTemplateUpdateOps.setAttribute,
          this.instanceId,
          slotIndex,
          normalizeAttributeSlotValue(nextValue),
        );
      }
    } else if (key === 'id' && this instanceof BackgroundElementTemplateSlot) {
      const previousPartId = this.partId;
      this.partId = Number(value);
      if (this.parent && previousPartId >= 0 && previousPartId !== this.partId) {
        this.parent.elementSlots[previousPartId] = [];
      }
      syncElementSlotChildren(this.parent, this.partId, collectChildren(this));
    } else if (key === 'options' && isRuntimeOptions(value)) {
      this.options = value;
    } else if (key === '__spread' || key === 'elementSlots' || key === 'children') {
      return;
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
    this.attributeSlots = [text];
    if (this.isPendingCreate()) {
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

function normalizeAttributeSlotValue(value: SerializableValue | undefined): SerializableValue | null {
  return value === undefined ? null : value;
}

function isRuntimeOptions(value: unknown): value is RuntimeOptions {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
