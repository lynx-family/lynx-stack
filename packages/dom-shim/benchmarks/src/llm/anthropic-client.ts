// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

/**
 * Multi-provider LLM client wrapper. Auto-detects from env which provider to
 * use:
 *   - if OPENAI_API_KEY is set, use OpenAI (default model: gpt-4o)
 *   - else if ANTHROPIC_API_KEY is set, use Anthropic (default: claude-opus-4-7)
 *   - else throws a descriptive error.
 *
 * Per PRD FR-8: 'LLM API key from ANTHROPIC_API_KEY (Claude default) or
 * OPENAI_API_KEY'. File kept under its original name so route imports do not
 * churn; logically it is now a generic LLM client.
 */

export interface LLMCallRequest {
  system: string;
  user: string;
  /** Model id. If empty/undefined, use provider default. */
  model: string;
  /** Hard max for output. */
  maxTokens?: number;
}

export interface LLMCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export type Provider = 'openai' | 'anthropic';

interface VisionCallRequest {
  system: string;
  promptText: string;
  imageBase64: string;
  imageMimeType: 'image/png' | 'image/jpeg';
  model: string;
  maxTokens?: number;
}

let cachedAnthropic: Anthropic | null = null;
let cachedOpenAI: OpenAI | null = null;

function detectProvider(): Provider {
  if (process.env['OPENAI_API_KEY']) return 'openai';
  if (process.env['ANTHROPIC_API_KEY']) return 'anthropic';
  throw new Error(
    'Neither OPENAI_API_KEY nor ANTHROPIC_API_KEY is set. '
      + 'Real benchmark runs need an API key; use --dry-run to exercise the '
      + 'harness without calling any provider.',
  );
}

function getAnthropic(): Anthropic {
  if (cachedAnthropic) return cachedAnthropic;
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  cachedAnthropic = new Anthropic({ apiKey });
  return cachedAnthropic;
}

function getOpenAI(): OpenAI {
  if (cachedOpenAI) return cachedOpenAI;
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  cachedOpenAI = new OpenAI({ apiKey });
  return cachedOpenAI;
}

export function currentProvider(): Provider {
  return detectProvider();
}

export function defaultModelForProvider(p: Provider): string {
  return p === 'openai' ? 'gpt-4o' : 'claude-opus-4-7';
}

/**
 * If the caller passed a Claude model id but the active provider is OpenAI
 * (or vice versa), silently switch to the provider's default. This is the
 * 'cross-vendor model name fix-up' the benchmark CLI used to maintain
 * manually; it now lives here so all call sites get the same behavior.
 */
function normalizeModel(p: Provider, requested: string): string {
  if (!requested) return defaultModelForProvider(p);
  const looksLikeClaude = requested.startsWith('claude-');
  const looksLikeGpt = requested.startsWith('gpt-')
    || requested.startsWith('o1')
    || requested.startsWith('o3');
  if (p === 'openai' && looksLikeClaude) return defaultModelForProvider(p);
  if (p === 'anthropic' && looksLikeGpt) return defaultModelForProvider(p);
  return requested;
}

/** Make a single text completion call across providers. */
export async function callLLM(req: LLMCallRequest): Promise<LLMCallResult> {
  const p = detectProvider();
  const model = normalizeModel(p, req.model);
  const maxTokens = req.maxTokens ?? 4096;

  if (p === 'openai') {
    const c = getOpenAI();
    const resp = await c.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
    });
    const text = resp.choices[0]?.message?.content ?? '';
    return {
      text,
      inputTokens: resp.usage?.prompt_tokens ?? 0,
      outputTokens: resp.usage?.completion_tokens ?? 0,
    };
  }

  const c = getAnthropic();
  const resp = await c.messages.create({
    model,
    max_tokens: maxTokens,
    system: req.system,
    messages: [{ role: 'user', content: req.user }],
  });
  let text = '';
  for (const block of resp.content) {
    if (block.type === 'text') text += block.text;
  }
  return {
    text,
    inputTokens: resp.usage.input_tokens,
    outputTokens: resp.usage.output_tokens,
  };
}

/** Make a single vision call across providers. */
export async function callLLMVision(
  req: VisionCallRequest,
): Promise<LLMCallResult> {
  const p = detectProvider();
  const model = normalizeModel(p, req.model);
  const maxTokens = req.maxTokens ?? 256;

  if (p === 'openai') {
    const c = getOpenAI();
    const resp = await c.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: req.system },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Prompt: ${req.promptText}` },
            {
              type: 'image_url',
              image_url: {
                url: `data:${req.imageMimeType};base64,${req.imageBase64}`,
              },
            },
          ],
        },
      ],
    });
    const text = resp.choices[0]?.message?.content ?? '';
    return {
      text,
      inputTokens: resp.usage?.prompt_tokens ?? 0,
      outputTokens: resp.usage?.completion_tokens ?? 0,
    };
  }

  const c = getAnthropic();
  const resp = await c.messages.create({
    model,
    max_tokens: maxTokens,
    system: req.system,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: req.imageMimeType,
              data: req.imageBase64,
            },
          },
          { type: 'text', text: `Prompt: ${req.promptText}` },
        ],
      },
    ],
  });
  let text = '';
  for (const block of resp.content) {
    if (block.type === 'text') text += block.text;
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
 */
export function extractCodeBlock(text: string): string {
  const fence = /```[a-z]*\n([\s\S]*?)\n```/i.exec(text);
  if (fence?.[1]) return fence[1].trim();
  return text.trim();
}

/**
 * Cheap input-token estimator using the canonical `chars / 4` heuristic. Good
 * enough for budget gates; we deliberately avoid pulling tiktoken (not already
 * in this monorepo) just to refine the estimate by a few percent.
 *
 * Both system and user are summed because every API call counts them as
 * input tokens.
 */
export function estimateInputTokens(system: string, user: string): number {
  return Math.ceil((system.length + user.length) / 4);
}
