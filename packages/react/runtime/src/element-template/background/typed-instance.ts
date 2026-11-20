// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { isElementTemplateHydrated } from './commit-hook.js';
import { backgroundElementTemplateInstanceManager } from './manager.js';
import { BackgroundElementTemplateInstance, pushElementTemplateOp } from './shadow-instance.js';
import type { LogicalListContainerInstance } from './shadow-instance.js';
import { collectMainThreadRefSubtreeHandleIds } from './subtree-handles.js';
import { isDirectOrDeepEqual } from '../../core/deep-equal.js';
import { ElementTemplateUpdateOps } from '../protocol/opcodes.js';
import { ELEMENT_TEMPLATE_PAGE_HANDLE_ID, ELEMENT_TEMPLATE_PAGE_TYPE } from '../protocol/page.js';
import type {
  ElementTemplateHandleSlotsCommand,
  RuntimeOptionsCommand,
  TypedElementAttributesCommand,
  UpdateTypedListItemCommand,
} from '../protocol/types.js';
import type { AuthoredPageAttributes } from '../runtime/page/authored-page.js';
import type { EtAttrPlan } from '../runtime/template/attr-slot-plan.js';
import {
  TYPED_ELEMENT_ATTRIBUTES_SLOT_INDEX,
  TYPED_ELEMENT_ATTR_PLAN,
  TYPED_LIST_ATTR_PLAN,
} from '../runtime/template/typed-attributes.js';

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

export class BackgroundListElementTemplateInstance extends BackgroundTypedElementTemplateInstance
  implements LogicalListContainerInstance
{
  public override readonly isLogicalListContainer: true = true;

  constructor() {
    super('list');
  }

  override emitCreate(): void {
    // Skip creation and candidate initialization for an existing List.
    if (this.isMaterializedOnMainThread) {
      return;
    }
    // The base class emits the List create command with the initial item UIDs
    // in childSlots.
    super.emitCreate();
    // Queue initial ref candidates after the List create command has been
    // emitted.
    if (!this.isMaterializedOnMainThread) {
      return;
    }
    let item = this.firstChild;
    while (item) {
      // Collect main-thread ref candidates separately for each direct item.
      // Passing false sends only ref candidates and leaves platformInfo null.
      pushElementTemplateOp(
        ElementTemplateUpdateOps.updateTypedListItem,
        this.instanceId,
        toUpdateTypedListItemCommand(item, false),
      );
      item = item.nextSibling;
    }
  }

  protected override getAttributeSlotPlan(): EtAttrPlan {
    return TYPED_LIST_ATTR_PLAN;
  }

  protected override getChildSlotsForCreate(): ElementTemplateHandleSlotsCommand {
    const childSlots: ElementTemplateHandleSlotsCommand = [];
    let child = this.firstChild;
    while (child) {
      // Group child UIDs by their logical slot.
      // Direct List children belong to slot 0, which MTS validates.
      (childSlots[child.__slotIndex] ??= []).push(child.instanceId);
      child = child.nextSibling;
    }
    return childSlots;
  }

  notifyLogicalChildUpdated(
    child: BackgroundElementTemplateInstance,
    isUpdatePlatformInfo: boolean,
  ): void {
    this.emitTypedListItemUpdate(child, isUpdatePlatformInfo);
  }

  emitTypedListItemUpdate(child: BackgroundElementTemplateInstance, isUpdatePlatformInfo: boolean): void {
    if (!isElementTemplateHydrated() || !this.isMaterializedOnMainThread) {
      return;
    }
    pushElementTemplateOp(
      ElementTemplateUpdateOps.updateTypedListItem,
      this.instanceId,
      toUpdateTypedListItemCommand(child, isUpdatePlatformInfo),
    );
  }
}

export function toUpdateTypedListItemCommand(
  child: BackgroundElementTemplateInstance,
  isUpdatePlatformInfo: boolean,
): UpdateTypedListItemCommand {
  return {
    __etHandleRef: child.instanceId,
    type: child.type,
    platformInfo: isUpdatePlatformInfo ? child.getListItemPlatformInfo() : null,
    subtreeHandleIds: isUpdatePlatformInfo
      ? null
      : collectMainThreadRefSubtreeHandleIds(child) ?? [],
  };
}
