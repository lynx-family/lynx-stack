// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useEffect, useRef, useState } from 'react';

import { useResizablePanels } from '../hooks/useResizablePanels.js';
import { MobilePreview } from '../components/MobilePreview.js';
import { QrCode } from '../components/QrCode.js';
import {
  createSession,
  getHealth,
  interrupt,
  streamChat,
} from '../utils/agentClient.js';
import type {
  AgentA2UIEvent,
  AgentDoneEvent,
  AgentErrorEvent,
  AgentHealthResponse,
  AgentUiStatus,
} from '../utils/agentTypes.js';
import { DEFAULT_DEMO_URL } from '../utils/demoUrl.js';
import type { ProtocolVersion } from '../utils/protocol.js';
import { buildRenderUrl } from '../utils/renderUrl.js';

interface StreamDebugState {
  phase: string;
  lastEvent: string;
  deltaChunks: number;
  deltaChars: number;
  hasA2UI: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string | React.ReactNode;
  status?: 'streaming' | 'done' | 'error';
  a2uiPayload?: AgentA2UIEvent;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'ai',
  content:
    'I\'m A2UI Assistant. Describe the UI you want to build and I\'ll generate A2UI JSON for you.',
};

const MOCK_AI_RESPONSE: ChatMessage = {
  role: 'ai',
  content: (
    <>
      AI generation is not yet connected. In the meantime, check out the{' '}
      <a href='#/examples' style={{ textDecoration: 'underline' }}>Examples</a>
      {' '}
      tab to see pre-recorded A2UI scenarios with simulated streaming — you can
      even adjust the playback speed.
    </>
  ),
};

const DESKTOP_PREVIEW_MIN_WIDTH = 360;
const DESKTOP_CHAT_MIN_WIDTH = 360;
const COMPACT_CHAT_MIN_HEIGHT = 280;
const COMPACT_PREVIEW_MIN_HEIGHT = 320;
const RESIZE_BREAKPOINT = 980;
function formatA2UIJson(payload: AgentA2UIEvent): string {
  return JSON.stringify(
    {
      messages: payload.messages,
      ...(payload.actionMocks === undefined
        ? {}
        : { actionMocks: payload.actionMocks }),
    },
    null,
    2,
  );
}

function getInitialStreamDebugState(): StreamDebugState {
  return {
    phase: 'idle',
    lastEvent: 'idle',
    deltaChunks: 0,
    deltaChars: 0,
    hasA2UI: false,
  };
}

function formatStatusPhase(payload: Record<string, unknown>): string {
  const phase = typeof payload.phase === 'string' ? payload.phase : '';
  const subtype = typeof payload.subtype === 'string' ? payload.subtype : '';
  const status = typeof payload.status === 'string' ? payload.status : '';
  const type = typeof payload.type === 'string' ? payload.type : '';

  if (phase) {
    return phase;
  }
  if (type === 'system' && subtype && status) {
    return `${subtype}:${status}`;
  }
  if (type === 'system' && subtype) {
    return subtype;
  }
  if (status) {
    return status;
  }
  return 'streaming';
}

function debugLog(event: string, payload: unknown): void {
  console.debug(`[AIChat debug] ${event}`, payload);
}

