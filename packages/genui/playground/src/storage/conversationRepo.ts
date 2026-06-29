// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { getDB } from './db.js';
import type { SharedConversationDoc } from './sharedConversation.js';
import type {
  ConversationMeta,
  ConversationProtocol,
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

function activeConversationMetaKey(protocol: ConversationProtocol): string {
  return `activeConversationId:${protocol}`;
}

export function resolveConversationProtocol(
  conversation: Pick<ConversationMeta, 'protocol'>,
): ConversationProtocol {
  return conversation.protocol ?? 'a2ui';
}

export function createConversationMeta(
  title = 'New conversation',
  protocol: ConversationProtocol = 'a2ui',
): ConversationMeta {
  const now = Date.now();
  return {
    id: createId(),
    protocol,
    title,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    previewText: '',
  };
}

export async function listConversations(
  protocol: ConversationProtocol = 'a2ui',
): Promise<ConversationMeta[]> {
  const db = await getDB();
  const tx = db.transaction('conversations', 'readonly');
  const items = await tx.store.index('by_updatedAt').getAll();
  return items
    .filter((item) => resolveConversationProtocol(item) === protocol)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getActiveConversationId(
  protocol: ConversationProtocol = 'a2ui',
): Promise<string | null> {
  const db = await getDB();
  const record = await db.get('meta', activeConversationMetaKey(protocol));
  if (record) return record.value;
  if (protocol !== 'a2ui') return null;
  const legacyRecord = await db.get('meta', 'activeConversationId');
  return legacyRecord?.value ?? null;
}

export async function setActiveConversationId(
  id: string | null,
  protocol: ConversationProtocol = 'a2ui',
): Promise<void> {
  const db = await getDB();
  const key = activeConversationMetaKey(protocol);
  if (id === null) {
    await db.delete('meta', key);
    if (protocol === 'a2ui') {
      await db.delete('meta', 'activeConversationId');
    }
    return;
  }
  const record: MetaRecord = {
    key,
    value: id,
  };
  await db.put('meta', record);
  if (protocol === 'a2ui') {
    await db.put('meta', {
      key: 'activeConversationId',
      value: id,
    });
  }
}

export async function createConversation(
  title?: string,
  protocol: ConversationProtocol = 'a2ui',
): Promise<ConversationMeta> {
  const db = await getDB();
  const meta = createConversationMeta(title, protocol);
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
    key: activeConversationMetaKey(protocol),
    value: meta.id,
  });
  if (protocol === 'a2ui') {
    await tx.objectStore('meta').put({
      key: 'activeConversationId',
      value: meta.id,
    });
  }
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

/**
 * Persist the durable URL of the published share document on the conversation
 * snapshot, paired with the `meta.updatedAt` it was generated for. Touches only
 * the snapshot's share field (not `meta.updatedAt`), so it does not invalidate
 * itself; a later turn rewrites the snapshot and drops it.
 */
export async function saveConversationSharePayload(
  conversationId: string,
  url: string,
  updatedAt: number,
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('snapshots', 'readwrite');
  const store = tx.objectStore('snapshots');
  const snapshot = await store.get(conversationId);
  if (snapshot) {
    await store.put({ ...snapshot, sharePayload: { url, updatedAt } });
  }
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
  protocol: ConversationProtocol = 'a2ui',
): Promise<ConversationMeta> {
  const now = Date.now();
  const meta: ConversationMeta = {
    ...createConversationMeta(doc.title || 'Shared conversation', protocol),
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

export async function deleteConversation(
  id: string,
  protocol: ConversationProtocol = 'a2ui',
): Promise<void> {
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
  const activeKey = activeConversationMetaKey(protocol);
  const active = await tx.objectStore('meta').get(activeKey);
  if (active?.value === id) {
    await tx.objectStore('meta').delete(activeKey);
  }
  if (protocol === 'a2ui') {
    const legacyActive = await tx.objectStore('meta').get(
      'activeConversationId',
    );
    if (legacyActive?.value === id) {
      await tx.objectStore('meta').delete('activeConversationId');
    }
  }
  await tx.done;
}
