// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  getAttributeSlotUpdateOp,
  prepareAttributeSlots as prepareRawAttributeSlots,
  queueRefAttributeSlotUpdates,
} from './attr-slots.js';
import { globalCommitContext, markRemovedSubtreeForPostDispatchTeardown } from './commit-context.js';
import { isElementTemplateHydrated } from './commit-hook.js';
import { backgroundElementTemplateInstanceManager } from './manager.js';
import { collectElementTemplateSubtreeHandleIds, collectMainThreadRefSubtreeHandleIds } from './subtree-handles.js';
import { isDirectOrDeepEqual } from '../../core/deep-equal.js';
import { ElementTemplateUpdateOps } from '../protocol/opcodes.js';
import { ELEMENT_TEMPLATE_PAGE_HANDLE_ID } from '../protocol/page.js';
import { parseElementTemplateType } from '../protocol/template-type.js';
import type {
  ElementTemplateHandleSlotsCommand,
  ElementTemplateUpdateCommandStream,
  SerializableValue,
} from '../protocol/types.js';
import type { EtAttrPlan } from '../runtime/template/attr-slot-plan.js';

export function pushElementTemplateOp(...items: ElementTemplateUpdateCommandStream): void {
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

const EMPTY_LIST_ITEM_PLATFORM_INFO: Record<string, SerializableValue> = {};

export interface LogicalListContainerInstance extends BackgroundElementTemplateInstance {
  notifyLogicalChildUpdated(child: BackgroundElementTemplateInstance): void;
}

const logicalListContainers = /*#__PURE__*/ new WeakSet<BackgroundElementTemplateInstance>();

export function markLogicalListContainer(instance: LogicalListContainerInstance): void {
  logicalListContainers.add(instance);
}

function isLogicalListContainer(
  instance: BackgroundElementTemplateInstance | null,
): instance is LogicalListContainerInstance {
  return logicalListContainers.has(instance!);
}

export class BackgroundElementTemplateInstance {
  public instanceId: number = 0; // Assigned by manager
  public type: string;

  public parent: BackgroundElementTemplateInstance | null = null;
  public firstChild: BackgroundElementTemplateInstance | null = null;
  public lastChild: BackgroundElementTemplateInstance | null = null;
  public nextSibling: BackgroundElementTemplateInstance | null = null;
  public previousSibling: BackgroundElementTemplateInstance | null = null;

  public __slotIndex: number = 0;

  // Shadow State for Hydration
  public attributeSlots: SerializableValue[];
  private rawAttributeSlots: readonly unknown[] | undefined;
  protected isMaterializedOnMainThread: boolean = false;
  private listItemPlatformInfo: Record<string, SerializableValue> | undefined;

  get parentNode(): BackgroundElementTemplateInstance | null {
    return this.parent;
  }

  // Preact 11's `removeNode` calls `node.remove()` instead of
  // `parentNode.removeChild(node)`.
  remove(): void {
    this.parentNode?.removeChild(this);
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

  get childSlots(): BackgroundElementTemplateInstance[][] {
    const childSlots: BackgroundElementTemplateInstance[][] = [];
    let child = this.firstChild;
    while (child) {
      (childSlots[child.__slotIndex] ??= []).push(child);
      child = child.nextSibling;
    }
    return childSlots;
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
      const preparedSlots = prepareRawAttributeSlots(this.type, this.instanceId, initialAttributeSlots);
      this.attributeSlots = preparedSlots;
      if (preparedSlots !== initialAttributeSlots) {
        this.rawAttributeSlots = initialAttributeSlots;
      }
    } else {
      this.attributeSlots = [];
    }
  }

  emitCreate(): void {
    if (this.isMaterializedOnMainThread) {
      return;
    }
    if (__DEV__ && this.instanceId === ELEMENT_TEMPLATE_PAGE_HANDLE_ID) {
      lynx.reportError(new Error('ElementTemplate patch has illegal handleId 0.'));
      return;
    }
    backgroundElementTemplateInstanceManager.restoreRegistration(this);

    // Walk the linked-list children once to build the slot-indexed handle list
    // for the createTemplate op. Going via `this.childSlots` would allocate
    // the full `Instance[][]` intermediate just to throw it away here.
    const serializedSlots: ElementTemplateHandleSlotsCommand = [];
    let child = this.firstChild;
    while (child) {
      (serializedSlots[child.__slotIndex] ??= []).push(child.instanceId);
      child = child.nextSibling;
    }
    const nativeTemplate = parseElementTemplateType(this.type);

    pushElementTemplateOp(
      ElementTemplateUpdateOps.createTemplate,
      this.instanceId,
      nativeTemplate.templateKey,
      nativeTemplate.bundleUrl,
      this.attributeSlots,
      serializedSlots,
    );
    this.isMaterializedOnMainThread = true;
  }

  private needsMainThreadCreate(): boolean {
    return this.instanceId !== ELEMENT_TEMPLATE_PAGE_HANDLE_ID && !this.isMaterializedOnMainThread;
  }

  protected getAttributeSlotPlan(): EtAttrPlan | undefined {
    return undefined;
  }

  private markSubtreeDetachedFromMainThread(): void {
    if (this.instanceId !== ELEMENT_TEMPLATE_PAGE_HANDLE_ID) {
      this.isMaterializedOnMainThread = false;
    }
    let child = this.firstChild;
    while (child) {
      child.markSubtreeDetachedFromMainThread();
      child = child.nextSibling;
    }
  }

  releaseDetachedSubtreeFromManager(): void {
    if (this.parent !== null || this.isMaterializedOnMainThread) {
      return;
    }
    this.releaseSubtreeFromManager();
  }

  private releaseSubtreeFromManager(): void {
    backgroundElementTemplateInstanceManager.unregister(this);
    let child = this.firstChild;
    while (child) {
      child.releaseSubtreeFromManager();
      child = child.nextSibling;
    }
  }

  emitMainThreadCreateIfNeeded(): void {
    if (!this.needsMainThreadCreate()) {
      return;
    }
    // New descendants materialize at their own insert boundary, and lifetime
    // removal clears this flag recursively before a subtree is reattached.
    let child = this.firstChild;
    while (child) {
      child.emitMainThreadCreateIfNeeded();
      child = child.nextSibling;
    }
    // An unmaterialized subtree may receive attr updates before it is inserted;
    // prepare here so its materializing insert attaches the latest ref value.
    this.prepareAttributeSlotsForNative();
    this.emitCreate();
  }

  protected canEmitUpdatePatch(): boolean {
    return isElementTemplateHydrated() && !this.needsMainThreadCreate();
  }

  protected cleanupDetachedChildForLifetimeRemoval(
    child: BackgroundElementTemplateInstance,
    canEmitUpdatePatch: boolean,
  ): void {
    if (canEmitUpdatePatch) {
      child.markSubtreeDetachedFromMainThread();
      // The removed JS object graph may outlive the detach until GC, so keep
      // it pending and tear it down on the Snapshot-aligned delayed boundary.
      markRemovedSubtreeForPostDispatchTeardown(child);
      child.queueRefCleanupForSubtree();
      return;
    }

    // Mirrors `shouldQueueRefEffects` in `setAttribute`: pre-hydration
    // commits and post-hydration materialized children publish their refs
    // to user effects. Post-hydration unmaterialized children defer attach
    // to `emitCreate`, which never fires for a subtree torn down before
    // insert — so cleaning up there would emit a spurious detach.
    const refAttachWasPublished = !isElementTemplateHydrated()
      || !child.needsMainThreadCreate();
    if (refAttachWasPublished) {
      // Run before any tearDown below: `tearDown` clears `rawAttributeSlots`,
      // which `queueRefCleanupForSubtree` walks to enqueue the detach.
      child.queueRefCleanupForSubtree();
    }
    if (child.needsMainThreadCreate()) {
      // An unmaterialized subtree has no main-thread registry entry, so it
      // can be released from the background manager without delayed cleanup.
      child.tearDown();
    }
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

    const previousParent = child.parent;
    if (previousParent) {
      previousParent.removeChild(child, true);
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

    if (silent || !this.canEmitUpdatePatch()) {
      return;
    }

    const beforeId = (beforeChild && beforeChild.__slotIndex === child.__slotIndex) ? beforeChild.instanceId : 0;
    const containingListItem = getContainingListItem(child);
    const movedMainThreadRefHandleIds = collectMainThreadRefSubtreeHandleIds(child);
    child.emitMainThreadCreateIfNeeded();
    pushElementTemplateOp(
      ElementTemplateUpdateOps.insertNode,
      this.instanceId,
      child.__slotIndex,
      child.instanceId,
      beforeId,
      containingListItem ? null : movedMainThreadRefHandleIds,
    );
    if (
      movedMainThreadRefHandleIds !== null
      && containingListItem
      && previousParent !== this
    ) {
      notifyListItemSubtreeUpdated(containingListItem);
    }
  }

  removeChild(child: BackgroundElementTemplateInstance, silent?: boolean): void {
    if (child.parent !== this) {
      throw new Error('Node is not a child of this parent');
    }

    const containingListItem = getContainingListItem(child);

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

    const slotId = child.__slotIndex;
    if (silent) {
      return;
    }
    const canEmitUpdatePatch = this.canEmitUpdatePatch();
    if (canEmitUpdatePatch) {
      pushElementTemplateOp(
        ElementTemplateUpdateOps.removeNode,
        this.instanceId,
        slotId,
        child.instanceId,
        collectElementTemplateSubtreeHandleIds(child),
      );
    }
    this.cleanupDetachedChildForLifetimeRemoval(child, canEmitUpdatePatch);
    if (
      canEmitUpdatePatch
      && containingListItem
      && collectMainThreadRefSubtreeHandleIds(child) !== null
    ) {
      notifyListItemSubtreeUpdated(containingListItem);
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

    backgroundElementTemplateInstanceManager.unregister(this);
  }

  queueRefCleanupForSubtree(): void {
    if (this.rawAttributeSlots) {
      queueRefAttributeSlotUpdates(
        this.type,
        this,
        this.rawAttributeSlots,
        undefined,
        this.getAttributeSlotPlan(),
      );
    }

    let child = this.firstChild;
    while (child) {
      child.queueRefCleanupForSubtree();
      child = child.nextSibling;
    }
  }

  getRawAttributeSlot(attrSlotIndex: number): unknown {
    return this.rawAttributeSlots?.[attrSlotIndex] ?? this.attributeSlots[attrSlotIndex];
  }

  markMaterializedByHydration(): void {
    // Hydration has already registered the stable handle through updateId.
    // Future updates must not emit create for this existing main-thread template.
    this.isMaterializedOnMainThread = true;
  }

  prepareAttributeSlotsForNative(options?: { publishRefEffects?: boolean }): void {
    if (!this.rawAttributeSlots) {
      return;
    }
    this.attributeSlots = prepareRawAttributeSlots(
      this.type,
      this.instanceId,
      this.rawAttributeSlots,
      {
        previousPreparedSlots: this.attributeSlots,
        previousRawSlots: this.rawAttributeSlots,
        attributePlan: this.getAttributeSlotPlan(),
      },
    );
    if (options?.publishRefEffects ?? true) {
      queueRefAttributeSlotUpdates(
        this.type,
        this,
        undefined,
        this.rawAttributeSlots,
        this.getAttributeSlotPlan(),
      );
    }
  }

  prepareAttributeSlotsForHydration(): void {
    if (!this.rawAttributeSlots) {
      return;
    }
    // Hydrate only rebinds the selector marker to the stable handle. The ref was
    // already made visible to user effects on the pre-hydration commit path.
    this.prepareAttributeSlotsForNative({
      publishRefEffects: false,
    });
  }

  setAttribute(key: string, value: unknown): void {
    if (isBuiltinRawTextTemplateKey(this.type) && (key === '0' || key === 'data')) {
      this.text = String(value);
    } else if (key === '__listItemPlatformInfo') {
      const previous = this.getListItemPlatformInfo();
      const next = value as Record<string, SerializableValue>;
      this.listItemPlatformInfo = next;
      if (!isDirectOrDeepEqual(previous, next)) {
        notifyListItemSubtreeUpdated(this);
      }
    } else if (key === 'attributeSlots' && Array.isArray(value)) {
      const previousSlots = this.attributeSlots;
      const previousRawSlots = this.rawAttributeSlots ?? previousSlots;
      const isHydrated = isElementTemplateHydrated();
      const canEmitUpdatePatch = this.canEmitUpdatePatch();
      // Pre-hydration commits must expose refs to effects, while post-hydration
      // unmaterialized nodes defer ref attach to create emission to avoid dupes.
      const shouldQueueRefEffects = !isHydrated || canEmitUpdatePatch;
      const nextSlots = prepareRawAttributeSlots(
        this.type,
        this.instanceId,
        value,
        {
          previousPreparedSlots: previousSlots,
          previousRawSlots,
          attributePlan: this.getAttributeSlotPlan(),
        },
      );
      if (shouldQueueRefEffects) {
        queueRefAttributeSlotUpdates(
          this.type,
          this,
          previousRawSlots,
          value,
          this.getAttributeSlotPlan(),
        );
      }
      this.rawAttributeSlots = nextSlots === value ? undefined : value;
      this.attributeSlots = nextSlots;
      if (!canEmitUpdatePatch) {
        return;
      }
      const maxLength = Math.max(previousSlots.length, nextSlots.length);
      for (let slotIndex = 0; slotIndex < maxLength; slotIndex += 1) {
        const previousValue = previousSlots[slotIndex];
        const nextValue = nextSlots[slotIndex];
        if (isDirectOrDeepEqual(previousValue, nextValue)) {
          continue;
        }
        pushElementTemplateOp(
          getAttributeSlotUpdateOp(this.type, slotIndex),
          this.instanceId,
          slotIndex,
          nextValue ?? null,
        );
      }
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
    if (!this.canEmitUpdatePatch()) {
      return;
    }
    pushElementTemplateOp(ElementTemplateUpdateOps.setAttribute, this.instanceId, 0, text);
  }

  get data(): string {
    return this.text;
  }
  set data(value: string) {
    this.text = value;
  }

  getListItemPlatformInfo(): Record<string, SerializableValue> {
    return this.listItemPlatformInfo ?? EMPTY_LIST_ITEM_PLATFORM_INFO;
  }
}

export function getContainingListItem(
  instance: BackgroundElementTemplateInstance,
): BackgroundElementTemplateInstance | undefined {
  let child: BackgroundElementTemplateInstance = instance;
  let parent = child.parent;
  while (parent) {
    if (isLogicalListContainer(parent)) {
      return child;
    }
    child = parent;
    parent = child.parent;
  }
  return undefined;
}

function notifyListItemSubtreeUpdated(
  listItem: BackgroundElementTemplateInstance,
): void {
  if (isLogicalListContainer(listItem.parent)) {
    listItem.parent.notifyLogicalChildUpdated(listItem);
  }
}
