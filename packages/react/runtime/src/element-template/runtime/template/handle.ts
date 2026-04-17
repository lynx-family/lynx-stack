// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { deleteElementTemplateNativeRef, setElementTemplateNativeRef } from './registry.js';

// Main-thread IFR allocates ids as consecutive negative integers.
let nextId = -1;

export function reserveElementTemplateId(): number {
  const id = nextId--;
  return id;
}

export function createElementTemplateWithHandle(
  templateKey: string,
  bundleUrl: string | null | undefined,
  attributeSlots: SerializableValue[] | null | undefined,
  elementSlots: ElementRef[][] | null | undefined,
  options?: RuntimeOptions,
): ElementRef {
  const handleId = nextId--;
  const runtimeOptions = options
    ? {
      ...options,
      handleId,
    }
    : handleId;
  const nativeRef = __CreateElementTemplate(
    templateKey,
    bundleUrl,
    attributeSlots,
    elementSlots,
    runtimeOptions,
  );
  setElementTemplateNativeRef(handleId, nativeRef);
  return nativeRef;
}

export function resetTemplateId(): void {
  nextId = -1;
}

export function destroyElementTemplateId(id: number): void {
  deleteElementTemplateNativeRef(id);
  // __ReleaseElement(nativeRef);
}
