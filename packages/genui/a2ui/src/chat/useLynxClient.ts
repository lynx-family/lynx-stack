// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useCallback, useRef, useState } from '@lynx-js/react';

import type { Message } from './Conversation.js';
import { BaseClient } from '../core/BaseClient.js';
import type { Resource } from '../core/types.js';

export interface UseLynxClientOptions {
  keepHistory?: boolean;
}

export interface UseLynxClientResult {
  messages: Message[];
  sendMessage: (
    content: string,
  ) => Promise<{ messageId: string; resource: Resource }>;
  setMessages: import('@lynx-js/react').Dispatch<
    import('@lynx-js/react').SetStateAction<Message[]>
  >;
  clientRef: import('@lynx-js/react').MutableRefObject<BaseClient | null>;
}

export function useLynxClient(
  url: string,
  options: UseLynxClientOptions = {},
): UseLynxClientResult {
  const { keepHistory = true } = options;
  const clientRef = useRef<BaseClient | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const getClient = useCallback(() => {
    if (!clientRef.current) {
      const client = new BaseClient(url);

      client.onResourceCreated = (resource, id) => {
        if (!keepHistory) return;
        setMessages((prev) => [
          ...prev,
          {
            id: `${id}-agent-new`,
            role: 'agent',
            content: '',
            resource,
          },
        ]);
      };

      client.onResponseComplete = (messageId, { hasBeginRendering }) => {
        if (!keepHistory) return;
        if (!hasBeginRendering) {
          setMessages((prev) =>
            prev.filter(
              (m) =>
                m.id !== `${messageId}-agent`
                && m.id !== `${messageId}-agent-new`,
            )
          );
        }
      };

      clientRef.current = client;
    }
    return clientRef.current;
  }, [url, keepHistory]);

  const sendMessage = useCallback(
    async (content: string) => {
      const client = getClient();

      if (keepHistory) {
        const userMsgId = 'user_'
          + Date.now().toString(36)
          + Math.random().toString(36).slice(2, 10);
        setMessages((prev) => [
          ...prev,
          {
            id: userMsgId,
            role: 'user',
            content,
          },
        ]);
      }

      const result = await client.makeRequest(content);
      const { messageId, resource } = result;

      if (keepHistory) {
        setMessages((prev) => [
          ...prev,
          {
            id: `${messageId}-agent`,
            role: 'agent',
            content: '',
            resource,
          },
        ]);
      }

      return result;
    },
    [getClient, keepHistory],
  );

  return {
    messages,
    sendMessage,
    setMessages,
    clientRef,
  };
}
