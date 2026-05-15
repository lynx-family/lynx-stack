// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export { createMessageStore } from './MessageStore.js';
export type { MessageStore, MessageStoreOptions } from './MessageStore.js';
export { MessageProcessor } from './MessageProcessor.js';
export type { A2UIEvent } from './MessageProcessor.js';
export { createResource } from './Resource.js';
export type { Resource as RawResource, ResourceStatus } from './Resource.js';
export { SignalStore } from './SignalStore.js';
export {
  createFallbackMessagesFromPlainText,
  createTextCardMessages,
  normalizePayloadToMessages,
  prepareMessagesForProcessing,
} from './payloadNormalizer.js';
export type {
  A2UIClientEventMessage,
  ComponentInstance,
  GenericComponentProps,
  Resource,
  ResourceInfo,
  ServerToClientMessage,
  Surface,
  SurfaceId,
  UserActionPayload,
} from './types.js';
export { FunctionRegistry, functionRegistry } from './FunctionRegistry.js';
export type { FunctionEntry, FunctionImpl } from './FunctionRegistry.js';
export type { FunctionCallContext } from './FunctionRegistry.js';
// `createFormController` + `FormController` are intentionally not exported.
// `useChecks` uses them internally to keep the door open for a follow-up
// `<Form>` component, but they aren't public API until that consumer
// lands and validates the shape.
export {
  executeFunctionCall,
  isDataBinding,
  isFunctionCall,
  resolveDynamicValue,
  resolveFunctionArguments,
} from './resolveFunctionCall.js';
export type { ResolveFunctionOptions } from './resolveFunctionCall.js';
