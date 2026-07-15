// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { ChatWorkspace } from './ChatWorkspace.js';
import {
  EMPTY_CHAT_TOKEN_USAGE,
  addTokenUsage,
  createChatHost,
  formatTokenCount,
  parseSseFrame,
  targetOriginForUrl,
} from './shared.js';
import type {
  ChatArtifact,
  ChatHttpRequest,
  ChatMessageIcon,
  ChatMessageModel,
  ChatProtocolAdapter,
  ChatSettingsAdapter,
  ChatStreamAdapter,
  ChatStreamEmission,
  ChatTokenUsage,
} from './type.js';
import { Button } from '../../components/Button.js';
import { useCopyToast } from '../../components/CopyToast.js';
import { Send, Sparkles, Zap } from '../../components/Icon.js';
import type { MobilePaneTab } from '../../components/MobileTabBar.js';
import type {
  PreviewMetricName,
  PreviewPanelMetricItem,
} from '../../components/PreviewPanel.js';
import { PreviewViewport } from '../../components/PreviewViewport.js';
import { useConversation } from '../../hooks/useConversation.js';
import type { ModelChatMessage } from '../../hooks/useConversation.js';
import { useResizablePanels } from '../../hooks/useResizablePanels.js';
import {
  loadConversation,
  saveConversationSharePayload,
} from '../../storage/conversationRepo.js';
import {
  isSharedConversationDoc,
  resolveSharedConversationProtocol,
  serializeConversation,
} from '../../storage/sharedConversation.js';
import type {
  PreviewPayloadUrls,
  PreviewPerformanceMetrics,
} from '../../storage/types.js';
import { copyToClipboard } from '../../utils/clipboard.js';
import type { Protocol } from '../../utils/protocol.js';
import {
  buildConversationShareUrl,
  clearImportConversationParam,
  publishConversation,
  readImportConversationParam,
  resolveTrustedConversationImportUrl,
} from '../../utils/shareConversation.js';

const DESKTOP_PREVIEW_MIN_WIDTH = 360;
const DESKTOP_CHAT_MIN_WIDTH = 360;
const COMPACT_CHAT_MIN_HEIGHT = 280;
const COMPACT_PREVIEW_MIN_HEIGHT = 320;
const RESIZE_BREAKPOINT = 980;

interface ChatControllerProps<
  TOutput,
  TStreamState,
  TSettings,
  TExample,
  TAction,
  TActionStreamState,
> {
  adapter: ChatProtocolAdapter<
    TOutput,
    TStreamState,
    TSettings,
    TExample,
    TAction,
    TActionStreamState
  >;
  protocol: Protocol;
  theme: 'light' | 'dark';
}

interface ConsumeResponseOptions<TOutput> {
  signal: AbortSignal;
  onEmission: (emission: ChatStreamEmission<TOutput>) => void;
}

type LiveMessageType = 'A2UI_LIVE_MESSAGES' | 'A2UI_ACTION_RESPONSE';

interface PendingLiveOutput<TOutput> {
  type: LiveMessageType;
  output: TOutput;
}

