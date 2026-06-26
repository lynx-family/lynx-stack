// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

import './AIChatPage.css';
import './OpenUICreatePage.css';

import { Button } from '../components/Button.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { ConversationListPanel } from '../components/ConversationListPanel.js';
import { CopyToast, useCopyToast } from '../components/CopyToast.js';
import { Send, Sparkles } from '../components/Icon.js';
import { MobileTabBar } from '../components/MobileTabBar.js';
import type { MobilePaneTab } from '../components/MobileTabBar.js';
import { PageHeader } from '../components/PageHeader.js';
import { PanelResizeHandle } from '../components/PanelResizeHandle.js';
import { PreviewPanel } from '../components/PreviewPanel.js';
import { PreviewViewport } from '../components/PreviewViewport.js';
import { useConversation } from '../hooks/useConversation.js';
import type { ModelChatMessage } from '../hooks/useConversation.js';
import { useResizablePanels } from '../hooks/useResizablePanels.js';
import {
  OPENUI_SCENARIOS,
  parseOpenUIScenarioRaw,
} from '../mock/openui-scenarios.js';
import type { OpenUIScenario } from '../mock/openui-scenarios.js';
import {
  loadConversation,
  saveConversationSharePayload,
} from '../storage/conversationRepo.js';
import {
  isSharedConversationDoc,
  serializeConversation,
} from '../storage/sharedConversation.js';
import { copyToClipboard } from '../utils/clipboard.js';
import type { Protocol } from '../utils/protocol.js';
import { isDevHost } from '../utils/publishPayload.js';
import {
  buildConversationShareUrl,
  clearImportConversationParam,
  publishConversation,
  readImportConversationParam,
} from '../utils/shareConversation.js';

interface ChatMessage {
  id?: string;
  role: 'user' | 'ai' | 'status';
  content: ReactNode;
  tone?: 'info' | 'pending' | 'success' | 'error';
}

interface GeneratedOpenUI {
  rawText: string;
  scenarioTitle: string;
}

type OutputView = 'raw' | 'json';

const DESKTOP_PREVIEW_MIN_WIDTH = 360;
const DESKTOP_CHAT_MIN_WIDTH = 360;
const COMPACT_CHAT_MIN_HEIGHT = 280;
const COMPACT_PREVIEW_MIN_HEIGHT = 320;
const RESIZE_BREAKPOINT = 980;
const ONLINE_OPENUI_SERVER_ORIGIN = 'https://genui-server.vercel.app';
const ONLINE_OPENUI_CHAT_URL = `${ONLINE_OPENUI_SERVER_ORIGIN}/openui/stream`;
const LOCAL_OPENUI_SERVER_PORT = '3060';

const WELCOME_MESSAGE: ChatMessage = {
  role: 'ai',
  content:
    'Describe the OpenUI surface you want to create. I will stream OpenUI Lang from the GenUI server and render the result in Lynx Preview.',
};

