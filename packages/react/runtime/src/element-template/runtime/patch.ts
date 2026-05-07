// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { ElementTemplateRegistry } from './template/registry.js';
import { ElementTemplateUpdateOps } from '../protocol/opcodes.js';
import type { ElementTemplateUpdateOp } from '../protocol/opcodes.js';
import type { ElementTemplateUpdateCommandStream, SerializableValue } from '../protocol/types.js';

export type { ElementTemplateUpdateCommandStream } from '../protocol/types.js';

export function applyElementTemplateUpdateCommands(
  stream: ElementTemplateUpdateCommandStream,
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
        const elementSlots = stream[i++] as number[][] | null | undefined;

        if (__DEV__) {
          const createError = validateCreateTemplatePayload(
            handleId,
            attributeSlots,
            elementSlots,
          );
          if (createError) {
            lynx.reportError(createError);
            continue;
          }
        }

        const resolvedElementSlots = resolveElementSlots(elementSlots);
        if (__DEV__ && resolvedElementSlots.hasError) {
          continue;
        }

        const nativeRef = __CreateElementTemplate(
          templateKey,
          bundleUrl,
          normalizeAttributeSlots(attributeSlots),
          resolvedElementSlots.value,
          handleId,
        );

        if (nativeRef) {
          ElementTemplateRegistry.set(handleId, nativeRef);
        }
        break;
      }

      case ElementTemplateUpdateOps.setAttribute: {
        const targetId = stream[i++] as number;
        const attrSlotIndex = stream[i++] as number;
        const value = stream[i++] as SerializableValue | null;
        const nativeRef = resolveHandle(targetId, 'target');
        if (!nativeRef) {
          continue;
        }
        __SetAttributeOfElementTemplate(nativeRef, attrSlotIndex, value, null);
        break;
      }

      case ElementTemplateUpdateOps.insertNode: {
        const targetId = stream[i++] as number;
        const elementSlotIndex = stream[i++] as number;
        const childId = stream[i++] as number;
        const referenceId = stream[i++] as number;
        const nativeRef = resolveHandle(targetId, 'target');
        const childRef = resolveHandle(childId, 'child');
        if (!nativeRef || !childRef) {
          continue;
        }
        const referenceRef = referenceId === 0 ? null : resolveHandle(referenceId, 'reference');
        if (referenceId !== 0 && !referenceRef) {
          continue;
        }
        __InsertNodeToElementTemplate(nativeRef, elementSlotIndex, childRef, referenceRef);
        break;
      }

      case ElementTemplateUpdateOps.removeNode: {
        const targetId = stream[i++] as number;
        const elementSlotIndex = stream[i++] as number;
        const childId = stream[i++] as number;
        const nativeRef = resolveHandle(targetId, 'target');
        const childRef = resolveHandle(childId, 'child');
        if (!nativeRef || !childRef) {
          continue;
        }
        __RemoveNodeFromElementTemplate(nativeRef, elementSlotIndex, childRef);
        break;
      }

      default: {
        lynx.reportError(new Error(`ElementTemplate update opcode ${String(op)} is not supported.`));
      }
    }
  }
}

function resolveElementSlots(
  elementSlots: number[][] | null | undefined,
): { hasError: boolean; value: ElementRef[][] | null } {
  if (!Array.isArray(elementSlots)) {
    return { hasError: false, value: null };
  }

  let hasError = false;
  const value = elementSlots.map((children, slotIndex) => {
    if (!Array.isArray(children)) {
      if (__DEV__) {
        lynx.reportError(
          new Error(`ElementTemplate create slot ${slotIndex} must be an array of child handles.`),
        );
        hasError = true;
      }
      return [];
    }

    return children
      .map((childId) => {
        const childRef = __DEV__
          ? resolveHandle(childId, 'child')
          : (ElementTemplateRegistry.get(childId) ?? null);
        if (__DEV__ && childRef === null) {
          hasError = true;
        }
        return childRef;
      })
      .filter((childRef): childRef is ElementRef => childRef !== null);
  });
  return { hasError, value };
}

function resolveHandle(id: number, role: string): ElementRef | null {
  const nativeRef = ElementTemplateRegistry.get(id);
  if (!nativeRef) {
    lynx.reportError(new Error(`ElementTemplate update ${role} handle ${id} not found.`));
    return null;
  }
  return nativeRef;
}

function isValidHandleId(handleId: number): boolean {
  return Number.isInteger(handleId) && handleId !== 0;
}

function validateCreateTemplatePayload(
  handleId: number,
  attributeSlots: SerializableValue[] | null | undefined,
  elementSlots: number[][] | null | undefined,
): Error | null {
  if (!isValidHandleId(handleId)) {
    return new Error(`ElementTemplate update has invalid handleId ${String(handleId)}.`);
  }
  if (ElementTemplateRegistry.get(handleId)) {
    return new Error(`ElementTemplate update received duplicate handleId ${handleId}.`);
  }
  if (attributeSlots != null && !Array.isArray(attributeSlots)) {
    return new Error('ElementTemplate update create attributeSlots must be an array, null, or undefined.');
  }
  if (elementSlots != null && !Array.isArray(elementSlots)) {
    return new Error('ElementTemplate update create elementSlots must be an array, null, or undefined.');
  }
  return null;
}

function normalizeAttributeSlots(
  attributeSlots: SerializableValue[] | null | undefined,
): SerializableValue[] | null | undefined {
  if (!Array.isArray(attributeSlots)) {
    return attributeSlots;
  }
  return attributeSlots.map((value) => (value === undefined ? null : value));
}
