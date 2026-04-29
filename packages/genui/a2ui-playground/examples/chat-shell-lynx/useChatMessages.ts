// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
//
// Reference chat-history state for a multi-turn conversation. NOT shipped
// from `@lynx-js/a2ui-reactlynx` — copy as a starting point.
//
// Each turn owns its own `MessageStore` so each `<A2UI>` instance has a
// bounded buffer to process. The shell renders one `<A2UI>` per agent
// turn alongside the user-prompt bubble.
import type {
  MessageStore,
  ServerToClientMessage,
} from '@lynx-js/a2ui-reactlynx';
import { createMessageStore } from '@lynx-js/a2ui-reactlynx';
import { useCallback, useState } from '@lynx-js/react';

export interface UserTurn {
  kind: 'user';
  id: string;
  content: string;
}

export interface AgentTurn {
  kind: 'agent';
  id: string;
  /** Owning store for this turn — pass to `<A2UI messageStore={...}>`. */
  store: MessageStore;
}

export type ChatTurn = UserTurn | AgentTurn;

export type RespondHandler = (
  input: string,
  store: MessageStore,
) => void | Promise<void>;

export interface UseChatMessagesResult {
  turns: readonly ChatTurn[];
  /**
   * Append a user turn AND a fresh agent turn (with a new store), then
   * invoke `respond` so the developer's IO can stream messages into the
   * agent turn's store.
   */
  send: (input: string, respond: RespondHandler) => Promise<void>;
  /** Clear all turns. */
  reset: () => void;
  /**
   * Push messages into the most recent agent turn. Useful when the
   * agent responds to a user action that fired inside an earlier turn
   * but you want the response to appear as the latest turn.
   */
  pushToLatestAgentTurn: (
    messages: readonly ServerToClientMessage[],
  ) => void;
}

function randomId(prefix: string) {
  return prefix + Date.now().toString(36)
    + Math.random().toString(36).slice(2, 10);
}

export function useChatMessages(): UseChatMessagesResult {
  const [turns, setTurns] = useState<ChatTurn[]>([]);

  const send = useCallback(
    async (input: string, respond: RespondHandler) => {
      const userTurn: UserTurn = {
        kind: 'user',
        id: randomId('user_'),
        content: input,
      };
      const agentStore = createMessageStore();
      const agentTurn: AgentTurn = {
        kind: 'agent',
        id: randomId('agent_'),
        store: agentStore,
      };
      setTurns((prev) => [...prev, userTurn, agentTurn]);
      await respond(input, agentStore);
    },
    [],
  );

  const reset = useCallback(() => {
    setTurns([]);
  }, []);

  const pushToLatestAgentTurn = useCallback(
    (messages: readonly ServerToClientMessage[]) => {
      setTurns((prev) => {
        for (let i = prev.length - 1; i >= 0; i -= 1) {
          const t = prev[i];
          if (t && t.kind === 'agent') {
            t.store.push(messages);
            break;
          }
        }
        return prev;
      });
    },
    [],
  );

  return { turns, send, reset, pushToLatestAgentTurn };
}
