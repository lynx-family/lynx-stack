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

export type RuntimeOptions = Record<string, SerializableValue>;

export interface SerializedElementTemplate {
  templateKey: string;
  bundleUrl?: string;
  attributeSlots: SerializableValue[];
  elementSlots: SerializedElementTemplate[][];
  uid: number | string;
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

export type ElementTemplateUpdateCommand =
  | CreateTemplateCommand
  | SetAttributeCommand
  | InsertNodeCommand
  | RemoveNodeCommand;

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
  // triggerDataUpdated?: boolean;
}

export interface ElementTemplateUpdateCommitContext {
  ops: ElementTemplateUpdateCommandStream;
  flushOptions: ElementTemplateFlushOptions;
  flowIds?: number[];
}
