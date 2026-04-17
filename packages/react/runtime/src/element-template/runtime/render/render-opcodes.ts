// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  createElementTemplateListCellRef,
  createElementTemplateListWithHandle,
  isElementTemplateList,
  splitListItemAttributeSlots,
} from './list.js';
import { __OpAttr, __OpBegin, __OpEnd, __OpSlot, __OpText } from './render-to-opcodes.js';
import type { RuntimeOptions, SerializableValue } from '../../protocol/types.js';
import { createElementTemplateWithHandle } from '../template/handle.js';

const BUILTIN_RAW_TEXT_TEMPLATE_KEY = '__et_builtin_raw_text__';

interface Frame {
  // Current template Key (vnode.type). null for the initial root frame.
  templateKey: string | null;

  // Collected dynamic attributes passed from transform lowering.
  attributeSlots: SerializableValue[] | undefined;

  // Collected dynamic children keyed by elementSlotIndex.
  elementSlots: Array<Array<ElementRef | ReturnType<typeof createElementTemplateListCellRef>>> | undefined;

  // Create-time metadata forwarded into __CreateElementTemplate options.
  options: RuntimeOptions | undefined;

  // Cached array for current active slot to avoid repeated lookups.
  activeElementSlot: ElementRef[] | undefined;
}

export interface MainThreadCreateResult {
  rootRefs: ElementRef[];
}

function appendChildToParent(
  parentTemplateKey: string | null | undefined,
  parentActiveElementSlot: ElementRef[] | undefined,
  rootRefs: ElementRef[],
  elementRef: ElementRef,
): void {
  if (parentTemplateKey === undefined) {
    return;
  }

  if (parentTemplateKey === null) {
    rootRefs.push(elementRef);
    return;
  }

  if (!parentActiveElementSlot) {
    throw new Error(`Template '${parentTemplateKey}' received a child outside of any element slot.`);
  }

  parentActiveElementSlot.push(elementRef);
}

function appendListAwareChildToParent(
  parentTemplateKey: string | null | undefined,
  parentOptions: RuntimeOptions | undefined,
  parentActiveElementSlot: ElementRef[] | undefined,
  rootRefs: ElementRef[],
  elementRef: ElementRef,
  templateKey: string,
  templateAttributeSlots: SerializableValue[] | null,
  platformInfo: Record<string, unknown> | null,
): void {
  if (parentTemplateKey === undefined) {
    return;
  }

  if (parentTemplateKey === null) {
    rootRefs.push(elementRef);
    return;
  }

  if (!parentActiveElementSlot) {
    throw new Error(`Template '${parentTemplateKey}' received a child outside of any element slot.`);
  }

  if (isElementTemplateList(parentOptions)) {
    parentActiveElementSlot.push(
      createElementTemplateListCellRef(
        elementRef,
        templateKey,
        templateAttributeSlots,
        platformInfo,
      ),
    );
    return;
  }

  parentActiveElementSlot.push(elementRef);
}

function createListAwareElementRef(
  frame: Frame,
  parentOptions: RuntimeOptions | undefined,
  templateKey: string,
): {
  elementRef: ElementRef;
  templateAttributeSlots: SerializableValue[] | null;
  platformInfo: Record<string, unknown> | null;
} {
  const isListCell = Boolean(parentOptions && isElementTemplateList(parentOptions));
  const {
    templateAttributeSlots,
    platformInfo,
  } = isListCell
    ? splitListItemAttributeSlots(frame.attributeSlots ?? null)
    : {
      templateAttributeSlots: frame.attributeSlots ?? null,
      platformInfo: null,
    };

  const elementRef = isElementTemplateList(frame.options)
    ? createElementTemplateListWithHandle(
      templateKey,
      frame.elementSlots ?? null,
      templateAttributeSlots,
      frame.options,
    )
    : createElementTemplateWithHandle(
      templateKey,
      null,
      templateAttributeSlots,
      frame.elementSlots ?? null,
      frame.options,
    );

  return {
    elementRef,
    templateAttributeSlots,
    platformInfo,
  };
}

export function renderOpcodesIntoElementTemplate(
  opcodes: unknown[],
): MainThreadCreateResult {
  const rootRefs: ElementRef[] = [];
  const templateKeyStack: Array<string | null> = [null];
  const attributeSlotsStack: Array<SerializableValue[] | undefined> = [undefined];
  const elementSlotsStack: Array<
    Array<Array<ElementRef | ReturnType<typeof createElementTemplateListCellRef>>> | undefined
  > = [undefined];
  const optionsStack: Array<RuntimeOptions | undefined> = [undefined];
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
        optionsStack[stackTop] = undefined;
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
        const currentOptions = optionsStack[stackTop];
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
          throw new Error('Instruction mismatch: Popped root frame at __OpEnd');
        }
        const concreteTemplateKey = templateKey!;

        const parentTemplateKey = templateKeyStack[stackTop];
        const parentOptions = optionsStack[stackTop];
        const parentActiveElementSlot = activeElementSlotStack[stackTop];

        if (!currentOptions && !parentOptions) {
          const elementRef = createElementTemplateWithHandle(
            concreteTemplateKey,
            null,
            attributeSlots ?? null,
            elementSlots ?? null,
            currentOptions,
          );
          appendChildToParent(parentTemplateKey, parentActiveElementSlot, rootRefs, elementRef);
          i += 1;
          break;
        }

        const currentIsList = isElementTemplateList(currentOptions);
        const parentIsList = Boolean(parentOptions && isElementTemplateList(parentOptions));

        if (!currentIsList && !parentIsList) {
          const elementRef = createElementTemplateWithHandle(
            concreteTemplateKey,
            null,
            attributeSlots ?? null,
            elementSlots ?? null,
            currentOptions,
          );
          appendChildToParent(parentTemplateKey, parentActiveElementSlot, rootRefs, elementRef);
          i += 1;
          break;
        }

        const frame: Frame = {
          templateKey: concreteTemplateKey,
          attributeSlots,
          elementSlots: elementSlots,
          options: currentOptions,
          activeElementSlot: undefined,
        };
        const {
          elementRef,
          templateAttributeSlots,
          platformInfo,
        } = createListAwareElementRef(frame, parentOptions, concreteTemplateKey);

        appendListAwareChildToParent(
          parentTemplateKey,
          parentOptions,
          parentActiveElementSlot,
          rootRefs,
          elementRef,
          concreteTemplateKey,
          templateAttributeSlots,
          platformInfo,
        );

        i += 1;
        break;
      }
      case __OpAttr: {
        const name = opcodes[i + 1] as string;
        const value = opcodes[i + 2] as SerializableValue;
        if (name === 'attributeSlots') {
          attributeSlotsStack[stackTop] = value as SerializableValue[];
        } else if (name === 'options') {
          optionsStack[stackTop] = value as RuntimeOptions;
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
          undefined,
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
