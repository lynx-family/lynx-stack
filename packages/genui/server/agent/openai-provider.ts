// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { randomUUID } from 'node:crypto';

import { createOpenAI } from '@ai-sdk/openai';
import type { AgentConfig } from '@mastra/core/agent';
import { Agent, fetch as undiciFetch } from 'undici';
import type { RequestInit as UndiciRequestInit } from 'undici';

import {
  defaultOpenAIAPIStyle,
  isAIDPChatEndpoint,
  isOfficialOpenAIBaseURL,
  rewriteAIDPChatURL,
} from './openai-utils';
import type { ChatMessage } from '../service/common/types';

export interface OpenAIProviderOptions {
  apiKey?: string | undefined;
  baseURL?: string | undefined;
  model?: string | undefined;
  api?: 'chat' | 'responses' | undefined;
}

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_OPENAI_FETCH_TIMEOUT_MS = 10 * 60 * 1000;
const MIN_OPENAI_FETCH_TIMEOUT_MS = 1000;
const MAX_OPENAI_FETCH_TIMEOUT_MS = 30 * 60 * 1000;
const openAIDispatchers = new Map<number, Agent>();

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

async function normalizeAIDPChatResponse(
  response: Response,
): Promise<Response> {
  if (
    !response.ok
    || !response.headers.get('content-type')?.includes('application/json')
  ) {
    return response;
  }

  let parsed: unknown;
  try {
    parsed = await response.clone().json();
  } catch {
    return response;
  }
  if (!isRecord(parsed) || !isUnknownArray(parsed.choices)) {
    return response;
  }

  let touched = false;
  const choices = parsed.choices.map((choice, index) => {
    if (isRecord(choice) && choice.index === undefined) {
      touched = true;
      return { ...choice, index };
    }
    return choice;
  });
  if (!touched) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.delete('content-encoding');
  headers.delete('content-length');
  headers.delete('transfer-encoding');
  return new Response(JSON.stringify({ ...parsed, choices }), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

interface OpenAIEnv {
  AIDP_LOG_ID?: string | undefined;
  OPENAI_API_KEY?: string | undefined;
  OPENAI_API_STYLE?: 'chat' | 'responses' | undefined;
  OPENAI_BASE_URL?: string | undefined;
  OPENAI_FETCH_TIMEOUT_MS?: string | undefined;
  OPENAI_LOG_ID?: string | undefined;
  OPENAI_MODEL?: string | undefined;
}

function requestURL(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') {
    return input;
  }
  return input instanceof URL ? input.href : input.url;
}

export function resolveOpenAIFetchTimeoutMs(
  value: string | undefined,
): number {
  if (value === undefined || value.trim() === '') {
    return DEFAULT_OPENAI_FETCH_TIMEOUT_MS;
  }
  const timeoutMs = Number(value);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 0) {
    return DEFAULT_OPENAI_FETCH_TIMEOUT_MS;
  }
  return Math.min(
    Math.max(timeoutMs, MIN_OPENAI_FETCH_TIMEOUT_MS),
    MAX_OPENAI_FETCH_TIMEOUT_MS,
  );
}

function getOpenAIDispatcher(timeoutMs: number): Agent {
  let dispatcher = openAIDispatchers.get(timeoutMs);
  if (dispatcher === undefined) {
    dispatcher = new Agent({
      bodyTimeout: timeoutMs,
      headersTimeout: timeoutMs,
    });
    openAIDispatchers.set(timeoutMs, dispatcher);
  }
  return dispatcher;
}

export function createOpenAITransportFetch(
  timeoutMs = resolveOpenAIFetchTimeoutMs(
    process.env.OPENAI_FETCH_TIMEOUT_MS,
  ),
): typeof fetch {
  const dispatcher = getOpenAIDispatcher(timeoutMs);
  return async (input, init) => {
    const response = await undiciFetch(requestURL(input), {
      ...(init as UndiciRequestInit | undefined),
      dispatcher,
    });
    return response as unknown as Response;
  };
}

export function createOpenAICompatFetch(
  baseURL: string,
  apiKey: string,
  fetchImpl: typeof fetch = createOpenAITransportFetch(),
  logID?: string,
): typeof fetch {
  return async (input, init) => {
    const originalURL = requestURL(input);
    const rewrittenURL = rewriteAIDPChatURL(originalURL, baseURL, apiKey);
    const requestInput = rewrittenURL === originalURL ? input : rewrittenURL;
    const isAIDP = isAIDPChatEndpoint(baseURL);
    let requestInit = init;
    if (isAIDP) {
      const headers = new Headers(init?.headers);
      headers.delete('authorization');
      headers.set(
        'X-TT-LOGID',
        logID
          ?? process.env.AIDP_LOG_ID
          ?? process.env.OPENAI_LOG_ID
          ?? randomUUID(),
      );
      requestInit = { ...init, headers };
    }
    if (
      !requestInit
      || !requestInit.body
      || typeof requestInit.body !== 'string'
    ) {
      const response = await fetchImpl(requestInput, requestInit);
      return isAIDP ? normalizeAIDPChatResponse(response) : response;
    }
    let body = requestInit.body;
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
    const response = await fetchImpl(requestInput, { ...requestInit, body });
    return isAIDP ? normalizeAIDPChatResponse(response) : response;
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
    ?? defaultOpenAIAPIStyle(baseURL);

  const transportFetch = createOpenAITransportFetch(
    resolveOpenAIFetchTimeoutMs(env.OPENAI_FETCH_TIMEOUT_MS),
  );
  const providerSettings = {
    apiKey,
    baseURL,
    ...(isOfficial
      ? { fetch: transportFetch }
      : {
        fetch: createOpenAICompatFetch(
          baseURL,
          apiKey,
          transportFetch,
        ),
      }),
  };
  const provider = createOpenAI(providerSettings);
  const buildModel = (id: string) =>
    api === 'chat' ? provider.chat(id) : provider(id);
  return { provider, buildModel, model, api, baseURL };
}
