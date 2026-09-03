// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const PROMPT_LIMIT: number = 128 * 1024;
export const ARTIFACT_LIMIT: number = 2 * 1024 * 1024;
export const EVENT_PAYLOAD_LIMIT: number = 256 * 1024;
export const AGENT_EVENT_QUEUE_COUNT_LIMIT: number = 10_000;
export const AGENT_EVENT_QUEUE_BYTES_LIMIT: number = 16 * 1024 * 1024;
export const DURABLE_TURN_EVENT_COUNT_LIMIT: number = 10_000;
export const DURABLE_TURN_EVENT_BYTES_LIMIT: number = 16 * 1024 * 1024;
export const PROTOCOL_FRAME_BYTES_LIMIT: number = 8 * 1024 * 1024;
export const VISIBLE_HISTORY_LIMIT: number = 64 * 1024;
export const DEFAULT_TURN_TIMEOUT_MS: number = 10 * 60 * 1000;

export type AgentId = 'codex' | 'claude' | 'cursor' | 'trae';

export const AGENT_IDS: readonly AgentId[] = [
  'codex',
  'claude',
  'cursor',
  'trae',
] as const;
export type TurnStatus =
  | 'accepted'
  | 'starting'
  | 'running'
  | 'awaiting_approval'
  | 'cancelling'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted';

export interface AgentCapabilities {
  models: boolean;
  effort: boolean;
  tools: boolean;
  approvals: boolean;
  cancellation: boolean;
}

export interface AgentDescriptor {
  id: AgentId;
  name: string;
  command: readonly string[];
  protocol: 'codex-app-server' | 'claude-stream-json' | 'acp';
  available: boolean;
  authentication: 'authenticated' | 'unknown' | 'unavailable';
  efforts: readonly string[];
  capabilities: AgentCapabilities;
}

export interface AgentModelOption {
  value: string;
  label: string;
  efforts?: readonly string[];
}

export type AgentModelCatalog =
  | {
    status: 'ready';
    models: readonly AgentModelOption[];
  }
  | {
    status: 'unsupported';
    reason: 'agent-does-not-expose-model-list';
    models: readonly [];
  };

export interface ConversationSession {
  id: string;
  agentId: AgentId;
  model?: string;
  effort?: string;
  createdAt: string;
}

export interface ConversationRecord {
  id: string;
  title: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  initialRequest?: string;
  eventSequence?: number;
  latestRevision?: string;
  latestArtifactHash?: string;
  currentSessionId?: string;
  sessions: ConversationSession[];
  createRequestHash: string;
}

export interface TurnRequest {
  sessionId: string;
  prompt: string;
  agentId: AgentId;
  model?: string;
  effort?: string;
}

export interface TurnRecord extends TurnRequest {
  id: string;
  conversationId: string;
  requestHash: string;
  status: TurnStatus;
  acceptedAt: string;
  startedAt?: string;
  completedAt?: string;
  revision?: string;
  error?: string;
  warnings?: string[];
}

export interface DurableEvent {
  eventId: string;
  conversationId: string;
  sessionId?: string;
  sequence: number;
  type: string;
  timestamp: string;
  turnId?: string;
  payload: unknown;
  durable: true;
  truncated?: boolean;
}

export interface TransientEvent extends Omit<DurableEvent, 'durable'> {
  durable: false;
}

export type PlaygroundEvent = DurableEvent | TransientEvent;

export interface ApprovalRecord {
  requestId: string;
  turnId: string;
  decision: 'allow_once' | 'deny';
}

export interface AgentLaunchRequest {
  systemPrompt: string;
  prompt: string;
  cwd: string;
  model?: string;
  effort?: string;
}

export type AgentEvent =
  | { type: 'assistant_delta'; text: string }
  | { type: 'assistant_final'; text: string }
  | { type: 'activity'; text: string }
  | { type: 'error'; message: string }
  | { type: 'tool'; name: string; status: string; detail?: string }
  | { type: 'usage'; inputTokens?: number; outputTokens?: number }
  | { type: 'policy_blocked'; reason: string }
  | {
    type: 'approval';
    requestId: string;
    prompt: string;
    decisions: readonly ApprovalRecord['decision'][];
    respond: (decision: ApprovalRecord['decision']) => void;
    cancel: () => void;
  };

export interface RunningAgent {
  events: AsyncIterable<AgentEvent>;
  processId?: number;
  exit?: Promise<AgentProcessExit>;
  cancel(): void;
  close(): Promise<void>;
}

export interface AgentProcessExit {
  code: number | null;
  signal: NodeJS.Signals | null;
}

export interface AgentAdapter {
  descriptor: AgentDescriptor;
  listModels(forceRefresh?: boolean): Promise<AgentModelCatalog>;
  launch(request: AgentLaunchRequest): RunningAgent;
}

export const UUID_PATTERN: RegExp =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function requireUuid(value: string, label: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new PlaygroundError(400, `${label} must be a UUID`);
  }
  return value.toLowerCase();
}

export class PlaygroundError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code = 'PLAYGROUND_ERROR',
  ) {
    super(message);
  }
}
