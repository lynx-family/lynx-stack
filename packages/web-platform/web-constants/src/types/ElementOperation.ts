// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Cloneable } from './Cloneable.js';
import type { LynxEventType } from './EventType.js';
import type { PerformancePipelineOptions } from './Performance.js';
export interface FlushElementTreeOptions {
  pipelineOptions?: PerformancePipelineOptions;
}

export enum OperationType {
  Create,
  SetAttribute,
  SetProperty,
  SwapElement,
  Append,
  Remove,
  Replace,
  SetDatasetProperty,
  InsertBefore,
  SetStyleProperty,
  UpdateCssInJs,
  RegisterEventHandler,
}

interface ElementOperationBase {
  type: OperationType;
  /**
   * uniqueId
   */
  uid: number;
}

export interface CreateOperation extends ElementOperationBase {
  type: OperationType.Create;
  tag: string;
  cssId?: number;
}

export interface SetAttributeOperation extends ElementOperationBase {
  type: OperationType.SetAttribute;
  key: string;
  value: string | null;
}

export interface SetPropertyOperation extends ElementOperationBase {
  type: OperationType.SetProperty;
  /**
   * property name
   */
  key: string;
  value: Cloneable;
}

export interface SwapOperation extends ElementOperationBase {
  type: OperationType.SwapElement;
  /**
   * target uniqueId
   */
  tid: number;
}

export interface AppendOperation extends ElementOperationBase {
  type: OperationType.Append;
  /**
   * child uniqueId
   */
  cid: number[];
}

export interface RemoveOperation extends ElementOperationBase {
  type: OperationType.Remove;
  cid: number[];
}

export interface SetDatasetPropertyOperation extends ElementOperationBase {
  type: OperationType.SetDatasetProperty;
  /**
   * propert name in dataset
   */
  key: string;
  value: Cloneable;
}

export interface InsertBeforeOperation extends ElementOperationBase {
  type: OperationType.InsertBefore;
  /**
   * child uniqueId
   */
  cid: number;
  ref?: number;
}

export interface ReplaceOperation extends ElementOperationBase {
  type: OperationType.Replace;
  /**
   * the new element's unique id.
   */
  nid: number[];
}

export interface UpdateCssInJsOperation extends ElementOperationBase {
  type: OperationType.UpdateCssInJs;
  classStyleStr: string;
}

export interface SetStylePropertyOperation extends ElementOperationBase {
  type: OperationType.SetStyleProperty;
  key: string;
  value: string | null;
  /**
   * important
   */
  im?: boolean;
}

export interface RegisterEventHandlerOperation extends ElementOperationBase {
  type: OperationType.RegisterEventHandler;
  eventType: LynxEventType;
  /**
   * lynx event name
   */
  ename: string;
  /**
   * If it's a background thread hander, it will have a handler name.
   * If it's a main-thread handler, it will be null
   * If it's going to be removed, it will be undefined
   */
  hname: string | undefined | null;
}

export type ElementOperation =
  | RegisterEventHandlerOperation
  | SetStylePropertyOperation
  | UpdateCssInJsOperation
  | ReplaceOperation
  | InsertBeforeOperation
  | SetDatasetPropertyOperation
  | CreateOperation
  | SetAttributeOperation
  | SetPropertyOperation
  | SwapOperation
  | AppendOperation
  | RemoveOperation;
