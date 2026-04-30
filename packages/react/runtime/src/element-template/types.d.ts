// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RuntimeOptions, SerializableValue, SerializedElementTemplate } from './protocol/types.js';

export {};

declare global {
  type ElementRef = FiberElement;

  const __USE_ELEMENT_TEMPLATE__: boolean;

  function __CreateElementTemplate(
    templateKey: string,
    bundleUrl: string | null | undefined,
    attributeSlots: SerializableValue[] | null | undefined,
    elementSlots: ElementRef[][] | null | undefined,
    uid: number | string,
  ): ElementRef;

  function __SetAttributeOfElementTemplate(
    element: ElementRef,
    attrSlotIndex: number,
    value: SerializableValue | null,
    oldValue?: SerializableValue | null,
  ): void;

  function __InsertNodeToElementTemplate(
    parent: ElementRef,
    elementSlotIndex: number,
    child: ElementRef,
    reference: ElementRef | null,
  ): void;

  function __RemoveNodeFromElementTemplate(
    parent: ElementRef,
    elementSlotIndex: number,
    child: ElementRef,
  ): void;

  function __SerializeElementTemplate(
    templateInstance: ElementRef,
    options?: RuntimeOptions | null,
  ): SerializedElementTemplate;
}
