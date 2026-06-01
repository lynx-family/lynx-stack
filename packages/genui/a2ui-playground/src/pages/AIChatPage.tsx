// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import './AIChatPage.css';

import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { ConversationListPanel } from '../components/ConversationListPanel.js';
import { CopyToast, useCopyToast } from '../components/CopyToast.js';
import { InstantExamplesStrip } from '../components/InstantExamplesStrip.js';
import { MobileTabBar } from '../components/MobileTabBar.js';
import type { MobilePaneTab } from '../components/MobileTabBar.js';
import { PageHeader } from '../components/PageHeader.js';
import { PanelResizeHandle } from '../components/PanelResizeHandle.js';
import { PreviewPanel } from '../components/PreviewPanel.js';
import { PreviewViewport } from '../components/PreviewViewport.js';
import type { StaticDemo } from '../demos.js';
import { useConversation } from '../hooks/useConversation.js';
import type { ModelChatMessage } from '../hooks/useConversation.js';
import { useResizablePanels } from '../hooks/useResizablePanels.js';
import { copyToClipboard } from '../utils/clipboard.js';
import { DEFAULT_A2UI_DEMO_URL } from '../utils/demoUrl.js';
import type { Protocol } from '../utils/protocol.js';
import { buildRenderUrl } from '../utils/renderUrl.js';

interface ChatMessage {
  role: 'user' | 'ai' | 'action' | 'json' | 'status';
  content: string | React.ReactNode;
  payload?: unknown;
  tone?: 'info' | 'pending' | 'success' | 'error';
}

interface SseEvent {
  event: string;
  data: unknown;
}

interface A2UIDonePayload {
  ok?: unknown;
  text?: unknown;
  errors?: unknown;
  validation?: {
    ok?: unknown;
    messages?: unknown;
    errors?: unknown;
  };
  error?: unknown;
  message?: unknown;
  usage?: unknown;
  preview?: {
    messagesUrl?: unknown;
    actionMocksUrl?: unknown;
  };
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface A2UIResponseMessageMeta {
  final: boolean;
}

interface PreviewPayloadUrls {
  messagesUrl: string;
  actionMocksUrl?: string;
}

interface ProviderSettings {
  preset: ProviderPresetId;
  apiKey: string;
  baseURL: string;
  model: string;
}

interface ProviderRequestOptions {
  apiKey?: string;
  baseURL?: string;
  model?: string;
}

interface PersistedProviderSettings {
  baseURL: string;
  model: string;
  preset?: ProviderPresetId;
}

function parseUsage(value: unknown): TokenUsage | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const pickNumber = (...keys: string[]): number => {
    for (const key of keys) {
      const v = record[key];
      if (typeof v === 'number' && Number.isFinite(v)) return v;
    }
    return 0;
  };
  // Support both legacy (promptTokens/completionTokens) and new
  // (inputTokens/outputTokens) AI SDK usage shapes.
  const promptTokens = pickNumber(
    'promptTokens',
    'inputTokens',
    'prompt_tokens',
  );
  const completionTokens = pickNumber(
    'completionTokens',
    'outputTokens',
    'completion_tokens',
  );
  const totalTokens = pickNumber('totalTokens', 'total_tokens')
    || promptTokens + completionTokens;
  if (promptTokens === 0 && completionTokens === 0 && totalTokens === 0) {
    return null;
  }
  return { promptTokens, completionTokens, totalTokens };
}

function formatTokenCount(value: number): string {
  if (value < 1000) return String(value);
  if (value < 10_000) return `${(value / 1000).toFixed(2)}k`;
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)}k`;
  return `${(value / 1_000_000).toFixed(2)}M`;
}

interface BrowserResponse {
  headers: {
    get(name: string): string | null;
  };
  body: {
    getReader(): {
      read(): Promise<{
        done: boolean;
        value?: Uint8Array;
      }>;
    };
  } | null;
  json(): Promise<unknown>;
}

const WELCOME_MESSAGE: ChatMessage = {
  role: 'ai',
  content:
    'I\'m A2UI Assistant. Describe the UI you want to build and I\'ll generate A2UI JSON for you.',
};

const DESKTOP_PREVIEW_MIN_WIDTH = 360;
const DESKTOP_CHAT_MIN_WIDTH = 360;
const COMPACT_CHAT_MIN_HEIGHT = 280;
const COMPACT_PREVIEW_MIN_HEIGHT = 320;
const RESIZE_BREAKPOINT = 980;
const ONLINE_A2UI_SERVER_ORIGIN = 'https://genui-server.vercel.app';
const ONLINE_A2UI_CHAT_URL = `${ONLINE_A2UI_SERVER_ORIGIN}/a2ui/stream`;
const LOCAL_A2UI_SERVER_PORT = '3060';
const PROVIDER_SETTINGS_STORAGE_KEY = 'a2ui-playground-provider-settings';

const PROVIDER_PRESETS = [
  { id: 'gpt-5.4', label: 'gpt5.4', model: 'gpt-5.4' },
  { id: 'gpt-5.5', label: 'gpt5.5', model: 'gpt-5.5' },
  { id: 'custom', label: 'Custom API key', model: '' },
] as const;

type ProviderPresetId = (typeof PROVIDER_PRESETS)[number]['id'];

function isProviderPresetId(value: unknown): value is ProviderPresetId {
  return PROVIDER_PRESETS.some((item) => item.id === value);
}

const EMPTY_PROVIDER_SETTINGS: ProviderSettings = {
  preset: 'gpt-5.5',
  apiKey: '',
  baseURL: 'https://api.openai.com/v1',
  model: 'gpt-5.5',
};

function compactProviderLabel(settings: ProviderSettings): string {
  if (settings.preset === 'custom') {
    const customModel = settings.model.trim();
    return customModel.length > 0 ? customModel : 'Custom model';
  }
  const preset = PROVIDER_PRESETS.find((item) => item.id === settings.preset);
  return preset?.model ?? 'Server default';
}
function isDevHost(hostname: string): boolean {
  return (
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '0.0.0.0'
    || hostname.startsWith('10.')
    || hostname.startsWith('192.168.')
    || /^172\.(?:1[6-9]|2\d|3[01])\./u.test(hostname)
  );
}

function isTrustedOnlineEndpoint(endpoint: URL): boolean {
  return endpoint.origin === ONLINE_A2UI_SERVER_ORIGIN;
}

function resolveTrustedA2UIEndpoint(raw: string): string | null {
  try {
    const endpoint = new URL(raw, window.location.origin);
    if (endpoint.origin === window.location.origin) {
      return endpoint.toString();
    }
    if (isTrustedOnlineEndpoint(endpoint)) {
      return endpoint.toString();
    }

    const isTrustedDevEndpoint = endpoint.protocol === 'http:'
      && endpoint.port === LOCAL_A2UI_SERVER_PORT
      && isDevHost(endpoint.hostname);
    return isTrustedDevEndpoint ? endpoint.toString() : null;
  } catch {
    return null;
  }
}

function getA2UIChatEndpoint(): string {
  const fromQuery = new URLSearchParams(window.location.search).get(
    'a2uiEndpoint',
  );
  if (fromQuery) {
    const trustedEndpoint = resolveTrustedA2UIEndpoint(fromQuery);
    if (trustedEndpoint) return trustedEndpoint;
  }
  if (
    window.location.protocol === 'http:' && isDevHost(window.location.hostname)
  ) {
    return `http://${window.location.hostname}:${LOCAL_A2UI_SERVER_PORT}/a2ui/stream`;
  }
  return ONLINE_A2UI_CHAT_URL;
}

