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
  function __InvokeUIMethod(
    e: ElementRef,
    method: string,
    params: Record<string, unknown>,
    callback: (res: { code: number; data: unknown }) => void,
  ): ElementRef[];
  function __FlushElementTree(element?: ElementRef, options?: unknown): void;
  function __SetAttribute(
    current: ElementRef,
    attrName: string,
    value: unknown,
  ): void;
  function __SetID(node: ElementRef, id: string | null): void;
  function __SetClasses(node: ElementRef, className: string | undefined): void;
  function __AddClass(current: ElementRef, className: string): void;
  function __AddDataset(node: ElementRef, key: string, value: unknown): void;
  function __SetDataset(
    node: ElementRef,
    value: Record<string, unknown> | undefined,
  ): void;
  function __AddInlineStyle(
    e: ElementRef,
    key: number | string,
    value: unknown,
  ): void;
  function __SetInlineStyles(node: ElementRef, value: unknown): void;
  function __AppendElement(parent: ElementRef, current: ElementRef): ElementRef;
  function __RemoveElement(parent: ElementRef, current: ElementRef): ElementRef;
  function __InsertElementBefore(
    parent: ElementRef,
    current: ElementRef,
    marker?: ElementRef,
  ): ElementRef;
  function __ReplaceElement(
    newElement: ElementRef,
    oldElement: ElementRef,
  ): void;
  function __CreateRawText(text: string, info?: unknown): ElementRef;
  function __CloneElement(
    ele: ElementRef,
    options: Record<string, unknown>,
  ): ElementRef;
}
