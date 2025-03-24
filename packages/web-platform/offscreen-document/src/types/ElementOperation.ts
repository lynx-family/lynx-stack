// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const OperationType = {
  CreateElement: 1,
  SetAttribute: 2,
  RemoveAttribute: 3,
  Append: 4,
  Remove: 5,
  ReplaceWith: 6,
  InsertBefore: 7,
  EnableEvent: 8,
  RemoveChild: 9,
  StyleDeclarationSetProperty: 10,
  StyleDeclarationRemoveProperty: 11,
  SetInnerHTML: 12,
} as const;

type IOperationType = typeof OperationType;
interface ElementOperationBase {
  type: IOperationType[keyof IOperationType];
  /**
   * uniqueId
   */
  uid: number;
}

export interface CreateOperation extends ElementOperationBase {
  type: IOperationType['CreateElement'];
  tag: string;
}

export interface SetAttributeOperation extends ElementOperationBase {
  type: IOperationType['SetAttribute'];
  key: string;
  value: string;
}
export interface RemoveAttributeOperation extends ElementOperationBase {
  type: IOperationType['RemoveAttribute'];
  key: string;
}

export interface AppendOperation extends ElementOperationBase {
  type: IOperationType['Append'];
  /**
   * child uniqueId
   */
  cid: number[];
}

export interface RemoveOperation extends ElementOperationBase {
  type: IOperationType['Remove'];
}

export interface InsertBeforeOperation extends ElementOperationBase {
  type: IOperationType['InsertBefore'];
  /**
   * child uniqueId
   */
  cid: number;
  ref?: number | undefined;
}

export interface ReplaceOperation extends ElementOperationBase {
  type: IOperationType['ReplaceWith'];
  /**
   * the new element's unique id.
   */
  nid: number[];
}

export interface EnableEventOperation extends ElementOperationBase {
  type: IOperationType['EnableEvent'];
  eventType: string;
}

export interface RemoveChildOperation extends ElementOperationBase {
  type: IOperationType['RemoveChild'];
  /**
   * the child element's unique id to be removed.
   */
  cid: number;
}

export interface StyleDeclarationSetPropertyOperation
  extends ElementOperationBase
{
  type: IOperationType['StyleDeclarationSetProperty'];
  property: string;
  value: string;
  priority: string | undefined | '';
}

export interface StyleDeclarationRemovePropertyOperation
  extends ElementOperationBase
{
  type: IOperationType['StyleDeclarationRemoveProperty'];
  property: string;
}

export interface SetInnerHTMLOperation extends ElementOperationBase {
  type: IOperationType['SetInnerHTML'];
  text: string;
}

export type ElementOperation =
  | EnableEventOperation
  | ReplaceOperation
  | InsertBeforeOperation
  | CreateOperation
  | SetAttributeOperation
  | RemoveAttributeOperation
  | AppendOperation
  | RemoveOperation
  | RemoveChildOperation
  | StyleDeclarationSetPropertyOperation
  | StyleDeclarationRemovePropertyOperation
  | SetInnerHTMLOperation;
