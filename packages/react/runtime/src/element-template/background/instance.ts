// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { prepareAttributeSlots as prepareRawAttributeSlots, queueRefAttributeSlotUpdates } from './attr-slots.js';
import { globalCommitContext, markRemovedSubtreeForPostDispatchTeardown } from './commit-context.js';
import { isElementTemplateHydrated } from './commit-hook.js';
import { backgroundElementTemplateInstanceManager } from './manager.js';
import { isDirectOrDeepEqual } from '../../utils.js';
import { ElementTemplateUpdateOps } from '../protocol/opcodes.js';
import { parseElementTemplateType } from '../protocol/template-type.js';
import type {
  ElementTemplateHandleSlotsCommand,
  ElementTemplateUpdateCommandStream,
  RuntimeOptionsCommand,
  SerializableValue,
  TypedElementAttributesCommand,
  UpdateTypedListItemCommand,
} from '../protocol/types.js';

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

const EMPTY_LIST_ITEM_PLATFORM_INFO: Record<string, SerializableValue> = {};
const EMPTY_REMOVED_SUBTREE_HANDLE_IDS: number[] = [];

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
  protected isMaterializedOnMainThread = false;
  private listItemPlatformInfo: Record<string, SerializableValue> | undefined;

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

  get elementSlots(): BackgroundElementTemplateInstance[][] {
    const elementSlots: BackgroundElementTemplateInstance[][] = [];
    let child = this.firstChild;
    while (child) {
      (elementSlots[child.__slotIndex] ??= []).push(child);
      child = child.nextSibling;
    }
    return elementSlots;
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
    if (__DEV__ && this.instanceId === 0) {
      lynx.reportError(new Error('ElementTemplate patch has illegal handleId 0.'));
      return;
    }
    this.restoreManagerRegistration();

    // Walk the linked-list children once to build the slot-indexed handle list
    // for the createTemplate op. Going via `this.elementSlots` would allocate
    // the full `Instance[][]` intermediate just to throw it away here.
    const serializedSlots: ElementTemplateHandleSlotsCommand = [];
    let child = this.firstChild;
    while (child) {
      (serializedSlots[child.__slotIndex] ??= []).push(child.instanceId);
      child = child.nextSibling;
    }
    const nativeTemplate = parseElementTemplateType(this.type);

    pushOp(
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
    return this.instanceId !== 0 && !this.isMaterializedOnMainThread;
  }

  private markSubtreeDetachedFromMainThread(): void {
    if (this.instanceId !== 0) {
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

  private restoreManagerRegistration(): void {
    if (this.instanceId === 0) {
      return;
    }
    const instances = backgroundElementTemplateInstanceManager.values;
    const existing = instances.get(this.instanceId);
    if (existing === this) {
      return;
    }
    if (existing) {
      throw new Error(`ElementTemplate handleId ${this.instanceId} is already bound.`);
    }
    instances.set(this.instanceId, this);
  }

  private releaseSubtreeFromManager(): void {
    const instances = backgroundElementTemplateInstanceManager.values;
    if (instances.get(this.instanceId) === this) {
      instances.delete(this.instanceId);
    }
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
    // An unmaterialized subtree may receive attr updates before it is inserted;
    // prepare here so ref attach happens once, at the create boundary.
    this.prepareAttributeSlotsForNative();
    this.emitCreate();
  }

  protected canEmitUpdatePatch(): boolean {
    // Background tree construction is local until hydrate binds it to main-thread
    // instances. Only hydrated and materialized owners can emit update ops.
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

    if (silent || !this.canEmitUpdatePatch()) {
      return;
    }

    const beforeId = (beforeChild && beforeChild.__slotIndex === child.__slotIndex) ? beforeChild.instanceId : 0;
    emitMainThreadCreateRecursive(child);
    pushOp(
      ElementTemplateUpdateOps.insertNode,
      this.instanceId,
      child.__slotIndex,
      child.instanceId,
      beforeId,
    );
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

    const slotId = child.__slotIndex;
    if (silent) {
      return;
    }
    const canEmitUpdatePatch = this.canEmitUpdatePatch();
    if (canEmitUpdatePatch) {
      pushOp(
        ElementTemplateUpdateOps.removeNode,
        this.instanceId,
        slotId,
        child.instanceId,
        collectElementTemplateSubtreeHandleIds(child),
      );
    }
    this.cleanupDetachedChildForLifetimeRemoval(child, canEmitUpdatePatch);
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

    // Remove from manager
    if (this.instanceId) {
      backgroundElementTemplateInstanceManager.values.delete(this.instanceId);
    }
  }

  queueRefCleanupForSubtree(): void {
    if (this.rawAttributeSlots) {
      queueRefAttributeSlotUpdates(this.type, this.instanceId, this.rawAttributeSlots);
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
    // Hydration binds this object to a template that already exists on the main
    // thread; future updates must treat it as materialized without emitting create.
    this.isMaterializedOnMainThread = true;
    this.restoreManagerRegistration();
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
      },
    );
    if (options?.publishRefEffects ?? true) {
      queueRefAttributeSlotUpdates(this.type, this.instanceId, undefined, this.rawAttributeSlots);
    }
  }

  prepareAttributeSlotsForHydration(): void {
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
        this.notifyParentListOfLogicalChildUpdate();
      }
    } else if (key === 'attributeSlots' && Array.isArray(value)) {
      const previousSlots = this.attributeSlots;
      const previousRawSlots = this.rawAttributeSlots ?? previousSlots;
      const isHydrated = isElementTemplateHydrated();
      const canEmitUpdatePatch = isHydrated && !this.needsMainThreadCreate();
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
        },
      );
      if (shouldQueueRefEffects) {
        queueRefAttributeSlotUpdates(this.type, this.instanceId, previousRawSlots, value);
      }
      this.rawAttributeSlots = nextSlots === value ? undefined : value;
      const maxLength = Math.max(previousSlots.length, nextSlots.length);
      this.attributeSlots = nextSlots;
      for (let slotIndex = 0; slotIndex < maxLength; slotIndex += 1) {
        const previousValue = previousSlots[slotIndex];
        const nextValue = nextSlots[slotIndex];
        if (isDirectOrDeepEqual(previousValue, nextValue)) {
          continue;
        }
        if (!canEmitUpdatePatch) {
          continue;
        }
        pushOp(
          ElementTemplateUpdateOps.setAttribute,
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
    pushOp(ElementTemplateUpdateOps.setAttribute, this.instanceId, 0, text);
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

  private notifyParentListOfLogicalChildUpdate(): void {
    if (this.parent instanceof BackgroundListElementTemplateInstance) {
      this.parent.notifyLogicalChildUpdated(this);
    }
  }
}

function toTypedAttributesCommand(value: unknown): TypedElementAttributesCommand | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as TypedElementAttributesCommand;
}

