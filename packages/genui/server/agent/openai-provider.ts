// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createOpenAI } from '@ai-sdk/openai';
import type { AgentConfig } from '@mastra/core/agent';

import {
  assertAllowedCustomProviderBaseURL,
  createCustomProviderFetch,
} from './custom-provider-security.js';
import { isOfficialOpenAIBaseURL } from './openai-utils';
import { resolveModelConfig } from '../service/common/model-config.js';
import type { ChatMessage } from '../service/common/types';

export interface OpenAIProviderOptions {
  apiKey?: string | undefined;
  baseURL?: string | undefined;
  model?: string | undefined;
  api?: 'chat' | 'responses' | undefined;
}

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

function createCompatFetch(fetchImpl: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    if (!init || !init.body || typeof init.body !== 'string') {
      return fetchImpl(input, init);
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
    return fetchImpl(input, { ...init, body });
  };
}

export function createLLMProvider(
  opts: OpenAIProviderOptions = {},
): LLMProvider {
  const directOverride = typeof opts.apiKey === 'string'
      && opts.apiKey.trim().length > 0
      && typeof opts.baseURL === 'string'
      && opts.baseURL.trim().length > 0
      && typeof opts.model === 'string'
      && opts.model.trim().length > 0
    ? {
      apiKey: opts.apiKey.trim(),
      baseURL: assertAllowedCustomProviderBaseURL(opts.baseURL.trim()),
      model: opts.model.trim(),
      api: opts.api,
    }
    : undefined;
  const providerOptions = directOverride ?? (() => {
    const resolved = resolveModelConfig(opts.model);
    return {
      apiKey: resolved.config.apiKey,
      baseURL: resolved.config.baseURL,
      model: resolved.config.model,
      api: resolved.config.api,
    };
  })();
  const { apiKey, baseURL, model } = providerOptions;

  const isOfficial = isOfficialOpenAIBaseURL(baseURL);
  const api = providerOptions.api
    ?? (isOfficial ? 'responses' : 'chat');

  const customProviderFetch = directOverride
    ? createCustomProviderFetch()
    : undefined;
  const providerFetch = isOfficial
    ? customProviderFetch
    : createCompatFetch(customProviderFetch);

  const providerSettings = {
    apiKey,
    baseURL,
    ...(providerFetch ? { fetch: providerFetch } : {}),
  };
  const provider = createOpenAI(providerSettings);
  const buildModel = (id: string) =>
    api === 'chat' ? provider.chat(id) : provider(id);
  return { provider, buildModel, model, api, baseURL };
}
