// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Registry for mapping element-template handle IDs to native refs.
//
// Main-thread IFR allocates IDs as consecutive negative integers: -1, -2, -3...
// We store those in a dense array for performance.
//
// Other IDs (e.g. positive IDs coming from background-created nodes) fall back to a Map.

const negativeRefs: Array<ElementRef | undefined> = [];
const otherRefs: Map<number, ElementRef> = new Map();

export function setElementTemplateNativeRef(id: number, nativeRef: ElementRef): void {
  if (id < 0) {
    negativeRefs[-id - 1] = nativeRef;
    return;
  }
  otherRefs.set(id, nativeRef);
}

export function getElementTemplateNativeRef(id: number): ElementRef | undefined {
  if (id < 0) {
    return negativeRefs[-id - 1];
  }
  return otherRefs.get(id);
}

export function hasElementTemplateNativeRef(id: number): boolean {
  return getElementTemplateNativeRef(id) != null;
}

export function deleteElementTemplateNativeRef(id: number): void {
  if (id < 0) {
    negativeRefs[-id - 1] = undefined;
    return;
  }
  otherRefs.delete(id);
}

export function clearElementTemplateNativeRefRegistry(): void {
  negativeRefs.length = 0;
  otherRefs.clear();
}

// Legacy-compatible facade used across runtime/tests.
// Note: unlike Map, .set returns void (call sites don't rely on the return value).
export interface ElementTemplateRegistryFacade {
  set: (id: number, nativeRef: ElementRef) => void;
  get: (id: number) => ElementRef | undefined;
  has: (id: number) => boolean;
  delete: (id: number) => void;
  clear: () => void;
}

export const ElementTemplateRegistry: ElementTemplateRegistryFacade = {
  set: setElementTemplateNativeRef,
  get: getElementTemplateNativeRef,
  has: hasElementTemplateNativeRef,
  delete: deleteElementTemplateNativeRef,
  clear: clearElementTemplateNativeRefRegistry,
};
