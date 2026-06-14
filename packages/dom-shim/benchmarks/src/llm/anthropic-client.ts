// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Anthropic from '@anthropic-ai/sdk';

export interface LLMCallRequest {
  system: string;
  user: string;
  model: string;
  /** Hard max for output. */
  maxTokens?: number;
}

export interface LLMCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Lazy-instantiated Anthropic client. Reads ANTHROPIC_API_KEY from env on
 * first call. Throws a clear error if missing.
 */
let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Real benchmark runs need a key; '
        + 'use --dry-run to exercise the harness without calling the API.',
    );
  }
  client = new Anthropic({ apiKey });
  return client;
}

/**
 * Make a single message call. Wraps the SDK so all routes share a single
 * model-id and error-handling path.
 */
export async function callLLM(req: LLMCallRequest): Promise<LLMCallResult> {
  const c = getClient();
  const resp = await c.messages.create({
    model: req.model,
    max_tokens: req.maxTokens ?? 4096,
    system: req.system,
    messages: [{ role: 'user', content: req.user }],
  });

  // Concatenate any text blocks; ignore tool-use or other content kinds.
  let text = '';
  for (const block of resp.content) {
    if (block.type === 'text') {
      text += block.text;
    }
  }
  return {
    text,
    inputTokens: resp.usage.input_tokens,
    outputTokens: resp.usage.output_tokens,
  };
}

/**
 * Strip surrounding markdown code fences from an LLM response, returning the
 * raw code body. If multiple fenced blocks exist, returns the first one.
 *
 * Recognizes ```ts / ```typescript / ```html / ```json / ``` (any).
 */
export function extractCodeBlock(text: string): string {
  const fence = /```[a-z]*\n([\s\S]*?)\n```/i.exec(text);
  if (fence?.[1]) return fence[1].trim();
  return text.trim();
}
