// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  Input,
  KeyboardAwareResponder,
  KeyboardAwareRoot,
  KeyboardAwareTrigger,
} from '@lynx-js/lynx-ui-input';
import type { InputRef } from '@lynx-js/lynx-ui-input';
import { useCallback, useRef, useState } from '@lynx-js/react';

import { useLynxClient } from './useLynxClient.js';
import { A2UIRender } from '../core/A2UIRender.js';
import type { Resource } from '../core/types.js';

export interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  resource?: Resource;
}

export interface ConversationProps {
  initialInput?: string;
  messages?: Message[];
  sendMessage?: (content: string) => Promise<void>;
  url?: string;
}

export function Conversation(
  props: ConversationProps,
): import('@lynx-js/react').ReactNode {
  const { initialInput, url } = props;

  // Logic to handle self-managed state if url is provided
  // We pass a dummy string if url is missing to satisfy the hook type, but we won't use the result if controlled
  const hookResult = useLynxClient(url ?? '');

  // If controlled props are provided, use them; otherwise use hook result if url is present
  const messages = props.messages ?? (url ? hookResult.messages : []);
  const sendMessage = props.sendMessage
    ?? (url ? hookResult.sendMessage : undefined);
  const inputRef = useRef<InputRef>(null);

  if (!sendMessage && !props.messages) {
    // Fallback or error if neither controlled nor uncontrolled props are valid
    console.warn(
      'Conversation requires either `messages` and `sendMessage` OR `url`.',
    );
  }

  const [inputValue, setInputValue] = useState(initialInput);
  const [isLoading, setIsLoading] = useState(false);

  const handleInput = useCallback((e: string) => {
    setInputValue(e);
  }, []);

  const handleSend = useCallback(() => {
    setIsLoading(true);
    const content = inputValue ?? 'Introduce yourself.';
    setInputValue('');
    void inputRef.current?.blur();
    void inputRef.current?.setValue('');
    try {
      if (sendMessage) {
        void sendMessage(content);
      }
    } catch (e) {
      console.error('sendMessage error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, sendMessage]);

  return (
    <KeyboardAwareRoot androidStatusBarPlusBottomBarHeight={74}>
      <KeyboardAwareResponder
        as='View'
        className='container luna-light'
        scrollOrientation='vertical'
      >
        <scroll-view className='message-list' scroll-y>
          {messages?.map((item: Message) =>
            item.role === 'user'
              ? (
                <view key={`user-${item.id}`} className={`message-item user`}>
                  <text className='user-text'>{item.content}</text>
                </view>
              )
              : (
                <view
                  key={`assistant-${item.id}`}
                  className={`message-item assistant`}
                >
                  <A2UIRender
                    resource={item.resource!}
                    renderFallback={() => (
                      <text className='loading-text'>Thinking...</text>
                    )}
                  />
                </view>
              )
          )}
          {isLoading && (
            <view className={`message-item assistant`}>
              <text className='loading-text'>Thinking...</text>
            </view>
          )}
        </scroll-view>
        <KeyboardAwareTrigger>
          <view id='panel' className='input-area'>
            <Input
              ref={inputRef}
              className='input'
              onInput={handleInput}
              defaultValue={inputValue ?? ''}
              placeholder='Ask me anything...'
            />
            <view
              className='send-btn'
              bindtap={() => {
                void handleSend();
              }}
            >
              <text className='send-text'>↑</text>
            </view>
          </view>
        </KeyboardAwareTrigger>
      </KeyboardAwareResponder>
    </KeyboardAwareRoot>
  );
}
