// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const SEARCH_INFINITY_API_KEY_ENV = 'SEARCH_INFINITY_API_KEY';
export const SEARCH_INFINITY_REQUEST_TIMEOUT_MS_ENV =
  'SEARCH_INFINITY_REQUEST_TIMEOUT_MS';
export const SEARCH_INFINITY_ENDPOINT =
  'https://open.feedcoopapi.com/search_api/global_search';

const DEFAULT_SEARCH_REQUEST_TIMEOUT_MS = 10_000;
const MAX_SEARCH_REQUEST_TIMEOUT_MS = 60_000;
const SEARCH_DOCUMENT_COUNT = 5;
const SEARCH_SNIPPET_LENGTH = 600;
const SEARCH_IMAGE_COUNT_PER_DOCUMENT = 0;
const SEARCH_RUN_STATE_KEY = 'a2ui:doubao-search-run-state' as const;
const MAX_SEARCH_QUERY_LENGTH = 1_000;
const MAX_SEARCH_TITLE_LENGTH = 500;
export const MAX_DOUBAO_SEARCH_CALLS_PER_RUN = 3;

interface DoubaoSearchRunState {
  attemptedCalls: number;
  documentURLs: string[];
  maxCalls: number;
}

type DoubaoSearchRequestContextValues = Record<
  typeof SEARCH_RUN_STATE_KEY,
  DoubaoSearchRunState
>;

type Environment = Readonly<Record<string, string | undefined>>;

export interface DoubaoSearchConfig {
  apiKey: string;
  requestTimeoutMs: number;
}

export type DoubaoSearchConfigResult =
  | { ok: true; enabled: false }
  | { ok: true; enabled: true; config: DoubaoSearchConfig }
  | { ok: false; enabled: false; error: string };

export interface DoubaoSearchDocument {
  rank: number;
  title: string;
  url: string;
  snippet: string;
  hostname: string;
  publishTime?: string;
  authorityLevel?: string;
}

export interface DoubaoSearchResult {
  query: string;
  totalDocCount: number;
  results: DoubaoSearchDocument[];
}

interface RequestContextScope {
  requestContext: unknown;
}

function readNonEmpty(
  environment: Environment,
  name: string,
): string | undefined {
  const value = environment[name]?.trim();
  return value === '' ? undefined : value;
}

function parseRequestTimeout(environment: Environment): number {
  const raw = readNonEmpty(
    environment,
    SEARCH_INFINITY_REQUEST_TIMEOUT_MS_ENV,
  );
  if (!raw) return DEFAULT_SEARCH_REQUEST_TIMEOUT_MS;
  const parsed = Number(raw);
  if (
    !Number.isSafeInteger(parsed)
    || parsed < 1
    || parsed > MAX_SEARCH_REQUEST_TIMEOUT_MS
  ) {
    throw new Error(
      `${SEARCH_INFINITY_REQUEST_TIMEOUT_MS_ENV} must be an integer between 1 and ${MAX_SEARCH_REQUEST_TIMEOUT_MS}`,
    );
  }
  return parsed;
}

export function resolveDoubaoSearchConfig(
  environment: Environment = process.env,
): DoubaoSearchConfig {
  const apiKey = readNonEmpty(environment, SEARCH_INFINITY_API_KEY_ENV);
  if (!apiKey) throw new Error(`${SEARCH_INFINITY_API_KEY_ENV} is required`);
  if (/^Bearer(?:\s|$)/iu.test(apiKey)) {
    throw new Error(
      `${SEARCH_INFINITY_API_KEY_ENV} must not include the Bearer prefix`,
    );
  }
  return {
    apiKey,
    requestTimeoutMs: parseRequestTimeout(environment),
  };
}

