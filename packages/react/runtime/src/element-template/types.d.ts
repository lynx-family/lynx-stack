// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  RuntimeAttributeSlotValue,
  RuntimeElementSlots,
  RuntimeOptions,
  RuntimeTypedElementAttributes,
  SerializableValue,
  SerializedEtNode,
} from './protocol/types.js';

export {};

declare global {
  type ElementRef = FiberElement;

  const __USE_ELEMENT_TEMPLATE__: boolean;

  /**
   * The lazy bundle's entry URL. The FetchBundle loader sets this before
   * running a lazy bundle's `loadScript` so the bundle wrapper resolves its
   * own element templates instead of falling back to the main card
   * (`__Card__`).
   */
  var globDynamicComponentEntry: string | undefined;

  function __CreateElementTemplate(
    templateKey: string,
    bundleUrl: string | null | undefined,
    attributeSlots: SerializableValue[] | null | undefined,
    elementSlots: RuntimeElementSlots | null | undefined,
    uid: number | string,
    options?: RuntimeOptions | null,
  ): ElementRef;

  function __CreateTypedElementTemplate(
    type: string,
    attributes: RuntimeTypedElementAttributes | null | undefined,
    elementSlots: RuntimeElementSlots | null | undefined,
    uid: number | string,
    options?: RuntimeOptions | null,
  ): ElementRef;

  function __SetAttributeOfElementTemplate(
    element: ElementRef,
    attrSlotIndex: number,
    value: RuntimeAttributeSlotValue | null,
    options?: RuntimeOptions | null,
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
  ): SerializedEtNode;
}
