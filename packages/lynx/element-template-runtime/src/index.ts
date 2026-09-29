// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export {
  ELEMENT_TEMPLATE_COMMIT_EVENT,
  ElementTemplateCommandReceiver,
  RemoteElementTemplateApi,
  createRemoteElementTemplateRuntime,
} from './bridge.js';
export type {
  BackgroundElementTemplateChannel,
  ElementTemplateBridgeCommand,
  ElementTemplateBridgeCommit,
  ElementTemplateBridgeProtocol,
  MainElementTemplateChannel,
  RemoteElementTemplateRuntime,
} from './bridge.js';
export { createElementTemplateHost, isElementTemplateHost } from './host.js';
export type {
  CreateElementTemplateHostOptions,
  ElementTemplateHost,
} from './host.js';
export {
  BUILTIN_RAW_TEXT_TEMPLATE_KEY,
  ELEMENT_TEMPLATE_EVENT_ATTRIBUTE_NAMES,
  ELEMENT_TEMPLATE_PROTOCOL_VERSION,
  ELEMENT_TEMPLATE_SPREAD_ATTRIBUTE_SLOT_INDEX,
  ElementTemplateUpdateOps,
  MAIN_BUNDLE_URL_SENTINEL,
  elementTemplateIdentityKey,
  elementTemplateTypeTag,
  getElementTemplateEventAttributeSlotIndex,
  isLynxEventAttributeName,
  parseElementTemplateType,
} from './protocol.js';
export type {
  ElementTemplateSerializableValue,
  ElementTemplateUpdateOp,
  ParsedElementTemplateType,
} from './protocol.js';
export { ElementTemplateRuntime } from './runtime.js';
export type {
  CreateElementTemplateRequest,
  ElementTemplateChildSlots,
  ElementTemplateDescriptor,
  ElementTemplateHandle,
  InsertElementTemplateNodeRequest,
  NativeElementTemplateApi,
  RemoveElementTemplateNodeRequest,
} from './runtime.js';