const SUGGESTED_PROMPTS: Array<{ label: string; text: string }> = [
  {
    label: 'Weather query',
    text:
      'Create an OpenUI weather card for Seattle with live query data, a refresh action, metrics, and alerts.',
  },
  {
    label: 'Pricing picker',
    text:
      'Create an OpenUI pricing page with three plans, selected state, billing controls, and reset actions.',
  },
  {
    label: 'Pizza order',
    text:
      'Create an OpenUI pizza order card with options, a summary, and an order action.',
  },
];

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${
    Math.random().toString(36).slice(2)
  }`;
}

function safeStringify(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatCharacterCount(value: string): string {
  return `${value.length.toLocaleString()} chars`;
}

function isTrustedOnlineEndpoint(endpoint: URL): boolean {
  return endpoint.origin === ONLINE_OPENUI_SERVER_ORIGIN;
}

function resolveTrustedOpenUIEndpoint(raw: string): string | null {
  try {
    const endpoint = new URL(raw, window.location.origin);
    if (endpoint.origin === window.location.origin) {
      return endpoint.toString();
    }
    if (isTrustedOnlineEndpoint(endpoint)) {
      return endpoint.toString();
    }

    const isTrustedDevEndpoint = endpoint.protocol === 'http:'
      && endpoint.port === LOCAL_OPENUI_SERVER_PORT
      && isDevHost(endpoint.hostname);
    return isTrustedDevEndpoint ? endpoint.toString() : null;
  } catch {
    return null;
  }
}

function getOpenUIChatEndpoint(): string {
  const fromQuery = new URLSearchParams(window.location.search).get(
    'openuiEndpoint',
  );
  if (fromQuery) {
    const trustedEndpoint = resolveTrustedOpenUIEndpoint(fromQuery);
    if (trustedEndpoint) return trustedEndpoint;
  }
  if (
    window.location.protocol === 'http:' && isDevHost(window.location.hostname)
  ) {
    return `http://${window.location.hostname}:${LOCAL_OPENUI_SERVER_PORT}/openui/stream`;
  }
  return ONLINE_OPENUI_CHAT_URL;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function normalizeErrorPayload(payload: unknown): string {
  if (payload && typeof payload === 'object') {
    const record = payload as {
      error?: unknown;
      message?: unknown;
      name?: unknown;
    };
    if (typeof record.error === 'string') return record.error;
    if (typeof record.message === 'string') return record.message;
  }
  return 'OpenUI generation failed';
}

function parseSseFrame(frame: string):
  | { event: string; data: unknown }
  | null
{
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of frame.split(/\r?\n/u)) {
    if (!line || line.startsWith(':')) continue;
    const separatorIndex = line.indexOf(':');
    const field = separatorIndex === -1
      ? line
      : line.slice(0, separatorIndex);
    const value = separatorIndex === -1
      ? ''
      : line.slice(separatorIndex + 1).replace(/^ /u, '');
    if (field === 'event') {
      event = value || 'message';
    } else if (field === 'data') {
      dataLines.push(value);
    }
  }

  if (dataLines.length === 0) return null;
  const dataText = dataLines.join('\n');
  try {
    return { event, data: JSON.parse(dataText) };
  } catch {
    return { event, data: dataText };
  }
}

async function readOpenUIResponse(
  response: Awaited<ReturnType<typeof window.fetch>>,
  onText: (text: string) => void,
): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream')) {
    const payload: unknown = await response.json().catch(() => ({}));
    if (
      payload
      && typeof payload === 'object'
      && typeof (payload as { text?: unknown }).text === 'string'
    ) {
      const text = (payload as { text: string }).text;
      onText(text);
      return text;
    }
    throw new Error(normalizeErrorPayload(payload));
  }

  const reader = response.body?.getReader();
  if (!reader) return '';

  const decoder = new TextDecoder();
  let buffer = '';
  let generatedText = '';
  let finalText: string | undefined;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const frames = buffer.split(/\r?\n\r?\n/u);
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const parsed = parseSseFrame(frame);
      if (!parsed) continue;

      if (parsed.event === 'delta') {
        const data = parsed.data as { text?: unknown };
        if (typeof data.text === 'string') {
          generatedText += data.text;
          onText(generatedText);
        }
        continue;
      }

      if (parsed.event === 'done') {
        const data = parsed.data as { text?: unknown };
        if (typeof data.text === 'string') {
          finalText = data.text;
          onText(finalText);
        }
        continue;
      }

      if (parsed.event === 'error') {
        throw new Error(normalizeErrorPayload(parsed.data));
      }
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const parsed = parseSseFrame(buffer);
    if (parsed?.event === 'done') {
      const data = parsed.data as { text?: unknown };
      if (typeof data.text === 'string') {
        finalText = data.text;
      }
    } else if (parsed?.event === 'error') {
      throw new Error(normalizeErrorPayload(parsed.data));
    }
  }

  return finalText ?? generatedText;
}