type BrowserResponse = Awaited<ReturnType<typeof window.fetch>>;

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${
    Math.random().toString(36).slice(2)
  }`;
}

function safeStringifyPayload(value: unknown): string {
  if (typeof value === 'string') {
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function requestInit(
  request: ChatHttpRequest,
  signal: AbortSignal,
): RequestInit {
  const body = request.body === undefined
    ? undefined
    : (typeof request.body === 'string'
      ? request.body
      : JSON.stringify(request.body));
  return {
    method: request.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...request.headers,
    },
    body,
    signal,
  };
}

async function consumeResponse<TState, TOutput>(
  response: BrowserResponse,
  stream: ChatStreamAdapter<TState, TOutput>,
  options: ConsumeResponseOptions<TOutput>,
): Promise<TOutput> {
  const { onEmission, signal } = options;
  let state = stream.initial();
  let finalOutput: TOutput | null = null;

  const applyEmissions = (
    emissions: readonly ChatStreamEmission<TOutput>[],
  ) => {
    for (const emission of emissions) {
      if (signal.aborted) return;
      if (emission.type === 'final') finalOutput = emission.output;
      onEmission(emission);
    }
  };

  const applyFrame = (frame: string) => {
    const parsed = parseSseFrame(frame);
    if (!parsed) return;
    if (parsed.event === 'error') {
      throw new Error(stream.error(parsed.data));
    }
    // This is the protocol state reducer, not Array.prototype.reduce.
    // eslint-disable-next-line unicorn/no-array-callback-reference
    const step = stream.reduce(state, parsed);
    state = step.state;
    applyEmissions(step.emissions);
  };

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('text/event-stream')) {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('The response stream is unavailable');

    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (signal.aborted) throw new Error('Request aborted');
      buffer += decoder.decode(value, { stream: !done });
      const frames = buffer.split(/\r?\n\r?\n/u);
      buffer = frames.pop() ?? '';
      for (const frame of frames) applyFrame(frame);
      if (done) break;
    }
    if (buffer.trim()) applyFrame(buffer);
  } else {
    const payload: unknown = await response.json().catch(() => ({}));
    const step = stream.fromJson(payload);
    state = step.state;
    applyEmissions(step.emissions);
  }

  const output = finalOutput ?? stream.finish(state);
  if (output === null) {
    throw new Error(stream.error({ message: 'The agent returned no output' }));
  }
  return output;
}

function JsonPayloadViewer(props: {
  payload: unknown;
  layout?: 'single' | 'chunks';
  onCopy: (text: string) => void;
}) {
  const { layout = 'chunks', onCopy, payload } = props;
  if (layout === 'single') {
    const text = safeStringifyPayload(payload);
    return (
      <div className='chatMessagePayload'>
        <div className='chatMessageSingleChunk'>
          <div className='chatMessageChunkHeader'>
            <span className='chatMessageChunkIndex'>Request</span>
            <button
              type='button'
              className='chatJsonCopyButton'
              onClick={() => onCopy(text)}
            >
              Copy
            </button>
          </div>
          <pre className='chatMessageChunkJson'>{text}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className='chatMessagePayload'>
      <div className='chatMessageChunks'>
        {payloadToChunks(payload).map((chunk, index) => {
          const text = safeStringifyPayload(chunk);
          return (
            <div className='chatMessageChunk' key={index}>
              <div className='chatMessageChunkHeader'>
                <span className='chatMessageChunkIndex'>#{index + 1}</span>
                <button
                  type='button'
                  className='chatJsonCopyButton'
                  onClick={() => onCopy(text)}
                >
                  Copy
                </button>
              </div>
              <pre className='chatMessageChunkJson'>{text}</pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MessageStatusIcon(props: { icon: ChatMessageIcon | undefined }) {
  switch (props.icon) {
    case 'spinner':
      return <span className='chatMessageActionSpinner' aria-hidden='true' />;
    case 'sparkles':
      return (
        <span className='chatMessageStatusIcon' aria-hidden='true'>
          <Sparkles size={13} strokeWidth={2} />
        </span>
      );
    case 'zap':
      return (
        <span className='chatMessageStatusIcon' aria-hidden='true'>
          <Zap size={13} strokeWidth={2} />
        </span>
      );
    case 'error':
      return (
        <span className='chatMessageStatusIcon' aria-hidden='true'>
          !
        </span>
      );
    default:
      return null;
  }
}

function formatMetricValue(value: number | undefined): string {
  return typeof value === 'number' ? `${Math.round(value)}ms` : '...';
}

function MessageMetrics(props: { metrics: PreviewPerformanceMetrics }) {
  const items = [
    { key: 'fcpMs', label: 'FCP', value: props.metrics.fcpMs },
    { key: 'fmpMs', label: 'FMP', value: props.metrics.fmpMs },
    { key: 'ttiMs', label: 'TTI', value: props.metrics.ttiMs },
    {
      key: 'agentOutputMs',
      label: 'Agent',
      value: props.metrics.agentOutputMs,
    },
    { key: 'renderMs', label: 'Render', value: props.metrics.renderMs },
  ].filter((item) => typeof item.value === 'number');
  if (items.length === 0) return null;
  return (
    <div className='chatMessageMetrics' aria-label='Metrics'>
      {items.map((item) => (
        <span className='chatMessageMetricItem' key={item.key}>
          <span className='chatMessageMetricName'>{item.label}</span>
          <span className='chatMessageMetricValue'>
            {formatMetricValue(item.value)}
          </span>
        </span>
      ))}
    </div>
  );
}

function MessageList(props: {
  messages: readonly ChatMessageModel[];
  onCopy: (text: string) => void;
}) {
  const { messages, onCopy } = props;
  return (
    <>
      {messages.map((message, index) => {
        const roleClassName = (() => {
          if (message.kind === 'user') return 'chatMessageUser';
          if (message.kind === 'action') {
            return message.payload === undefined
              ? 'chatMessageAction'
              : 'chatMessageAction chatMessageActionExpanded';
          }
          if (message.kind === 'output') return 'chatMessageJson';
          if (message.kind === 'status') {
            return `chatMessageStatus chatMessageStatus-${
              message.tone ?? 'info'
            }`;
          }
          return 'chatMessageAI';
        })();
        const payloadText = message.payload === undefined
          ? ''
          : safeStringifyPayload(message.payload);
        return (
          <div
            className={`chatMessage ${roleClassName}${
              message.side === 'right' ? ' chatMessageRight' : ''
            }`}
            key={message.id ?? index}
          >
            <div className='chatMessageBody'>
              <MessageStatusIcon icon={message.icon} />
              <span>
                {message.text}
                {message.code
                  ? (
                    <>
                      {' '}
                      <code className='chatMessageStatusInline'>
                        {message.code}
                      </code>
                    </>
                  )
                  : null}
              </span>
              {message.payload === undefined
                ? null
                : (
                  <button
                    type='button'
                    className='chatJsonCopyButton'
                    onClick={() => onCopy(payloadText)}
                  >
                    Copy all
                  </button>
                )}
            </div>
            {message.payload === undefined
              ? null
              : (
                <JsonPayloadViewer
                  payload={message.payload}
                  layout={message.payloadLayout}
                  onCopy={onCopy}
                />
              )}
            {message.metrics
              ? <MessageMetrics metrics={message.metrics} />
              : null}
          </div>
        );
      })}
    </>
  );
}

function ArtifactViewer(props: {
  artifact: ChatArtifact;
  onCopy: (text: string) => void;
}) {
  const { artifact, onCopy } = props;
  const [activeViewId, setActiveViewId] = useState(
    () => artifact.views[0]?.id ?? '',
  );
  const activeView = artifact.views.find((view) => view.id === activeViewId)
    ?? artifact.views[0];

  useEffect(() => {
    if (artifact.views.some((view) => view.id === activeViewId)) return;
    setActiveViewId(artifact.views[0]?.id ?? '');
  }, [activeViewId, artifact.views]);

  if (!activeView) return null;
  return (
    <div className='chatGeneratedJson chatArtifact'>
      <div className='chatGeneratedJsonTitle chatArtifactHeader'>
        <div className='chatArtifactTitle'>
          <span>{artifact.title}</span>
          {artifact.meta
            ? <span className='chatArtifactMeta'>{artifact.meta}</span>
            : null}
        </div>
        <div className='chatArtifactActions'>
          {artifact.views.length > 1
            ? (
              <div className='previewModeSwitch chatArtifactSwitch'>
                {artifact.views.map((view) => (
                  <button
                    key={view.id}
                    type='button'
                    className={view.id === activeView.id
                      ? 'previewModeBtn active'
                      : 'previewModeBtn'}
                    onClick={() => setActiveViewId(view.id)}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
            )
            : null}
          <button
            type='button'
            className='chatJsonCopyButton'
            onClick={() => onCopy(activeView.text)}
          >
            Copy
          </button>
        </div>
      </div>
      <pre className='chatMessageChunkJson chatArtifactCodeBlock'>
        {activeView.text}
      </pre>
    </div>
  );
}

function mergeMetrics(
  current: PreviewPerformanceMetrics,
  patch: PreviewPerformanceMetrics,
): PreviewPerformanceMetrics {
  const next = { ...current };
  for (
    const key of [
      'fcpMs',
      'fmpMs',
      'ttiMs',
      'agentOutputMs',
      'renderMs',
    ] as const
  ) {
    const value = patch[key];
    if (typeof value === 'number' && Number.isFinite(value)) next[key] = value;
  }
  return next;
}

function previewMetricPatch(
  metric: PreviewMetricName,
  value: number,
): PreviewPerformanceMetrics {
  if (metric === 'fcp') return { fcpMs: value };
  if (metric === 'fmp') return { fmpMs: value };
  if (metric === 'tti') return { ttiMs: value };
  return { renderMs: value };
}

function readInitialSettings<TSettings>(
  adapter: { settings?: ChatSettingsAdapter<TSettings> },
): TSettings {
  const settings = adapter.settings;
  if (!settings) return undefined as TSettings;
  try {
    for (const key of settings.storageKeys) {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) return settings.parseStored(raw);
    }
  } catch {
    // Fall through to the adapter default when storage is unavailable.
  }
  return settings.initial();
}

export function ChatController<
  TOutput,
  TStreamState,
  TSettings = undefined,
  TExample = never,
  TAction = never,
  TActionStreamState = TStreamState,
>(
  props: ChatControllerProps<
    TOutput,
    TStreamState,
    TSettings,
    TExample,
    TAction,
    TActionStreamState
  >,
) {
  const { adapter, protocol, theme } = props;
  const conversation = useConversation(protocol.name);
  const {
    activeId,
    buildConversationContext,
    conversations,
    createNew,
    importShared,
    isPersistent,
    isReady,
    messages: persistedMessages,
    previewMessages: persistedPreviewMessages,
    previewPayloadUrls: persistedPreviewPayloadUrls,
    recordTurn,
    remove,
    rename,
    switchTo,
    updateLastAssistantPreviewMetrics,
  } = conversation;
  const initialHydration = useMemo(
    () =>
      adapter.hydrate({
        history: [],
        previewMessages: [],
        previewPayloadUrls: null,
      }),
    [adapter],
  );
  const [messages, setMessages] = useState<ChatMessageModel[]>(
    initialHydration.messages,
  );
  const [inputValue, setInputValue] = useState('');
  const [output, setOutput] = useState<TOutput | null>(
    initialHydration.output,
  );
  const [previewOutput, setPreviewOutput] = useState<TOutput | null>(
    initialHydration.output,
  );
  const [previewPayloadUrls, setPreviewPayloadUrls] = useState<
    PreviewPayloadUrls | null
  >(null);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [usage, setUsage] = useState<ChatTokenUsage>({
    ...EMPTY_CHAT_TOKEN_USAGE,
  });
  const [metrics, setMetrics] = useState<PreviewPerformanceMetrics>(
    initialHydration.metrics ?? {},
  );
  const [settings, setSettings] = useState<TSettings>(() =>
    readInitialSettings(adapter)
  );
  const [activeMobileTab, setActiveMobileTab] = useState<MobilePaneTab>(
    'edit',
  );
  const [deleteConversationId, setDeleteConversationId] = useState<
    string | null
  >(null);
  const { showCopyToast, toast: copyToast } = useCopyToast();

  const host = useMemo(() => createChatHost(window.location), []);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const followBottomRef = useRef(true);
  const generationAbortRef = useRef<AbortController | null>(null);
  const actionAbortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const hydratedActiveIdRef = useRef<string | null>(null);
  const importHandledRef = useRef(false);
  const outputRef = useRef<TOutput | null>(output);
  const previewOutputRef = useRef<TOutput | null>(previewOutput);
  const previewPayloadUrlsRef = useRef<PreviewPayloadUrls | null>(null);
  const settingsRef = useRef(settings);
  const metricsRef = useRef(metrics);
  const metricsPersistenceReadyRef = useRef(false);
  const previewFrameReadyRef = useRef(false);
  const liveDeliveryGenerationRef = useRef(0);
  const pendingLiveOutputsRef = useRef<PendingLiveOutput<TOutput>[]>([]);
  outputRef.current = output;
  previewOutputRef.current = previewOutput;
  previewPayloadUrlsRef.current = previewPayloadUrls;
  settingsRef.current = settings;
  metricsRef.current = metrics;

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

  const busy = isGenerating || isActionRunning;

  const setCurrentOutput = useCallback((next: TOutput | null) => {
    outputRef.current = next;
    setOutput(next);
  }, []);

  const setCurrentPreviewOutput = useCallback((next: TOutput | null) => {
    previewOutputRef.current = next;
    setPreviewOutput(next);
  }, []);

  const setCurrentPreviewPayloadUrls = useCallback(
    (next: PreviewPayloadUrls | null) => {
      previewPayloadUrlsRef.current = next;
      setPreviewPayloadUrls(next);
    },
    [],
  );

  const resetLivePreviewDelivery = useCallback(() => {
    liveDeliveryGenerationRef.current++;
    previewFrameReadyRef.current = false;
    pendingLiveOutputsRef.current = [];
  }, []);

  const handleCopyText = useCallback(
    (text: string) => {
      void copyToClipboard(text).then(showCopyToast);
    },
    [showCopyToast],
  );

  const abortOperations = useCallback(() => {
    runIdRef.current++;
    generationAbortRef.current?.abort();
    generationAbortRef.current = null;
    actionAbortRef.current?.abort();
    actionAbortRef.current = null;
    setIsGenerating(false);
    setIsActionRunning(false);
  }, []);

  useEffect(() => () => abortOperations(), [abortOperations]);

  useEffect(() => {
    const settingsAdapter = adapter.settings;
    if (!settingsAdapter) return;
    try {
      const serialized = JSON.stringify(settingsAdapter.serialize(settings));
      for (const key of settingsAdapter.storageKeys) {
        window.localStorage.setItem(key, serialized);
      }
    } catch {
      // Keep the in-memory settings usable when localStorage is unavailable.
    }
  }, [adapter.settings, settings]);

  useEffect(() => {
    void messages;
    void busy;
    void output;
    if (!followBottomRef.current) return;
    const container = chatMessagesRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [busy, messages, output]);

  useEffect(() => {
    const container = chatMessagesRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const sizeObserver = new ResizeObserver(() => {
      if (followBottomRef.current) {
        container.scrollTop = container.scrollHeight;
      }
    });
    sizeObserver.observe(container);
    Array.from(container.children).forEach((child) => {
      sizeObserver.observe(child);
    });
    const childObserver = new MutationObserver((entries) => {
      for (const entry of entries) {
        entry.addedNodes.forEach((node) => {
          if (node instanceof Element) sizeObserver.observe(node);
        });
      }
      if (followBottomRef.current) {
        container.scrollTop = container.scrollHeight;
      }
    });
    childObserver.observe(container, { childList: true });
    return () => {
      childObserver.disconnect();
      sizeObserver.disconnect();
    };
  }, []);

  const handleChatScroll = useCallback(() => {
    const container = chatMessagesRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight
      - container.scrollTop
      - container.clientHeight;
    followBottomRef.current = distanceFromBottom <= 32;
  }, []);

  useEffect(() => {
    if (!isReady || busy) return;
    if (hydratedActiveIdRef.current === activeId) return;
    hydratedActiveIdRef.current = activeId;
    const hydrated = adapter.hydrate({
      history: persistedMessages,
      previewMessages: persistedPreviewMessages,
      previewPayloadUrls: persistedPreviewPayloadUrls,
    });
    resetLivePreviewDelivery();
    setMessages(hydrated.messages);
    setInputValue('');
    setCurrentOutput(hydrated.output);
    setCurrentPreviewOutput(hydrated.output);
    setCurrentPreviewPayloadUrls(persistedPreviewPayloadUrls);
    const nextMetrics = hydrated.metrics ?? {};
    metricsRef.current = nextMetrics;
    setMetrics(nextMetrics);
    setUsage({ ...EMPTY_CHAT_TOKEN_USAGE });
    setPreviewRevision((value) => value + 1);
    metricsPersistenceReadyRef.current = persistedMessages.some(
      (message) => message.role === 'assistant',
    );
  }, [
    activeId,
    adapter,
    busy,
    isReady,
    persistedMessages,
    persistedPreviewMessages,
    persistedPreviewPayloadUrls,
    resetLivePreviewDelivery,
    setCurrentOutput,
    setCurrentPreviewOutput,
    setCurrentPreviewPayloadUrls,
  ]);

  useEffect(() => {
    if (!isReady || importHandledRef.current) return;
    const importUrl = readImportConversationParam();
    if (!importUrl) {
      importHandledRef.current = true;
      return;
    }
    importHandledRef.current = true;
    void (async () => {
      try {
        const trustedImportUrl = resolveTrustedConversationImportUrl(importUrl);
        if (!trustedImportUrl) {
          throw new Error('Untrusted shared conversation URL');
        }
        const response = await window.fetch(trustedImportUrl, {
          credentials: 'omit',
        });
        if (!response.ok) {
          throw new Error(
            `Failed to load shared conversation: ${response.status}`,
          );
        }
        const doc = (await response.json()) as unknown;
        if (!isSharedConversationDoc(doc)) {
          throw new Error('Invalid shared conversation document');
        }
        if (resolveSharedConversationProtocol(doc) !== protocol.name) {
          throw new Error('Shared conversation protocol does not match');
        }
        await importShared(doc);
      } catch (error) {
        console.warn(`[${adapter.id}] Failed to import conversation`, error);
      } finally {
        clearImportConversationParam();
      }
    })();
  }, [adapter.id, importShared, isReady, protocol.name]);

  const postLiveOutput = useCallback((
    type: LiveMessageType,
    nextOutput: TOutput,
  ) => {
    if (adapter.preview.delivery !== 'live-message') return false;
    const messages = adapter.preview.livePayload?.(nextOutput);
    const frame = previewFrameRef.current;
    if (!previewFrameReadyRef.current || !messages || !frame?.contentWindow) {
      return false;
    }
    frame.contentWindow.postMessage(
      { type, messages },
      targetOriginForUrl(frame.src, host),
    );
    return true;
  }, [adapter.preview, host]);

  const queueOrPostLiveOutput = useCallback((
    type: LiveMessageType,
    nextOutput: TOutput,
  ) => {
    if (postLiveOutput(type, nextOutput)) return;
    pendingLiveOutputsRef.current.push({ type, output: nextOutput });
  }, [postLiveOutput]);

  const handlePreviewFrameLoad = useCallback(() => {
    if (adapter.preview.delivery !== 'live-message') return;
    const generation = liveDeliveryGenerationRef.current;
    window.setTimeout(() => {
      if (generation !== liveDeliveryGenerationRef.current) return;
      previewFrameReadyRef.current = true;
      const pending = pendingLiveOutputsRef.current;
      pendingLiveOutputsRef.current = [];
      for (let index = 0; index < pending.length; index++) {
        const item = pending[index];
        if (item && postLiveOutput(item.type, item.output)) continue;
        pendingLiveOutputsRef.current.push(...pending.slice(index));
        break;
      }
    }, 0);
  }, [adapter.preview.delivery, postLiveOutput]);

  const handleStreamEmission = useCallback((
    emission: ChatStreamEmission<TOutput>,
    pendingId: string,
  ) => {
    if (emission.type === 'progress') {
      setMessages((current) =>
        current.map((message) =>
          message.id === pendingId
            ? { ...adapter.transcript.progress(emission.text), id: pendingId }
            : message
        )
      );
      return;
    }
    if (emission.type === 'usage') {
      setUsage((current) => addTokenUsage(current, emission.usage));
      return;
    }
    if (emission.type === 'previewPayload') {
      setCurrentPreviewPayloadUrls(emission.value);
      return;
    }
    const nextOutput = emission.type === 'partial' && adapter.preview.merge
      ? adapter.preview.merge(outputRef.current, emission.output)
      : emission.output;
    setCurrentOutput(nextOutput);
    if (emission.type === 'partial') {
      if (adapter.preview.delivery === 'live-message') {
        if (previewOutputRef.current === null) {
          resetLivePreviewDelivery();
          setCurrentPreviewOutput(nextOutput);
        } else {
          queueOrPostLiveOutput('A2UI_LIVE_MESSAGES', emission.output);
        }
      }
      return;
    }
    resetLivePreviewDelivery();
    setCurrentPreviewOutput(nextOutput);
    setPreviewRevision((value) => value + 1);
  }, [
    adapter.preview.delivery,
    adapter.preview.merge,
    adapter.transcript,
    queueOrPostLiveOutput,
    resetLivePreviewDelivery,
    setCurrentOutput,
    setCurrentPreviewOutput,
    setCurrentPreviewPayloadUrls,
  ]);

  const handleSend = useCallback(() => {
    const prompt = inputValue.trim();
    if (!isReady || !prompt || busy) return;
    abortOperations();
    const runId = ++runIdRef.current;
    const controller = new AbortController();
    generationAbortRef.current = controller;
    const previousOutput = outputRef.current;
    const userMessage: ModelChatMessage = { role: 'user', content: prompt };
    const pendingId = createMessageId(`${adapter.id}-pending`);
    const pending = { ...adapter.transcript.pending(prompt), id: pendingId };
    const requestConversation = buildConversationContext();
    const startedAt = performance.now();

    setInputValue('');
    setMessages((current) => [
      ...current,
      { kind: 'user', text: prompt },
      pending,
    ]);
    resetLivePreviewDelivery();
    setCurrentOutput(null);
    setCurrentPreviewOutput(null);
    setCurrentPreviewPayloadUrls(null);
    setUsage({ ...EMPTY_CHAT_TOKEN_USAGE });
    metricsRef.current = {};
    setMetrics({});
    metricsPersistenceReadyRef.current = false;
    setIsGenerating(true);

    void (async () => {
      try {
        const request = await adapter.createRequest({
          prompt,
          conversation: requestConversation,
          settings: settingsRef.current,
          host,
          signal: controller.signal,
        });
        const response = await window.fetch(
          request.url,
          requestInit(request, controller.signal),
        );
        if (!response.ok) {
          const payload: unknown = await response.json().catch(() => ({}));
          throw new Error(adapter.stream.error(payload));
        }
        const finalOutput = await consumeResponse(
          response,
          adapter.stream,
          {
            signal: controller.signal,
            onEmission: (emission) => {
              if (runIdRef.current !== runId) return;
              handleStreamEmission(emission, pendingId);
            },
          },
        );
        if (controller.signal.aborted || runIdRef.current !== runId) return;

        setCurrentOutput(finalOutput);
        setCurrentPreviewOutput(finalOutput);
        setPreviewRevision((value) => value + 1);
        const nextMetrics = mergeMetrics(metricsRef.current, {
          agentOutputMs: performance.now() - startedAt,
        });
        metricsRef.current = nextMetrics;
        setMetrics(nextMetrics);
        const persistence = adapter.persist(finalOutput, {
          kind: 'create',
          current: previousOutput,
          previewPayloadUrls: previewPayloadUrlsRef.current,
        });
        await recordTurn({
          userMessage,
          ...persistence,
          previewMetrics: nextMetrics,
        });
        metricsPersistenceReadyRef.current = true;
        void updateLastAssistantPreviewMetrics(metricsRef.current);
        setMessages((current) =>
          current.flatMap((message) =>
            message.id === pendingId
              ? [...adapter.transcript.success(finalOutput)]
              : [message]
          )
        );
      } catch (error) {
        if (controller.signal.aborted || runIdRef.current !== runId) return;
        setMessages((current) =>
          current.map((message) =>
            message.id === pendingId
              ? {
                ...adapter.transcript.failure(getErrorMessage(error)),
                id: pendingId,
              }
              : message
          )
        );
      } finally {
        if (generationAbortRef.current === controller) {
          generationAbortRef.current = null;
        }
        if (runIdRef.current === runId) setIsGenerating(false);
      }
    })();
  }, [
    abortOperations,
    adapter,
    buildConversationContext,
    busy,
    handleStreamEmission,
    host,
    inputValue,
    isReady,
    recordTurn,
    resetLivePreviewDelivery,
    setCurrentOutput,
    setCurrentPreviewOutput,
    setCurrentPreviewPayloadUrls,
    updateLastAssistantPreviewMetrics,
  ]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const resetLocalState = useCallback(() => {
    const hydrated = adapter.hydrate({
      history: [],
      previewMessages: [],
      previewPayloadUrls: null,
    });
    resetLivePreviewDelivery();
    setMessages(hydrated.messages);
    setInputValue('');
    setCurrentOutput(hydrated.output);
    setCurrentPreviewOutput(hydrated.output);
    setCurrentPreviewPayloadUrls(null);
    setUsage({ ...EMPTY_CHAT_TOKEN_USAGE });
    metricsRef.current = hydrated.metrics ?? {};
    setMetrics(hydrated.metrics ?? {});
    metricsPersistenceReadyRef.current = false;
    setPreviewRevision((value) => value + 1);
  }, [
    adapter,
    resetLivePreviewDelivery,
    setCurrentOutput,
    setCurrentPreviewOutput,
    setCurrentPreviewPayloadUrls,
  ]);

  const handleCreateConversation = useCallback(() => {
    if (!isReady || busy) return;
    abortOperations();
    resetLocalState();
    void createNew();
  }, [abortOperations, busy, createNew, isReady, resetLocalState]);

  const handleSwitchConversation = useCallback((id: string) => {
    if (!isReady || busy) return;
    abortOperations();
    void switchTo(id);
  }, [abortOperations, busy, isReady, switchTo]);

  const handleLoadExample = useCallback((example: TExample) => {
    if (!isReady || busy) return;
    abortOperations();
    const loaded = adapter.examples.load(example);
    resetLivePreviewDelivery();
    setMessages(loaded.messages);
    setInputValue('');
    setCurrentOutput(loaded.output);
    setCurrentPreviewOutput(loaded.output);
    setCurrentPreviewPayloadUrls(
      loaded.persistence.previewPayloadUrls ?? null,
    );
    setPreviewRevision((value) => value + 1);
    metricsRef.current = {};
    setMetrics({});
    metricsPersistenceReadyRef.current = false;
    void recordTurn({
      userMessage: { role: 'user', content: loaded.userText },
      ...loaded.persistence,
    }).then(() => {
      metricsPersistenceReadyRef.current = true;
      return updateLastAssistantPreviewMetrics(metricsRef.current);
    });
  }, [
    abortOperations,
    adapter.examples,
    busy,
    isReady,
    recordTurn,
    resetLivePreviewDelivery,
    setCurrentOutput,
    setCurrentPreviewOutput,
    setCurrentPreviewPayloadUrls,
    updateLastAssistantPreviewMetrics,
  ]);

  const shareConversation = useCallback(async (id: string) => {
    try {
      const record = await loadConversation(id);
      if (!record || record.messages.length === 0) {
        showCopyToast(false);
        return;
      }
      const cached = record.snapshot?.sharePayload;
      let conversationUrl = cached?.updatedAt === record.meta.updatedAt
        ? cached.url
        : undefined;
      if (!conversationUrl) {
        const doc = serializeConversation(record, protocol.name);
        conversationUrl = await publishConversation(doc);
        await saveConversationSharePayload(
          id,
          conversationUrl,
          record.meta.updatedAt,
        );
      }
      const link = buildConversationShareUrl(
        conversationUrl,
        host.baseUrl,
        protocol.name,
      );
      showCopyToast(await copyToClipboard(link));
    } catch {
      showCopyToast(false);
    }
  }, [host.baseUrl, protocol.name, showCopyToast]);

  const handleRenameConversation = useCallback((id: string, title: string) => {
    void rename(id, title);
  }, [rename]);

  const deleteConversationTitle = useMemo(
    () =>
      conversations.find((item) => item.id === deleteConversationId)?.title
        ?? 'this conversation',
    [conversations, deleteConversationId],
  );

  const handleConfirmDeleteConversation = useCallback(() => {
    const id = deleteConversationId;
    if (!id) return;
    setDeleteConversationId(null);
    void remove(id);
  }, [deleteConversationId, remove]);

  const handlePreviewMetric = useCallback((
    metric: PreviewMetricName,
    value: number,
  ) => {
    const next = mergeMetrics(
      metricsRef.current,
      previewMetricPatch(metric, value),
    );
    metricsRef.current = next;
    setMetrics(next);
    if (metricsPersistenceReadyRef.current) {
      void updateLastAssistantPreviewMetrics(next);
    }
  }, [updateLastAssistantPreviewMetrics]);

  useEffect(() => {
    const actionAdapter = adapter.action;
    if (!actionAdapter) return;
    const handleMessage = (event: MessageEvent<unknown>) => {
      const frame = previewFrameRef.current;
      if (!frame?.contentWindow || event.source !== frame.contentWindow) return;
      if (event.origin !== targetOriginForUrl(frame.src, host)) return;
      if (generationAbortRef.current !== null) return;
      const action = actionAdapter.parseWindowMessage(event.data);
      if (action === null) return;

      actionAbortRef.current?.abort();
      const controller = new AbortController();
      actionAbortRef.current = controller;
      const runId = ++runIdRef.current;
      const currentOutput = outputRef.current;
      const requestConversation = buildConversationContext();
      const label = actionAdapter.label(action);
      const pendingId = createMessageId(`${adapter.id}-action`);
      const userMessage: ModelChatMessage = {
        role: 'user',
        content: actionAdapter.userText(action),
      };
      const startedAt = performance.now();
      let actionPreviewPayloadUrls: PreviewPayloadUrls | null = null;
      let streamedResponseOutput: TOutput | null = null;
      metricsPersistenceReadyRef.current = false;
      setIsActionRunning(true);
      setMessages((current) => [
        ...current,
        {
          kind: 'action',
          text: `Action: ${label}`,
          payload: action,
          payloadLayout: 'single',
        },
        {
          id: pendingId,
          kind: 'output',
          tone: 'pending',
          icon: 'spinner',
          text: 'LLM Response',
        },
      ]);

      void (async () => {
        try {
          const request = actionAdapter.request({
            action,
            conversation: requestConversation,
            settings: settingsRef.current,
            host,
          });
          const response = await window.fetch(
            request.url,
            requestInit(request, controller.signal),
          );
          if (!response.ok) {
            const payload: unknown = await response.json().catch(() => ({}));
            throw new Error(actionAdapter.stream.error(payload));
          }
          const responseOutput = await consumeResponse(
            response,
            actionAdapter.stream,
            {
              signal: controller.signal,
              onEmission: (emission) => {
                if (runIdRef.current !== runId) return;
                if (emission.type === 'usage') {
                  setUsage((current) => addTokenUsage(current, emission.usage));
                } else if (emission.type === 'previewPayload') {
                  actionPreviewPayloadUrls = emission.value;
                } else if (emission.type === 'partial') {
                  streamedResponseOutput = actionAdapter.merge(
                    streamedResponseOutput,
                    emission.output,
                  );
                  setMessages((current) =>
                    current.map((message) =>
                      message.id === pendingId
                        ? {
                          ...message,
                          payload: streamedResponseOutput,
                          payloadLayout: 'chunks',
                        }
                        : message
                    )
                  );
                  queueOrPostLiveOutput(
                    'A2UI_ACTION_RESPONSE',
                    emission.output,
                  );
                }
              },
            },
          );
          if (controller.signal.aborted || runIdRef.current !== runId) return;
          const mergedOutput = actionAdapter.merge(
            currentOutput,
            responseOutput,
          );
          setCurrentPreviewPayloadUrls(null);
          resetLivePreviewDelivery();
          setCurrentOutput(mergedOutput);
          setCurrentPreviewOutput(mergedOutput);
          setPreviewRevision((value) => value + 1);
          const nextMetrics = mergeMetrics(metricsRef.current, {
            agentOutputMs: performance.now() - startedAt,
          });
          metricsRef.current = nextMetrics;
          setMetrics(nextMetrics);
          const persistence = adapter.persist(responseOutput, {
            kind: 'action',
            current: currentOutput,
            previewPayloadUrls: actionPreviewPayloadUrls,
          });
          await recordTurn({
            userMessage,
            ...persistence,
            previewMetrics: nextMetrics,
          });
          metricsPersistenceReadyRef.current = true;
          void updateLastAssistantPreviewMetrics(metricsRef.current);
          setMessages((current) =>
            current.flatMap((message) =>
              message.id === pendingId
                ? [{
                  id: pendingId,
                  kind: 'output' as const,
                  text: 'LLM Response',
                  payload: responseOutput,
                  payloadLayout: 'chunks' as const,
                }]
                : [message]
            )
          );
        } catch (error) {
          if (controller.signal.aborted || runIdRef.current !== runId) return;
          metricsPersistenceReadyRef.current = true;
          setMessages((current) =>
            current.map((message) =>
              message.id === pendingId
                ? {
                  id: pendingId,
                  kind: 'status',
                  tone: 'error',
                  icon: 'error',
                  text: `Action failed: ${getErrorMessage(error)}`,
                }
                : message
            )
          );
        } finally {
          if (actionAbortRef.current === controller) {
            actionAbortRef.current = null;
          }
          if (runIdRef.current === runId) setIsActionRunning(false);
        }
      })();
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [
    adapter,
    buildConversationContext,
    host,
    queueOrPostLiveOutput,
    recordTurn,
    resetLivePreviewDelivery,
    setCurrentOutput,
    setCurrentPreviewOutput,
    setCurrentPreviewPayloadUrls,
    updateLastAssistantPreviewMetrics,
  ]);

  const settingsControls = adapter.settings?.controls(settings) ?? [];
  const selectControls = settingsControls.filter((item) =>
    item.kind === 'select'
  );
  const fieldControls = settingsControls.filter((item) =>
    item.kind !== 'select'
  );
  const updateSetting = (id: string, value: string) => {
    const settingsAdapter = adapter.settings;
    if (!settingsAdapter) return;
    setSettings((current) => settingsAdapter.update(current, id, value));
  };
  const artifact = output === null
    ? null
    : adapter.preview.artifact?.(output) ?? null;
  const previewSource = useMemo(
    () =>
      adapter.preview.source(previewOutput, {
        protocol,
        theme,
        previewPayloadUrls,
      }),
    [
      adapter.preview,
      previewOutput,
      previewPayloadUrls,
      protocol,
      theme,
    ],
  );
  const previewInfoHint = previewOutput === null
    ? (isGenerating
      ? adapter.preview.generatingHint
      : adapter.preview.emptyHint)
    : undefined;
  const extraMetrics = useMemo<PreviewPanelMetricItem[]>(
    () =>
      isGenerating
        || output !== null
        || typeof metrics.agentOutputMs === 'number'
        || typeof metrics.renderMs === 'number'
        ? [
          {
            key: 'agentOutputMs',
            label: 'Agent',
            title: 'Agent output duration',
            description: 'Time from request until final agent output.',
            value: metrics.agentOutputMs,
          },
          {
            key: 'renderMs',
            label: 'Render',
            title: 'Preview render duration',
            description:
              'Time from delivering output until the preview paints it.',
            value: metrics.renderMs,
          },
        ]
        : [],
    [isGenerating, metrics.agentOutputMs, metrics.renderMs, output],
  );
  const showStarterContent = messages.length <= 1;

  return (
    <ChatWorkspace
      pageRef={pageRef}
      isPanelResizing={isPanelResizing}
      isCompactLayout={isCompactLayout}
      activeMobileTab={activeMobileTab}
      onMobileTabChange={setActiveMobileTab}
      copyToast={copyToast}
      deleteConfirmation={{
        open: deleteConversationId !== null,
        conversationTitle: deleteConversationTitle,
        onCancel: () => setDeleteConversationId(null),
        onConfirm: handleConfirmDeleteConversation,
      }}
      conversation={{
        conversations,
        activeId,
        disabled: !isReady || busy,
        isPersistent,
        onCreate: handleCreateConversation,
        onSwitch: handleSwitchConversation,
        onShare: (id) => void shareConversation(id),
        onRename: handleRenameConversation,
        onRemove: setDeleteConversationId,
      }}
      header={{
        title: 'Create',
        description: adapter.copy.description,
        topContent: (
          <>
            <span
              className='constructionBadge'
              title={adapter.settings?.badge(settings)
                ?? adapter.copy.agentLabel}
            >
              {adapter.copy.agentLabel}
            </span>
            {protocol.name === 'mcp-apps'
              ? null
              : (
                <button
                  type='button'
                  className='chatExamplesLink'
                  onClick={() => {
                    window.location.hash = `#/${protocol.name}/examples`;
                  }}
                >
                  Browse examples
                </button>
              )}
            {usage.totalTokens > 0
              ? (
                <span className='chatTokenUsageBadge'>
                  <span className='chatTokenUsageItem'>
                    Prompt {formatTokenCount(usage.promptTokens)}
                  </span>
                  <span className='chatTokenUsageItem'>
                    Output {formatTokenCount(usage.completionTokens)}
                  </span>
                  <span className='chatTokenUsageItem chatTokenUsageTotal'>
                    Total {formatTokenCount(usage.totalTokens)}
                  </span>
                </span>
              )
              : null}
          </>
        ),
      }}
      messagesRef={chatMessagesRef}
      onMessagesScroll={handleChatScroll}
      messages={
        <>
          <MessageList messages={messages} onCopy={handleCopyText} />
          {artifact
            ? <ArtifactViewer artifact={artifact} onCopy={handleCopyText} />
            : null}
        </>
      }
      composer={
        <>
          {showStarterContent
            ? (
              <>
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
                    {adapter.suggestions.map((suggestion) => (
                      <button
                        key={suggestion.label}
                        type='button'
                        className='chatSuggestionChip'
                        disabled={!isReady || busy}
                        onClick={() => setInputValue(suggestion.text)}
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                </div>
                {adapter.examples.items.length > 0
                  ? (
                    <div className='promptSuggestions'>
                      <div className='promptSuggestionsHeader'>
                        <span className='promptSuggestionsLabel'>
                          <Zap size={13} strokeWidth={2} aria-hidden='true' />
                          Load a local example
                          <span className='promptSuggestionsLabelHint'>
                            · no API call
                          </span>
                        </span>
                      </div>
                      <div className='promptSuggestionsRail'>
                        {adapter.examples.items.map((example) => {
                          const item = adapter.examples.item(example);
                          return (
                            <button
                              key={item.id}
                              type='button'
                              className='chatSuggestionChip'
                              title={item.description}
                              disabled={!isReady || busy}
                              onClick={() => handleLoadExample(example)}
                            >
                              {item.title}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )
                  : null}
              </>
            )
            : null}
          <div className='chatComposer'>
            <textarea
              className='chatInput'
              aria-label={adapter.copy.inputAriaLabel}
              placeholder={adapter.copy.inputPlaceholder}
              value={inputValue}
              rows={3}
              disabled={!isReady || busy}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleKeyDown}
            />
            {fieldControls.length > 0
              ? (
                <div className='chatProviderConfig'>
                  {fieldControls.map((control) => (
                    <input
                      key={control.id}
                      className={control.id === 'baseURL'
                        ? 'chatProviderInputField chatProviderInputFieldUrl'
                        : 'chatProviderInputField'}
                      aria-label={control.label}
                      type={control.kind}
                      placeholder={control.placeholder}
                      value={control.value}
                      disabled={busy}
                      onChange={(event) =>
                        updateSetting(control.id, event.target.value)}
                    />
                  ))}
                </div>
              )
              : null}
            <div className='chatComposerFooter'>
              <div className='chatProviderControl'>
                {selectControls.map((control) => (
                  <select
                    key={control.id}
                    className='chatProviderSelect'
                    aria-label={control.label}
                    value={control.value}
                    disabled={busy}
                    onChange={(event) =>
                      updateSetting(control.id, event.target.value)}
                  >
                    {control.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
              <Button
                variant='primary'
                size='lg'
                iconBefore={Send}
                disabled={!isReady || busy || inputValue.trim().length === 0}
                onClick={handleSend}
              >
                {isGenerating ? 'Generating' : 'Send'}
              </Button>
            </div>
          </div>
        </>
      }
      chatPanelStyle={chatPanelStyle}
      previewPanelStyle={previewPanelStyle}
      resizeHandle={{
        ariaLabel: 'Resize Create and preview panels',
        onPointerDown: handlePanelResizeStart,
      }}
      preview={{
        title: 'Lynx Preview',
        showPreviewModeSwitch: true,
        showSimulationBar: false,
        previewSource,
        previewInfoHint,
        extraMetrics,
        onPreviewMetric: handlePreviewMetric,
        children: (
          <PreviewViewport
            key={adapter.preview.delivery === 'reload'
              ? previewRevision
              : undefined}
            iframeRef={previewFrameRef}
            onLoad={handlePreviewFrameLoad}
            retainPreviousFrame
            emptyIcon={<Sparkles size={28} strokeWidth={1.5} />}
            emptyTitle={adapter.preview.emptyTitle}
            emptySubTitle={adapter.preview.emptySubtitle}
          />
        ),
      }}
    />
  );
}
