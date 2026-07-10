// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createConversation,
  createConversationMeta,
  deleteConversation,
  getActiveConversationId,
  importConversation,
  listConversations,
  loadConversation,
  previewTextFromSharedMessages,
  renameConversation,
  saveConversationMessages,
  setActiveConversationId,
} from '../storage/conversationRepo.js';
import type { SharedConversationDoc } from '../storage/sharedConversation.js';
import type {
  ConversationMeta,
  ConversationProtocol,
  DataModelSnapshot,
  PersistedMessage,
  PreviewPayloadUrls,
  PreviewPerformanceMetrics,
} from '../storage/types.js';

export interface ModelChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  previewPayloadUrls?: PreviewPayloadUrls;
  previewMetrics?: PreviewPerformanceMetrics;
}

export interface ConversationContext {
  history: ModelChatMessage[];
  dataModel: Record<string, unknown>;
}

interface ConversationHotState {
  messages: ModelChatMessage[];
  dataModel: Record<string, unknown>;
  surfaceIds: Set<string>;
  previewMessages: unknown[];
  previewPayloadUrls: PreviewPayloadUrls | null;
}

export interface RecordTurnInput {
  userMessage: ModelChatMessage;
  assistantContent: string;
  a2uiMessages: unknown[];
  previewMessages?: unknown[];
  previewPayloadUrls?: PreviewPayloadUrls | null;
  snapshotPreviewPayloadUrls?: PreviewPayloadUrls | null;
  previewMetrics?: PreviewPerformanceMetrics | null;
}

export interface UseConversationReturn {
  conversations: ConversationMeta[];
  activeId: string | null;
  messages: ModelChatMessage[];
  dataModel: Record<string, unknown>;
  surfaceIds: ReadonlySet<string>;
  previewMessages: unknown[];
  previewPayloadUrls: PreviewPayloadUrls | null;
  isReady: boolean;
  isPersistent: boolean;
  switchTo: (id: string) => Promise<void>;
  createNew: () => Promise<string>;
  importShared: (doc: SharedConversationDoc) => Promise<string>;
  remove: (id: string) => Promise<void>;
  rename: (id: string, title: string) => Promise<void>;
  recordTurn: (input: RecordTurnInput) => Promise<void>;
  updateLastAssistantPreviewMetrics: (
    metrics: PreviewPerformanceMetrics,
  ) => Promise<void>;
  buildConversationContext: () => ConversationContext;
}

const MAX_CONVERSATION_TURNS = 20;
const MAX_CONVERSATION_CHARS = 16_000;

function cloneDataModel(
  value: Record<string, unknown>,
): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function cloneDataValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return value;
  }
}

