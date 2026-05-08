// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export { createMessageStore } from './MessageStore.js';
export type { MessageStore, MessageStoreOptions } from './MessageStore.js';
export {
  createFallbackMessagesFromPlainText,
  createTextCardMessages,
  normalizePayloadToMessages,
  prepareMessagesForProcessing,
} from './payloadNormalizer.js';
export type { ServerToClientMessage } from './types.js';
