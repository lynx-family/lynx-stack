// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { hydrateWorkletCtx } from '@lynx-js/react/worklet-runtime/bindings';
import type { Worklet } from '@lynx-js/react/worklet-runtime/bindings';

import {
  composeElementTemplateListAttributes,
  createElementTemplateListStateFromItems,
  flushInitialElementTemplateListUpdates,
  flushPendingElementTemplateListUpdates,
  insertElementTemplateListItem,
  markElementTemplateListDestroyed,
  registerElementTemplateListState,
  removeElementTemplateListItem,
  updateElementTemplateListAttributes,
  updateElementTemplateListItem,
} from './list/list.js';
import type { ETListFlushResult, ETListUpdateItem } from './list/list.js';
import { elementTemplateRegistry } from './template/registry.js';
import { ElementTemplateUpdateOps } from '../protocol/opcodes.js';
import type { ElementTemplateUpdateOp } from '../protocol/opcodes.js';
import {
  elementTemplateIdentityKey,
  elementTemplateTypeTag,
  parseElementTemplateType,
} from '../protocol/template-type.js';
import type {
  ElementTemplateHandleSlotsCommand,
  ElementTemplateUpdateCommandStream,
  RuntimeChildSlots,
  RuntimeOptions,
  RuntimeOptionsCommand,
  RuntimeTypedElementAttributes,
  RuntimeTypedListOptions,
  SerializableValue,
  TypedElementAttributesCommand,
  UpdateTypedListItemCommand,
} from '../protocol/types.js';
import {
  deleteMainThreadDynamicAttrStateForSubtree,
  initializeMainThreadDynamicAttrSlots,
  updateMainThreadDynamicAttrSlot,
} from './template/main-thread-dynamic-attr-state.js';
import type { MainThreadDynamicAttrHydrateHandoff } from './template/main-thread-dynamic-attr-state.js';