function clonePreviewPerformanceMetrics(
  value: PreviewPerformanceMetrics | null | undefined,
): PreviewPerformanceMetrics | undefined {
  if (!value) return undefined;
  const next: PreviewPerformanceMetrics = {};
  if (typeof value.fcpMs === 'number') next.fcpMs = value.fcpMs;
  if (typeof value.fmpMs === 'number') next.fmpMs = value.fmpMs;
  if (typeof value.ttiMs === 'number') next.ttiMs = value.ttiMs;
  if (typeof value.agentOutputMs === 'number') {
    next.agentOutputMs = value.agentOutputMs;
  }
  if (typeof value.renderMs === 'number') next.renderMs = value.renderMs;
  if (typeof value.cachedTokens === 'number') {
    next.cachedTokens = value.cachedTokens;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function truncateConversationHistory(
  history: ModelChatMessage[],
): ModelChatMessage[] {
  const byTurns = history.slice(-MAX_CONVERSATION_TURNS * 2);
  let totalChars = 0;
  const kept: ModelChatMessage[] = [];

  for (let i = byTurns.length - 1; i >= 0; i--) {
    const message = byTurns[i];
    if (!message) continue;
    totalChars += message.content.length;
    if (totalChars > MAX_CONVERSATION_CHARS) break;
    kept.unshift(message);
  }

  return kept;
}

function applyDataModel(
  model: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  if (!path || path === '/' || path === '') {
    for (const key of Object.keys(model)) {
      delete model[key];
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(model, cloneDataValue(value) as Record<string, unknown>);
    }
    return;
  }

  const parts = path.replace(/^\//u, '').split('/').filter(Boolean);
  let cursor = model;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!key) continue;
    if (typeof cursor[key] !== 'object' || cursor[key] === null) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }

  const last = parts[parts.length - 1];
  if (!last) return;
  if (value === undefined) {
    delete cursor[last];
  } else {
    cursor[last] = cloneDataValue(value);
  }
}

function applyA2UIMessagesToSnapshot(
  dataModel: Record<string, unknown>,
  surfaceIds: Set<string>,
  messages: unknown[],
): void {
  for (const message of messages) {
    if (!message || typeof message !== 'object') continue;
    const record = message as {
      createSurface?: { surfaceId?: unknown };
      deleteSurface?: { surfaceId?: unknown };
      updateDataModel?: { path?: unknown; value?: unknown };
    };
    if (
      record.createSurface
      && typeof record.createSurface.surfaceId === 'string'
    ) {
      surfaceIds.add(record.createSurface.surfaceId);
      continue;
    }
    if (
      record.deleteSurface
      && typeof record.deleteSurface.surfaceId === 'string'
    ) {
      surfaceIds.delete(record.deleteSurface.surfaceId);
      continue;
    }
    if (record.updateDataModel) {
      applyDataModel(
        dataModel,
        typeof record.updateDataModel.path === 'string'
          ? record.updateDataModel.path
          : '/',
        record.updateDataModel.value,
      );
    }
  }
}

function titleFromMessage(content: string): string {
  const compact = content.replace(/\s+/gu, ' ').trim();
  if (!compact) return 'New conversation';
  return compact.length > 30 ? `${compact.slice(0, 30)}...` : compact;
}

function previewFromMessage(content: string): string {
  const compact = content.replace(/\s+/gu, ' ').trim();
  return compact.length > 80 ? `${compact.slice(0, 80)}...` : compact;
}

function toPersistedMessages(
  conversationId: string,
  messages: ModelChatMessage[],
): PersistedMessage[] {
  const now = Date.now();
  return messages.map((message, index) => ({
    conversationId,
    seq: index,
    role: message.role,
    content: message.content,
    previewPayloadUrls: message.previewPayloadUrls,
    previewMetrics: clonePreviewPerformanceMetrics(message.previewMetrics),
    createdAt: now + index,
  }));
}

function fromPersistedMessages(
  messages: PersistedMessage[],
): ModelChatMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
    previewPayloadUrls: message.previewPayloadUrls,
    previewMetrics: clonePreviewPerformanceMetrics(message.previewMetrics),
  }));
}

function createEmptyHotState(): ConversationHotState {
  return {
    messages: [],
    dataModel: {},
    surfaceIds: new Set(),
    previewMessages: [],
    previewPayloadUrls: null,
  };
}

function cloneHotState(state: ConversationHotState): ConversationHotState {
  return {
    messages: state.messages.slice(),
    dataModel: cloneDataModel(state.dataModel),
    surfaceIds: new Set(state.surfaceIds),
    previewMessages: state.previewMessages.slice(),
    previewPayloadUrls: state.previewPayloadUrls
      ? { ...state.previewPayloadUrls }
      : null,
  };
}