export function AIChatPage(
  props: { protocol: ProtocolVersion },
) {
  const { protocol } = props;
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState<string>('');
  const [agentStatus, setAgentStatus] = useState<AgentUiStatus>('checking');
  const [agentHealth, setAgentHealth] = useState<AgentHealthResponse | null>(
    null,
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transportError, setTransportError] = useState<string>('');
  const [renderUrl, setRenderUrl] = useState<string>('');
  const [previewQrError, setPreviewQrError] = useState<string>('');
  const [streamDebug, setStreamDebug] = useState<StreamDebugState>(
    getInitialStreamDebugState(),
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
  const streamControllerRef = useRef<AbortController | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  const providerLabel = agentHealth?.provider
    ? ` (${agentHealth.provider})`
    : '';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const health = await getHealth();
        if (cancelled) {
          return;
        }

        setAgentHealth(health);
        setTransportError('');
        setAgentStatus(health.status === 'ready' ? 'ready' : 'unavailable');
      } catch (error) {
        if (cancelled) {
          return;
        }

        setAgentStatus('unavailable');
        setTransportError(
          error instanceof Error
            ? error.message
            : 'Failed to check agent health.',
        );
      }
    })();

    return () => {
      cancelled = true;
      streamControllerRef.current?.abort();
    };
  }, []);

  const updatePreview = useCallback(
    (payload: AgentA2UIEvent) => {
      const url = buildRenderUrl(
        {
          protocol,
          demoUrl: DEFAULT_DEMO_URL,
          messages: payload.messages,
          actionMocks: payload.actionMocks,
        },
        window.location.origin,
      );
      setRenderUrl(url);
      setPreviewQrError('');
    },
    [protocol],
  );

  const ensureSession = useCallback(async () => {
    if (sessionId) {
      return sessionId;
    }

    const response = await createSession();
    setSessionId(response.sessionId);
    return response.sessionId;
  }, [sessionId]);

  const appendAssistantError = useCallback((message: string) => {
    const streamingId = streamingMessageIdRef.current;
    if (!streamingId) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai_error_${Date.now()}`,
          role: 'ai',
          content: message,
          status: 'error',
        },
      ]);
      return;
    }

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === streamingId
          ? {
            ...msg,
            content: msg.content || message,
            status: 'error',
          }
          : msg
      )
    );
  }, []);

  const finalizeAssistantMessage = useCallback((payload?: AgentDoneEvent) => {
    const streamingId = streamingMessageIdRef.current;
    if (!streamingId) {
      return;
    }

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === streamingId
          ? {
            ...msg,
            content: msg.content === ''
              ? (payload?.resultText ?? '')
              : msg.content,
            status: 'done',
          }
          : msg
      )
    );
    streamingMessageIdRef.current = null;
  }, []);

  const handleStop = useCallback(() => {
    const activeSessionId = sessionId;
    if (!activeSessionId) {
      return;
    }

    streamControllerRef.current?.abort();
    streamControllerRef.current = null;
    void interrupt(activeSessionId).catch(() => undefined);

    const streamingId = streamingMessageIdRef.current;
    if (streamingId) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === streamingId
            ? {
              ...msg,
              content: msg.content === '' ? '[stopped]' : msg.content,
              status: 'done',
            }
            : msg
        )
      );
      streamingMessageIdRef.current = null;
    }

    setAgentStatus(agentHealth?.status === 'ready' ? 'ready' : 'unavailable');
  }, [agentHealth?.status, sessionId]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || agentStatus === 'checking' || agentStatus === 'streaming') {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      status: 'done',
    };
    const assistantMessageId = `ai_${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: assistantMessageId,
        role: 'ai',
        content: '',
        status: 'streaming',
      },
    ]);
    setInputValue('');
    setTransportError('');
    setAgentStatus('streaming');
    setStreamDebug({
      phase: 'requesting',
      lastEvent: 'send',
      deltaChunks: 0,
      deltaChars: 0,
      hasA2UI: false,
    });
    streamingMessageIdRef.current = assistantMessageId;
    debugLog('send', { text });

    try {
      const activeSessionId = await ensureSession();
      const controller = streamChat({
        sessionId: activeSessionId,
        text,
        onStatus: (payload) => {
          const phase = formatStatusPhase(payload);
          setStreamDebug((prev) => ({
            ...prev,
            phase,
            lastEvent: 'status',
          }));
          debugLog('status', payload);
        },
        onDelta: (payload) => {
          const deltaText = payload.text;
          if (!deltaText) {
            return;
          }

          setStreamDebug((prev) => ({
            ...prev,
            phase: 'streaming-text',
            lastEvent: 'delta',
            deltaChunks: prev.deltaChunks + 1,
            deltaChars: prev.deltaChars + deltaText.length,
          }));
          debugLog('delta', {
            text: deltaText,
            chunkLength: deltaText.length,
          });
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                  ...msg,
                  content: msg.content + deltaText,
                  status: 'streaming',
                }
                : msg
            )
          );
        },
        onDone: (payload) => {
          streamControllerRef.current = null;
          setStreamDebug((prev) => ({
            ...prev,
            phase: 'done',
            lastEvent: 'done',
          }));
          debugLog('done', payload);
          finalizeAssistantMessage(payload);
          setAgentStatus(
            agentHealth?.status === 'ready' ? 'ready' : 'unavailable',
          );
        },
        onError: (payload: AgentErrorEvent) => {
          streamControllerRef.current = null;
          const message = payload.message ?? payload.reason
            ?? 'Agent request failed.';
          setStreamDebug((prev) => ({
            ...prev,
            phase: 'error',
            lastEvent: 'error',
          }));
          debugLog('error', payload);
          appendAssistantError(message);
          setTransportError(message);
          setAgentStatus(
            agentHealth?.status === 'ready' ? 'ready' : 'unavailable',
          );
        },
        onA2UI: (payload) => {
          setStreamDebug((prev) => ({
            ...prev,
            phase: 'a2ui-ready',
            lastEvent: 'a2ui',
            hasA2UI: true,
          }));
          debugLog('a2ui', payload);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                  ...msg,
                  a2uiPayload: payload,
                }
                : msg
            )
          );
          updatePreview(payload);
        },
      });

      streamControllerRef.current = controller;
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Failed to start agent request.';
      setStreamDebug((prev) => ({
        ...prev,
        phase: 'error',
        lastEvent: 'error',
      }));
      debugLog('request-error', error);
      appendAssistantError(message);
      setTransportError(message);
      setAgentStatus(agentHealth?.status === 'ready' ? 'ready' : 'unavailable');
    }
  }, [
    agentHealth?.status,
    agentStatus,
    appendAssistantError,
    ensureSession,
    finalizeAssistantMessage,
    inputValue,
    updatePreview,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        void handleSend();
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
            <span className='constructionBadge'>Under construction</span>
          </div>
          <p className='chatHeaderSub'>
            Status: {(() => {
              if (agentStatus === 'checking') {
                return 'Checking Agent';
              }
              if (agentStatus === 'streaming') {
                return 'Streaming';
              }
              if (agentStatus === 'ready') {
                return `Ready${providerLabel}`;
              }
              return 'Unavailable';
            })()}
          </p>
          {transportError
            ? <p className='chatHeaderSub'>{transportError}</p>
            : null}
          <div className='chatDebugPanel'>
            <span className='chatDebugChip'>Phase: {streamDebug.phase}</span>
            <span className='chatDebugChip'>
              Last event: {streamDebug.lastEvent}
            </span>
            <span className='chatDebugChip'>
              Delta chunks: {String(streamDebug.deltaChunks)}
            </span>
            <span className='chatDebugChip'>
              Delta chars: {String(streamDebug.deltaChars)}
            </span>
            <span className='chatDebugChip'>
              A2UI: {streamDebug.hasA2UI ? 'yes' : 'no'}
            </span>
          </div>
        </div>

        <div className='chatMessages'>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`chatMessage ${
                msg.role === 'user' ? 'chatMessageUser' : 'chatMessageAI'
              }`}
            >
              {msg.content || (msg.status === 'streaming' ? 'Thinking...' : '')}
              {msg.a2uiPayload
                ? (
                  <div className='chatCodeBlock'>
                    <div className='chatCodeBlockHeader'>
                      Generated A2UI JSON
                    </div>
                    <pre className='chatCodeBlockPre'>
                      <code>{formatA2UIJson(msg.a2uiPayload)}</code>
                    </pre>
                  </div>
                )
                : null}
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
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className='chatSendBtn'
            type='button'
            onClick={() => {
              if (agentStatus === 'streaming') {
                handleStop();
                return;
              }
              void handleSend();
            }}
            disabled={agentStatus !== 'ready' && agentStatus !== 'streaming'}
          >
            {agentStatus === 'streaming' ? 'Stop' : 'Send'}
          </button>
        </div>
      </div>

      <div
        className={isPanelResizing
          ? 'panelResizeHandle active'
          : 'panelResizeHandle'}
        role='separator'
        aria-orientation={isCompactLayout ? 'horizontal' : 'vertical'}
        aria-label='Resize Create and preview panels'
        title='Drag to resize'
        onPointerDown={handlePanelResizeStart}
      />

      <div className='previewPanel' style={previewPanelStyle}>
        <div className='previewPanelHeader'>
          <span className='previewPanelTitle'>Lynx Preview</span>
        </div>
        <div className='previewPanelBody'>
          {renderUrl
            ? <MobilePreview src={renderUrl} />
            : (
              <div className='previewEmpty'>
                <div className='previewEmptyIcon'>💬</div>
                <div>Send a message to generate UI</div>
                <div className='previewEmptySub'>
                  Generated components will be previewed here
                </div>
              </div>
            )}
        </div>

        <div className='previewQrSection'>
          <div className='previewQrContent'>
            <div className='previewQrInfo'>
              <div className='previewQrTitle'>View on Device</div>
              <div className='previewQrDesc'>
                {previewQrError
                  ? 'QR code unavailable for this render.'
                  : 'Scan the QR code to preview on your mobile device.'}
              </div>
            </div>
            {renderUrl
              ? (
                <QrCode
                  value={renderUrl}
                  size={80}
                  onErrorChange={setPreviewQrError}
                />
              )
              : (
                <div className='previewQrPlaceholder'>
                  <span className='previewQrPlaceholderText'>No render</span>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
