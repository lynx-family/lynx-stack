// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ChatMessage } from './types.js';

interface GenerationRepairInput {
  initialMessages: readonly ChatMessage[];
  messages: readonly ChatMessage[];
  result: { text: string; finishReason?: unknown };
  repairPrompt: string;
}

export function buildCompactGenerationMessages(
  initialMessages: readonly ChatMessage[],
): ChatMessage[] {
  return [
    ...initialMessages,
    {
      role: 'user',
      content: [
        'The previous attempt reached its output token limit without producing a valid complete artifact.',
        'Regenerate a shorter, complete artifact from the original request within the available output budget. Follow the original output contract.',
        'Keep reasoning brief and reserve enough output tokens to finish the artifact.',
        'Preserve all required content and actions. Reduce optional details, reuse repeated structures, and omit comments and explanatory prose.',
      ].join('\n'),
    },
  ];
}

/** Call only after validation fails and the caller has a remaining attempt. */
export function buildGenerationRepairMessages({
  initialMessages,
  messages,
  result,
  repairPrompt,
}: GenerationRepairInput): ChatMessage[] {
  if (result.finishReason === 'length') {
    // Keep prior conversation context, but discard this run's failed attempts.
    return buildCompactGenerationMessages(initialMessages);
  }

  return [
    ...messages,
    { role: 'assistant', content: result.text },
    { role: 'user', content: repairPrompt },
  ];
}
