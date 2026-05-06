// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useEffect, useRef, useState } from 'react';

import { useResizablePanels } from '../hooks/useResizablePanels.js';
import type { Protocol } from '../utils/protocol.js';

interface ChatMessage {
  role: 'user' | 'ai';
  content: string | React.ReactNode;
}

const WELCOME_MESSAGE: ChatMessage = {
  role: 'ai',
  content:
    'I\'m A2UI Assistant. Describe the UI you want to build and I\'ll generate A2UI JSON for you.',
};

const MOCK_AI_RESPONSE: ChatMessage = {
  role: 'ai',
  content: (
    <>
      AI generation is not yet connected. In the meantime, check out the{' '}
      <a href='#/a2ui/demos' style={{ textDecoration: 'underline' }}>Demos</a>
      {' '}
      tab to see pre-recorded A2UI scenarios with simulated streaming — you can
      even adjust the playback speed.
    </>
  ),
};

const DESKTOP_PREVIEW_MIN_WIDTH = 320;
const DESKTOP_CHAT_MIN_WIDTH = 360;
const COMPACT_CHAT_MIN_HEIGHT = 280;
const COMPACT_PREVIEW_MIN_HEIGHT = 320;
const RESIZE_BREAKPOINT = 980;

export function AIChatPage(
  _props: { protocol: Protocol },
) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState<string>('');
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
    initialSecondarySize: 420,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  });

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text) {
      return;
    }

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text },
    ]);
    setInputValue('');

    setTimeout(() => {
      setMessages((prev) => [...prev, MOCK_AI_RESPONSE]);
    }, 600);
  }, [inputValue]);

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
            <h2 className='chatHeaderTitle'>AI Chat</h2>
            <span className='constructionBadge'>Under construction</span>
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
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className='chatSendBtn'
            type='button'
            onClick={handleSend}
          >
            Send
          </button>
        </div>
      </div>

      <div
        className={isPanelResizing
          ? 'panelResizeHandle active'
          : 'panelResizeHandle'}
        role='separator'
        aria-orientation={isCompactLayout ? 'horizontal' : 'vertical'}
        aria-label='Resize AI Chat and preview panels'
        title='Drag to resize'
        onPointerDown={handlePanelResizeStart}
      />

      <div className='previewPanel' style={previewPanelStyle}>
        <div className='previewPanelHeader'>
          <span className='previewPanelTitle'>Lynx Preview</span>
        </div>
        <div className='previewPanelBody'>
          <div className='previewEmpty'>
            <div className='previewEmptyIcon'>💬</div>
            <div>Send a message to generate UI</div>
            <div className='previewEmptySub'>
              Generated components will be previewed here
            </div>
          </div>
        </div>

        <div className='previewQrSection'>
          <div className='previewQrContent'>
            <div className='previewQrInfo'>
              <div className='previewQrTitle'>View on Device</div>
              <div className='previewQrDesc'>
                Scan the QR code to preview on your mobile device.
              </div>
            </div>
            <div className='previewQrPlaceholder'>
              <span className='previewQrPlaceholderText'>No render</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
