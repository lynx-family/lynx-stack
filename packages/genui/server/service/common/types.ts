// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ConversationContext {
  history: ChatMessage[];
  dataModel: Record<string, unknown>;
}

export type OpenAIReasoningEffort =
  | 'none'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh';

export interface ChatOptions {
  resourceId?: string | undefined;
  apiKey?: string | undefined;
  baseURL?: string | undefined;
  model?: string | undefined;
  api?: 'chat' | 'responses' | undefined;
  reasoningEffort?: OpenAIReasoningEffort | undefined;
  onPerformanceEvent?: (
    event: string,
    details?: Record<string, unknown>,
  ) => void;
}

export interface MastraResult {
  text?: unknown;
  usage?: unknown;
  finishReason?: unknown;
  content?: unknown;
  response?: unknown;
}

export interface MastraStreamResult extends MastraResult {
  textStream?: ReadableStream<string> | AsyncIterable<string>;
}
