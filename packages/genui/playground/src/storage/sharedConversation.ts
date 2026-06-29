// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ConversationRecord } from './conversationRepo.js';
import type {
  ConversationProtocol,
  PreviewPayloadUrls,
  PreviewPerformanceMetrics,
} from './types.js';

export const SHARED_CONVERSATION_KIND = 'a2ui-conversation';

/**
 * A single turn in a shared conversation. Structurally a `ModelChatMessage`,
 * redeclared here so the storage layer does not import from `hooks/`.
 */
export interface SharedConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  previewPayloadUrls?: PreviewPayloadUrls;
  previewMetrics?: PreviewPerformanceMetrics;
}

export interface SharedConversationSnapshot {
  dataModel: Record<string, unknown>;
  surfaceIds: string[];
  previewPayloadUrls?: PreviewPayloadUrls;
}

/**
 * Self-contained, versioned snapshot of an entire conversation. Uploaded to
 * durable storage so a share link can rehydrate the conversation (transcript +
 * data model) into the recipient's playground. Deliberately omits
 * `snapshot.previewMessages`: it is a client-side render cache that is rebuilt
 * from the assistant message history on import, and dropping it keeps the
 * uploaded document well under the server's body-size limit.
 */
export interface SharedConversationDoc {
  v: 1;
  kind: typeof SHARED_CONVERSATION_KIND;
  protocol?: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: SharedConversationMessage[];
  snapshot: SharedConversationSnapshot | null;
}

export function serializeConversation(
  record: ConversationRecord,
  protocol?: string,
): SharedConversationDoc {
  const messages: SharedConversationMessage[] = record.messages.map(
    (message) => {
      const next: SharedConversationMessage = {
        role: message.role,
        content: message.content,
      };
      if (message.previewPayloadUrls) {
        next.previewPayloadUrls = message.previewPayloadUrls;
      }
      if (message.previewMetrics) {
        next.previewMetrics = message.previewMetrics;
      }
      return next;
    },
  );

  let snapshot: SharedConversationSnapshot | null = null;
  if (record.snapshot) {
    snapshot = {
      dataModel: record.snapshot.dataModel ?? {},
      surfaceIds: record.snapshot.surfaceIds ?? [],
    };
    if (record.snapshot.previewPayloadUrls) {
      snapshot.previewPayloadUrls = record.snapshot.previewPayloadUrls;
    }
  }

  return {
    v: 1,
    kind: SHARED_CONVERSATION_KIND,
    protocol,
    title: record.meta.title,
    createdAt: record.meta.createdAt,
    updatedAt: record.meta.updatedAt,
    messages,
    snapshot,
  };
}

function isSharedConversationMessage(
  value: unknown,
): value is SharedConversationMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<SharedConversationMessage>;
  return (
    (message.role === 'user'
      || message.role === 'assistant'
      || message.role === 'system')
    && typeof message.content === 'string'
  );
}

export function isSharedConversationDoc(
  value: unknown,
): value is SharedConversationDoc {
  if (!value || typeof value !== 'object') return false;
  const doc = value as Partial<SharedConversationDoc>;
  return (
    doc.kind === SHARED_CONVERSATION_KIND
    && doc.v === 1
    && Array.isArray(doc.messages)
    && doc.messages.every((message) => isSharedConversationMessage(message))
  );
}

export function resolveSharedConversationProtocol(
  doc: Pick<SharedConversationDoc, 'protocol'>,
): ConversationProtocol | null {
  if (doc.protocol === undefined) return 'a2ui';
  if (doc.protocol === 'a2ui' || doc.protocol === 'openui') {
    return doc.protocol;
  }
  return null;
}