export class BackgroundTypedElementTemplateInstance extends BackgroundElementTemplateInstance {
  constructor(type: string) {
    super(type);
  }

  override emitCreate(): void {
    if (this.isMaterializedOnMainThread) {
      return;
    }
    if (__DEV__ && this.instanceId === 0) {
      lynx.reportError(new Error('ElementTemplate patch has illegal handleId 0.'));
      return;
    }

    pushOp(
      ElementTemplateUpdateOps.createTypedElement,
      this.instanceId,
      this.type,
      this.getTypedAttributesForCreate(),
      this.getElementSlotsForCreate(),
      this.getRuntimeOptionsForCreate(),
    );
    this.isMaterializedOnMainThread = true;
  }

  override setAttribute(key: string, value: unknown): void {
    if (key !== 'attributes') {
      super.setAttribute(key, value);
      return;
    }
    const previousValue = this.attributeSlots[0];
    const nextValue = toTypedAttributesCommand(value);
    this.attributeSlots = [nextValue];
    if (
      isElementTemplateHydrated()
      && this.isMaterializedOnMainThread
      && !isDirectOrDeepEqual(previousValue, nextValue)
    ) {
      pushOp(
        ElementTemplateUpdateOps.setAttribute,
        this.instanceId,
        0,
        nextValue,
      );
    }
  }

  protected getTypedAttributesForCreate(): TypedElementAttributesCommand | null {
    return toTypedAttributesCommand(this.attributeSlots[0]);
  }

  protected getElementSlotsForCreate(): ElementTemplateHandleSlotsCommand | null {
    return null;
  }

