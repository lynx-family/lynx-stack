// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  flushInitialElementTemplateListUpdates,
  flushPendingElementTemplateListUpdates,
  markElementTemplateListDestroyed,
  updateElementTemplateListAttributes,
} from './list/list.js';
import type { ETListFlushResult, ETListUpdateItem } from './list/list.js';
import { insertElementTemplateSubtree } from './template/handle.js';
import { retainMainThreadBackgroundFunctionCtx } from './template/main-thread-background-function.js';
import type { MTEventNativeWrapper } from './template/main-thread-event-ctx.js';
import { elementTemplateRegistry } from './template/registry.js';
import { TYPED_ELEMENT_ATTRIBUTES_SLOT_INDEX } from './template/typed-attributes.js';
import { ElementTemplateUpdateOps } from '../protocol/opcodes.js';
import type { ElementTemplateUpdateOp } from '../protocol/opcodes.js';
import { ELEMENT_TEMPLATE_PAGE_HANDLE_ID } from '../protocol/page.js';
import {
  elementTemplateIdentityKey,
  elementTemplateTypeTag,
  parseElementTemplateType,
} from '../protocol/template-type.js';
import type {
  ElementTemplateHandleSlotsCommand,
  ElementTemplateUpdateCommandStream,
  RuntimeChildSlots,
  RuntimeOptionsCommand,
  RuntimeTypedElementAttributes,
  SerializableValue,
  TypedElementAttributesCommand,
  UpdateTypedListItemCommand,
} from '../protocol/types.js';
import {
  deleteMainThreadDynamicAttrStateForSubtree,
  initializeMainThreadDynamicAttrSlots,
  isSpreadDynamicAttrSlot,
  prepareMainThreadDynamicAttrSlotsForNative,
  prepareSpreadAttrSlotForNative,
  reconcileUnhydratedSpreadMTRefSlots,
  updateGestureAttrSlot,
  updateMainThreadEventAttrSlot,
  updateMainThreadRefAttrSlot,
  updateSpreadAttrSlot,
} from './template/main-thread-dynamic-attr-state.js';
import type { MainThreadDynamicAttrSubtreeHandle } from './template/main-thread-dynamic-attr-state.js';
import { retainGestureCallbacks } from '../prop-adapters/gesture.js';
import type { GestureSlotValue } from '../prop-adapters/gesture.js';

export type { ElementTemplateUpdateCommandStream } from '../protocol/types.js';

