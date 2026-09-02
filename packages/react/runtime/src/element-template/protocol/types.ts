// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RunWorkletCtxData } from '@lynx-js/react/worklet-runtime/bindings';

import { ElementTemplateUpdateOps } from './opcodes.js';
import { ELEMENT_TEMPLATE_PAGE_HANDLE_ID, ELEMENT_TEMPLATE_PAGE_TYPE } from './page.js';
import type { MainThreadRefInitValuePatch } from '../../core/main-thread-ref-init-value.js';

export type SerializableValue =
  | string
  | number
  | boolean
  | null
  | SerializableValue[]
  | { [key: string]: SerializableValue };

export type RuntimeOptionValue =
  | SerializableValue
  | FiberElement
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

export type RuntimeChildSlots = Array<ElementTemplateHandle[] | null | undefined>;

export type ElementTemplateHandleSlotsCommand = Array<number[] | null | undefined>;

export type SerializedEtNodeChildSlots = Array<SerializedEtNode[] | null | undefined>;

export interface ElementTemplateHandleRefCommandValue {
  __etHandleRef: number;
  [key: string]: SerializableValue;
}

export interface UpdateTypedListItemCommand extends ElementTemplateHandleRefCommandValue {
  type: string;
  platformInfo: Record<string, SerializableValue>;
}

export type RuntimeOptionsCommand = Record<string, SerializableValue>;

// Deferred typed-list create carries logical item records here. Its future
// main-thread consumer resolves these refs into the list-specific runtime carrier.
export interface TypedListOptionsCommand extends RuntimeOptionsCommand {
  listChildren: UpdateTypedListItemCommand[];
}

export interface RuntimeTypedListOptions {
  listChildren: ElementTemplateHandle[];
}

export type SerializedRuntimeOptions = Record<string, SerializableValue>;

export interface SerializedTypedListOptions {
  listChildren: SerializedEtNode[];
}

export interface SerializedEtNodeBase {
  attributeSlots?: SerializableValue[] | null;
  childSlots?: SerializedEtNodeChildSlots | null;
  uid: number;
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

export interface SerializedTypedListNode extends Omit<SerializedEtNodeBase, 'options'> {
  tag: 'list';
  attributes?: TypedElementAttributesCommand | null;
  options?: SerializedTypedListOptions | null;
}

export type SerializedEtNode = SerializedCompiledNode | SerializedTypedNode | SerializedTypedListNode;

export interface SerializedPageRoot extends SerializedTypedNode {
  tag: typeof ELEMENT_TEMPLATE_PAGE_TYPE;
  uid: typeof ELEMENT_TEMPLATE_PAGE_HANDLE_ID;
}

export interface ElementTemplateHydrateCommitContext {
  page: SerializedPageRoot;
  reloadVersion: number;
}

export type CreateTemplateCommand = [
  typeof ElementTemplateUpdateOps.createTemplate,
  handleId: number,
  templateKey: string,
  bundleUrl: string | null | undefined,
  attributeSlots: SerializableValue[] | null | undefined,
  childSlots: ElementTemplateHandleSlotsCommand | null | undefined,
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
  childSlotIndex: number,
  childHandleId: number,
  referenceHandleId: number,
];

export type RemoveNodeCommand = [
  typeof ElementTemplateUpdateOps.removeNode,
  targetHandleId: number,
  childSlotIndex: number,
  childHandleId: number,
  removedSubtreeHandleIds: number[],
];

export type CreateTypedElementCommand = [
  typeof ElementTemplateUpdateOps.createTypedElement,
  handleId: number,
  type: string,
  attributes: TypedElementAttributesCommand | null | undefined,
  childSlots: ElementTemplateHandleSlotsCommand | null | undefined,
  options: RuntimeOptionsCommand | TypedListOptionsCommand | null | undefined,
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
  emptyPatch?: boolean;
}

export interface ElementTemplateUpdateCommitContext {
  ops: ElementTemplateUpdateCommandStream;
  flushOptions: ElementTemplateFlushOptions;
  flowIds?: number[] | undefined;
  isHydration?: boolean | undefined;
  reloadVersion?: number | undefined;
  delayedRunOnMainThreadData?: RunWorkletCtxData[] | undefined;
  mainThreadRefInitValuePatch?: MainThreadRefInitValuePatch | undefined;
}
