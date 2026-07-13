// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { MobilePaneTab } from '../../components/MobileTabBar.js';
import type { PreviewPanelSource } from '../../components/PreviewPanel.js';
import type {
  ConversationContext,
  ModelChatMessage,
} from '../../hooks/useConversation.js';
import type {
  PreviewPayloadUrls,
  PreviewPerformanceMetrics,
} from '../../storage/types.js';
import type { Protocol, ProtocolName } from '../../utils/protocol.js';

export interface ChatHost {
  origin: string;
  hostname: string;
  protocol: string;
  search: string;
  baseUrl: string;
}

export interface ChatHttpRequest {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Readonly<Record<string, string>>;
  body?: unknown;
}

export interface ChatTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

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

export type ChatStreamEmission<TOutput> =
  | { type: 'progress'; text: string }
  | { type: 'partial'; output: TOutput }
  | { type: 'final'; output: TOutput }
  | { type: 'usage'; usage: ChatTokenUsage }
  | { type: 'previewPayload'; value: PreviewPayloadUrls };

export interface ChatStreamStep<TState, TOutput> {
  state: TState;
  emissions: readonly ChatStreamEmission<TOutput>[];
}

export interface ChatSseEvent {
  event: string;
  data: unknown;
}

export interface ChatStreamAdapter<TState, TOutput> {
  initial: () => TState;
  reduce: (
    state: TState,
    frame: ChatSseEvent,
  ) => ChatStreamStep<TState, TOutput>;
  fromJson: (payload: unknown) => ChatStreamStep<TState, TOutput>;
  finish: (state: TState) => TOutput | null;
  error: (payload: unknown) => string;
}

export interface ChatTurnPersistence {
  assistantContent: string;
  a2uiMessages: unknown[];
  previewMessages: unknown[];
  previewPayloadUrls?: PreviewPayloadUrls | null;
  snapshotPreviewPayloadUrls?: PreviewPayloadUrls | null;
}

export interface ChatHydration<TOutput> {
  messages: ChatMessageModel[];
  output: TOutput | null;
  metrics?: PreviewPerformanceMetrics;
}

export interface ChatSettingOption {
  value: string;
  label: string;
}

export interface ChatSettingControl {
  id: string;
  label: string;
  value: string;
  kind: 'select' | 'text' | 'password';
  placeholder?: string;
  options?: readonly ChatSettingOption[];
}

export interface ChatSettingsAdapter<TSettings> {
  storageKeys: readonly string[];
  initial: () => TSettings;
  parseStored: (raw: unknown) => TSettings;
  serialize: (value: TSettings) => unknown;
  controls: (value: TSettings) => readonly ChatSettingControl[];
  update: (value: TSettings, id: string, next: string) => TSettings;
  badge: (value: TSettings) => string;
}

export interface ChatExampleItem {
  id: string;
  title: string;
  description?: string;
}

export interface ChatSuggestion {
  label: string;
  text: string;
}

export interface ChatLoadedExample<TOutput> {
  userText: string;
  messages: ChatMessageModel[];
  output: TOutput;
  persistence: ChatTurnPersistence;
}

export interface ChatExampleAdapter<TExample, TOutput> {
  items: readonly TExample[];
  item: (value: TExample) => ChatExampleItem;
  load: (value: TExample) => ChatLoadedExample<TOutput>;
}

export interface ChatPreviewContext {
  protocol: Protocol;
  theme: 'light' | 'dark';
  previewPayloadUrls: PreviewPayloadUrls | null;
}

export interface ChatPreviewAdapter<TOutput> {
  delivery: 'reload' | 'live-message';
  source: (
    output: TOutput | null,
    context: ChatPreviewContext,
  ) => PreviewPanelSource | undefined;
  artifact?: (output: TOutput) => ChatArtifact;
  livePayload?: (output: TOutput) => unknown[];
  merge?: (current: TOutput | null, next: TOutput) => TOutput;
  emptyTitle: string;
  emptySubtitle: string;
  generatingHint: string;
  emptyHint: string;
}

export interface ChatRequestContext<TSettings> {
  prompt: string;
  conversation: ConversationContext;
  settings: TSettings;
  host: ChatHost;
}

export interface ChatActionRequestContext<TAction, TSettings> {
  action: TAction;
  conversation: ConversationContext;
  settings: TSettings;
  host: ChatHost;
}

export interface ChatActionAdapter<
  TAction,
  TOutput,
  TSettings,
  TStreamState,
> {
  parseWindowMessage: (data: unknown) => TAction | null;
  userText: (action: TAction) => string;
  label: (action: TAction) => string;
  request: (
    context: ChatActionRequestContext<TAction, TSettings>,
  ) => ChatHttpRequest;
  stream: ChatStreamAdapter<TStreamState, TOutput>;
  merge: (current: TOutput | null, response: TOutput) => TOutput;
}

export interface ChatProtocolCopy {
  description: string;
  inputAriaLabel: string;
  inputPlaceholder: string;
  agentLabel: string;
  progressLabel: string;
  failurePrefix: string;
}

export interface ChatTranscriptAdapter<TOutput> {
  pending: (prompt: string) => ChatMessageModel;
  progress: (text: string) => ChatMessageModel;
  success: (output: TOutput) => readonly ChatMessageModel[];
  failure: (error: string) => ChatMessageModel;
}

export interface ChatHydrationContext {
  history: ModelChatMessage[];
  previewMessages: unknown[];
  previewPayloadUrls: PreviewPayloadUrls | null;
}

export interface ChatPersistenceContext<TOutput> {
  kind: 'create' | 'action' | 'example';
  current: TOutput | null;
  previewPayloadUrls: PreviewPayloadUrls | null;
}

export interface ChatProtocolAdapter<
  TOutput,
  TStreamState,
  TSettings = undefined,
  TExample = never,
  TAction = never,
  TActionStreamState = TStreamState,
> {
  id: ProtocolName;
  copy: ChatProtocolCopy;
  suggestions: readonly ChatSuggestion[];
  settings?: ChatSettingsAdapter<TSettings>;
  createRequest: (
    context: ChatRequestContext<TSettings>,
  ) => ChatHttpRequest;
  stream: ChatStreamAdapter<TStreamState, TOutput>;
  hydrate: (context: ChatHydrationContext) => ChatHydration<TOutput>;
  persist: (
    output: TOutput,
    context: ChatPersistenceContext<TOutput>,
  ) => ChatTurnPersistence;
  transcript: ChatTranscriptAdapter<TOutput>;
  examples: ChatExampleAdapter<TExample, TOutput>;
  preview: ChatPreviewAdapter<TOutput>;
  action?: ChatActionAdapter<
    TAction,
    TOutput,
    TSettings,
    TActionStreamState
  >;
}

export type ChatControllerPhase = 'idle' | 'generating';

export interface ChatControllerState<TOutput, TSettings> {
  messages: ChatMessageModel[];
  input: string;
  output: TOutput | null;
  phase: ChatControllerPhase;
  settings: TSettings;
  usage: ChatTokenUsage;
  metrics: PreviewPerformanceMetrics;
  previewPayloadUrls: PreviewPayloadUrls | null;
  previewRevision: number;
  activeMobileTab: MobilePaneTab;
  deleteConversationId: string | null;
}
