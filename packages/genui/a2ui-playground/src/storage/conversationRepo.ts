// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { getDB } from './db.js';
import type { SharedConversationDoc } from './sharedConversation.js';
import type {
  ConversationMeta,
  DataModelSnapshot,
  MetaRecord,
  PersistedMessage,
} from './types.js';

export interface ConversationRecord {
  meta: ConversationMeta;
  messages: PersistedMessage[];
  snapshot: DataModelSnapshot | null;
}

function createId(): string {
  return `conv-${Date.now().toString(36)}-${
    Math.random().toString(36).slice(2)
  }`;
}

export function createConversationMeta(
  title = 'New conversation',
): ConversationMeta {
  const now = Date.now();
  return {
    id: createId(),
    title,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    previewText: '',
  };
}

export async function listConversations(): Promise<ConversationMeta[]> {
  const db = await getDB();
  const tx = db.transaction('conversations', 'readonly');
  const items = await tx.store.index('by_updatedAt').getAll();
  return items.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getActiveConversationId(): Promise<string | null> {
  const db = await getDB();
  const record = await db.get('meta', 'activeConversationId');
  return record?.value ?? null;
}

export async function setActiveConversationId(
  id: string | null,
): Promise<void> {
  const db = await getDB();
  if (id === null) {
    await db.delete('meta', 'activeConversationId');
    return;
  }
  const record: MetaRecord = {
    key: 'activeConversationId',
    value: id,
  };
  await db.put('meta', record);
}

export async function createConversation(
  title?: string,
): Promise<ConversationMeta> {
  const db = await getDB();
  const meta = createConversationMeta(title);
  const tx = db.transaction(
    ['conversations', 'snapshots', 'meta'],
    'readwrite',
  );
  await tx.objectStore('conversations').put(meta);
  await tx.objectStore('snapshots').put({
    conversationId: meta.id,
    dataModel: {},
    surfaceIds: [],
    previewMessages: [],
    updatedAt: meta.updatedAt,
  });
  await tx.objectStore('meta').put({
    key: 'activeConversationId',
    value: meta.id,
  });
  await tx.done;
  return meta;
}

export async function loadConversation(
  id: string,
): Promise<ConversationRecord | null> {
  const db = await getDB();
  const tx = db.transaction(['conversations', 'messages', 'snapshots']);
  const [meta, messages, snapshot] = await Promise.all([
    tx.objectStore('conversations').get(id),
    tx.objectStore('messages').index('by_conversation').getAll(id),
    tx.objectStore('snapshots').get(id),
  ]);
  await tx.done;
  if (!meta) return null;
  messages.sort((a, b) => a.seq - b.seq);
  return {
    meta,
    messages,
    snapshot: snapshot ?? null,
  };
}

export async function saveConversationMessages(
  meta: ConversationMeta,
  messages: PersistedMessage[],
  snapshot: DataModelSnapshot,
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['conversations', 'messages', 'snapshots'],
    'readwrite',
  );
  await tx.objectStore('conversations').put(meta);
  const messageStore = tx.objectStore('messages');
  const messageIndex = messageStore.index('by_conversation');
  for (const key of await messageIndex.getAllKeys(meta.id)) {
    await messageStore.delete(key);
  }
  for (const message of messages) {
    await messageStore.put(message);
  }
  await tx.objectStore('snapshots').put(snapshot);
  await tx.done;
}

export function previewTextFromSharedMessages(
  messages: SharedConversationDoc['messages'],
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message?.role === 'user') {
      const compact = message.content.replace(/\s+/gu, ' ').trim();
      return compact.length > 80 ? `${compact.slice(0, 80)}...` : compact;
    }
  }
  return '';
}

/**
 * Write a shared conversation document into a brand-new local conversation
 * (fresh id, re-sequenced messages) and return its meta. The snapshot's
 * `previewMessages` is left empty on purpose — the chat page rebuilds the
 * preview from the assistant message history when the conversation activates.
 */
export async function importConversation(
  doc: SharedConversationDoc,
): Promise<ConversationMeta> {
  const now = Date.now();
  const meta: ConversationMeta = {
    ...createConversationMeta(doc.title || 'Shared conversation'),
    messageCount: doc.messages.length,
    previewText: previewTextFromSharedMessages(doc.messages),
  };
  const messages: PersistedMessage[] = doc.messages.map((message, index) => ({
    conversationId: meta.id,
    seq: index,
    role: message.role,
    content: message.content,
    previewPayloadUrls: message.previewPayloadUrls,
    previewMetrics: message.previewMetrics,
    createdAt: now + index,
  }));
  const snapshot: DataModelSnapshot = {
    conversationId: meta.id,
    dataModel: doc.snapshot?.dataModel ?? {},
    surfaceIds: doc.snapshot?.surfaceIds ?? [],
    previewMessages: [],
    previewPayloadUrls: doc.snapshot?.previewPayloadUrls,
    updatedAt: now,
  };
  await saveConversationMessages(meta, messages, snapshot);
  return meta;
}

export async function renameConversation(
  id: string,
  title: string,
): Promise<ConversationMeta | null> {
  const db = await getDB();
  const meta = await db.get('conversations', id);
  if (!meta) return null;
  const next = {
    ...meta,
    title,
    updatedAt: Date.now(),
  };
  await db.put('conversations', next);
  return next;
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(
    ['conversations', 'messages', 'snapshots', 'meta'],
    'readwrite',
  );
  await tx.objectStore('conversations').delete(id);
  await tx.objectStore('snapshots').delete(id);
  const messageStore = tx.objectStore('messages');
  const messageIndex = messageStore.index('by_conversation');
  for (const key of await messageIndex.getAllKeys(id)) {
    await messageStore.delete(key);
  }
  const active = await tx.objectStore('meta').get('activeConversationId');
  if (active?.value === id) {
    await tx.objectStore('meta').delete('activeConversationId');
  }
  await tx.done;
}
