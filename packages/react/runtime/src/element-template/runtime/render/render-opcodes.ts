// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { __OpAttr, __OpBegin, __OpEnd, __OpPageEnd, __OpPageStart, __OpSlot, __OpText } from './render-to-opcodes.js';
import { elementTemplateIdentityKey, parseElementTemplateType } from '../../protocol/template-type.js';
import type {
  RuntimeTypedElementAttributes,
  SerializableValue,
  TypedElementAttributesCommand,
} from '../../protocol/types.js';
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
import { prepareTypedElementAttributes } from '../template/typed-attributes.js';

const BUILTIN_RAW_TEXT_TEMPLATE_KEY = '_et_builtin_raw_text';
const TYPED_LIST_HOST_TYPE = 'list';
const EMPTY_LIST_ITEM_UIDS: readonly number[] = [];

export interface MainThreadCreateResult {
  pageAttributes: TypedElementAttributesCommand | null;
  rootRefs: ElementTemplateHandle[];
}

function appendChildToParent(
  parentTemplateKey: string | null,
  parentActiveChildSlot: ElementTemplateHandle[] | undefined,
  parentListItemUids: number[] | undefined,
  rootRefs: ElementTemplateHandle[],
  elementRef: ElementTemplateHandle,
  uid: number,
): void {
  if (parentTemplateKey === null) {
    rootRefs.push(elementRef);
    return;
  }

  if (__DEV__ && !parentActiveChildSlot) {
    throw new Error(`Template '${parentTemplateKey}' received a child outside of any child slot.`);
  }

  parentActiveChildSlot!.push(elementRef);
  parentListItemUids?.push(uid);
}

export function renderOpcodesIntoElementTemplate(
  opcodes: unknown[],
): MainThreadCreateResult {
  const rootRefs: ElementTemplateHandle[] = [];
  let pageAttributes: TypedElementAttributesCommand | null | undefined;
  let isInsideAuthoredPage = false;
  const typeStack: Array<string | null> = [null];
  const attributeSlotsStack: Array<SerializableValue[] | undefined> = [undefined];
  const typedAttributesStack: Array<RuntimeTypedElementAttributes | undefined> = [undefined];
  const childSlotsStack: Array<Array<Array<ElementTemplateHandle>> | undefined> = [undefined];
  const listItemUidsStack: Array<number[] | undefined> = [undefined];
  const activeChildSlotStack: Array<ElementTemplateHandle[] | undefined> = [undefined];
  const activeListItemUidsStack: Array<number[] | undefined> = [undefined];
  const listItemPlatformInfoStack: Array<ETListItemPlatformInfo | undefined> = [undefined];
  const deferredListItemMarkerStack: boolean[] = [false];
  let stackTop = 0;

  for (let i = 0; i < opcodes.length;) {
    const opcode = opcodes[i];
    switch (opcode) {
      case __OpBegin: {
        if (__DEV__ && stackTop === 0 && pageAttributes !== undefined && !isInsideAuthoredPage) {
          throw new Error('Element Template authored <page /> must wrap all materialized roots.');
        }
        const vnode = opcodes[i + 1] as { type: string; props?: Record<string, unknown> };
        const props = vnode.props;
        stackTop += 1;
        typeStack[stackTop] = vnode.type;
        attributeSlotsStack[stackTop] = undefined;
        typedAttributesStack[stackTop] = undefined;
        childSlotsStack[stackTop] = undefined;
        listItemUidsStack[stackTop] = undefined;
        activeChildSlotStack[stackTop] = undefined;
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
        const childSlots = childSlotsStack[stackTop];
        const listItemUids = listItemUidsStack[stackTop];
        const listItemPlatformInfo = listItemPlatformInfoStack[stackTop];
        const deferredListItemMarker = deferredListItemMarkerStack[stackTop];
        stackTop -= 1;

        const concreteType = type!;

        const parentTemplateKey = stackTop === 0 ? null : typeStack[stackTop]!;
        const parentActiveChildSlot = activeChildSlotStack[stackTop];
        const parentListItemUids = activeListItemUidsStack[stackTop];

        if (concreteType === TYPED_LIST_HOST_TYPE) {
          const listChildren = childSlots?.[0] ?? [];
          const handleId = reserveElementTemplateId();
          const preparedTypedAttributes = prepareTypedElementAttributes(
            handleId,
            typedAttributes,
          );
          const listState = createElementTemplateListState(
            listItemUids ?? EMPTY_LIST_ITEM_UIDS,
            preparedTypedAttributes,
          );
          const attrsWithCallbacks = composeElementTemplateListAttributes(
            undefined,
            listState,
          );
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
            parentActiveChildSlot,
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
          childSlots ?? null,
        );
        if (listItemPlatformInfo !== undefined) {
          registerElementTemplateListItem(handleId, elementRef, {
            // The native list identifies items by the same identity the template
            // was registered under (sentinel stripped for the main card), so the
            // update path (`resolveTypedListItem`) stays consistent with it.
            templateKey: elementTemplateIdentityKey(nativeTemplate.templateKey, nativeTemplate.bundleUrl),
            platformInfo: listItemPlatformInfo,
          });
        }
        appendChildToParent(
          parentTemplateKey,
          parentActiveChildSlot,
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
        const value = opcodes[i + 2] as SerializableValue | null;
        if (name === 'attributeSlots') {
          attributeSlotsStack[stackTop] = value as SerializableValue[];
        } else if (name === 'typedAttributes') {
          typedAttributesStack[stackTop] = value as RuntimeTypedElementAttributes;
        }
        i += 3;
        break;
      }
      case __OpPageStart: {
        if (__DEV__ && stackTop !== 0) {
          throw new Error('Element Template authored <page /> must be the outermost element.');
        }
        if (__DEV__ && pageAttributes !== undefined) {
          throw new Error('Element Template does not support multiple authored <page /> elements.');
        }
        if (__DEV__ && rootRefs.length !== 0) {
          throw new Error('Element Template authored <page /> must wrap all materialized roots.');
        }
        pageAttributes = opcodes[i + 1] as TypedElementAttributesCommand | null;
        isInsideAuthoredPage = true;
        i += 2;
        break;
      }
      case __OpPageEnd: {
        if (__DEV__) {
          isInsideAuthoredPage = false;
        }
        i += 1;
        break;
      }
      case __OpSlot: {
        const slotId = opcodes[i + 1] as number;
        if (__DEV__ && typeStack[stackTop] === TYPED_LIST_HOST_TYPE && slotId !== 0) {
          throw new Error('Element Template typed list only supports logical slot $0.');
        }
        const childSlots = childSlotsStack[stackTop] ?? (childSlotsStack[stackTop] = []);
        const activeChildSlot = childSlots[slotId] = [];
        activeChildSlotStack[stackTop] = activeChildSlot;
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
        if (__DEV__ && stackTop === 0 && pageAttributes !== undefined && !isInsideAuthoredPage) {
          throw new Error('Element Template authored <page /> must wrap all materialized roots.');
        }
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
          const activeChildSlot = activeChildSlotStack[stackTop];
          if (__DEV__ && !activeChildSlot) {
            throw new Error(`Template '${parentTemplateKey}' received a text child outside of any child slot.`);
          }
          activeChildSlot!.push(textRef);
        }
        i += 2;
        break;
      }
      default:
        throw new Error(`Unknown opcode: ${opcode as string | number}`);
    }
  }
  return {
    pageAttributes: pageAttributes ?? null,
    rootRefs,
  };
}
