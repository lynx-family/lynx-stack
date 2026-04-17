// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type SerializableValue =
  | string
  | number
  | boolean
  | null
  | SerializableValue[]
  | { [key: string]: SerializableValue };

export type RuntimeOptions = Record<string, SerializableValue>;

export interface SerializedElementNodeInstance {
  kind: 'element';
  tag: string;
  attributes?: Record<string, SerializableValue>;
  children?: SerializedElementNode[];
}

export interface SerializedTemplateInstance {
  kind: 'templateInstance';
  templateKey: string;
  bundleUrl?: string;
  attributeSlots: SerializableValue[];
  elementSlots: SerializedTemplateInstance[][];
  options?: RuntimeOptions;
}

export type SerializedElementNode =
  | SerializedElementNodeInstance
  | SerializedTemplateInstance;

export interface SerializedElementTemplate {
  templateKey: string;
  bundleUrl?: string;
  attributeSlots: SerializableValue[];
  elementSlots: SerializedTemplateInstance[][];
  options?: RuntimeOptions;
}

// Stage 7 target protocol: flat command stream over create/setAttribute/insert/remove.
// The stream intentionally stays opaque at this layer until runtime producer/consumer land.
export type ElementTemplateUpdateCommandStream = (
  number | string | null | SerializableValue | SerializableValue[] | unknown[]
)[];

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
