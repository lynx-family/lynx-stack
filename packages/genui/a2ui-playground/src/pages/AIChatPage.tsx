// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ProtocolVersion } from '../utils/protocol.js';

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  role: 'ai',
  content:
    'I\'m A2UI Assistant. Describe the UI you want to build and I\'ll generate A2UI JSON for you.',
};

const MOCK_AI_RESPONSE: ChatMessage = {
  role: 'ai',
  content:
    'AI generation is not yet connected. This is a preview of the AI Chat interface. In the future, this will generate A2UI components based on your description.',
};

export function AIChatPage(
  _props: { protocol: ProtocolVersion },
) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [inputValue, setInputValue] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    <div className='chatPage'>
      <div className='chatPanel'>
        <div className='chatHeader'>
          <h2 className='chatHeaderTitle'>AI Chat</h2>
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

      <div className='previewPanel'>
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