export function useConversation(
  protocol: ConversationProtocol = 'a2ui',
): UseConversationReturn {
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ModelChatMessage[]>([]);
  const [dataModel, setDataModel] = useState<Record<string, unknown>>({});
  const [surfaceIds, setSurfaceIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [previewMessages, setPreviewMessages] = useState<unknown[]>([]);
  const [previewPayloadUrls, setPreviewPayloadUrls] = useState<
    PreviewPayloadUrls | null
  >(null);
  const [isReady, setIsReady] = useState(false);
  const [isPersistent, setIsPersistent] = useState(true);

  const messagesRef = useRef<ModelChatMessage[]>([]);
  const dataModelRef = useRef<Record<string, unknown>>({});
  const surfaceIdsRef = useRef<Set<string>>(new Set());
  const previewMessagesRef = useRef<unknown[]>([]);
  const previewPayloadUrlsRef = useRef<PreviewPayloadUrls | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const conversationsRef = useRef<ConversationMeta[]>([]);
  const activationTokenRef = useRef<symbol | null>(null);
  const conversationHotStateMapRef = useRef<Map<string, ConversationHotState>>(
    new Map(),
  );
  const persistentRef = useRef(true);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const syncHotState = useCallback(
    (
      nextMessages: ModelChatMessage[],
      nextDataModel: Record<string, unknown>,
      nextSurfaceIds: Set<string>,
      nextPreviewMessages: unknown[],
      nextPreviewPayloadUrls: PreviewPayloadUrls | null,
    ) => {
      messagesRef.current = nextMessages;
      dataModelRef.current = nextDataModel;
      surfaceIdsRef.current = nextSurfaceIds;
      previewMessagesRef.current = nextPreviewMessages;
      previewPayloadUrlsRef.current = nextPreviewPayloadUrls;
      setMessages(nextMessages);
      setDataModel(nextDataModel);
      setSurfaceIds(new Set(nextSurfaceIds));
      setPreviewMessages(nextPreviewMessages);
      setPreviewPayloadUrls(nextPreviewPayloadUrls);
      const id = activeIdRef.current;
      if (!persistentRef.current && id) {
        conversationHotStateMapRef.current.set(id, {
          messages: nextMessages.slice(),
          dataModel: cloneDataModel(nextDataModel),
          surfaceIds: new Set(nextSurfaceIds),
          previewMessages: nextPreviewMessages.slice(),
          previewPayloadUrls: nextPreviewPayloadUrls
            ? { ...nextPreviewPayloadUrls }
            : null,
        });
      }
    },
    [],
  );

  const activateRecord = useCallback(
    async (id: string) => {
      const token = Symbol(id);
      activationTokenRef.current = token;
      const record = persistentRef.current ? await loadConversation(id) : null;
      if (activationTokenRef.current !== token) return false;
      if (!record) return false;
      await setActiveConversationId(id, protocol);
      if (activationTokenRef.current !== token) return false;
      activeIdRef.current = id;
      setActiveId(id);
      syncHotState(
        fromPersistedMessages(record.messages),
        cloneDataModel(record.snapshot?.dataModel ?? {}),
        new Set(record.snapshot?.surfaceIds ?? []),
        record.snapshot?.previewMessages ?? [],
        record.snapshot?.previewPayloadUrls ?? null,
      );
      return true;
    },
    [protocol, syncHotState],
  );

  const refreshConversations = useCallback(async () => {
    if (!persistentRef.current) return;
    setConversations(await listConversations(protocol));
  }, [protocol]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let items = await listConversations(protocol);
        let id = await getActiveConversationId(protocol);
        if (!id || !items.some((item) => item.id === id)) {
          if (items.length === 0) {
            const created = await createConversation(undefined, protocol);
            id = created.id;
            items = [created];
          } else {
            id = items[0]?.id ?? null;
            await setActiveConversationId(id, protocol);
          }
        }
        if (cancelled || !id) return;
        setConversations(items);
        await activateRecord(id);
      } catch (err) {
        console.warn(
          '[a2ui] IndexedDB unavailable; using in-memory conversation state',
          err,
        );
        persistentRef.current = false;
        if (cancelled) return;
        const meta = createConversationMeta(undefined, protocol);
        setIsPersistent(false);
        setConversations([meta]);
        activeIdRef.current = meta.id;
        conversationHotStateMapRef.current.set(meta.id, createEmptyHotState());
        setActiveId(meta.id);
        syncHotState([], {}, new Set(), [], null);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activateRecord, protocol, syncHotState]);

  const switchTo = useCallback(
    async (id: string) => {
      if (activeIdRef.current === id) return;
      if (!persistentRef.current) {
        activationTokenRef.current = Symbol(id);
        const hotState = cloneHotState(
          conversationHotStateMapRef.current.get(id) ?? createEmptyHotState(),
        );
        activeIdRef.current = id;
        setActiveId(id);
        syncHotState(
          hotState.messages,
          hotState.dataModel,
          hotState.surfaceIds,
          hotState.previewMessages,
          hotState.previewPayloadUrls,
        );
        return;
      }
      await activateRecord(id);
    },
    [activateRecord, syncHotState],
  );

  const createNew = useCallback(async () => {
    if (!persistentRef.current) {
      const meta = createConversationMeta(undefined, protocol);
      const hotState = createEmptyHotState();
      conversationHotStateMapRef.current.set(meta.id, hotState);
      setConversations((prev) => [meta, ...prev]);
      activationTokenRef.current = Symbol(meta.id);
      activeIdRef.current = meta.id;
      setActiveId(meta.id);
      syncHotState(
        hotState.messages,
        hotState.dataModel,
        hotState.surfaceIds,
        hotState.previewMessages,
        hotState.previewPayloadUrls,
      );
      return meta.id;
    }

    const meta = await createConversation(undefined, protocol);
    await setActiveConversationId(meta.id, protocol);
    setConversations((prev) => [meta, ...prev]);
    activationTokenRef.current = null;
    activeIdRef.current = meta.id;
    setActiveId(meta.id);
    syncHotState([], {}, new Set(), [], null);
    return meta.id;
  }, [protocol, syncHotState]);

  const importShared = useCallback(
    async (doc: SharedConversationDoc): Promise<string> => {
      // In-memory fallback (IndexedDB unavailable): build hot state directly.
      if (!persistentRef.current) {
        const meta: ConversationMeta = {
          ...createConversationMeta(
            doc.title || 'Shared conversation',
            protocol,
          ),
          messageCount: doc.messages.length,
          previewText: previewTextFromSharedMessages(doc.messages),
        };
        const hotState: ConversationHotState = {
          messages: doc.messages.map((message) => ({
            role: message.role,
            content: message.content,
            previewPayloadUrls: message.previewPayloadUrls,
            previewMetrics: clonePreviewPerformanceMetrics(
              message.previewMetrics,
            ),
          })),
          dataModel: cloneDataModel(doc.snapshot?.dataModel ?? {}),
          surfaceIds: new Set(doc.snapshot?.surfaceIds ?? []),
          previewMessages: [],
          previewPayloadUrls: doc.snapshot?.previewPayloadUrls ?? null,
        };
        conversationHotStateMapRef.current.set(
          meta.id,
          cloneHotState(hotState),
        );
        setConversations((prev) => [meta, ...prev]);
        activationTokenRef.current = Symbol(meta.id);
        activeIdRef.current = meta.id;
        setActiveId(meta.id);
        syncHotState(
          hotState.messages,
          hotState.dataModel,
          hotState.surfaceIds,
          hotState.previewMessages,
          hotState.previewPayloadUrls,
        );
        return meta.id;
      }

      const meta = await importConversation(doc, protocol);
      await setActiveConversationId(meta.id, protocol);
      await refreshConversations();
      await activateRecord(meta.id);
      return meta.id;
    },
    [activateRecord, protocol, refreshConversations, syncHotState],
  );

  const remove = useCallback(
    async (id: string) => {
      if (persistentRef.current) {
        await deleteConversation(id, protocol);
      } else {
        conversationHotStateMapRef.current.delete(id);
      }
      const nextItems = persistentRef.current
        ? await listConversations(protocol)
        : conversations.filter((item) => item.id !== id);
      if (nextItems.length === 0) {
        const nextId = await createNew();
        await switchTo(nextId);
        return;
      }

      setConversations(nextItems);
      if (activeIdRef.current === id) {
        await switchTo(nextItems[0]?.id ?? '');
      }
    },
    [conversations, createNew, protocol, switchTo],
  );

  const rename = useCallback(async (id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    if (persistentRef.current) {
      await renameConversation(id, trimmed);
      await refreshConversations();
      return;
    }
    setConversations((prev) =>
      prev.map((item) => item.id === id ? { ...item, title: trimmed } : item)
    );
  }, [refreshConversations]);

  const recordTurn = useCallback(
    async (input: RecordTurnInput) => {
      let id = activeIdRef.current;
      id ??= await createNew();

      const nextMessages = [
        ...messagesRef.current,
        input.userMessage,
        {
          role: 'assistant' as const,
          content: input.assistantContent,
          previewPayloadUrls: input.previewPayloadUrls ?? undefined,
          previewMetrics: clonePreviewPerformanceMetrics(input.previewMetrics),
        },
      ];
      const nextDataModel = cloneDataModel(dataModelRef.current);
      const nextSurfaceIds = new Set(surfaceIdsRef.current);
      applyA2UIMessagesToSnapshot(
        nextDataModel,
        nextSurfaceIds,
        input.a2uiMessages,
      );
      const nextPreviewMessages = input.previewMessages ?? input.a2uiMessages;
      const nextPreviewPayloadUrls = input.snapshotPreviewPayloadUrls
        ?? input.previewPayloadUrls
        ?? null;
      const now = Date.now();

      const existingMeta =
        conversationsRef.current.find((item) => item.id === id)
          ?? createConversationMeta(undefined, protocol);
      const baseMeta = {
        ...existingMeta,
        protocol,
      };
      const nextMeta: ConversationMeta = {
        ...baseMeta,
        id,
        title: existingMeta.messageCount === 0
          ? titleFromMessage(input.userMessage.content)
          : existingMeta.title,
        updatedAt: now,
        messageCount: nextMessages.length,
        previewText: previewFromMessage(input.userMessage.content),
      };
      const snapshot: DataModelSnapshot = {
        conversationId: id,
        dataModel: nextDataModel,
        surfaceIds: [...nextSurfaceIds],
        previewMessages: nextPreviewMessages,
        previewPayloadUrls: nextPreviewPayloadUrls ?? undefined,
        updatedAt: now,
      };

      syncHotState(
        nextMessages,
        nextDataModel,
        nextSurfaceIds,
        nextPreviewMessages,
        nextPreviewPayloadUrls,
      );
      const nextConversations = [
        nextMeta,
        ...conversationsRef.current.filter((item) => item.id !== id),
      ].sort((a, b) => b.updatedAt - a.updatedAt);
      conversationsRef.current = nextConversations;
      setConversations(nextConversations);

      if (persistentRef.current) {
        try {
          await saveConversationMessages(
            nextMeta,
            toPersistedMessages(id, nextMessages),
            snapshot,
          );
        } catch (err) {
          console.warn(
            '[a2ui] Failed to persist conversation; continuing in memory',
            err,
          );
          persistentRef.current = false;
          setIsPersistent(false);
          conversationHotStateMapRef.current.set(id, {
            messages: nextMessages.slice(),
            dataModel: cloneDataModel(nextDataModel),
            surfaceIds: new Set(nextSurfaceIds),
            previewMessages: nextPreviewMessages.slice(),
            previewPayloadUrls: nextPreviewPayloadUrls
              ? { ...nextPreviewPayloadUrls }
              : null,
          });
        }
      }
    },
    [createNew, protocol, syncHotState],
  );

  const updateLastAssistantPreviewMetrics = useCallback(
    async (metrics: PreviewPerformanceMetrics) => {
      const id = activeIdRef.current;
      if (!id) return;

      const nextPreviewMetrics = clonePreviewPerformanceMetrics(metrics);
      if (!nextPreviewMetrics) return;

      const currentMessages = messagesRef.current;
      const assistantIndex = (() => {
        for (let i = currentMessages.length - 1; i >= 0; i--) {
          if (currentMessages[i]?.role === 'assistant') return i;
        }
        return -1;
      })();
      if (assistantIndex < 0) return;

      const nextMessages = currentMessages.slice();
      nextMessages[assistantIndex] = {
        ...nextMessages[assistantIndex],
        previewMetrics: nextPreviewMetrics,
      };
      const nextDataModel = cloneDataModel(dataModelRef.current);
      const nextSurfaceIds = new Set(surfaceIdsRef.current);
      const nextPreviewMessages = previewMessagesRef.current.slice();
      const nextPreviewPayloadUrls = previewPayloadUrlsRef.current;

      syncHotState(
        nextMessages,
        nextDataModel,
        nextSurfaceIds,
        nextPreviewMessages,
        nextPreviewPayloadUrls,
      );

      const existingMeta = conversationsRef.current.find((item) =>
        item.id === id
      );
      if (!persistentRef.current || !existingMeta) return;

      const snapshot: DataModelSnapshot = {
        conversationId: id,
        dataModel: nextDataModel,
        surfaceIds: [...nextSurfaceIds],
        previewMessages: nextPreviewMessages,
        previewPayloadUrls: nextPreviewPayloadUrls ?? undefined,
        updatedAt: existingMeta.updatedAt,
      };

      try {
        await saveConversationMessages(
          existingMeta,
          toPersistedMessages(id, nextMessages),
          snapshot,
        );
      } catch (err) {
        console.warn(
          '[a2ui] Failed to persist preview metrics; continuing in memory',
          err,
        );
        persistentRef.current = false;
        setIsPersistent(false);
        conversationHotStateMapRef.current.set(id, {
          messages: nextMessages.slice(),
          dataModel: cloneDataModel(nextDataModel),
          surfaceIds: new Set(nextSurfaceIds),
          previewMessages: nextPreviewMessages.slice(),
          previewPayloadUrls: nextPreviewPayloadUrls
            ? { ...nextPreviewPayloadUrls }
            : null,
        });
      }
    },
    [syncHotState],
  );

  const buildConversationContext = useCallback(
    (): ConversationContext => ({
      history: truncateConversationHistory(messagesRef.current),
      dataModel: cloneDataModel(dataModelRef.current),
    }),
    [],
  );

  return {
    conversations,
    activeId,
    messages,
    dataModel,
    surfaceIds,
    previewMessages,
    previewPayloadUrls,
    isReady,
    isPersistent,
    switchTo,
    createNew,
    importShared,
    remove,
    rename,
    recordTurn,
    updateLastAssistantPreviewMetrics,
    buildConversationContext,
  };
}
