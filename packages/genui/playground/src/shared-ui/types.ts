// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  PreviewPayloadUrls,
  PreviewPerformanceMetrics,
} from '../utils/previewTypes.js';

export type ChatMessageKind =
  | 'user'
  | 'assistant'
  | 'status'
  | 'action'
  | 'output';

export type ChatMessageTone = 'info' | 'pending' | 'success' | 'error';

export type ChatMessageIcon = 'spinner' | 'sparkles' | 'zap' | 'error';

export interface ChatMessageModel {
  id?: string;
  kind: ChatMessageKind;
  side?: 'left' | 'right';
  tone?: ChatMessageTone;
  text: string;
  code?: string;
  icon?: ChatMessageIcon;
  payload?: unknown;
  payloadLayout?: 'single' | 'chunks';
  metrics?: PreviewPerformanceMetrics;
}

export interface ChatArtifactView {
  id: string;
  label: string;
  text: string;
  language: 'text' | 'json';
}

export interface ChatArtifact {
  title: string;
  meta?: string;
  views: readonly ChatArtifactView[];
}

export interface ChatTurnPersistence {
  assistantContent: string;
  a2uiMessages: unknown[];
  previewMessages: unknown[];
  previewPayloadUrls?: PreviewPayloadUrls | null;
  snapshotPreviewPayloadUrls?: PreviewPayloadUrls | null;
}

export interface ChatSettingOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ChatSettingControl {
  id: string;
  label: string;
  value: string;
  kind: 'select' | 'text' | 'password';
  disabled?: boolean;
  fadeOverflow?: boolean;
  title?: string;
  placeholder?: string;
  options?: readonly ChatSettingOption[];
}
