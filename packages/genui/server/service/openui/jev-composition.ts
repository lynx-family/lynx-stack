// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { OpenUIChatOptions } from './openui-agent.js';
import { composeJevOpenUI } from '../../agent/openui/jev-composer.js';
import {
  consumeJevComposition,
  createJevCompositionStream,
} from '../common/jev-composition.js';
import type { ChatMessage, ConversationContext } from '../common/types.js';

export function streamJevOpenUI(
  messages: ChatMessage[],
  opts: OpenUIChatOptions,
  conversation?: ConversationContext,
  abortSignal?: AbortSignal,
) {
  return createJevCompositionStream(
    opts,
    abortSignal,
    async function*(runtime) {
      const text = await composeJevOpenUI({
        ...opts,
        messages,
        conversation,
        ...runtime,
      });
      yield { text, delta: text };
    },
  );
}

export async function generateJevOpenUI(
  messages: ChatMessage[],
  opts: OpenUIChatOptions,
  conversation?: ConversationContext,
  signal?: AbortSignal,
) {
  return await consumeJevComposition(
    streamJevOpenUI(messages, opts, conversation, signal),
  );
}