// The update event's JSON transport already normalizes array holes and undefined
// entries to null. Consume those wire values without copying each attr array.
export function applyElementTemplateUpdateCommands(
  stream: ElementTemplateUpdateCommandStream,
  isHydration = false,
): void {
  let i = 0;
  while (i < stream.length) {
    const op = stream[i++] as ElementTemplateUpdateOp;

    switch (op) {
      case ElementTemplateUpdateOps.createTemplate: {
        const handleId = stream[i++] as number;
        const templateKey = stream[i++] as string;
        const bundleUrl = stream[i++] as string | null | undefined;
        const attributeSlots = stream[i++] as SerializableValue[] | null | undefined;
        const childSlots = stream[i++] as ElementTemplateHandleSlotsCommand | null | undefined;
        // Read options in the same order as BTS emits them. Every create
        // command includes this field.
        const options = stream[i++] as RuntimeOptionsCommand | null;
        if (__DEV__) {
          const createError = validateCreateTemplatePayload(
            handleId,
            attributeSlots,
            childSlots,
          );
          if (createError) {
            lynx.reportError(createError);
            continue;
          }
        }

        const resolvedChildSlots = resolveChildSlots(childSlots);
        if (resolvedChildSlots === undefined) {
          continue;
        }

        const templateType = elementTemplateTypeTag(templateKey, bundleUrl);
        const nativeAttributeSlots = prepareMainThreadDynamicAttrSlotsForNative(
          templateType,
          attributeSlots,
        );
        const nativeRef = __CreateElementTemplate(
          templateKey,
          bundleUrl,
          nativeAttributeSlots,
          resolvedChildSlots,
          handleId,
          options,
        );

        if (nativeRef) {
          elementTemplateRegistry.set(handleId, nativeRef);
          initializeMainThreadDynamicAttrSlots(
            handleId,
            templateType,
            attributeSlots,
            true,
          );
        }
        break;
      }

      case ElementTemplateUpdateOps.setAttribute: {
        const targetId = stream[i++] as number;
        const attrSlotIndex = stream[i++] as number;
        const value = stream[i++] as SerializableValue | null;
        const nativeRef = resolveTargetHandle(targetId, 'target');
        if (!nativeRef) {
          continue;
        }
        if (attrSlotIndex === TYPED_ELEMENT_ATTRIBUTES_SLOT_INDEX) {
          const listAttributes = updateElementTemplateListAttributes(
            targetId,
            value as RuntimeTypedElementAttributes | null,
          );
          if (listAttributes) {
            __SetAttributeOfElementTemplate(nativeRef, attrSlotIndex, listAttributes);
            break;
          }
        }
        if (isSpreadDynamicAttrSlot(targetId, attrSlotIndex)) {
          const nativeValue = prepareSpreadAttrSlotForNative(value);
          __SetAttributeOfElementTemplate(nativeRef, attrSlotIndex, nativeValue);
          updateSpreadAttrSlot(targetId, attrSlotIndex, value, nativeRef, isHydration);
          break;
        }
        __SetAttributeOfElementTemplate(nativeRef, attrSlotIndex, value);
        break;
      }

      case ElementTemplateUpdateOps.setGesture: {
        const targetId = stream[i++] as number;
        const attrSlotIndex = stream[i++] as number;
        const value = stream[i++] as SerializableValue | null;
        const nativeRef = resolveTargetHandle(targetId, 'target');
        if (!nativeRef) {
          continue;
        }
        if (value != null) {
          retainGestureCallbacks(value as unknown as GestureSlotValue);
        }
        __SetAttributeOfElementTemplate(nativeRef, attrSlotIndex, value);
        updateGestureAttrSlot(targetId, attrSlotIndex, value, isHydration);
        break;
      }

      case ElementTemplateUpdateOps.setMainThreadEvent: {
        const targetId = stream[i++] as number;
        const attrSlotIndex = stream[i++] as number;
        const value = stream[i++] as SerializableValue | null;
        const nativeRef = resolveTargetHandle(targetId, 'target');
        if (!nativeRef) {
          continue;
        }
        if (value != null) {
          retainMainThreadBackgroundFunctionCtx((value as unknown as MTEventNativeWrapper).value);
        }
        __SetAttributeOfElementTemplate(nativeRef, attrSlotIndex, value);
        updateMainThreadEventAttrSlot(targetId, attrSlotIndex, value, isHydration);
        break;
      }

      case ElementTemplateUpdateOps.setMainThreadRef: {
        const targetId = stream[i++] as number;
        const attrSlotIndex = stream[i++] as number;
        const value = stream[i++] as SerializableValue | null;
        const nativeRef = resolveTargetHandle(targetId, 'target');
        if (!nativeRef) {
          continue;
        }
        updateMainThreadRefAttrSlot(targetId, attrSlotIndex, value, nativeRef, isHydration);
        break;
      }

      case ElementTemplateUpdateOps.createTypedElement: {
        const handleId = stream[i++] as number;
        const type = stream[i++] as string;
        const attributes = stream[i++] as TypedElementAttributesCommand | null | undefined;
        const childSlots = stream[i++] as ElementTemplateHandleSlotsCommand | null | undefined;
        const options = stream[i++] as RuntimeOptionsCommand | null | undefined;
        const isTypedList = type === 'list';

        if (__DEV__) {
          const createError = validateCreateHandleId(handleId);
          if (createError) {
            lynx.reportError(createError);
            continue;
          }
        }
        if (__DEV__ && childSlots != null && !Array.isArray(childSlots)) {
          lynx.reportError(
            new Error('ElementTemplate update create childSlots must be an array, null, or undefined.'),
          );
          continue;
        }
        if (
          __DEV__
          && isTypedList
          && childSlots?.some(
            (children, slotIndex) => slotIndex !== 0 && (children?.length ?? 0) > 0,
          )
        ) {
          lynx.reportError(
            new Error('ElementTemplate typed list only supports logical slot 0.'),
          );
          continue;
        }
        const resolvedChildSlots = resolveChildSlots(childSlots);
        if (resolvedChildSlots === undefined) {
          continue;
        }
        // Attributes have already been adapted on BTS.
        // Native initializes logical List items from childSlots[0] and records
        // their initial insertions.
        const nativeRef = __CreateTypedElementTemplate(
          type,
          attributes,
          resolvedChildSlots,
          handleId,
          options,
        );

        if (nativeRef) {
          elementTemplateRegistry.set(handleId, nativeRef);
        }
        break;
      }

      case ElementTemplateUpdateOps.updateTypedListItem: {
        // Consume the List handle to keep the command stream aligned.
        void stream[i++];
        const item = stream[i++] as UpdateTypedListItemCommand;
        const resolvedItem = resolveTypedListItem(item, 'typed list update item');
        if (resolvedItem === null) {
          continue;
        }
        if (item.platformInfo !== null) {
          // Update item ET options when platform info is provided. Native List
          // records the change.
          __SetListItemInfoOfTemplate(resolvedItem.ref, item.platformInfo);
        }
        if (item.subtreeHandleIds != null) {
          // TODO: Handle subtreeHandleIds updates.
        }
        break;
      }

      case ElementTemplateUpdateOps.insertNode: {
        const targetId = stream[i++] as number;
        const childSlotIndex = stream[i++] as number;
        const childId = stream[i++] as number;
        const referenceId = stream[i++] as number;
        const attachedSubtreeHandleIds = stream[i++] as number[] | null;
        const nativeRef = resolveTargetHandle(targetId, 'target');
        const childRef = resolveTargetHandle(childId, 'child');
        const attachedSubtreeHandles = attachedSubtreeHandleIds === null
          ? null
          : resolveSubtreeHandles(attachedSubtreeHandleIds, 'insert subtree');
        if (
          !nativeRef
          || !childRef
          || (attachedSubtreeHandleIds !== null && attachedSubtreeHandles === null)
        ) {
          continue;
        }
        const referenceRef = referenceId === 0 ? null : resolveTargetHandle(referenceId, 'reference');
        if (referenceId !== 0 && !referenceRef) {
          continue;
        }
        insertElementTemplateSubtree(
          nativeRef,
          childSlotIndex,
          childRef,
          referenceRef,
          attachedSubtreeHandles,
        );
        break;
      }

      case ElementTemplateUpdateOps.removeNode: {
        const targetId = stream[i++] as number;
        const childSlotIndex = stream[i++] as number;
        const childId = stream[i++] as number;
        const removedSubtreeHandleIds = stream[i++] as number[];
        const nativeRef = resolveTargetHandle(targetId, 'target');
        const childRef = resolveTargetHandle(childId, 'child');
        if (!nativeRef || !childRef) {
          continue;
        }
        __RemoveNodeFromElementTemplate(nativeRef, childSlotIndex, childRef);
        releaseRemovedSubtreeHandles(removedSubtreeHandleIds);
        break;
      }

      default: {
        if (__DEV__) {
          lynx.reportError(new Error(`ElementTemplate update opcode ${String(op)} is not supported.`));
        }
      }
    }
  }
  if (isHydration) {
    reconcileUnhydratedSpreadMTRefSlots();
  }
  flushPendingListUpdates();
}