function GeneratedOutputViewer(props: {
  generated: GeneratedOpenUI;
  onCopy: (text: string) => void;
}) {
  const { generated, onCopy } = props;
  const [view, setView] = useState<OutputView>('raw');

  const parsedJson = useMemo(() => {
    try {
      return parseOpenUIScenarioRaw(generated.rawText);
    } catch (err) {
      return `Unable to parse OpenUI DSL:\n${String(err)}`;
    }
  }, [generated.rawText]);

  const visibleText = view === 'raw' ? generated.rawText : parsedJson;

  return (
    <div className='chatGeneratedJson openuiCreateOutput'>
      <div className='chatGeneratedJsonTitle openuiCreateOutputHeader'>
        <div className='openuiCreateOutputTitle'>
          <span>Generated OpenUI Output</span>
          <span className='openuiCreateOutputMeta'>
            {generated.scenarioTitle} - {formatCharacterCount(
              generated.rawText,
            )}
          </span>
        </div>
        <div className='openuiCreateOutputActions'>
          <div className='previewModeSwitch openuiCreateOutputSwitch'>
            <button
              type='button'
              className={view === 'raw'
                ? 'previewModeBtn active'
                : 'previewModeBtn'}
              onClick={() => setView('raw')}
            >
              Raw
            </button>
            <button
              type='button'
              className={view === 'json'
                ? 'previewModeBtn active'
                : 'previewModeBtn'}
              onClick={() => setView('json')}
            >
              JSON
            </button>
          </div>
          <button
            type='button'
            className='chatJsonCopyButton'
            onClick={() => onCopy(visibleText)}
          >
            Copy
          </button>
        </div>
      </div>
      <pre className='chatMessageChunkJson openuiCreateCodeBlock'>
        {safeStringify(visibleText)}
      </pre>
    </div>
  );
}

const LOCAL_SCENARIO_PROMPT_PREFIX = 'Load local OpenUI scenario: ';

function localScenarioTitleFromPrompt(content: string): string | null {
  if (!content.startsWith(LOCAL_SCENARIO_PROMPT_PREFIX)) return null;
  const title = content.slice(LOCAL_SCENARIO_PROMPT_PREFIX.length).trim();
  return title || null;
}

function createGeneratedStatus(): ChatMessage {
  return {
    role: 'status',
    tone: 'success',
    content: (
      <>
        <span className='chatMessageStatusIcon' aria-hidden='true'>
          <Sparkles size={13} strokeWidth={2} />
        </span>
        <span>
          Generated OpenUI Lang from the server agent. The Lynx Preview is
          rendering the final response.
        </span>
      </>
    ),
  };
}

function createLoadedScenarioStatus(title: string): ChatMessage {
  return {
    role: 'status',
    tone: 'success',
    content: (
      <>
        <span className='chatMessageStatusIcon' aria-hidden='true'>
          <Sparkles size={13} strokeWidth={2} />
        </span>
        <span>
          Loaded local OpenUI scenario{' '}
          <code className='chatMessageStatusInline'>{title}</code>. No API call
          was made.
        </span>
      </>
    ),
  };
}

function buildChatMessagesFromHistory(
  history: ModelChatMessage[],
): ChatMessage[] {
  if (history.length === 0) return [WELCOME_MESSAGE];

  const next: ChatMessage[] = [WELCOME_MESSAGE];
  let previousScenarioTitle: string | null = null;
  for (const message of history) {
    if (message.role === 'user') {
      previousScenarioTitle = localScenarioTitleFromPrompt(message.content);
      next.push({ role: 'user', content: message.content });
      continue;
    }
    if (message.role === 'assistant') {
      next.push(
        previousScenarioTitle
          ? createLoadedScenarioStatus(previousScenarioTitle)
          : createGeneratedStatus(),
      );
      previousScenarioTitle = null;
    }
  }
  return next;
}

