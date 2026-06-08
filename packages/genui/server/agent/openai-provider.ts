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

function isExactChatCompletionEndpoint(baseURL: string): boolean {
  try {
    const url = new URL(baseURL);
    return url.hostname === 'aidp.bytedance.net'
      && /\/api\/modelhub\/online\/v\d+\/crawl\/?$/u.test(url.pathname);
  } catch {
    return false;
  }
}

function getRequestUrl(input: Parameters<typeof fetch>[0]): string | null {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return null;
}

function maybeRewriteExactChatURL(
  input: Parameters<typeof fetch>[0],
  baseURL: string,
): Parameters<typeof fetch>[0] {
  if (!isExactChatCompletionEndpoint(baseURL)) return input;
  const raw = getRequestUrl(input);
  if (!raw) return input;

  try {
    const requestUrl = new URL(raw);
    const exactUrl = new URL(baseURL);
    const basePath = exactUrl.pathname.replace(/\/$/u, '');
    const expectedPath = `${basePath}/chat/completions`;
    if (
      requestUrl.origin !== exactUrl.origin
      || requestUrl.pathname !== expectedPath
    ) {
      return input;
    }
    requestUrl.pathname = exactUrl.pathname;
    requestUrl.search = exactUrl.search;
    if (typeof input === 'string') return requestUrl.toString();
    if (input instanceof URL) return requestUrl;
    if (input instanceof Request) {
      return new Request(requestUrl, input);
    }
  } catch {
    return input;
  }

  return input;
}

async function normalizeExactChatResponse(
  response: Response,
  baseURL: string,
): Promise<Response> {
  if (!isExactChatCompletionEndpoint(baseURL)) return response;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return response;

  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === 'object') {
      const record = parsed as {
        choices?: Record<string, unknown>[];
        created?: unknown;
        id?: unknown;
      };
      if (typeof record.id !== 'string') {
        record.id = `chatcmpl-${Date.now().toString(36)}`;
      }
      if (typeof record.created !== 'number') {
        record.created = Math.floor(Date.now() / 1000);
      }
      if (Array.isArray(record.choices)) {
        record.choices = record.choices.map((choice, index) => ({
          index,
          ...choice,
        }));
      }
      const headers = new Headers(response.headers);
      headers.delete('content-length');
      headers.set('content-type', 'application/json; charset=utf-8');
      return new Response(JSON.stringify(record), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
  } catch {
    // Preserve the original body text for the SDK to report.
  }

  return new Response(text, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

function createCompatFetch(baseURL: string): typeof fetch {
  return async (input, init) => {
    const nextInput = maybeRewriteExactChatURL(input, baseURL);
    let response: Response;
    if (!init || !init.body || typeof init.body !== 'string') {
      response = await fetch(nextInput, init);
      return normalizeExactChatResponse(response, baseURL);
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
    response = await fetch(nextInput, { ...init, body });
    return normalizeExactChatResponse(response, baseURL);
  };
}

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
    ...(isOfficial ? {} : { fetch: createCompatFetch(baseURL) }),
  };
  const provider = createOpenAI(providerSettings);
  const buildModel = (id: string) =>
    api === 'chat' ? provider.chat(id) : provider(id);
  return { provider, buildModel, model, api, baseURL };
}
