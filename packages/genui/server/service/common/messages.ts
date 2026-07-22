// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ChatMessage, ConversationContext } from './types';

export type DataModelMessageFactory = (
  dataModel: Record<string, unknown>,
) => ChatMessage;

export function buildConversationMessages(
  messages: ChatMessage[],
  conversation?: ConversationContext,
  buildDataModelMessage?: DataModelMessageFactory,
): ChatMessage[] {
  return [
    ...(conversation?.history ?? []),
    ...(conversation
        && buildDataModelMessage
        && Object.keys(conversation.dataModel).length > 0
      ? [buildDataModelMessage(conversation.dataModel)]
      : []),
    ...messages,
  ];
}

export function toModelMessages(messages: ChatMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

export function sumContentChars(messages: ChatMessage[]): number {
  return messages.reduce((total, message) => total + message.content.length, 0);
}
