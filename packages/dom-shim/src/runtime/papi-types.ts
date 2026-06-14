// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Ambient PAPI globals consumed by the Shim runtime. Subset shipped in this
// file is what US-401..US-410 needs; later stories extend it.
// Canonical surface lives in benchmarks/src/routes/element-papi-reference.d.ts.txt

export interface ElementRef extends Record<string, unknown> {}

declare global {
  function __GetTag(node: ElementRef): string;
  function __GetParent(current: ElementRef): ElementRef | undefined;
  function __GetChildren(current: ElementRef): ElementRef[];
  function __FirstElement(current: ElementRef): ElementRef | undefined;
  function __LastElement(current: ElementRef): ElementRef | undefined;
  function __NextElement(node: ElementRef): ElementRef | undefined;
  function __GetElementUniqueID(node: ElementRef): number;
  function __ElementIsEqual(left: ElementRef, right: ElementRef): boolean;
  function __GetPageElement(): ElementRef;
  function __GetID(node: ElementRef): string;
  function __GetClasses(node: ElementRef): string[];
  function __GetAttributeByName(node: ElementRef, name: string): unknown;
  function __GetAttributeNames(node: ElementRef): string[];
  function __GetAttributes(node: ElementRef): Record<string, unknown>;
  function __GetDataset(node: ElementRef): Record<string, unknown>;
  function __GetDataByKey(node: ElementRef, key: string): unknown;
  function __QuerySelector(
    root: ElementRef,
    cssSelector: string,
    params: { onlyCurrentComponent?: boolean },
  ): ElementRef | undefined;
  function __QuerySelectorAll(
    root: ElementRef,
    cssSelector: string,
    params: { onlyCurrentComponent?: boolean },
  ): ElementRef[];
}
