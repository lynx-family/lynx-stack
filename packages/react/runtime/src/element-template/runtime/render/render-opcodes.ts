// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { __OpAttr, __OpBegin, __OpEnd, __OpSlot, __OpText } from './render-to-opcodes.js';
import { parseElementTemplateType } from '../../protocol/template-type.js';
import type { RuntimeTypedElementAttributes, SerializableValue } from '../../protocol/types.js';
import {
  composeElementTemplateListAttributes,
  createElementTemplateListState,
  registerElementTemplateListItem,
  registerElementTemplateListState,
} from '../list/list.js';
import type { ETListItemPlatformInfo } from '../list/list.js';
import { __etAttrPlanMap } from '../template/attr-slot-plan.js';
import type { EtAttrAdapter } from '../template/attr-slot-plan.js';
import {
  createElementTemplateWithReservedHandle,
  createTypedElementTemplateWithReservedHandle,
  reserveElementTemplateId,
} from '../template/handle.js';

const BUILTIN_RAW_TEXT_TEMPLATE_KEY = '_et_builtin_raw_text';
const TYPED_LIST_HOST_TYPE = 'list';
const EMPTY_LIST_ITEM_UIDS: readonly number[] = [];

export interface MainThreadCreateResult {
  rootRefs: ElementRef[];
}

function appendChildToParent(
  parentTemplateKey: string | null,
  parentActiveElementSlot: ElementRef[] | undefined,
  parentListItemUids: number[] | undefined,
  rootRefs: ElementRef[],
  elementRef: ElementRef,
  uid: number,
): void {
  if (parentTemplateKey === null) {
    rootRefs.push(elementRef);
    return;
  }

  if (__DEV__ && !parentActiveElementSlot) {
    throw new Error(`Template '${parentTemplateKey}' received a child outside of any element slot.`);
  }

  parentActiveElementSlot!.push(elementRef);
  parentListItemUids?.push(uid);
}