function flushPendingListUpdates(): void {
  applyListFlushResults(flushPendingElementTemplateListUpdates());
  applyListFlushResults(flushInitialElementTemplateListUpdates());
}

function applyListFlushResults(results: ETListFlushResult[]): void {
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index]!;
    const listRef = resolveTargetHandle(result.uid, 'typed list');
    if (!listRef) {
      continue;
    }
    __SetAttributeOfElementTemplate(
      listRef,
      TYPED_ELEMENT_ATTRIBUTES_SLOT_INDEX,
      result.attributes,
    );
    if (result.removedSubtreeHandleIds) {
      releaseRemovedSubtreeHandles(result.removedSubtreeHandleIds);
    }
  }
}

function releaseRemovedSubtreeHandles(
  removedSubtreeHandleIds: number[],
): void {
  for (const handleId of removedSubtreeHandleIds) {
    const pendingRemovedSubtreeHandleIds = markElementTemplateListDestroyed(handleId);
    elementTemplateRegistry.delete(handleId);
    deleteMainThreadDynamicAttrStateForSubtree([handleId]);
    if (pendingRemovedSubtreeHandleIds) {
      releaseRemovedSubtreeHandles(pendingRemovedSubtreeHandleIds);
    }
  }
}

function resolveChildSlots(
  childSlots: ElementTemplateHandleSlotsCommand | null | undefined,
): RuntimeChildSlots | null | undefined {
  if (childSlots == null) {
    return null;
  }

  let hasError = false;
  const value: RuntimeChildSlots = [];
  for (let slotIndex = 0; slotIndex < childSlots.length; slotIndex += 1) {
    const children = childSlots[slotIndex];
    if (children == null) {
      continue;
    }
    if (__DEV__ && !Array.isArray(children)) {
      lynx.reportError(
        new Error(`ElementTemplate create slot ${slotIndex} must be an array of child handles, null, or undefined.`),
      );
      hasError = true;
      continue;
    }

    const resolvedChildren: ElementTemplateHandle[] = [];
    for (let childIndex = 0; childIndex < children.length; childIndex += 1) {
      const childId = children[childIndex]!;
      const childRef = resolveTargetHandle(childId, 'child');
      if (childRef === null) {
        hasError = true;
        continue;
      }
      resolvedChildren.push(childRef);
    }
    value[slotIndex] = resolvedChildren;
  }
  if (hasError) {
    return undefined;
  }
  return value;
}

