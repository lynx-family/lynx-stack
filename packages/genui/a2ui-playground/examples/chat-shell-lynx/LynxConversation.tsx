// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// Reference Lynx-themed chat shell. NOT shipped from
// `@lynx-js/a2ui-reactlynx`. Depends on `@lynx-js/lynx-ui-input` and
// applies the `luna-light` theme — copy and adapt rather than depending
// on it directly.
//
// Each turn (user prompt + agent response) gets its own `MessageStore`
// and its own `<A2UI>` instance. The shell only knows about turns; the
// renderer handles everything inside an agent turn.
import { A2UI } from '@lynx-js/a2ui-reactlynx';
import type {
  CatalogInput,
  MessageStore,
  UserActionPayload,
} from '@lynx-js/a2ui-reactlynx';
import {
  Input,
  KeyboardAwareResponder,
  KeyboardAwareRoot,
  KeyboardAwareTrigger,
} from '@lynx-js/lynx-ui-input';
import type { InputRef } from '@lynx-js/lynx-ui-input';
import { useCallback, useRef, useState } from '@lynx-js/react';

import { useChatMessages } from './useChatMessages.js';

/**
 * Developer's IO contract: given an input + the agent-turn store, stream
 * the response messages into the store. Called once per `send()`.
 */
export type ChatRespondFn = (
  input: string,
  store: MessageStore,
) => void | Promise<void>;

export interface LynxConversationProps {
  /** Catalog passed to each turn's `<A2UI>`. */
  catalogs: readonly CatalogInput[];
  /** Stream the agent's response into the provided store. */
  respond: ChatRespondFn;
  /**
   * Forward a user action that fired inside an earlier turn. The default
   * routes the action through `respond(...)` against the latest agent
   * turn's store, but consumers can override (e.g., to spawn a new turn).
   */
  onAction?: (
    action: UserActionPayload,
    latestStore: MessageStore | undefined,
  ) => void | Promise<void>;
  /** Initial composer value (uncontrolled after mount). */
  defaultInput?: string;
}

export function LynxConversation(
  props: LynxConversationProps,
): import('@lynx-js/react').ReactNode {
  const { catalogs, respond, onAction, defaultInput } = props;
  const { turns, send } = useChatMessages();

  const inputRef = useRef<InputRef>(null);
  const [inputValue, setInputValue] = useState(defaultInput);
  const [isSending, setIsSending] = useState(false);

  const latestAgentStoreRef = useRef<MessageStore | undefined>(undefined);
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const t = turns[i];
    if (t && t.kind === 'agent') {
      latestAgentStoreRef.current = t.store;
      break;
    }
  }

  const handleInput = useCallback((e: string) => {
    setInputValue(e);
  }, []);

  const handleSend = useCallback(async () => {
    setIsSending(true);
    const content = inputValue ?? 'Introduce yourself.';
    setInputValue('');
    void inputRef.current?.blur();
    void inputRef.current?.setValue('');
    try {
      await send(content, respond);
    } catch (e) {
      console.error('respond threw:', e);
    } finally {
      setIsSending(false);
    }
  }, [inputValue, send, respond]);

  const handleAction = useCallback(
    (action: UserActionPayload) => {
      if (onAction) {
        void onAction(action, latestAgentStoreRef.current);
      }
    },
    [onAction],
  );

  return (
    <KeyboardAwareRoot androidStatusBarPlusBottomBarHeight={74}>
      <KeyboardAwareResponder
        as='View'
        className='container luna-light'
        scrollOrientation='vertical'
      >
        <scroll-view className='message-list' scroll-y>
          {turns.map((turn) =>
            turn.kind === 'user'
              ? (
                <view
                  key={`user-${turn.id}`}
                  className='message-item user'
                >
                  <text className='user-text'>{turn.content}</text>
                </view>
              )
              : (
                <view
                  key={`agent-${turn.id}`}
                  className='message-item assistant'
                >
                  <A2UI
                    messageStore={turn.store}
                    catalogs={catalogs}
                    onAction={handleAction}
                    renderEmpty={() => (
                      <text className='loading-text'>Thinking...</text>
                    )}
                    renderFallback={() => (
                      <text className='loading-text'>Thinking...</text>
                    )}
                    wrapSurface={(c) => <view className='luna-light'>{c}</view>}
                  />
                </view>
              )
          )}
          {isSending && (
            <view className='message-item assistant'>
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
              defaultValue={defaultInput ?? ''}
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
