// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type AgentUiStatus =
  | 'checking'
  | 'ready'
  | 'unavailable'
  | 'streaming';

export interface AgentHealthResponse {
  status: 'ready' | 'unavailable' | 'needs_token';
  provider: 'claude_code' | 'token_provider' | null;
  reason?: string | null;
  version?: string | null;
  binaryPath?: string | null;
  features: {
    streaming: boolean;
    interrupt: boolean;
    preview: boolean;
    tokenFallbackReserved: boolean;
  };
}

export interface AgentSessionResponse {
  sessionId: string;
}

export interface AgentInterruptResponse {
  ok: boolean;
  interrupted: boolean;
  reason: string | null;
}

export type AgentStatusEvent = Record<string, unknown>;

export interface AgentDeltaEvent {
  text?: string;
  sessionId?: string;
  runId?: string;
}

export interface AgentDoneEvent {
  sessionId?: string;
  runId?: string;
  resultText?: string | null;
}

export interface AgentA2UIEvent {
  messages: unknown;
  actionMocks?: unknown;
}

export interface AgentErrorEvent {
  message?: string;
  reason?: string;
  sessionId?: string;
  runId?: string;
}