export function renderOpcodesIntoElementTemplate(
  opcodes: unknown[],
): MainThreadCreateResult {
  const rootRefs: ElementRef[] = [];
  const typeStack: Array<string | null> = [null];
  const attributeSlotsStack: Array<SerializableValue[] | undefined> = [undefined];
  const typedAttributesStack: Array<RuntimeTypedElementAttributes | undefined> = [undefined];
  const elementSlotsStack: Array<Array<Array<ElementRef>> | undefined> = [undefined];
  const listItemUidsStack: Array<number[] | undefined> = [undefined];
  const activeElementSlotStack: Array<ElementRef[] | undefined> = [undefined];
  const activeListItemUidsStack: Array<number[] | undefined> = [undefined];
  const listItemPlatformInfoStack: Array<ETListItemPlatformInfo | undefined> = [undefined];
  const deferredListItemMarkerStack: boolean[] = [false];
  let stackTop = 0;

  for (let i = 0; i < opcodes.length;) {
    const opcode = opcodes[i];
    switch (opcode) {
      case __OpBegin: {
        const vnode = opcodes[i + 1] as { type: string; props?: Record<string, unknown> };
        const props = vnode.props;
        stackTop += 1;
        typeStack[stackTop] = vnode.type;
        attributeSlotsStack[stackTop] = undefined;
        typedAttributesStack[stackTop] = undefined;
        elementSlotsStack[stackTop] = undefined;
        listItemUidsStack[stackTop] = undefined;
        activeElementSlotStack[stackTop] = undefined;
        activeListItemUidsStack[stackTop] = undefined;
        listItemPlatformInfoStack[stackTop] = props?.['__listItemPlatformInfo'] as ETListItemPlatformInfo | undefined;
        deferredListItemMarkerStack[stackTop] = props?.['isReady'] !== undefined;
        i += 2;
        break;
      }
      case __OpEnd: {
        if (__DEV__ && stackTop === 0) {
          throw new Error('Instruction mismatch: Popped root frame at __OpEnd');
        }

        const type = typeStack[stackTop];
        const attributeSlots = attributeSlotsStack[stackTop];
        const typedAttributes = typedAttributesStack[stackTop];
        const elementSlots = elementSlotsStack[stackTop];
        const listItemUids = listItemUidsStack[stackTop];
        const listItemPlatformInfo = listItemPlatformInfoStack[stackTop];
        const deferredListItemMarker = deferredListItemMarkerStack[stackTop];
        stackTop -= 1;

        const concreteType = type!;

        const parentTemplateKey = stackTop === 0 ? null : typeStack[stackTop]!;
        const parentActiveElementSlot = activeElementSlotStack[stackTop];
        const parentListItemUids = activeListItemUidsStack[stackTop];

        if (concreteType === TYPED_LIST_HOST_TYPE) {
          const listChildren = elementSlots?.[0] ?? [];
          const listState = createElementTemplateListState(
            listItemUids ?? EMPTY_LIST_ITEM_UIDS,
            typedAttributes ?? null,
          );
          const attrsWithCallbacks = composeElementTemplateListAttributes(
            undefined,
            listState,
          );
          const handleId = reserveElementTemplateId();
          const elementRef = createTypedElementTemplateWithReservedHandle(
            handleId,
            TYPED_LIST_HOST_TYPE,
            attrsWithCallbacks,
            null,
            { listChildren },
          );
          registerElementTemplateListState(handleId, listState, true, elementRef);
          appendChildToParent(
            parentTemplateKey,
            parentActiveElementSlot,
            parentListItemUids,
            rootRefs,
            elementRef,
            handleId,
          );

          i += 1;
          break;
        }

        if (__DEV__ && parentTemplateKey === TYPED_LIST_HOST_TYPE) {
          if (deferredListItemMarker) {
            throw new Error('Element Template typed list does not support deferred list items.');
          }
          if (listItemPlatformInfo === undefined) {
            throw new Error('Element Template typed list received a non-list-item root in logical slot $0.');
          }
        }

        const attrPlan = __etAttrPlanMap[concreteType];
        const handleId = reserveElementTemplateId();
        let preparedAttributeSlots = attributeSlots ?? null;
        if (attrPlan !== undefined) {
          preparedAttributeSlots = attributeSlots?.slice() ?? [];
          for (let planIndex = 0; planIndex < attrPlan.length; planIndex += 2) {
            const attrSlotIndex = attrPlan[planIndex] as number;
            const adapter = attrPlan[planIndex + 1] as EtAttrAdapter;
            preparedAttributeSlots[attrSlotIndex] = adapter(
              handleId,
              attrSlotIndex,
              preparedAttributeSlots[attrSlotIndex],
            );
          }
        }
        const nativeTemplate = parseElementTemplateType(concreteType);
        const elementRef = createElementTemplateWithReservedHandle(
          handleId,
          nativeTemplate.templateKey,
          nativeTemplate.bundleUrl,
          preparedAttributeSlots,
          elementSlots ?? null,
        );
        if (listItemPlatformInfo !== undefined) {
          registerElementTemplateListItem(handleId, elementRef, {
            templateKey: concreteType,
            platformInfo: listItemPlatformInfo,
          });
        }
        appendChildToParent(
          parentTemplateKey,
          parentActiveElementSlot,
          parentListItemUids,
          rootRefs,
          elementRef,
          handleId,
        );

        i += 1;
        break;
      }
      case __OpAttr: {
        const name = opcodes[i + 1] as string;
        const value = opcodes[i + 2] as SerializableValue;
        if (name === 'attributeSlots') {
          attributeSlotsStack[stackTop] = value as SerializableValue[];
        } else if (name === 'typedAttributes') {
          typedAttributesStack[stackTop] = value as RuntimeTypedElementAttributes;
        }
        i += 3;
        break;
      }
      case __OpSlot: {
        const slotId = opcodes[i + 1] as number;
        if (__DEV__ && typeStack[stackTop] === TYPED_LIST_HOST_TYPE && slotId !== 0) {
          throw new Error('Element Template typed list only supports logical slot $0.');
        }
        const elementSlots = elementSlotsStack[stackTop] ?? (elementSlotsStack[stackTop] = []);
        const activeElementSlot = elementSlots[slotId] = [];
        activeElementSlotStack[stackTop] = activeElementSlot;
        if (typeStack[stackTop] === TYPED_LIST_HOST_TYPE && slotId === 0) {
          const activeListItemUids = listItemUidsStack[stackTop] = [];
          activeListItemUidsStack[stackTop] = activeListItemUids;
        } else {
          activeListItemUidsStack[stackTop] = undefined;
        }
        i += 2;
        break;
      }
      case __OpText: {
        const text = opcodes[i + 1] as string;
        const parentTemplateKey = stackTop === 0 ? null : typeStack[stackTop]!;
        if (__DEV__ && parentTemplateKey === TYPED_LIST_HOST_TYPE) {
          throw new Error('Element Template typed list received text logical child.');
        }
        const handleId = reserveElementTemplateId();
        const textRef = createElementTemplateWithReservedHandle(
          handleId,
          BUILTIN_RAW_TEXT_TEMPLATE_KEY,
          null,
          [String(text)],
          [],
        );
        if (parentTemplateKey === null) {
          rootRefs.push(textRef);
        } else {
          const activeElementSlot = activeElementSlotStack[stackTop];
          if (__DEV__ && !activeElementSlot) {
            throw new Error(`Template '${parentTemplateKey}' received a text child outside of any element slot.`);
          }
          activeElementSlot!.push(textRef);
        }
        i += 2;
        break;
      }
      default:
        throw new Error(`Unknown opcode: ${opcode as string | number}`);
    }
  }
  return {
    rootRefs,
  };
}