export type { ElementTemplateUpdateCommandStream } from '../protocol/types.js';

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

        const nativeAttributeSlots = normalizeAttributeSlots(attributeSlots);
        const nativeRef = __CreateElementTemplate(
          templateKey,
          bundleUrl,
          nativeAttributeSlots,
          resolvedChildSlots,
          handleId,
        );

        if (nativeRef) {
          elementTemplateRegistry.set(handleId, nativeRef);
          initializeMainThreadDynamicAttrSlots(
            handleId,
            elementTemplateTypeTag(templateKey, bundleUrl),
            nativeAttributeSlots,
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
        if (attrSlotIndex === 0) {
          const listAttributes = updateElementTemplateListAttributes(
            targetId,
            value as RuntimeTypedElementAttributes | null,
          );
          if (listAttributes) {
            __SetAttributeOfElementTemplate(nativeRef, attrSlotIndex, listAttributes);
            break;
          }
        }
        __SetAttributeOfElementTemplate(nativeRef, attrSlotIndex, value);
        const hydrateHandoff = updateMainThreadDynamicAttrSlot(
          targetId,
          attrSlotIndex,
          value,
          isHydration,
        );
        if (isHydration) {
          hydrateMTEventCtxIfNeeded(hydrateHandoff);
        }
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
          && !isTypedListChildSlotsEmpty(childSlots)
        ) {
          lynx.reportError(
            new Error('ElementTemplate typed list create must keep logical children in options.listChildren.'),
          );
          continue;
        }
        const resolvedChildSlots = isTypedList ? null : resolveChildSlots(childSlots);
        if (resolvedChildSlots === undefined) {
          continue;
        }
        let resolvedListItems: ETListUpdateItem[] | null = null;
        let nativeOptions: RuntimeOptions | RuntimeTypedListOptions | null | undefined;
        if (isTypedList) {
          const listChildren = getTypedListChildren(options);
          if (__DEV__ && !Array.isArray(listChildren)) {
            lynx.reportError(
              new Error('ElementTemplate typed list create must keep logical children in options.listChildren.'),
            );
            continue;
          }
          resolvedListItems = resolveTypedListItems(listChildren);
          if (resolvedListItems === null) {
            continue;
          }
          nativeOptions = resolveTypedListOptions(options, resolvedListItems);
        } else {
          nativeOptions = options as RuntimeOptions | null | undefined;
        }
        const listState = resolvedListItems
          ? createElementTemplateListStateFromItems(
            resolvedListItems,
            attributes,
          )
          : null;
        const typedAttributes = listState
          ? composeElementTemplateListAttributes(
            undefined,
            listState,
          )
          : attributes;

        const nativeRef = __CreateTypedElementTemplate(
          type,
          typedAttributes,
          isTypedList ? null : resolvedChildSlots!,
          handleId,
          nativeOptions,
        );

        if (nativeRef) {
          elementTemplateRegistry.set(handleId, nativeRef);
          if (listState) {
            registerElementTemplateListState(handleId, listState, true, nativeRef);
          }
        }
        break;
      }

      case ElementTemplateUpdateOps.insertTypedListItem: {
        const listId = stream[i++] as number;
        const item = stream[i++] as UpdateTypedListItemCommand;
        const beforeId = stream[i++] as number;
        const resolvedItem = resolveTypedListItem(item, 'typed list insert item');
        if (resolvedItem === null) {
          continue;
        }
        insertElementTemplateListItem(listId, resolvedItem, beforeId);
        break;
      }

      case ElementTemplateUpdateOps.removeTypedListItem: {
        const listId = stream[i++] as number;
        const itemId = stream[i++] as number;
        const removedSubtreeHandleIds = stream[i++] as number[];
        removeElementTemplateListItem(listId, itemId, removedSubtreeHandleIds);
        break;
      }

      case ElementTemplateUpdateOps.updateTypedListItem: {
        const listId = stream[i++] as number;
        const item = stream[i++] as UpdateTypedListItemCommand;
        const resolvedItem = resolveTypedListItem(item, 'typed list update item');
        if (resolvedItem === null) {
          continue;
        }
        updateElementTemplateListItem(listId, resolvedItem);
        break;
      }

      case ElementTemplateUpdateOps.insertNode: {
        const targetId = stream[i++] as number;
        const childSlotIndex = stream[i++] as number;
        const childId = stream[i++] as number;
        const referenceId = stream[i++] as number;
        const nativeRef = resolveTargetHandle(targetId, 'target');
        const childRef = resolveTargetHandle(childId, 'child');
        if (!nativeRef || !childRef) {
          continue;
        }
        const referenceRef = referenceId === 0 ? null : resolveTargetHandle(referenceId, 'reference');
        if (referenceId !== 0 && !referenceRef) {
          continue;
        }
        __InsertNodeToElementTemplate(nativeRef, childSlotIndex, childRef, referenceRef);
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
      0,
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

function hydrateMTEventCtxIfNeeded(handoff: MainThreadDynamicAttrHydrateHandoff | undefined): void {
  if (!handoff) {
    return;
  }
  hydrateWorkletCtx(
    handoff.nextValue as Worklet,
    handoff.previousNativeHeldValue as Worklet,
  );
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

function resolveTypedListOptions(
  options: RuntimeOptionsCommand | null | undefined,
  items: ETListUpdateItem[],
): RuntimeTypedListOptions {
  return {
    ...options!,
    listChildren: items.map(item => item.ref),
  };
}

function getTypedListChildren(
  options: RuntimeOptionsCommand | null | undefined,
): UpdateTypedListItemCommand[] {
  return (__DEV__ ? options?.['listChildren'] : options!['listChildren']!)! as UpdateTypedListItemCommand[];
}

function resolveTypedListItems(
  items: UpdateTypedListItemCommand[],
): ETListUpdateItem[] | null {
  const resolvedItems: ETListUpdateItem[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const resolvedItem = resolveTypedListItem(items[index]!, `typed list item ${index}`);
    if (resolvedItem === null) {
      return null;
    }
    resolvedItems.push(resolvedItem);
  }
  return resolvedItems;
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
    platformInfo: item.platformInfo,
  };
}

function isTypedListChildSlotsEmpty(childSlots: ElementTemplateHandleSlotsCommand | null | undefined): boolean {
  if (!Array.isArray(childSlots)) {
    return true;
  }
  return childSlots.every(slot => slot == null || (Array.isArray(slot) && slot.length === 0));
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
  return Number.isInteger(handleId) && handleId !== 0;
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

function normalizeAttributeSlots(
  attributeSlots: SerializableValue[] | null | undefined,
): SerializableValue[] | null | undefined {
  if (attributeSlots == null) {
    return attributeSlots;
  }
  return attributeSlots.map((value) => (value === undefined ? null : value));
}
