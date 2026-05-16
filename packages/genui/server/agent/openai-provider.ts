// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createOpenAI } from '@ai-sdk/openai';
import type { AgentConfig } from '@mastra/core/agent';

import { isOfficialOpenAIBaseURL } from './openai-utils';
import type { ChatMessage } from '../service/a2ui-agent';

export interface OpenAIProviderOptions {
  apiKey?: string | undefined;
  baseURL?: string | undefined;
  model?: string | undefined;
  api?: 'chat' | 'responses' | undefined;
}

const DEFAULT_MODEL = 'gpt-4o-mini';

interface LLMProvider {
  provider: ReturnType<typeof createOpenAI>;
  buildModel: (id: string) => AgentConfig['model'];
  model: string;
  api: 'chat' | 'responses';
  baseURL: string;
}

type CompatChatMessage =
  | ChatMessage
  | (Omit<ChatMessage, 'role'> & {
    role: 'developer';
  });

interface CompatRequestBody {
  messages?: CompatChatMessage[];
}

interface OpenAIEnv {
  OPENAI_API_KEY?: string | undefined;
  OPENAI_API_STYLE?: 'chat' | 'responses' | undefined;
  OPENAI_BASE_URL?: string | undefined;
  OPENAI_MODEL?: string | undefined;
}

const compatFetch: typeof fetch = async (input, init) => {
  if (!init || !init.body || typeof init.body !== 'string') {
    return fetch(input, init);
  }
  let body = init.body;
  try {
    const parsed = JSON.parse(body) as CompatRequestBody;
    if (Array.isArray(parsed.messages)) {
      let touched = false;
      parsed.messages = parsed.messages.map((m) => {
        if (m && m.role === 'developer') {
          touched = true;
          return { ...m, role: 'system' };
        }
        return m;
      });
      if (touched) body = JSON.stringify(parsed);
    }
  } catch {
    // body is not JSON, leave as-is
  }
  return fetch(input, { ...init, body });
};

export function createLLMProvider(
  opts: OpenAIProviderOptions = {},
): LLMProvider {
  const env = process.env as OpenAIEnv;
  const apiKey = opts.apiKey ?? env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OpenAI credentials not provided: set OPENAI_API_KEY env var or pass apiKey',
    );
  }
  const baseURL = opts.baseURL ?? env.OPENAI_BASE_URL
    ?? 'https://api.openai.com/v1';
  const model = opts.model ?? env.OPENAI_MODEL ?? DEFAULT_MODEL;

  const isOfficial = isOfficialOpenAIBaseURL(baseURL);
  const api = opts.api
    ?? env.OPENAI_API_STYLE
    ?? (isOfficial ? 'responses' : 'chat');

  const providerSettings = {
    apiKey,
    baseURL,
    ...(isOfficial ? {} : { fetch: compatFetch }),
  };
  const provider = createOpenAI(providerSettings);
  const buildModel = (id: string) =>
    api === 'chat' ? provider.chat(id) : provider(id);
  return { provider, buildModel, model, api, baseURL };
}
