// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  attachMainThreadDynamicAttrRefsForSubtree,
  deleteMainThreadDynamicAttrStateForSubtree,
  initializeMainThreadDynamicAttrSlots,
  prepareMainThreadDynamicAttrSlotsForNative,
} from './main-thread-dynamic-attr-state.js';
import type { MainThreadDynamicAttrSubtreeHandle } from './main-thread-dynamic-attr-state.js';
import { deleteElementTemplateNativeRef, setElementTemplateNativeRef } from './registry.js';
import { elementTemplateTypeTag } from '../../protocol/template-type.js';
import type {
  RuntimeElementSlots,
  RuntimeOptions,
  RuntimeTypedElementAttributes,
  SerializableValue,
} from '../../protocol/types.js';

// Main-thread IFR allocates ids as consecutive negative integers.
let nextId = -1;

export function reserveElementTemplateId(): number {
  const id = nextId--;
  return id;
}

export function createElementTemplateWithReservedHandle(
  handleId: number,
  templateKey: string,
  bundleUrl: string | null | undefined,
  attributeSlots: SerializableValue[] | null | undefined,
  elementSlots: RuntimeElementSlots | null | undefined,
): ElementRef {
  const templateType = elementTemplateTypeTag(templateKey, bundleUrl);
  const nativeAttributeSlots = prepareMainThreadDynamicAttrSlotsForNative(templateType, attributeSlots);
  const nativeRef = __CreateElementTemplate(
    templateKey,
    bundleUrl,
    nativeAttributeSlots,
    elementSlots,
    handleId,
  );
  if (nativeRef) {
    setElementTemplateNativeRef(handleId, nativeRef);
    initializeMainThreadDynamicAttrSlots(
      handleId,
      templateType,
      attributeSlots,
    );
  }
  return nativeRef;
}

export function createTypedElementTemplateWithReservedHandle(
  handleId: number,
  type: string,
  attributes: RuntimeTypedElementAttributes | null | undefined,
  elementSlots: RuntimeElementSlots | null | undefined,
  options: RuntimeOptions | null | undefined,
): ElementRef {
  const nativeRef = __CreateTypedElementTemplate(
    type,
    attributes,
    elementSlots,
    handleId,
    options,
  );
  setElementTemplateNativeRef(handleId, nativeRef);
  return nativeRef;
}

export function insertElementTemplateSubtree(
  targetRef: ElementRef,
  elementSlotIndex: number,
  childRef: ElementRef,
  referenceRef: ElementRef | null,
  subtreeHandles: readonly MainThreadDynamicAttrSubtreeHandle[] | null,
): void {
  __InsertNodeToElementTemplate(targetRef, elementSlotIndex, childRef, referenceRef);
  if (subtreeHandles !== null) {
    attachMainThreadDynamicAttrRefsForSubtree(subtreeHandles);
  }
}

export function resetTemplateId(): void {
  nextId = -1;
}

export function destroyElementTemplateId(id: number): void {
  deleteElementTemplateNativeRef(id);
  deleteMainThreadDynamicAttrStateForSubtree([id]);
}
