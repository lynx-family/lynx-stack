// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { json } from '@codemirror/lang-json';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import './AIChatPage.css';

import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { ConversationListPanel } from '../components/ConversationListPanel.js';
import { PanelResizeHandle } from '../components/PanelResizeHandle.js';
import { PreviewPanel } from '../components/PreviewPanel.js';
import { PreviewViewport } from '../components/PreviewViewport.js';
import { useConversation } from '../hooks/useConversation.js';
import type { ModelChatMessage } from '../hooks/useConversation.js';
import { useResizablePanels } from '../hooks/useResizablePanels.js';
import { DEFAULT_A2UI_DEMO_URL } from '../utils/demoUrl.js';
import type { Protocol } from '../utils/protocol.js';
import { buildRenderUrl } from '../utils/renderUrl.js';

interface ChatMessage {
  role: 'user' | 'ai' | 'action' | 'json' | 'status';
  content: string | React.ReactNode;
  payload?: unknown;
  payloadLabel?: string;
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
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
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
const jsonExtensions = [json(), EditorView.lineWrapping];

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
    // re-pretty-print it so CodeMirror can show it across multiple lines.
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
  onMessages: (messages: unknown[]) => void,
  onUsage?: (usage: TokenUsage) => void,
  options: { publishPartialMessages?: boolean } = {},
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
    }
    onMessages(messages);
    return messages;
  }

  const reader = response.body?.getReader();
  if (!reader) return [];

  const decoder = new TextDecoder();
  let buffer = '';
  let generatedText = '';
  let latestMessages: unknown[] = [];
  const publishPartialMessages = options.publishPartialMessages ?? true;

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
          onText(generatedText);
          if (!publishPartialMessages) continue;
          const completed = parseCompletedArrayItems(generatedText);
          if (completed.length > latestMessages.length) {
            latestMessages = completed;
            onMessages(latestMessages);
          }
        }
        continue;
      }

      if (parsed.event === 'done') {
        const doneMessages = normalizeA2UIMessages(parsed.data);
        if (parsed.data && typeof parsed.data === 'object') {
          const usage = parseUsage((parsed.data as A2UIDonePayload).usage);
          if (usage) onUsage?.(usage);
        }
        if (doneMessages.length > 0) {
          latestMessages = doneMessages;
          onMessages(latestMessages);
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
      'Create a product card for a limited-edition sneaker. Include name, a photo, price ($189), a short description, and a "Buy Now" button. When tapped, show an order confirmation with a fake order number and estimated delivery.',
  },
  {
    label: '⚡ Quiz card with actions',
    text:
      'Create a trivia quiz card. Show a question "Which shape has three sides?" with 4 answer buttons: Triangle, Square, Circle, Hexagon. When the user taps an answer, show whether it is correct with a brief explanation.',
  },
];

