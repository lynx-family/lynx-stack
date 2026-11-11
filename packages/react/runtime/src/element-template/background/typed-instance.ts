// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { isElementTemplateHydrated } from './commit-hook.js';
import { backgroundElementTemplateInstanceManager } from './manager.js';
import {
  BackgroundElementTemplateInstance,
  markLogicalListContainer,
  pushElementTemplateOp,
} from './shadow-instance.js';
import { collectElementTemplateSubtreeHandleIds, collectMainThreadRefSubtreeHandleIds } from './subtree-handles.js';
import { isDirectOrDeepEqual } from '../../core/deep-equal.js';
import { ElementTemplateUpdateOps } from '../protocol/opcodes.js';
import { ELEMENT_TEMPLATE_PAGE_HANDLE_ID, ELEMENT_TEMPLATE_PAGE_TYPE } from '../protocol/page.js';
import type {
  ElementTemplateHandleSlotsCommand,
  RuntimeOptionsCommand,
  TypedElementAttributesCommand,
  TypedListOptionsCommand,
  UpdateTypedListItemCommand,
} from '../protocol/types.js';
import type { AuthoredPageAttributes } from '../runtime/page/authored-page.js';
import type { EtAttrPlan } from '../runtime/template/attr-slot-plan.js';
import { TYPED_ELEMENT_ATTRIBUTES_SLOT_INDEX, TYPED_ELEMENT_ATTR_PLAN } from '../runtime/template/typed-attributes.js';

const EMPTY_REMOVED_SUBTREE_HANDLE_IDS: number[] = [];

export class BackgroundTypedElementTemplateInstance extends BackgroundElementTemplateInstance {
  constructor(type: string) {
    super(type);
    this.attributeSlots = [null];
  }

  override emitCreate(): void {
    if (this.isMaterializedOnMainThread) {
      return;
    }
    if (__DEV__ && this.instanceId === ELEMENT_TEMPLATE_PAGE_HANDLE_ID) {
      lynx.reportError(new Error('ElementTemplate patch has illegal handleId 0.'));
      return;
    }

    pushElementTemplateOp(
      ElementTemplateUpdateOps.createTypedElement,
      this.instanceId,
      this.type,
      this.getTypedAttributesForCreate(),
      this.getChildSlotsForCreate(),
      this.getRuntimeOptionsForCreate(),
    );
    this.isMaterializedOnMainThread = true;
  }

  override setAttribute(key: string, value: unknown): void {
    if (key !== 'attributes') {
      super.setAttribute(key, value);
      return;
    }
    super.setAttribute('attributeSlots', [value]);
  }

  protected getTypedAttributesForCreate(): TypedElementAttributesCommand | null {
    return this.attributeSlots[TYPED_ELEMENT_ATTRIBUTES_SLOT_INDEX] as TypedElementAttributesCommand | null;
  }

  protected override getAttributeSlotPlan(): EtAttrPlan {
    return TYPED_ELEMENT_ATTR_PLAN;
  }

  protected getChildSlotsForCreate(): ElementTemplateHandleSlotsCommand | null {
    return null;
  }

  protected getRuntimeOptionsForCreate(): RuntimeOptionsCommand | null {
    return null;
  }
}

export class BackgroundPageRootInstance extends BackgroundTypedElementTemplateInstance {
  // Preact may render a keyed replacement before running the old Page's cleanup.
  // Only the current helper lifetime may clear the shared root attributes.
  private authoredPageLifetime: object | undefined;

  constructor() {
    super(ELEMENT_TEMPLATE_PAGE_TYPE);
    backgroundElementTemplateInstanceManager.registerPageRoot(this);
    this.isMaterializedOnMainThread = true;
  }

  setAuthoredPageAttributes(
    lifetime: object,
    attributes: AuthoredPageAttributes,
  ): void {
    this.authoredPageLifetime = lifetime;
    this.setAttribute('attributes', attributes);
  }

  clearAuthoredPageAttributes(lifetime: object): void {
    if (this.authoredPageLifetime !== lifetime) {
      return;
    }
    this.authoredPageLifetime = undefined;
    this.setAttribute('attributes', null);
  }

  reconcileAuthoredPageAttributesOnHydration(
    mainThreadAttributes: TypedElementAttributesCommand | null,
  ): void {
    const backgroundAttributes = this.attributeSlots[TYPED_ELEMENT_ATTRIBUTES_SLOT_INDEX] as
      | TypedElementAttributesCommand
      | null;
    if (isDirectOrDeepEqual(mainThreadAttributes, backgroundAttributes)) {
      return;
    }
    pushElementTemplateOp(
      ElementTemplateUpdateOps.setAttribute,
      this.instanceId,
      TYPED_ELEMENT_ATTRIBUTES_SLOT_INDEX,
      backgroundAttributes,
    );
  }
}

export class BackgroundListElementTemplateInstance extends BackgroundTypedElementTemplateInstance {
  constructor() {
    super('list');
    markLogicalListContainer(this);
  }

  protected override getRuntimeOptionsForCreate(): TypedListOptionsCommand {
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

    child.emitMainThreadCreateIfNeeded();
    pushElementTemplateOp(
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

    pushElementTemplateOp(
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

    pushElementTemplateOp(
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
    subtreeHandleIds: collectMainThreadRefSubtreeHandleIds(child) ?? [],
  };
}
