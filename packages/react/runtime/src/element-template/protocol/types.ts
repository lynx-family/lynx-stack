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

export interface ElementTemplateHandleRefCommandValue {
  __etHandleRef: number;
  [key: string]: SerializableValue;
}

// Phase 1 keeps handle refs list-specific: only `listChildren` is resolved to
// ElementRef[] by MTS before native create. Generic nested refs are deferred.
export interface RuntimeOptionsCommand extends Record<string, SerializableValue> {
  listChildren?: ElementTemplateHandleRefCommandValue[];
}

export type SerializedRuntimeOptionValue =
  | SerializableValue
  | SerializedEtNode
  | SerializedRuntimeOptionValue[]
  | { [key: string]: SerializedRuntimeOptionValue };

export type SerializedRuntimeOptions = Record<string, SerializedRuntimeOptionValue>;

export interface SerializedEtNodeBase {
  attributeSlots?: SerializableValue[] | null;
  elementSlots?: SerializedEtNode[][] | null;
  uid: number | string;
  options?: SerializedRuntimeOptions | null;
}

export interface SerializedCompiledNode extends SerializedEtNodeBase {
  templateKey: string;
  bundleUrl?: string;
}

export interface SerializedTypedNode extends SerializedEtNodeBase {
  type: string;
}

export type SerializedEtNode = SerializedCompiledNode | SerializedTypedNode;

// Current hydrate/update code is still compiled-node only. Keep this recursive
// shape narrow while the RFC-level SerializedEtNode already models typed nodes.
export interface SerializedElementTemplate {
  templateKey: string;
  bundleUrl?: string;
  attributeSlots?: SerializableValue[] | null;
  elementSlots?: SerializedElementTemplate[][] | null;
  uid: number | string;
  options?: SerializedRuntimeOptions | null;
}

export type CreateTemplateCommand = [
  typeof ElementTemplateUpdateOps.createTemplate,
  handleId: number,
  templateKey: string,
  bundleUrl: string | null | undefined,
  attributeSlots: SerializableValue[] | null | undefined,
  elementSlots: number[][] | null | undefined,
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
  elementSlots: number[][] | null | undefined,
  options: RuntimeOptionsCommand | null | undefined,
];

export type ElementTemplateUpdateCommand =
  | CreateTemplateCommand
  | SetAttributeCommand
  | InsertNodeCommand
  | RemoveNodeCommand
  | CreateTypedElementCommand;

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
}
