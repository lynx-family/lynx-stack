// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  deleteMainThreadDynamicAttrStateForSubtree,
  initializeMainThreadDynamicAttrSlots,
} from './main-thread-dynamic-attr-state.js';
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
  const nativeRef = __CreateElementTemplate(
    templateKey,
    bundleUrl,
    attributeSlots,
    childSlots,
    handleId,
  );
  if (nativeRef) {
    setElementTemplateNativeRef(handleId, nativeRef);
    initializeMainThreadDynamicAttrSlots(
      handleId,
      elementTemplateTypeTag(templateKey, bundleUrl),
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

export function resetTemplateId(): void {
  nextId = -1;
}

export function destroyElementTemplateId(id: number): void {
  deleteElementTemplateNativeRef(id);
  deleteMainThreadDynamicAttrStateForSubtree([id]);
}
