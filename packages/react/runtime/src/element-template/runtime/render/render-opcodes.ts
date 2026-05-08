// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { __OpAttr, __OpBegin, __OpEnd, __OpSlot, __OpText } from './render-to-opcodes.js';
import type { SerializableValue } from '../../protocol/types.js';
import { __etAttrPlanMap } from '../template/attr-slot-plan.js';
import type { EtAttrAdapter } from '../template/attr-slot-plan.js';
import {
  createElementTemplateWithHandle,
  createElementTemplateWithReservedHandle,
  reserveElementTemplateId,
} from '../template/handle.js';

const BUILTIN_RAW_TEXT_TEMPLATE_KEY = '_et_builtin_raw_text';

export interface MainThreadCreateResult {
  rootRefs: ElementRef[];
}

function appendChildToParent(
  parentTemplateKey: string | null | undefined,
  parentActiveElementSlot: ElementRef[] | undefined,
  rootRefs: ElementRef[],
  elementRef: ElementRef,
): void {
  /* v8 ignore start -- stackTop is always rooted with `null`, never `undefined`. */
  if (parentTemplateKey === undefined) {
    return;
  }
  /* v8 ignore end */

  if (parentTemplateKey === null) {
    rootRefs.push(elementRef);
    return;
  }

  if (!parentActiveElementSlot) {
    throw new Error(`Template '${parentTemplateKey}' received a child outside of any element slot.`);
  }

  parentActiveElementSlot.push(elementRef);
}

export function renderOpcodesIntoElementTemplate(
  opcodes: unknown[],
): MainThreadCreateResult {
  const rootRefs: ElementRef[] = [];
  const templateKeyStack: Array<string | null> = [null];
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
        templateKeyStack[stackTop] = vnode.type;
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

        const templateKey = templateKeyStack[stackTop];
        const attributeSlots = attributeSlotsStack[stackTop];
        const elementSlots = elementSlotsStack[stackTop];
        stackTop -= 1;

        // If templateKey is null, it means we popped the root frame?
        // But __OpEnd should pair with __OpBegin.
        // The Root frame is manually pushed and has no __OpBegin.
        // So we should never pop the Root frame via __OpEnd unless there's an extra End.
        if (templateKey === null) {
          // This should effectively not happen if opcodes are balanced?
          // Actually, if we are at root, and opcode has __OpEnd, it implies we are closing a component.
          // The structure is: Root -> [Begin ... End] -> Root.
          // Wait, if opcodes list ends, loop finishes.
          // __OpEnd corresponds to a component.
          // So if we pop, we must get a valid component frame.
          /* v8 ignore start -- the synthetic root frame cannot be popped by balanced opcodes. */
          throw new Error('Instruction mismatch: Popped root frame at __OpEnd');
          /* v8 ignore end */
        }
        const concreteTemplateKey = templateKey!;

        const parentTemplateKey = templateKeyStack[stackTop];
        const parentActiveElementSlot = activeElementSlotStack[stackTop];

        const attrPlan = __etAttrPlanMap[concreteTemplateKey];
        let elementRef: ElementRef;
        if (attrPlan === undefined) {
          elementRef = createElementTemplateWithHandle(
            concreteTemplateKey,
            null,
            attributeSlots ?? null,
            elementSlots ?? null,
          );
        } else {
          const handleId = reserveElementTemplateId();
          const preparedAttributeSlots = attributeSlots?.slice() ?? [];
          for (let planIndex = 0; planIndex < attrPlan.length; planIndex += 2) {
            const attrSlotIndex = attrPlan[planIndex] as number;
            const adapter = attrPlan[planIndex + 1] as EtAttrAdapter;
            preparedAttributeSlots[attrSlotIndex] = adapter(
              handleId,
              attrSlotIndex,
              preparedAttributeSlots[attrSlotIndex],
            );
          }
          elementRef = createElementTemplateWithReservedHandle(
            handleId,
            concreteTemplateKey,
            null,
            preparedAttributeSlots,
            elementSlots ?? null,
          );
        }
        appendChildToParent(parentTemplateKey, parentActiveElementSlot, rootRefs, elementRef);

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
        const textRef = createElementTemplateWithHandle(
          BUILTIN_RAW_TEXT_TEMPLATE_KEY,
          null,
          [String(text)],
          [],
        );
        const parentTemplateKey = templateKeyStack[stackTop];
        if (parentTemplateKey === null) {
          rootRefs.push(textRef);
        } else {
          const activeElementSlot = activeElementSlotStack[stackTop];
          if (!activeElementSlot) {
            throw new Error(`Template '${parentTemplateKey}' received a text child outside of any element slot.`);
          }
          activeElementSlot.push(textRef);
        }
        i += 2;
        break;
      }
      default:
        // Unknown opcode, maybe skip? or throw?
        // renderToString loop increments manually.
        // If we hit here, something is desync.
        throw new Error(`Unknown opcode: ${opcode as string | number}`);
    }
  }
  return {
    rootRefs,
  };
}
