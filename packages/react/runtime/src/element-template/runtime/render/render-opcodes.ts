// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { __OpAttr, __OpBegin, __OpEnd, __OpSlot, __OpText } from './render-to-opcodes.js';
import { parseElementTemplateType } from '../../protocol/template-type.js';
import type { SerializableValue } from '../../protocol/types.js';
import { __etAttrPlanMap } from '../template/attr-slot-plan.js';
import type { EtAttrAdapter } from '../template/attr-slot-plan.js';
import { createElementTemplateWithReservedHandle, reserveElementTemplateId } from '../template/handle.js';

const BUILTIN_RAW_TEXT_TEMPLATE_KEY = '_et_builtin_raw_text';

export interface MainThreadCreateResult {
  rootRefs: ElementRef[];
}

export function renderOpcodesIntoElementTemplate(
  opcodes: unknown[],
): MainThreadCreateResult {
  const rootRefs: ElementRef[] = [];
  const typeStack: Array<string | null> = [null];
  const attributeSlotsStack: Array<SerializableValue[] | undefined> = [undefined];
  const elementSlotsStack: Array<Array<Array<ElementRef>> | undefined> = [undefined];
  const activeElementSlotStack: Array<ElementRef[] | undefined> = [undefined];
  let stackTop = 0;

  for (let i = 0; i < opcodes.length;) {
    const opcode = opcodes[i];
    switch (opcode) {
      case __OpBegin: {
        const vnode = opcodes[i + 1] as { type: string };
        stackTop += 1;
        typeStack[stackTop] = vnode.type;
        attributeSlotsStack[stackTop] = undefined;
        elementSlotsStack[stackTop] = undefined;
        activeElementSlotStack[stackTop] = undefined;
        i += 2;
        break;
      }
      case __OpEnd: {
        if (stackTop === 0) {
          throw new Error('Instruction mismatch: Popped root frame at __OpEnd');
        }

        const type = typeStack[stackTop];
        const attributeSlots = attributeSlotsStack[stackTop];
        const elementSlots = elementSlotsStack[stackTop];
        stackTop -= 1;

        const concreteType = type!;
        const nativeTemplate = parseElementTemplateType(concreteType);

        const parentType = stackTop === 0 ? null : typeStack[stackTop]!;
        const parentActiveElementSlot = activeElementSlotStack[stackTop];

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
        const elementRef = createElementTemplateWithReservedHandle(
          handleId,
          nativeTemplate.templateKey,
          nativeTemplate.bundleUrl,
          preparedAttributeSlots,
          elementSlots ?? null,
        );
        if (parentType === null) {
          rootRefs.push(elementRef);
        } else if (parentActiveElementSlot) {
          parentActiveElementSlot.push(elementRef);
        } else {
          throw new Error(`Template '${parentType}' received a child outside of any element slot.`);
        }

        i += 1;
        break;
      }
      case __OpAttr: {
        const name = opcodes[i + 1] as string;
        const value = opcodes[i + 2] as SerializableValue;
        if (name === 'attributeSlots') {
          attributeSlotsStack[stackTop] = value as SerializableValue[];
        }
        i += 3;
        break;
      }
      case __OpSlot: {
        const slotId = opcodes[i + 1] as number;
        const elementSlots = elementSlotsStack[stackTop] ?? (elementSlotsStack[stackTop] = []);
        const activeElementSlot = elementSlots[slotId] = [];
        activeElementSlotStack[stackTop] = activeElementSlot;
        i += 2;
        break;
      }
      case __OpText: {
        const text = opcodes[i + 1] as string;
        const handleId = reserveElementTemplateId();
        const textRef = createElementTemplateWithReservedHandle(
          handleId,
          BUILTIN_RAW_TEXT_TEMPLATE_KEY,
          null,
          [String(text)],
          [],
        );
        const parentType = stackTop === 0 ? null : typeStack[stackTop]!;
        if (parentType === null) {
          rootRefs.push(textRef);
        } else {
          const activeElementSlot = activeElementSlotStack[stackTop];
          if (!activeElementSlot) {
            throw new Error(`Template '${parentType}' received a text child outside of any element slot.`);
          }
          activeElementSlot.push(textRef);
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
