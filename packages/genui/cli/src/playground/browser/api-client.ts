// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type LocalAgentId = 'codex' | 'claude' | 'cursor' | 'trae';
export type LocalTurnStatus =
  | 'accepted'
  | 'starting'
  | 'running'
  | 'awaiting_approval'
  | 'cancelling'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted';

export interface LocalAgentDescriptor {
  id: LocalAgentId;
  name: string;
  available: boolean;
  authentication: 'authenticated' | 'unknown' | 'unavailable';
  efforts: string[];
  capabilities: {
    models: boolean;
    effort: boolean;
    tools: boolean;
    approvals: boolean;
    cancellation: boolean;
  };
}

export interface LocalAgentModelOption {
  value: string;
  label: string;
  efforts?: string[];
}

export type LocalAgentModelCatalog =
  | {
    status: 'ready';
    models: LocalAgentModelOption[];
  }
  | {
    status: 'unsupported';
    reason: 'agent-does-not-expose-model-list';
    models: [];
  };

export interface LocalConversationSession {
  id: string;
  agentId: LocalAgentId;
  model?: string;
  effort?: string;
  createdAt: string;
}

export interface LocalConversation {
  id: string;
  title: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  initialRequest?: string;
  latestRevision?: string;
  latestArtifactHash?: string;
  currentSessionId?: string;
  sessions: LocalConversationSession[];
  turns?: number;
  activeTurn?: string;
}

export interface LocalTurn {
  id: string;
  conversationId: string;
  sessionId: string;
  prompt: string;
  agentId: LocalAgentId;
  model?: string;
  effort?: string;
  status: LocalTurnStatus;
  acceptedAt: string;
  startedAt?: string;
  completedAt?: string;
  revision?: string;
  error?: string;
  warnings?: string[];
}

export interface LocalApproval {
  requestId: string;
  turnId: string;
  prompt: string;
  decisions: Array<'allow_once' | 'deny'>;
}

export interface LocalConversationSnapshot {
  conversation: LocalConversation;
  turns: LocalTurn[];
  sequence: number;
  pendingApprovals: LocalApproval[];
  pagination: {
    cursor: number;
    limit: number;
    nextCursor: number | null;
    truncated: boolean;
    totalTurns: number;
  };
}

export interface LocalPlaygroundEvent {
  sequence: number;
  type: string;
  turnId?: string;
  payload: Record<string, unknown>;
  truncated?: boolean;
}

export interface LocalBootstrap {
  csrf: string;
  previewOrigin: string;
  previewIsolation: {
    status: 'isolated' | 'degraded';
    isolationCompliant: boolean;
    previewBoundHost: string;
    distinctPort: boolean;
    reason?: string;
  };
  dataRoot: string;
}

export interface LocalConversationList {
  conversations: LocalConversation[];
  diskUsage: number;
  warnings: string[];
}

