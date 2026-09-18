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
  RuntimeChildSlots,
  RuntimeOptions,
  RuntimeTypedElementAttributes,
  RuntimeTypedListOptions,
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
  childSlots: RuntimeChildSlots | null | undefined,
): ElementTemplateHandle {
  const templateType = elementTemplateTypeTag(templateKey, bundleUrl);
  const nativeAttributeSlots = prepareMainThreadDynamicAttrSlotsForNative(templateType, attributeSlots);
  const nativeRef = __CreateElementTemplate(
    templateKey,
    bundleUrl,
    nativeAttributeSlots,
    childSlots,
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
  childSlots: RuntimeChildSlots | null | undefined,
  options: RuntimeOptions | RuntimeTypedListOptions | null | undefined,
): ElementTemplateHandle {
  const nativeRef = __CreateTypedElementTemplate(
    type,
    attributes,
    childSlots,
    handleId,
    options,
  );
  setElementTemplateNativeRef(handleId, nativeRef);
  return nativeRef;
}

export function insertElementTemplateSubtree(
  targetRef: ElementTemplateHandle,
  childSlotIndex: number,
  childRef: ElementTemplateHandle,
  referenceRef: ElementTemplateHandle | null,
  subtreeHandles: readonly MainThreadDynamicAttrSubtreeHandle[] | null,
): void {
  __InsertNodeToElementTemplate(targetRef, childSlotIndex, childRef, referenceRef);
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