function resolveTypedListItem(
  item: UpdateTypedListItemCommand,
  role: string,
): ETListUpdateItem | null {
  const ref = resolveTargetHandle(item.__etHandleRef, role);
  if (ref === null) {
    return null;
  }
  // `item.type` is the full `${globDynamicComponentEntry}:${key}` tag; the
  // native list identifies items by the same identity key the templates were
  // registered under (see the `createTemplate` op above), so normalize it.
  const nativeTemplate = parseElementTemplateType(item.type);
  return {
    uid: item.__etHandleRef,
    ref,
    templateKey: elementTemplateIdentityKey(nativeTemplate.templateKey, nativeTemplate.bundleUrl),
    // Normalize omitted platform info to an empty object.
    platformInfo: item.platformInfo ?? {},
  };
}

function resolveSubtreeHandles(
  subtreeHandleIds: readonly number[],
  role: string,
): MainThreadDynamicAttrSubtreeHandle[] | null {
  const subtreeHandles: MainThreadDynamicAttrSubtreeHandle[] = [];
  for (let index = 0; index < subtreeHandleIds.length; index += 1) {
    const uid = subtreeHandleIds[index]!;
    const ref = resolveTargetHandle(uid, role);
    if (!ref) {
      return null;
    }
    subtreeHandles.push({ uid, ref });
  }
  return subtreeHandles;
}

function resolveTargetHandle(id: number, role: string): ElementTemplateHandle | null {
  const nativeRef = elementTemplateRegistry.getTarget(id);
  if (!nativeRef) {
    lynx.reportError(new Error(`ElementTemplate update ${role} handle ${id} not found.`));
    return null;
  }
  return nativeRef;
}

function isValidHandleId(handleId: number): boolean {
  return Number.isInteger(handleId) && handleId !== ELEMENT_TEMPLATE_PAGE_HANDLE_ID;
}

function validateCreateHandleId(handleId: number): Error | null {
  if (!isValidHandleId(handleId)) {
    return new Error(`ElementTemplate update has invalid handleId ${String(handleId)}.`);
  }
  if (elementTemplateRegistry.get(handleId)) {
    return new Error(`ElementTemplate update received duplicate handleId ${handleId}.`);
  }
  return null;
}

function validateCreateTemplatePayload(
  handleId: number,
  attributeSlots: SerializableValue[] | null | undefined,
  childSlots: ElementTemplateHandleSlotsCommand | null | undefined,
): Error | null {
  const handleError = validateCreateHandleId(handleId);
  if (handleError) {
    return handleError;
  }
  if (attributeSlots != null && !Array.isArray(attributeSlots)) {
    return new Error('ElementTemplate update create attributeSlots must be an array, null, or undefined.');
  }
  if (childSlots != null && !Array.isArray(childSlots)) {
    return new Error('ElementTemplate update create childSlots must be an array, null, or undefined.');
  }
  return null;
}
