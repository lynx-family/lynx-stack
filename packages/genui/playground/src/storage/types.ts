// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { GenerationUsageRecord } from '../utils/modelPricing.js';

export type ConversationProtocol =
  | 'a2ui'
  | 'openui'
  | 'mcp-apps'
  | 'lynx-xml'
  | 'html';

export interface ConversationGenerationSettings {
  provider?: string;
  enableDesignGuidance: boolean;
  enableHtmlFragment?: boolean;
}

export interface ConversationMeta {
  id: string;
  protocol?: ConversationProtocol;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  previewText: string;
  generationSettings?: ConversationGenerationSettings;
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
  generationUsage?: GenerationUsageRecord;
  generationError?: string;
  conversationId: string;
  seq: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  lynxXmlFragment?: string;
  lynxXmlModelOutput?: string;
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
  /**
   * Durable URL of the most recently published "share whole conversation"
   * document, paired with the `meta.updatedAt` it was generated for. Lets
   * repeated shares (including after a page reload) reuse the same link until
   * the conversation changes.
   */
  sharePayload?: { url: string; updatedAt: number };
}

export interface MetaRecord {
  key: string;
  value: string;
}
