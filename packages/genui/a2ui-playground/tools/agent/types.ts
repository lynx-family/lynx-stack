// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type AgentProvider = 'claude_code' | 'token_provider' | null;

export type AgentStatus = 'ready' | 'unavailable' | 'needs_token';

export type AgentSseEventName =
  | 'status'
  | 'delta'
  | 'tool_call'
  | 'tool_result'
  | 'a2ui'
  | 'done'
  | 'error';

export interface AgentFeatures {
  streaming: boolean;
  interrupt: boolean;
  preview: boolean;
  tokenFallbackReserved: boolean;
}

export interface AgentHealthResponse {
  status: AgentStatus;
  provider: AgentProvider;
  reason?: string | null;
  version?: string | null;
  binaryPath?: string | null;
  features: AgentFeatures;
}

export interface AgentSessionResponse {
  sessionId: string;
}

export interface ResolvedProvider {
  status: AgentStatus;
  provider: AgentProvider;
  reason: string | null;
  version: string | null;
  binaryPath: string | null;
}

export interface AgentSession {
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  activeRunId: string | null;
}

export interface AgentActiveRun {
  runId: string;
  stop: () => boolean;
}

export interface AgentInterruptResponse {
  ok: boolean;
  interrupted: boolean;
  reason: string | null;
}

export interface ClaudeCodeTextRunOptions {
  prompt: string;
  cwd: string;
  onStatus?: (payload: unknown) => void;
  onDelta: (text: string) => void;
  onDone: (payload: { resultText: string | null }) => void;
  onError: (error: unknown) => void;
}
