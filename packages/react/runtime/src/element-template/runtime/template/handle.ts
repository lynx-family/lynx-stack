// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { deleteElementTemplateNativeRef, setElementTemplateNativeRef } from './registry.js';
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
  const nativeRef = __CreateElementTemplate(
    templateKey,
    bundleUrl,
    attributeSlots,
    elementSlots,
    handleId,
  );
  setElementTemplateNativeRef(handleId, nativeRef);
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

export function resetTemplateId(): void {
  nextId = -1;
}

export function destroyElementTemplateId(id: number): void {
  deleteElementTemplateNativeRef(id);
}
