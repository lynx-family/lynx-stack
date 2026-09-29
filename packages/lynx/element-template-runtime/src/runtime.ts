// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ElementTemplateSerializableValue } from './protocol.js';

export interface ElementTemplateHandle<NativeHandle = unknown> {
  readonly id: number;
  readonly nativeHandle: NativeHandle;
}

export type ElementTemplateChildSlots<NativeHandle> = Array<
  ElementTemplateHandle<NativeHandle>[] | null | undefined
>;

export interface ElementTemplateDescriptor<NativeHandle = unknown> {
  templateKey: string;
  bundleUrl?: string | null;
  attributeSlots?: ElementTemplateSerializableValue[] | null;
  attributeSlotsFactory?: (
    handleId: number,
  ) => ElementTemplateSerializableValue[] | null;
  childSlots?: ElementTemplateChildSlots<NativeHandle> | null;
}

export interface CreateElementTemplateRequest<NativeHandle> {
  handleId: number;
  templateKey: string;
  bundleUrl: string | null;
  attributeSlots: ElementTemplateSerializableValue[] | null;
  childSlots: Array<NativeHandle[] | null | undefined> | null;
}

export interface InsertElementTemplateNodeRequest<NativeHandle> {
  parent: NativeHandle;
  childSlotIndex: number;
  child: NativeHandle;
  before: NativeHandle | null;
}

export interface RemoveElementTemplateNodeRequest<NativeHandle> {
  parent: NativeHandle;
  childSlotIndex: number;
  child: NativeHandle;
}

export interface NativeElementTemplateApi<NativeHandle> {
  createTemplate(
    request: CreateElementTemplateRequest<NativeHandle>,
  ): NativeHandle | null | undefined;
  flush?(): void;
  insertNode(request: InsertElementTemplateNodeRequest<NativeHandle>): void;
  removeNode(request: RemoveElementTemplateNodeRequest<NativeHandle>): void;
  setAttribute(
    target: NativeHandle,
    attributeSlotIndex: number,
    value: ElementTemplateSerializableValue,
  ): void;
}

interface ParentLocation {
  childSlotIndex: number;
  parentId: number;
}

export class ElementTemplateRuntime<NativeHandle> {
  readonly #api: NativeElementTemplateApi<NativeHandle>;
  readonly #handles = new Map<number, ElementTemplateHandle<NativeHandle>>();
  readonly #childSlots = new Map<
    number,
    Array<number[] | null | undefined>
  >();
  readonly #parents = new Map<number, ParentLocation>();
  #nextHandleId = -1;

  public constructor(api: NativeElementTemplateApi<NativeHandle>) {
    this.#api = api;
  }

  public registerRoot(
    nativeHandle: NativeHandle,
    handleId = 0,
  ): ElementTemplateHandle<NativeHandle> {
    if (this.#handles.has(handleId)) {
      throw new Error(
        `Element Template handle ${handleId} is already registered.`,
      );
    }

    const handle = { id: handleId, nativeHandle };
    this.#handles.set(handleId, handle);
    return handle;
  }