  protected getRuntimeOptionsForCreate(): RuntimeOptionsCommand | null {
    return null;
  }
}

export class BackgroundListElementTemplateInstance extends BackgroundTypedElementTemplateInstance {
  constructor() {
    super('list');
  }

  protected override getRuntimeOptionsForCreate(): RuntimeOptionsCommand {
    const listChildren: UpdateTypedListItemCommand[] = [];
    let child = this.firstChild;
    while (child) {
      listChildren.push(toUpdateTypedListItemCommand(child));
      child = child.nextSibling;
    }
    return {
      listChildren,
    };
  }

  override insertBefore(
    child: BackgroundElementTemplateInstance,
    beforeChild: BackgroundElementTemplateInstance | null,
    silent?: boolean,
  ): void {
    const previousParent = child.parent;
    super.insertBefore(child, beforeChild, true);
    if (!silent) {
      if (previousParent instanceof BackgroundListElementTemplateInstance) {
        previousParent.emitTypedListItemRemove(child, EMPTY_REMOVED_SUBTREE_HANDLE_IDS);
      }
      this.emitTypedListItemInsert(child, beforeChild);
    }
  }

  override removeChild(child: BackgroundElementTemplateInstance, silent?: boolean): void {
    super.removeChild(child, true);
    if (!silent) {
      const canEmitUpdatePatch = this.canEmitUpdatePatch();
      const removedSubtreeHandleIds = canEmitUpdatePatch
        ? collectElementTemplateSubtreeHandleIds(child)
        : EMPTY_REMOVED_SUBTREE_HANDLE_IDS;
      this.cleanupDetachedChildForLifetimeRemoval(child, canEmitUpdatePatch);
      this.emitTypedListItemRemove(child, removedSubtreeHandleIds);
    }
  }

  notifyLogicalChildUpdated(child: BackgroundElementTemplateInstance): void {
    this.emitTypedListItemUpdate(child);
  }

  private emitTypedListItemInsert(
    child: BackgroundElementTemplateInstance,
    beforeChild: BackgroundElementTemplateInstance | null,
  ): void {
    if (!isElementTemplateHydrated() || !this.isMaterializedOnMainThread) {
      return;
    }

    emitMainThreadCreateRecursive(child);
    pushOp(
      ElementTemplateUpdateOps.insertTypedListItem,
      this.instanceId,
      toUpdateTypedListItemCommand(child),
      beforeChild?.instanceId ?? 0,
    );
  }

  private emitTypedListItemRemove(
    child: BackgroundElementTemplateInstance,
    removedSubtreeHandleIds: number[],
  ): void {
    if (!isElementTemplateHydrated() || !this.isMaterializedOnMainThread) {
      return;
    }

    pushOp(
      ElementTemplateUpdateOps.removeTypedListItem,
      this.instanceId,
      child.instanceId,
      removedSubtreeHandleIds,
    );
  }

  private emitTypedListItemUpdate(child: BackgroundElementTemplateInstance): void {
    if (!isElementTemplateHydrated() || !this.isMaterializedOnMainThread) {
      return;
    }

    pushOp(
      ElementTemplateUpdateOps.updateTypedListItem,
      this.instanceId,
      toUpdateTypedListItemCommand(child),
    );
  }
}

export function toUpdateTypedListItemCommand(
  child: BackgroundElementTemplateInstance,
): UpdateTypedListItemCommand {
  return {
    __etHandleRef: child.instanceId,
    type: child.type,
    platformInfo: child.getListItemPlatformInfo(),
  };
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
  if (instance.instanceId !== 0) {
    handles.push(instance.instanceId);
  }
  let child = instance.firstChild;
  while (child) {
    collectElementTemplateSubtreeHandleIdsImpl(child, handles);
    child = child.nextSibling;
  }
}

function emitMainThreadCreateRecursive(instance: BackgroundElementTemplateInstance): void {
  if (
    !isElementTemplateHydrated()
    || instance.instanceId === 0
  ) {
    return;
  }

  // Walk children in linked-list order; the slot-grouped view would just be
  // discarded here since we recurse into every child regardless of slot.
  let child = instance.firstChild;
  while (child) {
    emitMainThreadCreateRecursive(child);
    child = child.nextSibling;
  }
  instance.emitMainThreadCreateIfNeeded();
}