function getLastGeneratedOpenUI(
  history: ModelChatMessage[],
): GeneratedOpenUI | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const message = history[i];
    if (message?.role !== 'assistant') continue;
    const rawText = message.content.trim();
    if (!rawText) continue;
    const previousUser = history
      .slice(0, i)
      .reverse()
      .find((item) => item.role === 'user');
    return {
      rawText,
      scenarioTitle: previousUser
        ? localScenarioTitleFromPrompt(previousUser.content) ?? 'Saved response'
        : 'Saved response',
    };
  }
  return null;
}

export function OpenUICreatePage(props: { protocol: Protocol }) {
  const { protocol } = props;
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
    recordTurn,
    remove,
    rename,
    switchTo,
  } = conversation;
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    WELCOME_MESSAGE,
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedOpenUI | null>(null);
  const [previewRenderKey, setPreviewRenderKey] = useState(0);
  const [activeMobileTab, setActiveMobileTab] = useState<MobilePaneTab>(
    'edit',
  );
  const [deleteConversationId, setDeleteConversationId] = useState<
    string | null
  >(null);
  const abortRef = useRef<AbortController | null>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const hydratedActiveIdRef = useRef<string | null>(null);
  const importHandledRef = useRef(false);
  const { showCopyToast, toast: copyToast } = useCopyToast();

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

  const previewSource = useMemo(() => {
    if (!generated) return undefined;
    return {
      kind: 'openui' as const,
      rawText: generated.rawText,
    };
  }, [generated]);

  const previewInfoHint = generated
    ? undefined
    : (isGenerating
      ? 'Streaming OpenUI output from the GenUI server. The preview will appear when the response is complete.'
      : 'No OpenUI output yet. Send a prompt or load a local scenario to preview it.');

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const container = chatMessagesRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  });

  const handleCopyText = useCallback(
    (text: string) => {
      void copyToClipboard(text).then(showCopyToast);
    },
    [showCopyToast],
  );

  const baseUrl = useMemo(() => window.location.href.replace(/#.*$/, ''), []);

  useEffect(() => {
    if (!isReady || isGenerating) return;
    if (hydratedActiveIdRef.current === activeId) return;
    hydratedActiveIdRef.current = activeId;
    setMessages(buildChatMessagesFromHistory(persistedMessages));
    setGenerated(getLastGeneratedOpenUI(persistedMessages));
    setInputValue('');
    setPreviewRenderKey((value) => value + 1);
  }, [activeId, isGenerating, isReady, persistedMessages]);

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
        const response = await window.fetch(importUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to load shared conversation: ${response.status}`,
          );
        }
        const doc = (await response.json()) as unknown;
        if (!isSharedConversationDoc(doc)) {
          throw new Error('Invalid shared conversation document');
        }
        await importShared(doc);
      } catch (err) {
        console.warn('[openui] Failed to import shared conversation', err);
      } finally {
        clearImportConversationParam();
      }
    })();
  }, [importShared, isReady]);

  const applyScenario = useCallback((scenario: OpenUIScenario) => {
    const nextGenerated: GeneratedOpenUI = {
      rawText: scenario.raw,
      scenarioTitle: scenario.title,
    };
    const userPrompt = `${LOCAL_SCENARIO_PROMPT_PREFIX}${scenario.title}`;
    setGenerated(nextGenerated);
    setPreviewRenderKey((value) => value + 1);
    setMessages([
      WELCOME_MESSAGE,
      { role: 'user', content: userPrompt },
      createLoadedScenarioStatus(scenario.title),
    ]);
  }, []);

  const handleLoadScenario = useCallback((scenario: OpenUIScenario) => {
    if (isGenerating) return;
    abortRef.current?.abort();
    abortRef.current = null;
    setInputValue('');
    setIsGenerating(false);
    applyScenario(scenario);
    void recordTurn({
      userMessage: {
        role: 'user',
        content: `${LOCAL_SCENARIO_PROMPT_PREFIX}${scenario.title}`,
      },
      assistantContent: scenario.raw,
      a2uiMessages: [],
      previewMessages: [],
    });
  }, [applyScenario, isGenerating, recordTurn]);

  const handleSend = useCallback(() => {
    const prompt = inputValue.trim();
    if (!prompt || isGenerating) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    const pendingId = createMessageId('openui-pending');
    const userMessage: ModelChatMessage = { role: 'user', content: prompt };
    const requestConversation = buildConversationContext();
    setInputValue('');
    setGenerated(null);
    setIsGenerating(true);
    setMessages((current) => [
      ...current,
      { role: 'user', content: prompt },
      {
        id: pendingId,
        role: 'status',
        tone: 'pending',
        content: (
          <>
            <span className='chatMessageActionSpinner' aria-hidden='true' />
            <span>Streaming OpenUI Lang from the GenUI server...</span>
          </>
        ),
      },
    ]);

    void (async () => {
      try {
        const endpoint = getOpenUIChatEndpoint();
        const response = await window.fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            resourceId: 'openui-create',
            messages: [userMessage],
            conversation: requestConversation,
          }),
          signal,
        });

        if (!response.ok) {
          const payload: unknown = await response.json().catch(() => ({}));
          throw new Error(normalizeErrorPayload(payload));
        }

        const generatedText = await readOpenUIResponse(response, (text) => {
          if (signal.aborted) return;
          setMessages((current) =>
            current.map((message) =>
              message.id === pendingId
                ? {
                  ...message,
                  tone: 'pending',
                  content: (
                    <>
                      <span
                        className='chatMessageActionSpinner'
                        aria-hidden='true'
                      />
                      <span>
                        Streaming OpenUI Lang from the GenUI server...{' '}
                        {formatCharacterCount(text)}
                      </span>
                    </>
                  ),
                }
                : message
            )
          );
        });

        if (signal.aborted) return;
        if (!generatedText.trim()) {
          throw new Error('OpenUI agent returned no output');
        }

        setGenerated({
          rawText: generatedText,
          scenarioTitle: 'Agent response',
        });
        setPreviewRenderKey((value) => value + 1);
        await recordTurn({
          userMessage,
          assistantContent: generatedText,
          a2uiMessages: [],
          previewMessages: [],
        });
        setMessages((current) =>
          current.map((message) =>
            message.id === pendingId
              ? {
                ...message,
                ...createGeneratedStatus(),
              }
              : message
          )
        );
      } catch (err: unknown) {
        if (signal.aborted) return;
        setMessages((current) =>
          current.map((message) =>
            message.id === pendingId
              ? {
                ...message,
                tone: 'error',
                content: (
                  <>
                    <span className='chatMessageStatusIcon' aria-hidden='true'>
                      !
                    </span>
                    <span>
                      OpenUI generation failed: {getErrorMessage(err)}
                    </span>
                  </>
                ),
              }
              : message
          )
        );
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        if (!signal.aborted) {
          setIsGenerating(false);
        }
      }
    })();
  }, [buildConversationContext, inputValue, isGenerating, recordTurn]);

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

  const handleCreateConversation = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setInputValue('');
    setGenerated(null);
    setIsGenerating(false);
    setMessages([WELCOME_MESSAGE]);
    setPreviewRenderKey((value) => value + 1);
    void createNew();
  }, [createNew]);

  const handleSwitchConversation = useCallback((id: string) => {
    if (isGenerating) return;
    abortRef.current?.abort();
    abortRef.current = null;
    void switchTo(id);
  }, [isGenerating, switchTo]);

  const shareConversation = useCallback(
    async (id: string) => {
      try {
        const record = await loadConversation(id);
        if (!record || record.messages.length === 0) {
          showCopyToast(false);
          return;
        }

        const cached = record.snapshot?.sharePayload;
        let conversationUrl: string | undefined;
        if (cached && cached.updatedAt === record.meta.updatedAt) {
          conversationUrl = cached.url;
        }
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
          baseUrl,
          protocol.name,
        );
        showCopyToast(await copyToClipboard(link));
      } catch {
        showCopyToast(false);
      }
    },
    [baseUrl, protocol.name, showCopyToast],
  );

  const handleShareConversation = useCallback((id: string) => {
    void shareConversation(id);
  }, [shareConversation]);

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
      className={isPanelResizing
        ? 'chatPage openuiCreatePage resizing'
        : 'chatPage openuiCreatePage'}
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
          onShare={handleShareConversation}
          onRename={handleRenameConversation}
          onRemove={handleRemoveConversation}
        />

        <div className='chatPanel' style={chatPanelStyle}>
          <PageHeader
            className='chatHeader'
            titleClassName='chatHeaderTitle'
            descriptionClassName='chatHeaderSub'
            title='Create'
            description='Describe an OpenUI surface, inspect the generated DSL, and render it in Lynx Preview.'
            topContent={
              <>
                <span className='constructionBadge'>OpenUI Agent</span>
                <button
                  type='button'
                  className='openuiCreateExamplesLink'
                  onClick={() => {
                    window.location.hash = `#/${protocol.name}/examples`;
                  }}
                >
                  Browse examples
                </button>
              </>
            }
          />

          <div className='chatMessages' ref={chatMessagesRef}>
            {messages.map((message, index) => {
              const className = message.role === 'user'
                ? 'chatMessageUser'
                : (message.role === 'status'
                  ? `chatMessageStatus chatMessageStatus-${
                    message.tone ?? 'info'
                  }`
                  : 'chatMessageAI');
              return (
                <div
                  key={message.id ?? index}
                  className={`chatMessage ${className}`}
                >
                  <div className='chatMessageBody'>
                    <span>{message.content}</span>
                  </div>
                </div>
              );
            })}
            {generated
              ? (
                <GeneratedOutputViewer
                  generated={generated}
                  onCopy={handleCopyText}
                />
              )
              : null}
          </div>

          <div className='chatInputArea'>
            {messages.length === 1
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
                          - server agent
                        </span>
                      </span>
                    </div>
                    <div className='promptSuggestionsRail'>
                      {SUGGESTED_PROMPTS.map((prompt) => (
                        <button
                          key={prompt.label}
                          type='button'
                          className='chatSuggestionChip'
                          disabled={isGenerating}
                          onClick={() => setInputValue(prompt.text)}
                        >
                          {prompt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className='promptSuggestions openuiCreateScenarioPicker'>
                    <div className='promptSuggestionsHeader'>
                      <span className='promptSuggestionsLabel'>
                        <span
                          className='promptSuggestionsLabelDot'
                          aria-hidden='true'
                        />
                        Load local OpenUI examples
                        <span className='promptSuggestionsLabelHint'>
                          - no API call
                        </span>
                      </span>
                    </div>
                    <div className='promptSuggestionsRail'>
                      {OPENUI_SCENARIOS.slice(0, 8).map((scenario) => (
                        <button
                          key={scenario.id}
                          type='button'
                          className='chatSuggestionChip'
                          disabled={isGenerating}
                          onClick={() => handleLoadScenario(scenario)}
                        >
                          {scenario.title}
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
                aria-label='Describe the OpenUI surface to generate'
                placeholder='Describe the OpenUI surface, data, state, or interactions you want to generate...'
                value={inputValue}
                rows={3}
                disabled={isGenerating}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div className='chatComposerFooter'>
                <Button
                  variant='ghost'
                  size='lg'
                  disabled={isGenerating}
                  onClick={handleCreateConversation}
                >
                  New draft
                </Button>
                <Button
                  variant='primary'
                  size='lg'
                  iconBefore={Send}
                  disabled={isGenerating || inputValue.trim().length === 0}
                  onClick={handleSend}
                >
                  {isGenerating ? 'Generating' : 'Send'}
                </Button>
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
          previewInfoHint={previewInfoHint}
        >
          <PreviewViewport
            key={previewRenderKey}
            retainPreviousFrame
            emptyIcon={<Sparkles size={28} strokeWidth={1.5} />}
            emptyTitle='Send a prompt to generate OpenUI'
            emptySubTitle='Generated OpenUI output will be previewed here'
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
