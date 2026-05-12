// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import './AIChatPage.css';

import { PanelResizeHandle } from '../components/PanelResizeHandle.js';
import { PreviewPanel } from '../components/PreviewPanel.js';
import { PreviewViewport } from '../components/PreviewViewport.js';
import { QrCode } from '../components/QrCode.js';
import { useResizablePanels } from '../hooks/useResizablePanels.js';
import { DEFAULT_A2UI_DEMO_URL } from '../utils/demoUrl.js';
import type { Protocol } from '../utils/protocol.js';
import { buildRenderUrl } from '../utils/renderUrl.js';

interface ChatMessage {
  role: 'user' | 'ai';
  content: string | React.ReactNode;
}

interface ModelChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
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
const ONLINE_A2UI_CHAT_URL = '/a2ui/stream';
const LOCAL_A2UI_SERVER_PORT = '3060';

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

function resolveTrustedA2UIEndpoint(raw: string): string | null {
  try {
    const endpoint = new URL(raw, window.location.origin);
    if (endpoint.origin === window.location.origin) {
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
    return `http://${window.location.hostname}:${LOCAL_A2UI_SERVER_PORT}/a2ui/chat`;
  }
  return ONLINE_A2UI_CHAT_URL;
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
): Promise<unknown[]> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream')) {
    const payload = await response.json();
    const messages = normalizeA2UIMessages(payload);
    if (messages.length === 0) {
      throw new Error(normalizeErrorPayload(payload));
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

export function AIChatPage(props: { protocol: Protocol }) {
  const { protocol } = props;
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState<string>('');
  const [renderUrl, setRenderUrl] = useState<string>('');
  const [generatedJson, setGeneratedJson] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const conversationRef = useRef<ModelChatMessage[]>([]);
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  });

  const baseUrl = useMemo(() => window.location.href.replace(/#.*$/, ''), []);

  const publishPreviewMessages = useCallback(
    (nextMessages: unknown[]) => {
      if (nextMessages.length === 0) return;
      latestPreviewMessagesRef.current = nextMessages;

      const initData = {
        protocol,
        demoUrl: DEFAULT_A2UI_DEMO_URL,
        messages: nextMessages,
        instant: true,
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
    [baseUrl, protocol],
  );

  const handlePreviewLoad = useCallback(() => {
    publishPreviewMessages(latestPreviewMessagesRef.current);
  }, [publishPreviewMessages]);

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
    const nextConversation = [...conversationRef.current, userMessage];
    conversationRef.current = nextConversation;

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text },
      { role: 'ai', content: 'Connecting to A2UI agent...' },
    ]);
    setInputValue('');
    setGeneratedJson('');
    setIsGenerating(true);

    void (async () => {
      try {
        const response = await window.fetch(getA2UIChatEndpoint(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: nextConversation }),
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
        );

        if (finalMessages.length === 0) {
          throw new Error('A2UI agent did not return valid messages');
        }

        const assistantContent = latestText.length > 0
          ? latestText
          : JSON.stringify(finalMessages);
        conversationRef.current = [
          ...nextConversation,
          { role: 'assistant', content: assistantContent },
        ];
        setMessages((prev) => {
          const next = prev.slice();
          next[next.length - 1] = {
            role: 'ai',
            content: `Done. Rendered ${finalMessages.length} A2UI message${
              finalMessages.length === 1 ? '' : 's'
            }.`,
          };
          return next;
        });
      } catch (e) {
        if (controller.signal.aborted) return;
        conversationRef.current = nextConversation.slice(0, -1);
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
  }, [inputValue, isGenerating, publishPreviewMessages]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div
      ref={pageRef}
      className={isPanelResizing ? 'chatPage resizing' : 'chatPage'}
    >
      <div className='chatPanel' style={chatPanelStyle}>
        <div className='chatHeader'>
          <div className='chatHeaderTitleRow'>
            <h2 className='chatHeaderTitle'>Create</h2>
            <span className='constructionBadge'>Online Agent</span>
          </div>
          <p className='chatHeaderSub'>Describe the UI you want to build</p>
        </div>

        <div className='chatMessages'>
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`chatMessage ${
                msg.role === 'user' ? 'chatMessageUser' : 'chatMessageAI'
              }`}
            >
              {msg.content}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className='chatInputArea'>
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
        afterBody={
          <>
            {generatedJson
              ? (
                <div className='chatGeneratedJson'>
                  <div className='chatGeneratedJsonTitle'>Generated JSON</div>
                  <pre>{generatedJson}</pre>
                </div>
              )
              : null}

            <div className='previewQrSection'>
              <div className='previewQrContent'>
                <div className='previewQrInfo'>
                  <div className='previewQrTitle'>View on Device</div>
                  <div className='previewQrDesc'>
                    Scan the QR code to preview on your mobile device.
                  </div>
                </div>
                {renderUrl
                  ? <QrCode value={renderUrl} size={80} />
                  : (
                    <div className='previewQrPlaceholder'>
                      <span className='previewQrPlaceholderText'>
                        No render
                      </span>
                    </div>
                  )}
              </div>
            </div>
          </>
        }
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