export class LocalApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function bootstrapLocalPlayground(): Promise<LocalDaemonClient> {
  const token = new URLSearchParams(location.hash.slice(1)).get('bootstrap');
  history.replaceState(null, '', location.pathname);
  const bootstrap = token
    ? await fetchBootstrap('/api/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    : await fetchBootstrap('/api/bootstrap', { method: 'GET' });
  return new LocalDaemonClient(bootstrap);
}

async function fetchBootstrap(
  path: string,
  init: RequestInit,
): Promise<LocalBootstrap> {
  const response = await fetch(path, { ...init, credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error(
      'This page needs a fresh one-time bootstrap URL. Run `genui playground --no-open` again.',
    );
  }
  return await response.json() as LocalBootstrap;
}

export class LocalDaemonClient {
  constructor(readonly bootstrap: LocalBootstrap) {}

  async agents(): Promise<LocalAgentDescriptor[]> {
    const response = await this.json<{ agents: LocalAgentDescriptor[] }>(
      '/api/agents',
    );
    return response.agents;
  }

  async agentModels(agentId: LocalAgentId): Promise<LocalAgentModelCatalog> {
    return await this.json<LocalAgentModelCatalog>(
      `/api/agents/${encodeURIComponent(agentId)}/models`,
    );
  }

  async conversations(): Promise<LocalConversationList> {
    return await this.json<LocalConversationList>('/api/conversations');
  }

  async createConversation(
    id: string,
    title: string,
  ): Promise<LocalConversation> {
    const response = await this.json<{ conversation: LocalConversation }>(
      `/api/conversations/${id}`,
      { method: 'PUT', body: { title } },
    );
    return response.conversation;
  }

  async patchConversation(
    id: string,
    patch: { title?: string; archived?: boolean },
  ): Promise<LocalConversation> {
    const response = await this.json<{ conversation: LocalConversation }>(
      `/api/conversations/${id}`,
      { method: 'PATCH', body: patch },
    );
    return response.conversation;
  }

  async snapshot(id: string): Promise<LocalConversationSnapshot> {
    return await this.json<LocalConversationSnapshot>(
      `/api/conversations/${id}`,
    );
  }

  async artifact(id: string, revision: string): Promise<string> {
    const response = await fetch(
      `/api/conversations/${id}/artifacts/${encodeURIComponent(revision)}`,
      { credentials: 'same-origin' },
    );
    if (!response.ok) {
      throw new Error(`Artifact request failed (${response.status})`);
    }
    return await response.text();
  }

  async putSession(
    conversationId: string,
    sessionId: string,
    body: {
      agentId: LocalAgentId;
      model?: string;
      effort?: string;
    },
  ): Promise<void> {
    await this.json(
      `/api/conversations/${conversationId}/sessions/${sessionId}`,
      { method: 'PUT', body },
    );
  }

  async putTurn(
    conversationId: string,
    turnId: string,
    body: {
      sessionId: string;
      prompt: string;
      agentId: LocalAgentId;
      model?: string;
      effort?: string;
    },
  ): Promise<LocalTurn> {
    const response = await this.json<{ turn: LocalTurn }>(
      `/api/conversations/${conversationId}/turns/${turnId}`,
      { method: 'PUT', body },
    );
    return response.turn;
  }

  async cancel(conversationId: string, turnId: string): Promise<LocalTurn> {
    const response = await this.json<{ turn: LocalTurn }>(
      `/api/conversations/${conversationId}/turns/${turnId}/cancellation`,
      { method: 'PUT', body: {} },
    );
    return response.turn;
  }

  async approve(
    conversationId: string,
    requestId: string,
    decision: 'allow_once' | 'deny',
  ): Promise<void> {
    await this.json(
      `/api/conversations/${conversationId}/approvals/${requestId}`,
      { method: 'PUT', body: { decision } },
    );
  }

  subscribe(
    conversationId: string,
    after: number,
    onEvent: (event: LocalPlaygroundEvent) => void,
    onError: () => void,
  ): EventSource {
    const source = new EventSource(
      `/api/conversations/${conversationId}/events?after=${after}`,
    );
    for (const type of LOCAL_EVENT_TYPES) {
      source.addEventListener(type, (raw) => {
        const data = (raw as MessageEvent<unknown>).data;
        if (typeof data !== 'string') return;
        onEvent(JSON.parse(data) as LocalPlaygroundEvent);
      });
    }
    source.onerror = () => onError();
    return source;
  }

  private async json<T = unknown>(
    path: string,
    init: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const method = init.method ?? 'GET';
    const response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: method === 'GET'
        ? {}
        : {
          'Content-Type': 'application/json',
          'X-GenUI-CSRF': this.bootstrap.csrf,
        },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
    const value = await response.json() as T & {
      error?: { code?: string; message?: string };
    };
    if (!response.ok) {
      throw new LocalApiError(
        response.status,
        value.error?.code ?? 'PLAYGROUND_ERROR',
        value.error?.message ?? `Request failed (${response.status})`,
      );
    }
    return value;
  }
}

const LOCAL_EVENT_TYPES = [
  'conversation.created',
  'conversation.updated',
  'session.created',
  'turn.accepted',
  'turn.starting',
  'turn.started',
  'turn.completed',
  'turn.failed',
  'turn.cancelling',
  'turn.cancelled',
  'turn.interrupted',
  'artifact.ready',
  'assistant.delta',
  'activity',
  'tool',
  'approval.requested',
  'approval.resolved',
  'context.truncated',
  'message.user',
  'message.assistant',
  'process.exit',
  'usage',
  'policy.blocked',
] as const;
