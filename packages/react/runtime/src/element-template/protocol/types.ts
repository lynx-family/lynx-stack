// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { ElementTemplateUpdateOps } from './opcodes.js';

export type SerializableValue =
  | string
  | number
  | boolean
  | null
  | SerializableValue[]
  | { [key: string]: SerializableValue };

export type RuntimeOptionValue =
  | SerializableValue
  | ElementRef
  | RuntimeOptionValue[]
  | { [key: string]: RuntimeOptionValue };

export type RuntimeOptions = Record<string, RuntimeOptionValue>;

export type RuntimeAttributeSlotValue =
  | SerializableValue
  | ((...args: unknown[]) => unknown)
  | RuntimeAttributeSlotValue[]
  | { [key: string]: RuntimeAttributeSlotValue };

export type RuntimeTypedElementAttributes = Record<string, RuntimeAttributeSlotValue>;

export type TypedElementAttributesCommand = Record<string, SerializableValue>;

export type RuntimeElementSlots = Array<ElementRef[] | null | undefined>;

export type ElementTemplateHandleSlotsCommand = Array<number[] | null | undefined>;

export type SerializedEtNodeSlots = Array<SerializedEtNode[] | null | undefined>;

export interface ElementTemplateHandleRefCommandValue {
  __etHandleRef: number;
  [key: string]: SerializableValue;
}

export interface UpdateTypedListItemCommand extends ElementTemplateHandleRefCommandValue {
  type: string;
  platformInfo: Record<string, SerializableValue>;
}

// Typed list create carries logical item records here, and MTS resolves their
// handle refs before native create.
export interface RuntimeOptionsCommand extends Record<string, SerializableValue> {
  listChildren?: UpdateTypedListItemCommand[];
}

export type SerializedRuntimeOptionValue =
  | SerializableValue
  | SerializedEtNode
  | SerializedRuntimeOptionValue[]
  | { [key: string]: SerializedRuntimeOptionValue };

export type SerializedRuntimeOptions = Record<string, SerializedRuntimeOptionValue>;

export interface SerializedEtNodeBase {
  attributeSlots?: SerializableValue[] | null;
  elementSlots?: SerializedEtNodeSlots | null;
  uid: number | string;
  options?: SerializedRuntimeOptions | null;
}

export interface SerializedCompiledNode extends SerializedEtNodeBase {
  templateKey: string;
  bundleUrl?: string;
  attributeSlots?: SerializableValue[] | null;
}

export interface SerializedTypedNode extends SerializedEtNodeBase {
  // Native __SerializeElementTemplate returns typed hosts as { tag, attributes }.
  tag: string;
  attributes?: TypedElementAttributesCommand | null;
}

export type SerializedEtNode = SerializedCompiledNode | SerializedTypedNode;

export interface ElementTemplateHydrateCommitContext {
  instances: SerializedEtNode[];
  reloadVersion?: number;
}

// Legacy compiled-node alias kept for fixture helpers. Its child slots can now
// contain typed nodes because hydrate dispatch accepts the RFC-level union.
export interface SerializedElementTemplate extends SerializedCompiledNode {}

export type CreateTemplateCommand = [
  typeof ElementTemplateUpdateOps.createTemplate,
  handleId: number,
  templateKey: string,
  bundleUrl: string | null | undefined,
  attributeSlots: SerializableValue[] | null | undefined,
  elementSlots: ElementTemplateHandleSlotsCommand | null | undefined,
];

export type SetAttributeCommand = [
  typeof ElementTemplateUpdateOps.setAttribute,
  targetHandleId: number,
  attrSlotIndex: number,
  value: SerializableValue | null,
];

export type InsertNodeCommand = [
  typeof ElementTemplateUpdateOps.insertNode,
  targetHandleId: number,
  elementSlotIndex: number,
  childHandleId: number,
  referenceHandleId: number,
];

export type RemoveNodeCommand = [
  typeof ElementTemplateUpdateOps.removeNode,
  targetHandleId: number,
  elementSlotIndex: number,
  childHandleId: number,
  removedSubtreeHandleIds: number[],
];

export type CreateTypedElementCommand = [
  typeof ElementTemplateUpdateOps.createTypedElement,
  handleId: number,
  type: string,
  attributes: TypedElementAttributesCommand | null | undefined,
  elementSlots: ElementTemplateHandleSlotsCommand | null | undefined,
  options: RuntimeOptionsCommand | null | undefined,
];

export type InsertTypedListItemCommand = [
  typeof ElementTemplateUpdateOps.insertTypedListItem,
  listHandleId: number,
  item: UpdateTypedListItemCommand,
  beforeHandleId: number,
];

export type RemoveTypedListItemCommand = [
  typeof ElementTemplateUpdateOps.removeTypedListItem,
  listHandleId: number,
  itemHandleId: number,
  removedSubtreeHandleIds: number[],
];

export type UpdateTypedListItemInfoCommand = [
  typeof ElementTemplateUpdateOps.updateTypedListItem,
  listHandleId: number,
  item: UpdateTypedListItemCommand,
];

export type ElementTemplateUpdateCommand =
  | CreateTemplateCommand
  | SetAttributeCommand
  | InsertNodeCommand
  | RemoveNodeCommand
  | CreateTypedElementCommand
  | InsertTypedListItemCommand
  | RemoveTypedListItemCommand
  | UpdateTypedListItemInfoCommand;

// Commands are transported as a flat stream to match the native update payload.
// Tuple aliases above define each opcode's shape; this item union preserves the
// existing flat buffer ergonomics while making command contracts explicit.
export type ElementTemplateUpdateCommandStream = ElementTemplateUpdateCommand[number][];

export interface ElementTemplateFlushOptions {
  // triggerLayout?: boolean;
  // operationID?: any;
  // __lynx_timing_flag?: string;
  // nativeUpdateDataOrder?: number;
  // elementID?: number;
  // listID?: number;
  // listReuseNotification?: {
  //   listElement: FiberElement;
  //   itemKey: string;
  // };
  pipelineOptions?: PipelineOptions;
  // elementIDs?: number[];
  // operationIDs?: any[];
  // asyncFlush?: boolean;
  triggerDataUpdated?: boolean;
}

export interface ElementTemplateUpdateCommitContext {
  ops: ElementTemplateUpdateCommandStream;
  flushOptions: ElementTemplateFlushOptions;
  flowIds?: number[];
  reloadVersion?: number;
}