function getA2UIActionStreamEndpoint(): string {
  return getA2UIChatEndpoint().replace(
    /\/a2ui\/stream$/,
    '/a2ui/action/stream',
  );
}

function targetOriginForFrame(src: string): string {
  try {
    return new URL(src, window.location.href).origin;
  } catch {
    return window.location.origin;
  }
}

function canForwardApiKeyToEndpoint(raw: string): boolean {
  try {
    const endpoint = new URL(raw, window.location.origin);
    return endpoint.protocol === 'http:'
      && endpoint.port === LOCAL_A2UI_SERVER_PORT
      && isDevHost(endpoint.hostname);
  } catch {
    return false;
  }
}

function filterProviderRequestOptionsForEndpoint(
  options: ProviderRequestOptions,
  endpoint: string,
): ProviderRequestOptions {
  if (canForwardApiKeyToEndpoint(endpoint)) {
    return options;
  }
  const { apiKey: _apiKey, ...safeOptions } = options;
  return safeOptions;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function normalizeErrorPayload(payload: unknown): string {
  if (payload && typeof payload === 'object') {
    const record = payload as A2UIDonePayload;
    if (Array.isArray(record.errors) && record.errors.length > 0) {
      return record.errors
        .filter((item): item is string => typeof item === 'string')
        .join(' ');
    }
    if (
      record.validation
      && Array.isArray(record.validation.errors)
      && record.validation.errors.length > 0
    ) {
      return record.validation.errors
        .filter((item): item is string => typeof item === 'string')
        .join(' ');
    }
    if (typeof record.error === 'string') return record.error;
    if (typeof record.message === 'string') return record.message;
  }
  return getErrorMessage(payload);
}

function parseSseData(raw: string): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function safeStringifyPayload(value: unknown): string {
  if (typeof value === 'string') {
    // Streaming JSON often arrives minified (no spaces/newlines) — try to
    // re-pretty-print it so the generated output is easy to scan.
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function payloadToChunks(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [value];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [value];
  }
}

function JsonPayloadViewer(
  props: {
    payload: unknown;
    onCopy: (text: string) => void;
    singleBlock?: boolean;
  },
) {
  const { onCopy, payload, singleBlock = false } = props;
  if (singleBlock) {
    const payloadStr = safeStringifyPayload(payload);
    return (
      <div className='chatMessagePayload'>
        <div className='chatMessageSingleChunk'>
          <div className='chatMessageChunkHeader'>
            <span className='chatMessageChunkIndex'>Request</span>
            <button
              type='button'
              className='chatJsonCopyButton'
              onClick={() => onCopy(payloadStr)}
            >
              Copy
            </button>
          </div>
          <pre className='chatMessageChunkJson'>{payloadStr}</pre>
        </div>
      </div>
    );
  }

  const chunks = payloadToChunks(payload);

  return (
    <div className='chatMessagePayload'>
      <div className='chatMessageChunks'>
        {chunks.map((message, index) => {
          const messageStr = JSON.stringify(message, null, 2);
          return (
            <div className='chatMessageChunk' key={index}>
              <div className='chatMessageChunkHeader'>
                <span className='chatMessageChunkIndex'>#{index + 1}</span>
                <button
                  type='button'
                  className='chatJsonCopyButton'
                  onClick={() => onCopy(messageStr)}
                >
                  Copy
                </button>
              </div>
              <pre className='chatMessageChunkJson'>{messageStr}</pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function readProviderSettings(): ProviderSettings {
  if (typeof window === 'undefined') return EMPTY_PROVIDER_SETTINGS;
  try {
    const raw = window.localStorage.getItem(PROVIDER_SETTINGS_STORAGE_KEY);
    if (!raw) return EMPTY_PROVIDER_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PersistedProviderSettings>;
    const preset = isProviderPresetId(parsed.preset)
      ? parsed.preset
      : EMPTY_PROVIDER_SETTINGS.preset;
    return {
      preset,
      apiKey: '',
      baseURL: typeof parsed.baseURL === 'string'
        ? parsed.baseURL
        : EMPTY_PROVIDER_SETTINGS.baseURL,
      model: typeof parsed.model === 'string'
        ? parsed.model
        : EMPTY_PROVIDER_SETTINGS.model,
    };
  } catch {
    return EMPTY_PROVIDER_SETTINGS;
  }
}

function toProviderRequestOptions(
  settings: ProviderSettings,
): ProviderRequestOptions {
  if (settings.preset !== 'custom') {
    const preset = PROVIDER_PRESETS.find((item) => item.id === settings.preset);
    return preset?.model ? { model: preset.model } : {};
  }
  const apiKey = settings.apiKey.trim();
  const baseURL = settings.baseURL.trim();
  const model = settings.model.trim();
  return {
    ...(apiKey ? { apiKey } : {}),
    ...(baseURL ? { baseURL } : {}),
    ...(model ? { model } : {}),
  };
}

function parseSseFrame(frame: string): SseEvent | null {
  const lines = frame.split(/\r?\n/u);
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim();
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart());
    }
  }

  if (dataLines.length === 0) return null;
  return { event, data: parseSseData(dataLines.join('\n')) };
}

function normalizeA2UIMessages(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (typeof payload === 'string') {
    try {
      return normalizeA2UIMessages(JSON.parse(payload));
    } catch {
      return [];
    }
  }
  if (payload && typeof payload === 'object') {
    const record = payload as A2UIDonePayload & { messages?: unknown };
    if (Array.isArray(record.messages) && record.messages.length > 0) {
      return record.messages;
    }
    if (
      record.validation
      && Array.isArray(record.validation.messages)
      && record.validation.messages.length > 0
    ) {
      return record.validation.messages;
    }
    if (typeof record.text === 'string') {
      return normalizeA2UIMessages(record.text);
    }
  }
  return [];
}

function normalizePreviewPayloadUrls(
  payload: unknown,
): PreviewPayloadUrls | null {
  if (!payload || typeof payload !== 'object') return null;
  const preview = (payload as A2UIDonePayload).preview;
  if (!preview || typeof preview !== 'object') return null;
  if (typeof preview.messagesUrl !== 'string') return null;
  return {
    messagesUrl: preview.messagesUrl,
    actionMocksUrl: typeof preview.actionMocksUrl === 'string'
      ? preview.actionMocksUrl
      : undefined,
  };
}

function includesCreateSurface(messages: unknown[]): boolean {
  return messages.some((message) =>
    Boolean(
      message
        && typeof message === 'object'
        && 'createSurface' in message
        && (message as { createSurface?: unknown }).createSurface,
    )
  );
}

function buildPreviewMessagesFromHistory(
  history: ModelChatMessage[],
): unknown[] {
  return history.flatMap((message) =>
    message.role === 'assistant'
      ? normalizeA2UIMessages(message.content)
      : []
  );
}

function parseCompletedArrayItems(raw: string): unknown[] {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith('[')) return [];

  const items: unknown[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let itemStart = -1;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{' || ch === '[') {
      depth++;
      if (depth === 2 && ch === '{') {
        itemStart = i;
      }
      continue;
    }

    if (ch === '}' || ch === ']') {
      if (depth === 2 && ch === '}' && itemStart !== -1) {
        const candidate = trimmed.slice(itemStart, i + 1);
        try {
          items.push(JSON.parse(candidate));
        } catch {
          return items;
        }
        itemStart = -1;
      }
      depth--;
    }
  }

  return items;
}

async function readA2UIResponse(
  response: BrowserResponse,
  onText: (text: string) => void,
  onMessages: (messages: unknown[], meta: A2UIResponseMessageMeta) => void,
  onUsage?: (usage: TokenUsage) => void,
  options: {
    parseDeltaMessages?: boolean;
    publishPartialMessages?: boolean;
    publishText?: boolean;
    onPreviewPayload?: (preview: PreviewPayloadUrls) => void;
  } = {},
): Promise<unknown[]> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream')) {
    const payload = await response.json();
    const messages = normalizeA2UIMessages(payload);
    if (messages.length === 0) {
      throw new Error(normalizeErrorPayload(payload));
    }
    if (payload && typeof payload === 'object') {
      const usage = parseUsage((payload as A2UIDonePayload).usage);
      if (usage) onUsage?.(usage);
      const preview = normalizePreviewPayloadUrls(payload);
      if (preview) options.onPreviewPayload?.(preview);
    }
    onMessages(messages, { final: true });
    return messages;
  }

  const reader = response.body?.getReader();
  if (!reader) return [];

  const decoder = new TextDecoder();
  let buffer = '';
  let generatedText = '';
  let latestMessages: unknown[] = [];
  const parseDeltaMessages = options.parseDeltaMessages ?? true;
  const publishPartialMessages = options.publishPartialMessages ?? true;
  const publishText = options.publishText ?? true;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const frames = buffer.split(/\r?\n\r?\n/u);
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const parsed = parseSseFrame(frame);
      if (!parsed) continue;

      if (parsed.event === 'delta') {
        const deltaData = parsed.data as { text?: unknown };
        if (typeof deltaData.text === 'string') {
          generatedText += deltaData.text;
          if (publishText) onText(generatedText);
          if (!publishPartialMessages || !parseDeltaMessages) continue;
          const completed = parseCompletedArrayItems(generatedText);
          if (completed.length > latestMessages.length) {
            latestMessages = completed;
            onMessages(latestMessages, { final: false });
          }
        }
        continue;
      }

      if (parsed.event === 'message') {
        if (!publishPartialMessages) continue;
        const messages = normalizeA2UIMessages(parsed.data);
        if (messages.length > 0) {
          latestMessages = messages;
          onMessages(latestMessages, { final: false });
        }
        continue;
      }

      if (parsed.event === 'done') {
        const doneMessages = normalizeA2UIMessages(parsed.data);
        if (parsed.data && typeof parsed.data === 'object') {
          const usage = parseUsage((parsed.data as A2UIDonePayload).usage);
          if (usage) onUsage?.(usage);
          const preview = normalizePreviewPayloadUrls(parsed.data);
          if (preview) options.onPreviewPayload?.(preview);
        }
        if (doneMessages.length > 0) {
          latestMessages = doneMessages;
          onMessages(latestMessages, { final: true });
        } else {
          throw new Error(normalizeErrorPayload(parsed.data));
        }
        return latestMessages;
      }

      if (parsed.event === 'error') {
        throw new Error(normalizeErrorPayload(parsed.data));
      }
    }

    if (done) break;
  }

  return latestMessages.length > 0
    ? latestMessages
    : normalizeA2UIMessages(generatedText);
}

const SUGGESTED_PROMPTS: Array<{ label: string; text: string }> = [
  {
    label: '🌤️ Weather with Refresh',
    text:
      'Create a weather card for San Francisco showing sunny, a photo, 22°C, humidity 60%, and a "Refresh" button. When the user taps Refresh, update the card with slightly different weather data to simulate a live fetch.',
  },
  {
    label: '🛍️ Product card with Buy',
    text:
      'Create a product card for a limited-edition sneaker. Include name, a photo, price ($189), a short description, and a "Buy Now" button. When tapped, show a purchase confirmation step with a "Confirm Purchase" button. Only the Confirm Purchase button should submit the action; after the action response, replace the card with an order success page showing a fake order number and estimated delivery.',
  },
  {
    label: '⚡ Quiz card with actions',
    text:
      'Create a trivia quiz card. Show a question "Which shape has three sides?" with 4 answer buttons: Triangle, Square, Circle, Hexagon. When the user taps an answer, show whether it is correct with a brief explanation.',
  },
];

function parsePersistedUserAction(content: string): {
  action: Record<string, unknown>;
  name: string;
} | null {
  const prefix = 'A2UI_USER_ACTION:';
  if (!content.startsWith(prefix)) return null;
  try {
    const parsed = JSON.parse(content.slice(prefix.length).trim()) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const action = (parsed as { action?: unknown }).action;
    if (!action || typeof action !== 'object') return null;
    const record = action as Record<string, unknown>;
    const event = record.event;
    const eventName = event && typeof event === 'object'
      ? (event as { name?: unknown }).name
      : undefined;
    return {
      action: record,
      name: typeof record.name === 'string'
        ? record.name
        : (typeof eventName === 'string' ? eventName : 'unknown'),
    };
  } catch {
    return null;
  }
}

function createActionForwardingStatus(actionName: string): ChatMessage {
  return {
    role: 'status',
    tone: 'info',
    content: (
      <>
        <span className='chatMessageStatusIcon' aria-hidden='true'>
          📤
        </span>
        <span>
          Lynx Preview triggered{' '}
          <code className='chatMessageStatusInline'>{actionName}</code>,
          forwarding request to agent...
        </span>
      </>
    ),
  };
}

function createAgentRespondedStatus(count: number): ChatMessage {
  return {
    role: 'status',
    tone: 'success',
    content: (
      <>
        <span className='chatMessageStatusIcon' aria-hidden='true'>
          📥
        </span>
        <span>
          Agent responded with {count} A2UI{' '}
          {count === 1 ? 'message' : 'messages'}.
        </span>
      </>
    ),
  };
}

function createPreviewReadyStatus(): ChatMessage {
  return {
    role: 'status',
    tone: 'info',
    content: (
      <>
        <span className='chatMessageStatusIcon' aria-hidden='true'>
          ✨
        </span>
        <span>UI updated. Ready for the next action.</span>
      </>
    ),
  };
}

function buildChatMessagesFromHistory(
  history: ModelChatMessage[],
): ChatMessage[] {
  if (history.length === 0) return [WELCOME_MESSAGE];
  const next: ChatMessage[] = [WELCOME_MESSAGE];
  let previousWasAction = false;
  for (const message of history) {
    if (message.role === 'user') {
      const action = parsePersistedUserAction(message.content);
      if (action) {
        next.push(createActionForwardingStatus(action.name));
        next.push({
          role: 'action',
          content: `⚡ Action: ${action.name}`,
          payload: action.action,
        });
        previousWasAction = true;
        continue;
      }
      next.push({ role: 'user', content: message.content });
      previousWasAction = false;
      continue;
    }
    if (message.role === 'assistant') {
      if (previousWasAction) {
        const actionMessages = normalizeA2UIMessages(message.content);
        if (actionMessages.length > 0) {
          next.push(createAgentRespondedStatus(actionMessages.length));
          next.push({
            role: 'action',
            content: `✅ Applied ${actionMessages.length} ${
              actionMessages.length === 1 ? 'message' : 'messages'
            } to Lynx Preview`,
            payload: actionMessages,
          });
          next.push(createPreviewReadyStatus());
          previousWasAction = false;
          continue;
        }
      }
      next.push({
        role: 'json',
        content: 'Generated Output',
        payload: message.content,
      });
      previousWasAction = false;
    }
  }
  return next;
}

export function AIChatPage(
  props: { protocol: Protocol; theme: 'light' | 'dark' },
) {
  const { protocol, theme } = props;
  const conversation = useConversation();
  const {
    activeId,
    buildConversationContext,
    conversations,
    createNew,
    isPersistent,
    isReady,
    messages: persistedMessages,
    previewMessages: persistedPreviewMessages,
    previewPayloadUrls: persistedPreviewPayloadUrls,
    recordTurn,
    remove,
    rename,
    switchTo,
  } = conversation;
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState<string>('');
  const [providerSettings, setProviderSettings] = useState<ProviderSettings>(
    () => readProviderSettings(),
  );
  const [renderUrl, setRenderUrl] = useState<string>('');
  const [previewMessages, setPreviewMessages] = useState<unknown[] | null>(
    null,
  );
  const [previewPayloadUrls, setPreviewPayloadUrls] = useState<
    PreviewPayloadUrls | null
  >(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [activeMobileTab, setActiveMobileTab] = useState<MobilePaneTab>(
    'edit',
  );
  const [deleteConversationId, setDeleteConversationId] = useState<
    string | null
  >(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  });
  const { showCopyToast, toast: copyToast } = useCopyToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const followBottomRef = useRef<boolean>(true);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const actionAbortRef = useRef<AbortController | null>(null);
  const hydratedActiveIdRef = useRef<string | null>(null);
  const latestPreviewMessagesRef = useRef<unknown[]>([]);
  const latestPreviewPayloadUrlsRef = useRef<PreviewPayloadUrls | null>(null);
  const renderUrlRef = useRef('');
  const bootstrappedRenderUrlRef = useRef<string | null>(null);
  const bootstrappedMessagesRef = useRef<unknown[] | null>(null);
  const bootstrappedMessagesSentUrlRef = useRef<string | null>(null);
  const bootstrappedReplayTimersRef = useRef<number[]>([]);
  const {
    containerRef: pageRef,
    handleResizeStart: handlePanelResizeStart,
    isCompactLayout,
    isResizing: isPanelResizing,
    primaryPanelStyle: chatPanelStyle,
    secondaryPanelStyle: previewPanelStyle,
  } = useResizablePanels({
    breakpoint: RESIZE_BREAKPOINT,
    compactPrimaryMinSize: COMPACT_CHAT_MIN_HEIGHT,
    compactSecondaryMinSize: COMPACT_PREVIEW_MIN_HEIGHT,
    desktopPrimaryMinSize: DESKTOP_CHAT_MIN_WIDTH,
    desktopSecondaryMinSize: DESKTOP_PREVIEW_MIN_WIDTH,
    initialPrimarySize: 400,
    initialSecondarySize: 560,
  });

  const handleCopyText = useCallback(
    (text: string) => {
      void copyToClipboard(text).then(showCopyToast);
    },
    [showCopyToast],
  );

  const updatePreviewPayloadUrls = useCallback(
    (next: PreviewPayloadUrls | null) => {
      latestPreviewPayloadUrlsRef.current = next;
      setPreviewPayloadUrls(next);
    },
    [],
  );

  const providerRequestOptions = useMemo(
    () => toProviderRequestOptions(providerSettings),
    [providerSettings],
  );
  const providerRequestOptionsRef = useRef(providerRequestOptions);

  const hasProviderOverride = providerSettings.preset === 'custom';

  useEffect(() => {
    providerRequestOptionsRef.current = providerRequestOptions;
  }, [providerRequestOptions]);

  useEffect(() => {
    renderUrlRef.current = renderUrl;
  }, [renderUrl]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PROVIDER_SETTINGS_STORAGE_KEY,
        JSON.stringify(
          {
            baseURL: providerSettings.baseURL,
            model: providerSettings.model,
            preset: providerSettings.preset,
          } satisfies PersistedProviderSettings,
        ),
      );
    } catch {
      // Keep the in-memory settings usable even when browser storage is off.
    }
  }, [providerSettings]);

  useEffect(() => {
    // Re-run on streaming updates so generated chunks keep the chat pinned to
    // the latest message.
    void messages;
    void isGenerating;
    void previewMessages;
    if (!followBottomRef.current) return;
    const container = chatMessagesRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, isGenerating, previewMessages]);

  useEffect(() => {
    const container = chatMessagesRef.current;
    if (!container) return;
    if (typeof ResizeObserver === 'undefined') return;
    // Streaming generated output expands the container height after React
    // commits. ResizeObserver fires for those layout shifts and lets us keep
    // the chat pinned to the bottom while the user is in "follow" mode.
    const sizeObserver = new ResizeObserver(() => {
      if (!followBottomRef.current) return;
      container.scrollTop = container.scrollHeight;
    });
    sizeObserver.observe(container);
    Array.from(container.children).forEach((child: Element) => {
      sizeObserver.observe(child);
    });
    // Newly inserted message rows must also be observed so delayed chunk
    // rendering still triggers the bottom-pin behavior. We use a
    // MutationObserver instead of re-running this effect on every messages
    // change so it stays a one-time setup.
    const childObserver = new MutationObserver((entries) => {
      let inserted = false;
      for (const entry of entries) {
        entry.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            sizeObserver.observe(node);
            inserted = true;
          }
        });
      }
      if (inserted && followBottomRef.current) {
        container.scrollTop = container.scrollHeight;
      }
    });
    childObserver.observe(container, { childList: true });
    return () => {
      sizeObserver.disconnect();
      childObserver.disconnect();
    };
  }, []);

  const handleChatScroll = useCallback(() => {
    const container = chatMessagesRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight
      - container.scrollTop
      - container.clientHeight;
    // 32px hysteresis: small upward scrolls inside generated output still count as
    // "at bottom"; once the user is clearly above we stop auto-following so
    // their reading position is respected.
    followBottomRef.current = distanceFromBottom <= 32;
  }, []);

  const baseUrl = useMemo(() => window.location.href.replace(/#.*$/, ''), []);
  const previewSource = useMemo(() => {
    if (!previewMessages) return undefined;
    return {
      kind: 'a2ui' as const,
      protocol,
      demoUrl: DEFAULT_A2UI_DEMO_URL,
      theme,
      messages: previewMessages,
      messagesUrl: previewPayloadUrls?.messagesUrl,
      actionMocksUrl: previewPayloadUrls?.actionMocksUrl,
    };
  }, [previewMessages, previewPayloadUrls, protocol, theme]);

  const clearBootstrappedPreview = useCallback(() => {
    bootstrappedRenderUrlRef.current = null;
    bootstrappedMessagesRef.current = null;
    bootstrappedMessagesSentUrlRef.current = null;
    for (const timer of bootstrappedReplayTimersRef.current) {
      window.clearTimeout(timer);
    }
    bootstrappedReplayTimersRef.current = [];
  }, []);

  const postLiveMessagesToPreview = useCallback((messages: unknown[]) => {
    const targetOrigin = targetOriginForFrame(renderUrlRef.current);
    previewFrameRef.current?.contentWindow?.postMessage(
      { type: 'A2UI_LIVE_MESSAGES', messages },
      targetOrigin,
    );
  }, []);

  const postReplayMessagesToPreview = useCallback((messages: unknown[]) => {
    const targetOrigin = targetOriginForFrame(renderUrlRef.current);
    previewFrameRef.current?.contentWindow?.postMessage(
      { type: 'A2UI_REPLAY_MESSAGES', messages },
      targetOrigin,
    );
  }, []);

  const postBootstrappedMessagesOnce = useCallback(() => {
    const currentUrl = renderUrlRef.current;
    if (bootstrappedRenderUrlRef.current !== currentUrl) return;
    if (bootstrappedMessagesSentUrlRef.current === currentUrl) return;
    const messages = bootstrappedMessagesRef.current;
    if (!messages || messages.length === 0) return;
    // The first render URL only boots the Lynx runtime. Replay restored
    // messages after iframe startup so render.html can queue them until
    // sendGlobalEvent and the Lynx MessageStore are both ready.
    bootstrappedMessagesSentUrlRef.current = currentUrl;
    postReplayMessagesToPreview(messages);
    for (const delay of [100, 300, 800]) {
      const timer = window.setTimeout(() => {
        bootstrappedReplayTimersRef.current = bootstrappedReplayTimersRef
          .current.filter((item) => item !== timer);
        if (bootstrappedRenderUrlRef.current !== renderUrlRef.current) return;
        const latestMessages = bootstrappedMessagesRef.current;
        if (!latestMessages || latestMessages.length === 0) return;
        postReplayMessagesToPreview(latestMessages);
      }, delay);
      bootstrappedReplayTimersRef.current.push(timer);
    }
  }, [postReplayMessagesToPreview]);

  const publishPreviewMessages = useCallback(
    (nextMessages: unknown[]) => {
      if (nextMessages.length === 0) return;
      latestPreviewMessagesRef.current = nextMessages;
      setPreviewMessages(nextMessages);

      const initData = {
        protocol,
        demoUrl: DEFAULT_A2UI_DEMO_URL,
        messages: [],
        theme,
        instant: true,
        liveAction: nextMessages.length > 0,
      };

      setRenderUrl((current) => {
        if (current) {
          renderUrlRef.current = current;
          clearBootstrappedPreview();
          postLiveMessagesToPreview(nextMessages);
          return current;
        }

        const nextRenderUrl = buildRenderUrl(initData, baseUrl);
        renderUrlRef.current = nextRenderUrl;
        bootstrappedRenderUrlRef.current = nextRenderUrl;
        bootstrappedMessagesRef.current = nextMessages;
        bootstrappedMessagesSentUrlRef.current = null;
        return nextRenderUrl;
      });
    },
    [
      baseUrl,
      clearBootstrappedPreview,
      postLiveMessagesToPreview,
      protocol,
      theme,
    ],
  );

  const publishStreamingPreviewMessages = useCallback(
    (deltaMessages: unknown[]) => {
      if (deltaMessages.length === 0) return;
      const accumulatedMessages = [
        ...latestPreviewMessagesRef.current,
        ...deltaMessages,
      ];
      latestPreviewMessagesRef.current = accumulatedMessages;
      setPreviewMessages(accumulatedMessages);
      updatePreviewPayloadUrls(null);

      const initData = {
        protocol,
        demoUrl: DEFAULT_A2UI_DEMO_URL,
        messages: [],
        theme,
        instant: true,
        liveAction: deltaMessages.length > 0,
      };

      setRenderUrl((current) => {
        if (current) {
          renderUrlRef.current = current;
          if (bootstrappedRenderUrlRef.current === current) {
            bootstrappedMessagesRef.current = accumulatedMessages;
            postBootstrappedMessagesOnce();
            return current;
          }
          postLiveMessagesToPreview(deltaMessages);
          return current;
        }

        const nextRenderUrl = buildRenderUrl(initData, baseUrl);
        renderUrlRef.current = nextRenderUrl;
        bootstrappedRenderUrlRef.current = nextRenderUrl;
        bootstrappedMessagesRef.current = accumulatedMessages;
        bootstrappedMessagesSentUrlRef.current = null;
        return nextRenderUrl;
      });
    },
    [
      baseUrl,
      postBootstrappedMessagesOnce,
      postLiveMessagesToPreview,
      protocol,
      theme,
      updatePreviewPayloadUrls,
    ],
  );

  const handlePreviewLoad = useCallback(() => {
    if (bootstrappedRenderUrlRef.current === renderUrlRef.current) {
      postBootstrappedMessagesOnce();
      return;
    }
    publishPreviewMessages(latestPreviewMessagesRef.current);
  }, [postBootstrappedMessagesOnce, publishPreviewMessages]);

  useEffect(() => {
    if (!isReady || isGenerating) return;
    const replayMessages = includesCreateSurface(persistedPreviewMessages)
      ? persistedPreviewMessages
      : buildPreviewMessagesFromHistory(persistedMessages);

    if (hydratedActiveIdRef.current === activeId) {
      if (!renderUrl && replayMessages.length > 0) {
        publishPreviewMessages(replayMessages);
      }
      return;
    }

    hydratedActiveIdRef.current = activeId;
    setMessages(buildChatMessagesFromHistory(persistedMessages));
    setTokenUsage({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
    updatePreviewPayloadUrls(persistedPreviewPayloadUrls);
    if (replayMessages.length > 0) {
      publishPreviewMessages(replayMessages);
    } else {
      latestPreviewMessagesRef.current = [];
      setPreviewMessages(null);
      updatePreviewPayloadUrls(null);
      clearBootstrappedPreview();
      renderUrlRef.current = '';
      setRenderUrl('');
    }
  }, [
    activeId,
    clearBootstrappedPreview,
    isReady,
    isGenerating,
    persistedMessages,
    persistedPreviewMessages,
    persistedPreviewPayloadUrls,
    publishPreviewMessages,
    renderUrl,
    updatePreviewPayloadUrls,
  ]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || isGenerating) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMessage: ModelChatMessage = { role: 'user', content: text };
    const requestConversation = buildConversationContext();

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text },
      { role: 'ai', content: 'Connecting to A2UI agent...' },
    ]);
    setInputValue('');
    setPreviewMessages(null);
    updatePreviewPayloadUrls(null);
    latestPreviewMessagesRef.current = [];
    setTokenUsage({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
    setIsGenerating(true);

    void (async () => {
      try {
        const chatEndpoint = getA2UIChatEndpoint();
        const requestProviderOptions = filterProviderRequestOptionsForEndpoint(
          providerRequestOptions,
          chatEndpoint,
        );
        const response = await window.fetch(chatEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [userMessage],
            conversation: requestConversation,
            ...requestProviderOptions,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`A2UI agent request failed: ${response.status}`);
        }

        const finalMessages = await readA2UIResponse(
          response,
          () => {
            setMessages((prev) => {
              const next = prev.slice();
              next[next.length - 1] = {
                role: 'ai',
                content: 'Streaming A2UI messages...',
              };
              return next;
            });
          },
          (nextMessages, meta) => {
            if (controller.signal.aborted) return;
            if (meta.final) {
              publishPreviewMessages(nextMessages);
              return;
            }
            publishStreamingPreviewMessages(nextMessages);
            setMessages((prev) => {
              const next = prev.slice();
              next[next.length - 1] = {
                role: 'ai',
                content:
                  `Streaming ${latestPreviewMessagesRef.current.length} A2UI message${
                    latestPreviewMessagesRef.current.length === 1 ? '' : 's'
                  }...`,
              };
              return next;
            });
          },
          (usage) => {
            if (controller.signal.aborted) return;
            setTokenUsage((prev) => ({
              promptTokens: prev.promptTokens + usage.promptTokens,
              completionTokens: prev.completionTokens + usage.completionTokens,
              totalTokens: prev.totalTokens + usage.totalTokens,
            }));
          },
          {
            parseDeltaMessages: false,
            publishText: false,
            onPreviewPayload: updatePreviewPayloadUrls,
          },
        );

        if (finalMessages.length === 0) {
          throw new Error('A2UI agent did not return valid messages');
        }

        await recordTurn({
          userMessage,
          assistantContent: JSON.stringify(finalMessages),
          a2uiMessages: finalMessages,
          previewMessages: finalMessages,
          previewPayloadUrls: latestPreviewPayloadUrlsRef.current,
        });
        setMessages((prev) => {
          const next = prev.slice();
          next[next.length - 1] = {
            role: 'ai',
            content: `✅ Rendered ${finalMessages.length} A2UI message${
              finalMessages.length === 1 ? '' : 's'
            } to Lynx Preview`,
          };
          next.push({
            role: 'json',
            content: 'Generated Output',
            payload: finalMessages,
          });
          return next;
        });
      } catch (e) {
        if (controller.signal.aborted) return;
        setMessages((prev) => {
          const next = prev.slice();
          next[next.length - 1] = {
            role: 'ai',
            content: `Generation failed: ${getErrorMessage(e)}`,
          };
          return next;
        });
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setIsGenerating(false);
      }
    })();
  }, [
    buildConversationContext,
    inputValue,
    isGenerating,
    publishPreviewMessages,
    publishStreamingPreviewMessages,
    providerRequestOptions,
    recordTurn,
    updatePreviewPayloadUrls,
  ]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent<unknown>) => {
      const frameWindow = previewFrameRef.current?.contentWindow;
      if (!frameWindow || e.source !== frameWindow) return;
      if (e.origin !== targetOriginForFrame(renderUrlRef.current)) return;
      if (!e.data || typeof e.data !== 'object') return;
      const msg = e.data as Record<string, unknown>;
      if (msg.type === 'A2UI_RENDER_READY') {
        if (bootstrappedRenderUrlRef.current === renderUrlRef.current) {
          postBootstrappedMessagesOnce();
          return;
        }
        publishPreviewMessages(latestPreviewMessagesRef.current);
        return;
      }
      if (msg.type !== 'A2UI_USER_ACTION') return;

      const action = msg.action as {
        name?: string;
        surfaceId?: string;
        context?: Record<string, unknown>;
      };
      const actionName = typeof action?.name === 'string'
        ? action.name
        : 'unknown';
      const payload = {
        surfaceId: typeof msg.surfaceId === 'string' ? msg.surfaceId : action
          ?.surfaceId,
        action,
      };
      const userActionMessage: ModelChatMessage = {
        role: 'user',
        content: `A2UI_USER_ACTION: ${JSON.stringify(payload)}`,
      };
      const requestConversation = buildConversationContext();

      // Abort any in-flight action stream so a stale request can no longer
      // mutate state or post into the preview iframe after a new action
      // arrives.
      actionAbortRef.current?.abort();
      const controller = new AbortController();
      actionAbortRef.current = controller;
      const signal = controller.signal;

      let pendingIndex = -1;
      let streamingIndex = -1;
      setMessages((prev) => {
        const next: ChatMessage[] = [
          ...prev,
          createActionForwardingStatus(actionName),
          {
            role: 'action' as const,
            content: `⚡ Action: ${actionName}`,
            payload: action,
          },
          {
            role: 'status' as const,
            tone: 'pending',
            content: (
              <>
                <span
                  className='chatMessageActionSpinner'
                  aria-hidden='true'
                />
                <span>Streaming response from agent...</span>
              </>
            ),
          },
        ];
        pendingIndex = next.length - 1;
        return next;
      });

      void (async () => {
        try {
          const actionEndpoint = getA2UIActionStreamEndpoint();
          const requestProviderOptions =
            filterProviderRequestOptionsForEndpoint(
              providerRequestOptionsRef.current,
              actionEndpoint,
            );
          const response = await window.fetch(actionEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'text/event-stream',
            },
            body: JSON.stringify({
              surfaceId: payload.surfaceId,
              action,
              conversation: requestConversation,
              ...requestProviderOptions,
            }),
            signal,
          });

          if (!response.ok) {
            const errPayload: unknown = await response.json().catch(
              () => ({}),
            );
            throw new Error(normalizeErrorPayload(errPayload));
          }

          let responseMessages: unknown[] = [];
          let responsePreviewPayloadUrls: PreviewPayloadUrls | null = null;

          await readA2UIResponse(
            response,
            (text) => {
              if (!text) return;
              if (signal.aborted) return;
              setMessages((prev) => {
                const next = prev.slice();
                if (pendingIndex < 0 || pendingIndex >= next.length) {
                  return next;
                }
                next[pendingIndex] = {
                  role: 'status' as const,
                  tone: 'pending',
                  content: (
                    <>
                      <span
                        className='chatMessageActionSpinner'
                        aria-hidden='true'
                      />
                      <span>
                        Streaming response from agent... {text.length} chars
                      </span>
                    </>
                  ),
                };
                return next;
              });
            },
            (msgs) => {
              if (signal.aborted) return;
              responseMessages = msgs;
              setMessages((prev) => {
                const next = prev.slice();
                if (streamingIndex < 0 || streamingIndex >= next.length) {
                  const insertAt = pendingIndex >= 0
                      && pendingIndex < next.length
                    ? pendingIndex + 1
                    : next.length;
                  next.splice(insertAt, 0, {
                    role: 'action' as const,
                    content: '✨ Streaming RESPONSE...',
                    payload: responseMessages,
                  });
                  streamingIndex = insertAt;
                  return next;
                }
                next[streamingIndex] = {
                  ...next[streamingIndex],
                  payload: responseMessages,
                };
                return next;
              });
              previewFrameRef.current?.contentWindow?.postMessage(
                { type: 'A2UI_ACTION_RESPONSE', messages: responseMessages },
                targetOriginForFrame(renderUrlRef.current),
              );
            },
            (usage) => {
              if (signal.aborted) return;
              setTokenUsage((prev) => ({
                promptTokens: prev.promptTokens + usage.promptTokens,
                completionTokens: prev.completionTokens
                  + usage.completionTokens,
                totalTokens: prev.totalTokens + usage.totalTokens,
              }));
            },
            {
              onPreviewPayload: (preview) => {
                responsePreviewPayloadUrls = preview;
              },
            },
          );

          if (signal.aborted) return;

          if (responseMessages.length === 0) {
            throw new Error('Agent returned no A2UI messages');
          }

          const count = responseMessages.length;
          const replayMessages = [
            ...latestPreviewMessagesRef.current,
            ...responseMessages,
          ];
          latestPreviewMessagesRef.current = replayMessages;
          setPreviewMessages(replayMessages);
          updatePreviewPayloadUrls(null);
          await recordTurn({
            userMessage: userActionMessage,
            assistantContent: JSON.stringify(responseMessages),
            a2uiMessages: responseMessages,
            previewMessages: replayMessages,
            previewPayloadUrls: responsePreviewPayloadUrls,
            snapshotPreviewPayloadUrls: null,
          });
          setMessages((prev) => {
            const next = prev.slice();
            if (pendingIndex >= 0 && pendingIndex < next.length) {
              next[pendingIndex] = createAgentRespondedStatus(count);
            }
            const finalCard: ChatMessage = {
              role: 'action' as const,
              content: `✅ Applied ${count} ${
                count === 1 ? 'message' : 'messages'
              } to Lynx Preview`,
              payload: responseMessages,
            };
            if (streamingIndex >= 0 && streamingIndex < next.length) {
              next[streamingIndex] = finalCard;
            } else {
              next.push(finalCard);
            }
            next.push(createPreviewReadyStatus());
            return next;
          });
        } catch (e) {
          if (signal.aborted) return;
          setMessages((prev) => {
            const next = prev.slice();
            if (pendingIndex >= 0 && pendingIndex < next.length) {
              next[pendingIndex] = {
                role: 'status' as const,
                tone: 'error',
                content: (
                  <>
                    <span className='chatMessageStatusIcon' aria-hidden='true'>
                      ❌
                    </span>
                    <span>
                      Action failed: {getErrorMessage(e)}
                    </span>
                  </>
                ),
              };
            }
            // Drop the streaming placeholder card on failure.
            if (streamingIndex >= 0 && streamingIndex < next.length) {
              next.splice(streamingIndex, 1);
            }
            return next;
          });
        } finally {
          if (actionAbortRef.current === controller) {
            actionAbortRef.current = null;
          }
        }
      })();
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      // Cancel any in-flight action stream when this effect tears down
      // (component unmount / hot reload) so its callbacks can't fire.
      actionAbortRef.current?.abort();
      actionAbortRef.current = null;
    };
  }, [
    buildConversationContext,
    postBootstrappedMessagesOnce,
    publishPreviewMessages,
    recordTurn,
    updatePreviewPayloadUrls,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleLoadExample = useCallback(
    (demo: StaticDemo) => {
      if (isGenerating) return;
      const messages = Array.isArray(demo.messages)
        ? (demo.messages as unknown[])
        : [];
      if (messages.length === 0) return;

      abortRef.current?.abort();
      actionAbortRef.current?.abort();

      // Synthetic user message keeps follow-up prompts in context (e.g.
      // "change the price to $99" sees what's on screen) while clearly
      // labeling the entry as an offline example load.
      const userMessage: ModelChatMessage = {
        role: 'user',
        content: `Load offline example: ${demo.title}${
          demo.description ? `. ${demo.description}` : ''
        }`,
      };
      const assistantContent = JSON.stringify(messages);

      setInputValue('');
      publishPreviewMessages(messages);

      setMessages([
        WELCOME_MESSAGE,
        {
          role: 'status' as const,
          tone: 'info',
          content: (
            <>
              <span className='chatMessageStatusIcon' aria-hidden='true'>
                ⚡
              </span>
              <span>
                Loaded offline example{' '}
                <code className='chatMessageStatusInline'>{demo.title}</code>
                {' '}
                — no API call made.
              </span>
            </>
          ),
        },
        {
          role: 'json',
          content: 'Recorded A2UI Stream',
          payload: assistantContent,
        },
      ]);

      void recordTurn({
        userMessage,
        assistantContent,
        a2uiMessages: messages,
        previewMessages: messages,
      });
    },
    [isGenerating, publishPreviewMessages, recordTurn],
  );

  const handleCreateConversation = useCallback(() => {
    void createNew();
  }, [createNew]);

  const handleSwitchConversation = useCallback((id: string) => {
    if (isGenerating) return;
    abortRef.current?.abort();
    actionAbortRef.current?.abort();
    void switchTo(id);
  }, [isGenerating, switchTo]);

  const handleRenameConversation = useCallback((id: string, title: string) => {
    void rename(id, title);
  }, [rename]);

  const handleRemoveConversation = useCallback((id: string) => {
    setDeleteConversationId(id);
  }, []);

  const deleteConversationTitle = useMemo(
    () =>
      conversations.find((item) => item.id === deleteConversationId)?.title
        ?? 'this conversation',
    [conversations, deleteConversationId],
  );

  const handleCancelDeleteConversation = useCallback(() => {
    setDeleteConversationId(null);
  }, []);

  const handleConfirmDeleteConversation = useCallback(() => {
    const id = deleteConversationId;
    if (!id) return;
    setDeleteConversationId(null);
    void remove(id);
  }, [deleteConversationId, remove]);

  return (
    <div
      ref={pageRef}
      className={isPanelResizing ? 'chatPage resizing' : 'chatPage'}
      data-active-tab={activeMobileTab}
    >
      <CopyToast toast={copyToast} />
      <ConfirmDialog
        open={deleteConversationId !== null}
        title='Delete conversation?'
        description={`"${deleteConversationTitle}" will be removed from this browser. This cannot be undone.`}
        confirmLabel='Delete'
        cancelLabel='Keep'
        tone='danger'
        onCancel={handleCancelDeleteConversation}
        onConfirm={handleConfirmDeleteConversation}
      />

      <div className='chatPageBody'>
        <ConversationListPanel
          conversations={conversations}
          activeId={activeId}
          disabled={!isReady || isGenerating}
          isPersistent={isPersistent}
          onCreate={handleCreateConversation}
          onSwitch={handleSwitchConversation}
          onRename={handleRenameConversation}
          onRemove={handleRemoveConversation}
        />

        <div className='chatPanel' style={chatPanelStyle}>
          <PageHeader
            className='chatHeader'
            titleClassName='chatHeaderTitle'
            descriptionClassName='chatHeaderSub'
            title='Create'
            description='Describe the UI you want to build. Share the structure, interactions, or visual style you want to explore.'
            topContent={
              <>
                <span className='constructionBadge'>
                  {hasProviderOverride ? 'Custom Provider' : 'Online Agent'}
                </span>
                {tokenUsage.totalTokens > 0
                  ? (
                    <span
                      className='chatTokenUsageBadge'
                      title={`Prompt: ${tokenUsage.promptTokens} · Completion: ${tokenUsage.completionTokens} · Total: ${tokenUsage.totalTokens}`}
                    >
                      <span className='chatTokenUsageItem'>
                        Prompt {formatTokenCount(tokenUsage.promptTokens)}
                      </span>
                      <span className='chatTokenUsageItem'>
                        Output {formatTokenCount(tokenUsage.completionTokens)}
                      </span>
                      <span className='chatTokenUsageItem chatTokenUsageTotal'>
                        Total {formatTokenCount(tokenUsage.totalTokens)}
                      </span>
                    </span>
                  )
                  : null}
              </>
            }
          />
          <div
            className='chatMessages'
            ref={chatMessagesRef}
            onScroll={handleChatScroll}
          >
            {messages.map((msg, i) => {
              const baseClassName = (() => {
                if (msg.role === 'user') return 'chatMessageUser';
                if (msg.role === 'action') return 'chatMessageAction';
                if (msg.role === 'json') return 'chatMessageJson';
                if (msg.role === 'status') {
                  return `chatMessageStatus chatMessageStatus-${
                    msg.tone ?? 'info'
                  }`;
                }
                return 'chatMessageAI';
              })();

              const hasPayload = msg.payload !== undefined;
              const payloadStr = hasPayload
                ? safeStringifyPayload(msg.payload)
                : '';
              const isAppliedActionResponse = msg.role === 'action'
                && typeof msg.content === 'string'
                && msg.content.startsWith('✅ Applied ');
              const isActionRequest = msg.role === 'action'
                && typeof msg.content === 'string'
                && msg.content.startsWith('⚡ Action:');

              const className = msg.role === 'action'
                  && hasPayload
                ? `${baseClassName} chatMessageActionExpanded`
                : baseClassName;

              return (
                <div key={i} className={`chatMessage ${className}`}>
                  <div className='chatMessageBody'>
                    <span>{msg.content}</span>
                    {(msg.role === 'json' || isAppliedActionResponse)
                        && hasPayload
                      ? (
                        <button
                          type='button'
                          className='chatJsonCopyButton'
                          onClick={() => handleCopyText(payloadStr)}
                        >
                          Copy all
                        </button>
                      )
                      : null}
                  </div>
                  {hasPayload
                    ? (
                      <JsonPayloadViewer
                        payload={msg.payload}
                        onCopy={handleCopyText}
                        singleBlock={isActionRequest}
                      />
                    )
                    : null}
                </div>
              );
            })}
            {isGenerating && previewMessages && previewMessages.length > 0
              ? (
                <div className='chatGeneratedJson'>
                  <div className='chatGeneratedJsonTitle'>
                    <span>Generated Output</span>
                    <button
                      type='button'
                      className='chatJsonCopyButton'
                      onClick={() =>
                        handleCopyText(safeStringifyPayload(previewMessages))}
                    >
                      Copy all
                    </button>
                  </div>
                  <JsonPayloadViewer
                    payload={previewMessages}
                    onCopy={handleCopyText}
                  />
                </div>
              )
              : null}
            <div ref={messagesEndRef} />
          </div>
          <div className='chatInputArea'>
            {messages.length === 1
              ? (
                <>
                  <InstantExamplesStrip
                    protocol={protocol}
                    theme={theme}
                    disabled={isGenerating}
                    onSelectExample={handleLoadExample}
                    onBrowseAllHref={`#/${protocol.name}/examples`}
                  />
                  <div className='promptSuggestions'>
                    <div className='promptSuggestionsHeader'>
                      <span className='promptSuggestionsLabel'>
                        <span
                          className='promptSuggestionsLabelDot'
                          aria-hidden='true'
                        />
                        Describe with a prompt
                        <span className='promptSuggestionsLabelHint'>
                          · uses online agent
                        </span>
                      </span>
                    </div>
                    <div className='promptSuggestionsRail'>
                      {SUGGESTED_PROMPTS.map((p) => (
                        <button
                          key={p.label}
                          type='button'
                          className='chatSuggestionChip'
                          disabled={isGenerating}
                          onClick={() => setInputValue(p.text)}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )
              : null}
            <div className='chatComposer'>
              <textarea
                className='chatInput'
                aria-label='Describe the UI to generate'
                placeholder='Describe the UI, interaction, data, or style you want to generate...'
                value={inputValue}
                rows={3}
                disabled={isGenerating}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              {providerSettings.preset === 'custom'
                ? (
                  <div className='chatProviderConfig'>
                    <input
                      className='chatProviderInputField chatProviderInputFieldUrl'
                      aria-label='Provider base URL'
                      type='text'
                      placeholder='Base URL'
                      value={providerSettings.baseURL}
                      disabled={isGenerating}
                      onChange={(e) =>
                        setProviderSettings((prev) => ({
                          ...prev,
                          baseURL: e.target.value,
                        }))}
                    />
                    <input
                      className='chatProviderInputField'
                      aria-label='Provider model'
                      type='text'
                      placeholder='Model'
                      value={providerSettings.model}
                      disabled={isGenerating}
                      onChange={(e) =>
                        setProviderSettings((prev) => ({
                          ...prev,
                          model: e.target.value,
                        }))}
                    />
                    <input
                      className='chatProviderInputField'
                      aria-label='Provider API key'
                      type='password'
                      placeholder='API key for local endpoint'
                      value={providerSettings.apiKey}
                      disabled={isGenerating}
                      onChange={(e) =>
                        setProviderSettings((prev) => ({
                          ...prev,
                          apiKey: e.target.value,
                        }))}
                    />
                  </div>
                )
                : null}
              <div className='chatComposerFooter'>
                <div className='chatProviderControl'>
                  <span className='chatProviderStatus' aria-hidden='true' />
                  <select
                    className='chatProviderSelect'
                    aria-label='Provider preset'
                    value={providerSettings.preset}
                    disabled={isGenerating}
                    title={`Provider: ${
                      compactProviderLabel(providerSettings)
                    }`}
                    onChange={(e) =>
                      setProviderSettings((prev) => ({
                        ...prev,
                        preset: e.target.value as ProviderPresetId,
                      }))}
                  >
                    {PROVIDER_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className='chatSendBtn'
                  type='button'
                  disabled={isGenerating || inputValue.trim().length === 0}
                  onClick={handleSend}
                >
                  <span className='chatSendIcon' aria-hidden='true'>↖</span>
                  {isGenerating ? 'Generating' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <PanelResizeHandle
          isActive={isPanelResizing}
          isCompactLayout={isCompactLayout}
          ariaLabel='Resize Create and preview panels'
          onPointerDown={handlePanelResizeStart}
        />

        <PreviewPanel
          className='previewPanel'
          style={previewPanelStyle}
          title='Lynx Preview'
          showPreviewModeSwitch
          showSimulationBar={false}
          previewSource={previewSource}
        >
          <PreviewViewport
            src={renderUrl}
            iframeRef={previewFrameRef}
            onLoad={handlePreviewLoad}
            retainPreviousFrame
            emptyIcon='💬'
            emptyTitle='Send a message to generate UI'
            emptySubTitle='Generated components will be previewed here'
          />
        </PreviewPanel>
      </div>

      <MobileTabBar
        activeTab={activeMobileTab}
        onChange={setActiveMobileTab}
        editLabel='Chat'
      />
    </div>
  );
}
