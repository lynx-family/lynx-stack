// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  RuntimeAttributeSlotValue,
  RuntimeChildSlots,
  RuntimeOptions,
  RuntimeTypedElementAttributes,
  RuntimeTypedListOptions,
  SerializableValue,
  SerializedEtNode,
  SerializedRuntimeOptions,
  SerializedTypedListOptions,
  TypedListOptionsCommand,
  UpdateTypedListItemCommand,
} from './protocol/types.js';

export {};

declare global {
  const elementTemplateHandleBrand: unique symbol;

  interface FiberElement {
    readonly [elementTemplateHandleBrand]?: never;
  }

  type ElementRef = FiberElement;

  interface ElementTemplateHandle {
    readonly [elementTemplateHandleBrand]: true;
  }

  const __USE_ELEMENT_TEMPLATE__: boolean;

  // Passing undefined selects the default ordinary Element root while retaining
  // explicit flush options. It is not an Element Template handle.
  function __FlushElementTree(element: undefined, options: FlushOptions): void;

  function __CreateElementTemplate(
    templateKey: string,
    bundleUrl: string | null | undefined,
    attributeSlots: SerializableValue[] | null | undefined,
    childSlots: RuntimeChildSlots | null | undefined,
    uid: number,
    options?: RuntimeOptions | null,
  ): ElementTemplateHandle;

  function __CreateTypedElementTemplate(
    type: 'list',
    attributes: RuntimeTypedElementAttributes | null | undefined,
    childSlots: RuntimeChildSlots | null | undefined,
    uid: number,
    options?: RuntimeTypedListOptions | null,
  ): ElementTemplateHandle;

  function __CreateTypedElementTemplate(
    type: string,
    attributes: RuntimeTypedElementAttributes | null | undefined,
    childSlots: RuntimeChildSlots | null | undefined,
    uid: number,
    options?: RuntimeOptions | RuntimeTypedListOptions | null,
  ): ElementTemplateHandle;

  function __SetAttributeOfElementTemplate(
    element: ElementTemplateHandle,
    attrSlotIndex: number,
    value: RuntimeAttributeSlotValue | null,
  ): void;

  function __InsertNodeToElementTemplate(
    parent: ElementTemplateHandle,
    childSlotIndex: number,
    child: ElementTemplateHandle,
    reference?: ElementTemplateHandle | null,
  ): void;

  function __RemoveNodeFromElementTemplate(
    parent: ElementTemplateHandle,
    childSlotIndex: number,
    child: ElementTemplateHandle,
  ): void;

  function __SerializeElementTemplate(templateInstance: ElementTemplateHandle): SerializedEtNode;
}

type AssertFalse<T extends false> = T;
type AssertTrue<T extends true> = T;
type IsAssignable<From, To> = [From] extends [To] ? true : false;
type ElementTemplateHandleIsNotElementRef = AssertFalse<
  IsAssignable<ElementTemplateHandle, ElementRef>
>;
type ElementRefIsNotElementTemplateHandle = AssertFalse<
  IsAssignable<ElementRef, ElementTemplateHandle>
>;
type RuntimeOptionsRejectElementTemplateHandle = AssertFalse<
  IsAssignable<ElementTemplateHandle, RuntimeOptions[string]>
>;
type RuntimeOptionsAcceptElementRef = AssertTrue<
  IsAssignable<ElementRef, RuntimeOptions[string]>
>;
type RuntimeAttributeSlotValueRejectElementTemplateHandle = AssertFalse<
  IsAssignable<ElementTemplateHandle, RuntimeAttributeSlotValue>
>;
type CreateCompiledElementTemplateRejectStringUid = AssertFalse<
  IsAssignable<string, Parameters<typeof __CreateElementTemplate>[4]>
>;
type CreateTypedElementTemplateRejectStringUid = AssertFalse<
  IsAssignable<string, Parameters<typeof __CreateTypedElementTemplate>[3]>
>;
type InsertElementTemplateAcceptsUndefinedReference = AssertTrue<
  IsAssignable<undefined, Parameters<typeof __InsertNodeToElementTemplate>[3]>
>;
type SerializedEtNodeRejectStringUid = AssertFalse<
  IsAssignable<string, SerializedEtNode['uid']>
>;
type SerializedRuntimeOptionsRejectEtNode = AssertFalse<
  IsAssignable<SerializedEtNode, SerializedRuntimeOptions[string]>
>;
type RuntimeTypedListOptionsAcceptElementTemplateHandle = AssertTrue<
  IsAssignable<ElementTemplateHandle, RuntimeTypedListOptions['listChildren'][number]>
>;
type SerializedTypedListOptionsAcceptEtNode = AssertTrue<
  IsAssignable<SerializedEtNode, SerializedTypedListOptions['listChildren'][number]>
>;
type TypedListOptionsCommandAcceptItem = AssertTrue<
  IsAssignable<UpdateTypedListItemCommand, TypedListOptionsCommand['listChildren'][number]>
>;