  public createTemplate(
    descriptor: ElementTemplateDescriptor<NativeHandle>,
  ): ElementTemplateHandle<NativeHandle> {
    if (
      descriptor.attributeSlots !== undefined
      && descriptor.attributeSlotsFactory !== undefined
    ) {
      throw new Error(
        'Element Template descriptors cannot define both attributeSlots and attributeSlotsFactory.',
      );
    }
    const handleId = this.#nextHandleId--;
    const attributeSlots = descriptor.attributeSlotsFactory?.(handleId)
      ?? descriptor.attributeSlots
      ?? null;
    const childSlots = descriptor.childSlots ?? null;
    this.#validateChildSlots(childSlots);
    const nativeHandle = this.#api.createTemplate({
      handleId,
      templateKey: descriptor.templateKey,
      bundleUrl: descriptor.bundleUrl ?? null,
      attributeSlots,
      childSlots: childSlots?.map(slot =>
        slot?.map(child => child.nativeHandle)
      ) ?? null,
    });

    if (nativeHandle == null) {
      throw new Error(
        `Failed to create Element Template "${descriptor.templateKey}".`,
      );
    }

    const handle = { id: handleId, nativeHandle };
    this.#handles.set(handleId, handle);
    this.#rememberChildSlots(handle, childSlots);
    return handle;
  }

  public setAttribute(
    target: ElementTemplateHandle<NativeHandle>,
    attributeSlotIndex: number,
    value: ElementTemplateSerializableValue,
  ): void {
    this.#assertRegistered(target);
    this.#api.setAttribute(
      target.nativeHandle,
      attributeSlotIndex,
      value,
    );
  }

  public insertNode(
    parent: ElementTemplateHandle<NativeHandle>,
    childSlotIndex: number,
    child: ElementTemplateHandle<NativeHandle>,
    before: ElementTemplateHandle<NativeHandle> | null = null,
  ): void {
    this.#assertRegistered(parent);
    this.#assertRegistered(child);
    if (before !== null) {
      this.#assertRegistered(before);
    }

    const destinationChildren = this.#childSlots.get(parent.id)
      ?.[childSlotIndex] ?? [];
    if (
      before !== null
      && (before.id === child.id || !destinationChildren.includes(before.id))
    ) {
      throw new Error(
        `Reference handle ${before.id} is not in child slot ${childSlotIndex}.`,
      );
    }

    for (
      let ancestor: ParentLocation | undefined = {
        parentId: parent.id,
        childSlotIndex,
      };
      ancestor !== undefined;
      ancestor = this.#parents.get(ancestor.parentId)
    ) {
      if (ancestor.parentId === child.id) {
        throw new Error(
          `Element Template handle ${child.id} cannot be inserted into its own subtree.`,
        );
      }
    }

    this.#api.insertNode({
      parent: parent.nativeHandle,
      childSlotIndex,
      child: child.nativeHandle,
      before: before?.nativeHandle ?? null,
    });

    this.#detachFromParent(child.id);
    const slots = this.#childSlots.get(parent.id) ?? [];
    const children = slots[childSlotIndex] ?? [];
    const beforeIndex = before === null ? -1 : children.indexOf(before.id);
    if (beforeIndex < 0) {
      children.push(child.id);
    } else {
      children.splice(beforeIndex, 0, child.id);
    }
    slots[childSlotIndex] = children;
    this.#childSlots.set(parent.id, slots);
    this.#parents.set(child.id, { parentId: parent.id, childSlotIndex });
  }

  public removeNode(
    parent: ElementTemplateHandle<NativeHandle>,
    childSlotIndex: number,
    child: ElementTemplateHandle<NativeHandle>,
  ): number[] {
    this.#assertRegistered(parent);
    this.#assertRegistered(child);
    const location = this.#parents.get(child.id);
    if (
      location?.parentId !== parent.id
      || location.childSlotIndex !== childSlotIndex
    ) {
      throw new Error(
        `Element Template handle ${child.id} is not attached to handle ${parent.id} at child slot ${childSlotIndex}.`,
      );
    }

    this.#api.removeNode({
      parent: parent.nativeHandle,
      childSlotIndex,
      child: child.nativeHandle,
    });
    this.#detachFromParent(child.id);
    return this.releaseSubtree(child);
  }

  public releaseSubtree(
    root: ElementTemplateHandle<NativeHandle>,
  ): number[] {
    this.#assertRegistered(root);
    const releasedIds: number[] = [];
    this.#releaseSubtreeById(root.id, releasedIds);
    return releasedIds;
  }

  public getHandle(
    handleId: number,
  ): ElementTemplateHandle<NativeHandle> | undefined {
    return this.#handles.get(handleId);
  }

  #assertRegistered(handle: ElementTemplateHandle<NativeHandle>): void {
    if (this.#handles.get(handle.id) !== handle) {
      throw new Error(
        `Element Template handle ${handle.id} is not registered in this runtime.`,
      );
    }
  }

  #validateChildSlots(
    childSlots: ElementTemplateChildSlots<NativeHandle> | null,
  ): void {
    if (childSlots === null) {
      return;
    }

    const childIds = new Set<number>();
    for (const slot of childSlots) {
      for (const child of slot ?? []) {
        this.#assertRegistered(child);
        if (this.#parents.has(child.id)) {
          throw new Error(
            `Element Template handle ${child.id} already has a parent.`,
          );
        }
        if (childIds.has(child.id)) {
          throw new Error(
            `Element Template handle ${child.id} occurs more than once in child slots.`,
          );
        }
        childIds.add(child.id);
      }
    }
  }

  #rememberChildSlots(
    parent: ElementTemplateHandle<NativeHandle>,
    childSlots: ElementTemplateChildSlots<NativeHandle> | null,
  ): void {
    if (childSlots === null) {
      return;
    }

    const childIds = childSlots.map(slot => slot?.map(child => child.id));
    this.#childSlots.set(parent.id, childIds);
    childSlots.forEach((slot, childSlotIndex) => {
      slot?.forEach(child => {
        this.#parents.set(child.id, {
          parentId: parent.id,
          childSlotIndex,
        });
      });
    });
  }

  #detachFromParent(childId: number): void {
    const location = this.#parents.get(childId);
    if (location === undefined) {
      return;
    }

    const slot = this.#childSlots.get(location.parentId)
      ?.[location.childSlotIndex];
    const index = slot?.indexOf(childId) ?? -1;
    if (index >= 0) {
      slot?.splice(index, 1);
    }
    this.#parents.delete(childId);
  }

  #releaseSubtreeById(handleId: number, releasedIds: number[]): void {
    this.#childSlots.get(handleId)?.forEach(slot => {
      slot?.forEach(childId => {
        this.#releaseSubtreeById(childId, releasedIds);
      });
    });
    this.#childSlots.delete(handleId);
    this.#parents.delete(handleId);
    this.#handles.delete(handleId);
    releasedIds.push(handleId);
  }
}
