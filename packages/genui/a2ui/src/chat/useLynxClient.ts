import { useState, useRef, useCallback } from '@lynx-js/react';
import { BaseClient } from "../core/BaseClient";
import { type Message } from "./Conversation";

export interface UseLynxClientOptions {
  keepHistory?: boolean;
}

export function useLynxClient(url: string, options: UseLynxClientOptions = {}): any {
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
              (m) => m.id !== `${messageId}-agent` && m.id !== `${messageId}-agent-new`,
            ),
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
        const userMsgId =
          'user_' +
          Date.now().toString(36) +
          Math.random().toString(36).slice(2, 10);
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