export function readDoubaoSearchConfig(
  environment: Environment = process.env,
): DoubaoSearchConfigResult {
  const apiKey = readNonEmpty(environment, SEARCH_INFINITY_API_KEY_ENV);
  if (!apiKey) return { ok: true, enabled: false };
  try {
    return {
      ok: true,
      enabled: true,
      config: resolveDoubaoSearchConfig(environment),
    };
  } catch (error) {
    return {
      ok: false,
      enabled: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function abortError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  return new DOMException('The operation was aborted', 'AbortError');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizedHttpURL(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function boundedText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function normalizeSnippet(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value
    .flatMap((item): string[] => {
      if (!isRecord(item) || item.Type !== 'text') return [];
      const text = boundedText(item.Text, SEARCH_SNIPPET_LENGTH);
      return text ? [text] : [];
    })
    .join('\n')
    .slice(0, SEARCH_SNIPPET_LENGTH);
}

function normalizeDocument(
  value: unknown,
  index: number,
): DoubaoSearchDocument | undefined {
  if (!isRecord(value)) return undefined;
  const url = normalizedHttpURL(value.Url);
  if (!url) return undefined;
  const title = boundedText(value.Title, MAX_SEARCH_TITLE_LENGTH);
  const snippet = normalizeSnippet(value.Snippet);
  const documentInfo = isRecord(value.DocumentInfo)
    ? value.DocumentInfo
    : undefined;
  const hostInfo = isRecord(value.HostInfo) ? value.HostInfo : undefined;
  const rank = typeof value.Rank === 'number'
      && Number.isSafeInteger(value.Rank)
      && value.Rank >= 0
    ? value.Rank
    : index;
  const hostname = new URL(url).hostname;
  const publishTime = boundedText(documentInfo?.PublishTime, 100);
  const authorityLevel = typeof hostInfo?.AuthorityLevel === 'number'
      && Number.isFinite(hostInfo.AuthorityLevel)
    ? String(hostInfo.AuthorityLevel)
    : boundedText(hostInfo?.AuthorityLevel, 100);
  return {
    rank,
    title,
    url,
    snippet,
    hostname,
    ...(publishTime ? { publishTime } : {}),
    ...(authorityLevel ? { authorityLevel } : {}),
  };
}

function normalizeSearchResponse(
  value: unknown,
  query: string,
): DoubaoSearchResult {
  if (!isRecord(value) || !isRecord(value.Result)) {
    throw new Error('Doubao search returned an invalid response');
  }
  const result = value.Result;
  if (result.ErrorCode !== 0) {
    const code = typeof result.ErrorCode === 'number'
        || typeof result.ErrorCode === 'string'
      ? String(result.ErrorCode)
      : 'unknown';
    throw new Error(`Doubao search failed with code ${code}`);
  }
  if (!Array.isArray(result.Documents)) {
    throw new Error('Doubao search returned an invalid response');
  }
  const results = result.Documents
    .map((document, index) => normalizeDocument(document, index))
    .filter((document): document is DoubaoSearchDocument => Boolean(document))
    .slice(0, SEARCH_DOCUMENT_COUNT);
  const totalDocCount = typeof result.TotalDocCount === 'number'
      && Number.isSafeInteger(result.TotalDocCount)
      && result.TotalDocCount >= 0
    ? result.TotalDocCount
    : results.length;
  return { query, totalDocCount, results };
}

function normalizedQuery(query: string): string {
  const normalized = query.trim();
  if (!normalized) throw new Error('Doubao search query is required');
  if (normalized.length > MAX_SEARCH_QUERY_LENGTH) {
    throw new Error(
      `Doubao search query must not exceed ${MAX_SEARCH_QUERY_LENGTH} characters`,
    );
  }
  return normalized;
}

function throwIfSearchAborted(
  config: DoubaoSearchConfig,
  controller: AbortController,
  abortSignal?: AbortSignal,
): void {
  if (abortSignal?.aborted) throw abortError(abortSignal.reason);
  if (controller.signal.aborted) {
    throw new Error(
      `Doubao search timed out after ${config.requestTimeoutMs}ms`,
    );
  }
}

export async function searchDoubao(
  config: DoubaoSearchConfig,
  query: string,
  fetchImpl: typeof fetch = fetch,
  abortSignal?: AbortSignal,
): Promise<DoubaoSearchResult> {
  abortSignal?.throwIfAborted();
  const normalized = normalizedQuery(query);
  const controller = new AbortController();
  const onAbort = () => controller.abort(abortSignal?.reason);
  abortSignal?.addEventListener('abort', onAbort, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new Error('Doubao search timed out')),
    config.requestTimeoutMs,
  );

  try {
    let response: Response;
    try {
      response = await fetchImpl(SEARCH_INFINITY_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Query: normalized,
          DocCount: SEARCH_DOCUMENT_COUNT,
          MaxSnippetLength: SEARCH_SNIPPET_LENGTH,
          MaxImageCountPerDoc: SEARCH_IMAGE_COUNT_PER_DOCUMENT,
        }),
        signal: controller.signal,
      });
    } catch {
      throwIfSearchAborted(config, controller, abortSignal);
      throw new Error('Doubao search request failed');
    }
    throwIfSearchAborted(config, controller, abortSignal);
    if (!response.ok) {
      throw new Error(
        `Doubao search request failed with status ${response.status}`,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json() as unknown;
    } catch {
      throwIfSearchAborted(config, controller, abortSignal);
      throw new Error('Doubao search returned invalid JSON');
    }
    throwIfSearchAborted(config, controller, abortSignal);
    return normalizeSearchResponse(payload, normalized);
  } finally {
    clearTimeout(timeout);
    abortSignal?.removeEventListener('abort', onAbort);
  }
}

function searchRequestContext(
  scope: RequestContextScope,
): RequestContext<DoubaoSearchRequestContextValues> {
  return scope.requestContext as RequestContext<
    DoubaoSearchRequestContextValues
  >;
}

function readSearchRunState(
  requestContext: RequestContext<DoubaoSearchRequestContextValues>,
): DoubaoSearchRunState | undefined {
  return requestContext.get(SEARCH_RUN_STATE_KEY);
}

function getOrCreateSearchRunState(
  requestContext: RequestContext<DoubaoSearchRequestContextValues>,
): DoubaoSearchRunState {
  const existing = readSearchRunState(requestContext);
  if (existing) return existing;
  const state: DoubaoSearchRunState = {
    attemptedCalls: 0,
    documentURLs: [],
    maxCalls: MAX_DOUBAO_SEARCH_CALLS_PER_RUN,
  };
  requestContext.set(SEARCH_RUN_STATE_KEY, state);
  return state;
}

export function initializeDoubaoSearchRunScope(
  scope: RequestContextScope,
  maxCalls = MAX_DOUBAO_SEARCH_CALLS_PER_RUN,
): void {
  if (!Number.isSafeInteger(maxCalls) || maxCalls < 1 || maxCalls > 10) {
    throw new Error('search maxCalls must be an integer from 1 to 10');
  }
  searchRequestContext(scope).set(SEARCH_RUN_STATE_KEY, {
    attemptedCalls: 0,
    documentURLs: [],
    maxCalls,
  });
}

function reserveSearchCall(scope: RequestContextScope): void {
  const requestContext = searchRequestContext(scope);
  const state = getOrCreateSearchRunState(requestContext);
  if (state.attemptedCalls >= state.maxCalls) {
    throw new Error(
      `Doubao search call limit reached (${state.maxCalls} per request)`,
    );
  }
  requestContext.set(SEARCH_RUN_STATE_KEY, {
    ...state,
    attemptedCalls: state.attemptedCalls + 1,
  });
}

function recordSearchDocumentURLs(
  scope: RequestContextScope,
  urls: readonly string[],
): void {
  const requestContext = searchRequestContext(scope);
  const state = getOrCreateSearchRunState(requestContext);
  requestContext.set(SEARCH_RUN_STATE_KEY, {
    ...state,
    documentURLs: [...new Set([...state.documentURLs, ...urls])],
  });
}

export function searchedDoubaoDocumentURLs(
  scope: RequestContextScope,
): readonly string[] {
  const state = readSearchRunState(searchRequestContext(scope));
  return state ? [...new Set(state.documentURLs)] : [];
}

export async function searchDoubaoForRun(
  scope: RequestContextScope,
  config: DoubaoSearchConfig,
  query: string,
  fetchImpl: typeof fetch = fetch,
  abortSignal?: AbortSignal,
): Promise<DoubaoSearchResult> {
  reserveSearchCall(scope);
  const result = await searchDoubao(
    config,
    query,
    fetchImpl,
    abortSignal,
  );
  recordSearchDocumentURLs(
    scope,
    result.results.map((document) => document.url),
  );
  return result;
}

const searchInputSchema = z.object({
  query: z.string().trim().min(1).max(MAX_SEARCH_QUERY_LENGTH).describe(
    'One focused web search query for current or externally verifiable information.',
  ),
});

const searchDocumentSchema = z.object({
  rank: z.number().int().nonnegative(),
  title: z.string(),
  url: z.url(),
  snippet: z.string(),
  hostname: z.string(),
  publishTime: z.string().optional(),
  authorityLevel: z.string().optional(),
});

const searchOutputSchema = z.object({
  query: z.string(),
  totalDocCount: z.number().int().nonnegative(),
  results: z.array(searchDocumentSchema).max(SEARCH_DOCUMENT_COUNT),
});

export function createDoubaoSearchTool(
  config: DoubaoSearchConfig,
  fetchImpl: typeof fetch = fetch,
) {
  return createTool({
    id: 'web_search',
    description:
      'Search the public web for current or externally verifiable information. Returns normalized text results and source URLs; it does not return images.',
    inputSchema: searchInputSchema,
    outputSchema: searchOutputSchema,
    execute: ({ query }, context) =>
      searchDoubaoForRun(
        { requestContext: context.requestContext },
        config,
        query,
        fetchImpl,
        context.abortSignal,
      ),
  });
}

export function createOptionalDoubaoSearchTool(
  enabled: boolean | undefined = true,
  environment: Environment = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  if (enabled === false) return undefined;
  const result = readDoubaoSearchConfig(environment);
  if (!result.ok) return undefined;
  if (!result.enabled) return undefined;
  return createDoubaoSearchTool(result.config, fetchImpl);
}