function buildChatMessagesFromHistory(
  history: ModelChatMessage[],
): ChatMessage[] {
  if (history.length === 0) return [WELCOME_MESSAGE];
  const next: ChatMessage[] = [WELCOME_MESSAGE];
  for (const message of history) {
    if (message.role === 'user') {
      next.push({ role: 'user', content: message.content });
      continue;
    }
    if (message.role === 'assistant') {
      next.push({
        role: 'json',
        content: 'Generated Output',
        payload: message.content,
        payloadLabel: 'JSON',
      });
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
    recordTurn,
    remove,
    rename,
    switchTo,
  } = conversation;
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState<string>('');
  const [renderUrl, setRenderUrl] = useState<string>('');
  const [generatedJson, setGeneratedJson] = useState<string>('');
  const [previewMessages, setPreviewMessages] = useState<unknown[] | null>(
    null,
  );
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [deleteConversationId, setDeleteConversationId] = useState<
    string | null
  >(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const followBottomRef = useRef<boolean>(true);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const actionAbortRef = useRef<AbortController | null>(null);
  const hydratedActiveIdRef = useRef<string | null>(null);
  const latestPreviewMessagesRef = useRef<unknown[]>([]);
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
    initialSecondarySize: 480,
  });

  useEffect(() => {
    // Re-run on every render so streaming text growth & async editor mounts
    // both keep the chat pinned to the latest message.
    void messages;
    void generatedJson;
    void isGenerating;
    if (!followBottomRef.current) return;
    const container = chatMessagesRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [messages, generatedJson, isGenerating]);

  useEffect(() => {
    const container = chatMessagesRef.current;
    if (!container) return;
    if (typeof ResizeObserver === 'undefined') return;
    // Async-mounted CodeMirror editors and streaming JSON expand the container
    // height after React commits. ResizeObserver fires for those layout shifts
    // and lets us keep the chat pinned to the bottom while the user is in
    // "follow" mode.
    const sizeObserver = new ResizeObserver(() => {
      if (!followBottomRef.current) return;
      container.scrollTop = container.scrollHeight;
    });
    sizeObserver.observe(container);
    Array.from(container.children).forEach((child: Element) => {
      sizeObserver.observe(child);
    });
    // Newly inserted message rows must also be observed so their delayed
    // CodeMirror layout still triggers the bottom-pin behavior. We use a
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
    // 32px hysteresis: small upward scrolls inside CodeMirror still count as
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
    };
  }, [previewMessages, protocol, theme]);

  const publishPreviewMessages = useCallback(
    (nextMessages: unknown[]) => {
      if (nextMessages.length === 0) return;
      latestPreviewMessagesRef.current = nextMessages;
      setPreviewMessages(nextMessages);

      const initData = {
        protocol,
        demoUrl: DEFAULT_A2UI_DEMO_URL,
        messages: nextMessages,
        theme,
        instant: true,
        liveAction: nextMessages.length > 0,
      };

      setRenderUrl((current) => {
        if (current) {
          previewFrameRef.current?.contentWindow?.postMessage(
            { type: 'INIT_LYNX_VIEW', data: initData },
            window.location.origin,
          );
          return current;
        }

        return buildRenderUrl(initData, baseUrl);
      });
    },
    [baseUrl, protocol, theme],
  );

  const handlePreviewLoad = useCallback(() => {
    publishPreviewMessages(latestPreviewMessagesRef.current);
  }, [publishPreviewMessages]);

  useEffect(() => {
    if (!isReady || isGenerating) return;
    if (hydratedActiveIdRef.current === activeId) return;
    hydratedActiveIdRef.current = activeId;
    setMessages(buildChatMessagesFromHistory(persistedMessages));
    setGeneratedJson('');
    setTokenUsage({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
    if (persistedPreviewMessages.length > 0) {
      publishPreviewMessages(persistedPreviewMessages);
    } else {
      latestPreviewMessagesRef.current = [];
      setPreviewMessages(null);
      setRenderUrl('');
    }
  }, [
    activeId,
    isReady,
    isGenerating,
    persistedMessages,
    persistedPreviewMessages,
    publishPreviewMessages,
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
    setGeneratedJson('');
    setPreviewMessages(null);
    latestPreviewMessagesRef.current = [];
    setTokenUsage({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
    setIsGenerating(true);

    void (async () => {
      try {
        const response = await window.fetch(getA2UIChatEndpoint(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [userMessage],
            conversation: requestConversation,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`A2UI agent request failed: ${response.status}`);
        }

        let latestText = '';
        const finalMessages = await readA2UIResponse(
          response,
          (nextText) => {
            latestText = nextText;
            setGeneratedJson(nextText);
            setMessages((prev) => {
              const next = prev.slice();
              next[next.length - 1] = {
                role: 'ai',
                content: `Generating A2UI JSON... ${nextText.length} chars`,
              };
              return next;
            });
          },
          publishPreviewMessages,
          (usage) => {
            if (controller.signal.aborted) return;
            setTokenUsage((prev) => ({
              promptTokens: prev.promptTokens + usage.promptTokens,
              completionTokens: prev.completionTokens + usage.completionTokens,
              totalTokens: prev.totalTokens + usage.totalTokens,
            }));
          },
          { publishPartialMessages: false },
        );

        if (finalMessages.length === 0) {
          throw new Error('A2UI agent did not return valid messages');
        }

        const assistantContent = latestText.length > 0
          ? latestText
          : JSON.stringify(finalMessages);
        await recordTurn({
          userMessage,
          assistantContent,
          a2uiMessages: finalMessages,
          previewMessages: finalMessages,
        });
        setMessages((prev) => {
          const next = prev.slice();
          next[next.length - 1] = {
            role: 'ai',
            content: `Done. Rendered ${finalMessages.length} A2UI message${
              finalMessages.length === 1 ? '' : 's'
            }.`,
          };
          next.push({
            role: 'json',
            content: 'Generated Output',
            payload: assistantContent,
            payloadLabel: 'JSON',
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
    recordTurn,
  ]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent<unknown>) => {
      if (!e.data || typeof e.data !== 'object') return;
      const msg = e.data as Record<string, unknown>;
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
          {
            role: 'status' as const,
            tone: 'info',
            content: (
              <>
                <span className='chatMessageStatusIcon' aria-hidden='true'>
                  📤
                </span>
                <span>
                  Lynx Preview triggered{' '}
                  <code className='chatMessageStatusInline'>{actionName}</code>
                  , forwarding request to agent...
                </span>
              </>
            ),
          },
          {
            role: 'action' as const,
            content: `⚡ Action: ${actionName}`,
            payload: action,
            payloadLabel: 'REQUEST',
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
          const response = await window.fetch(getA2UIActionStreamEndpoint(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'text/event-stream',
            },
            body: JSON.stringify({
              surfaceId: payload.surfaceId,
              action,
              conversation: requestConversation,
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
          let latestActionText = '';

          await readA2UIResponse(
            response,
            (text) => {
              if (!text) return;
              if (signal.aborted) return;
              latestActionText = text;
              setMessages((prev) => {
                const next = prev.slice();
                if (streamingIndex < 0 || streamingIndex >= next.length) {
                  // First non-empty delta — insert the streaming card right
                  // after the pending status row so the card appears only
                  // when there is actual data to show.
                  const insertAt = pendingIndex >= 0
                      && pendingIndex < next.length
                    ? pendingIndex + 1
                    : next.length;
                  next.splice(insertAt, 0, {
                    role: 'action' as const,
                    content: '✨ Streaming RESPONSE...',
                    payload: text,
                    payloadLabel: 'RESPONSE (streaming)',
                  });
                  streamingIndex = insertAt;
                  return next;
                }
                next[streamingIndex] = {
                  ...next[streamingIndex],
                  payload: text,
                };
                return next;
              });
            },
            (msgs) => {
              if (signal.aborted) return;
              responseMessages = msgs;
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
          );

          if (signal.aborted) return;

          if (responseMessages.length === 0) {
            throw new Error('Agent returned no A2UI messages');
          }

          previewFrameRef.current?.contentWindow?.postMessage(
            { type: 'A2UI_ACTION_RESPONSE', messages: responseMessages },
            window.location.origin,
          );

          const count = responseMessages.length;
          const assistantContent = latestActionText.length > 0
            ? latestActionText
            : JSON.stringify(responseMessages);
          await recordTurn({
            userMessage: userActionMessage,
            assistantContent,
            a2uiMessages: responseMessages,
            previewMessages: responseMessages,
          });
          setMessages((prev) => {
            const next = prev.slice();
            if (pendingIndex >= 0 && pendingIndex < next.length) {
              next[pendingIndex] = {
                role: 'status' as const,
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
            const finalCard: ChatMessage = {
              role: 'action' as const,
              content: `✅ Applied ${count} ${
                count === 1 ? 'message' : 'messages'
              } to Lynx Preview`,
              payload: responseMessages,
              payloadLabel: 'RESPONSE',
            };
            if (streamingIndex >= 0 && streamingIndex < next.length) {
              next[streamingIndex] = finalCard;
            } else {
              next.push(finalCard);
            }
            next.push({
              role: 'status' as const,
              tone: 'info',
              content: (
                <>
                  <span className='chatMessageStatusIcon' aria-hidden='true'>
                    ✨
                  </span>
                  <span>UI updated. Ready for the next action.</span>
                </>
              ),
            });
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
  }, [buildConversationContext, recordTurn]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSend();
      }
    },
    [handleSend],
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
    >
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
        <div className='chatHeader'>
          <div className='chatHeaderTitleRow'>
            <h2 className='chatHeaderTitle'>Create</h2>
            <span className='constructionBadge'>Online Agent</span>
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
          </div>
          <p className='chatHeaderSub'>Describe the UI you want to build</p>
        </div>

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

            const payloadStr = msg.payload === undefined
              ? null
              : safeStringifyPayload(msg.payload);

            const className = msg.role === 'action' && payloadStr !== null
              ? `${baseClassName} chatMessageActionExpanded`
              : baseClassName;

            return (
              <div key={i} className={`chatMessage ${className}`}>
                <div className='chatMessageBody'>{msg.content}</div>
                {payloadStr === null
                  ? null
                  : (
                    <div className='chatMessagePayload'>
                      {msg.payloadLabel
                        ? (
                          <div className='chatMessagePayloadLabel'>
                            {msg.payloadLabel}
                          </div>
                        )
                        : null}
                      <CodeMirror
                        className='chatMessagePayloadEditor'
                        value={payloadStr}
                        extensions={jsonExtensions}
                        editable={false}
                        basicSetup={{
                          lineNumbers: true,
                          foldGutter: true,
                          bracketMatching: true,
                          closeBrackets: false,
                          autocompletion: false,
                        }}
                      />
                    </div>
                  )}
              </div>
            );
          })}
          {isGenerating && generatedJson
            ? (
              <div className='chatGeneratedJson'>
                <div className='chatGeneratedJsonTitle'>
                  Generated Output
                  <span className='chatGeneratedJsonBadge'>JSON</span>
                </div>
                <CodeMirror
                  className='chatGeneratedJsonEditor'
                  value={generatedJson}
                  extensions={jsonExtensions}
                  editable={false}
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    bracketMatching: true,
                    closeBrackets: false,
                    autocompletion: false,
                  }}
                />
              </div>
            )
            : null}
          <div ref={messagesEndRef} />
        </div>

        <div className='chatInputArea'>
          {messages.length === 1
            ? (
              <div className='chatSuggestionsRow'>
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
            )
            : null}
          <div className='chatInputRow'>
            <input
              className='chatInput'
              type='text'
              placeholder='Describe the UI you want to generate...'
              value={inputValue}
              disabled={isGenerating}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className='chatSendBtn'
              type='button'
              disabled={isGenerating}
              onClick={handleSend}
            >
              {isGenerating ? 'Sending' : 'Send'}
            </button>
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
  );
}
