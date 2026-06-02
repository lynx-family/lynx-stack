// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  previewText: string;
}

export interface PreviewPayloadUrls {
  messagesUrl: string;
  actionMocksUrl?: string;
}

export interface PreviewPerformanceMetrics {
  fcpMs?: number;
  fmpMs?: number;
  ttiMs?: number;
  agentOutputMs?: number;
  renderMs?: number;
}

export interface PersistedMessage {
  conversationId: string;
  seq: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  previewPayloadUrls?: PreviewPayloadUrls;
  previewMetrics?: PreviewPerformanceMetrics;
  createdAt: number;
}

export interface DataModelSnapshot {
  conversationId: string;
  dataModel: Record<string, unknown>;
  surfaceIds: string[];
  previewMessages?: unknown[];
  previewPayloadUrls?: PreviewPayloadUrls;
  updatedAt: number;
}

export interface MetaRecord {
  key: 'activeConversationId' | 'schemaVersion';
  value: string;
}
