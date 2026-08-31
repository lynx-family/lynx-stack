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
  'https://open.feedcoopapi.com/search_api/web_search';

const DEFAULT_SEARCH_REQUEST_TIMEOUT_MS = 10_000;
const MAX_SEARCH_REQUEST_TIMEOUT_MS = 60_000;
const WEB_SEARCH_RESULT_COUNT = 5;
const IMAGE_SEARCH_RESULT_COUNT = 5;
const SEARCH_SNIPPET_LENGTH = 600;
const WEB_SEARCH_TYPE = 'web';
const IMAGE_SEARCH_TYPE = 'image';
const SEARCH_RUN_STATE_KEY = 'a2ui:doubao-search-run-state' as const;
const MAX_SEARCH_QUERY_LENGTH = 100;
const MAX_SEARCH_TITLE_LENGTH = 500;
const MAX_SEARCH_METADATA_LENGTH = 100;
export const MAX_DOUBAO_SEARCH_CALLS_PER_RUN = 3;

interface DoubaoSearchRunState {
  attemptedCalls: number;
  documentURLs: string[];
  imageURLs: string[];
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

export interface DoubaoImageSearchItem {
  rank: number;
  title: string;
  imageUrl: string;
  sourceUrl?: string;
  siteName?: string;
  publishTime?: string;
  width?: number;
  height?: number;
  shape?: string;
  blurDescription?: string;
  category?: string;
  hasWatermark?: boolean;
}

export interface DoubaoImageSearchResult {
  query: string;
  totalImageCount: number;
  results: DoubaoImageSearchItem[];
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

function normalizedRank(value: unknown, fallback: number): number {
  return typeof value === 'number'
      && Number.isSafeInteger(value)
      && value >= 0
    ? value
    : fallback;
}

function normalizedPositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number'
      && Number.isSafeInteger(value)
      && value > 0
    ? value
    : undefined;
}

function normalizeDocument(
  value: unknown,
  index: number,
): DoubaoSearchDocument | undefined {
  if (!isRecord(value)) return undefined;
  const url = normalizedHttpURL(value.Url);
  if (!url) return undefined;
  const title = boundedText(value.Title, MAX_SEARCH_TITLE_LENGTH);
  const snippet = boundedText(value.Summary, SEARCH_SNIPPET_LENGTH)
    || boundedText(value.Snippet, SEARCH_SNIPPET_LENGTH)
    || boundedText(value.Content, SEARCH_SNIPPET_LENGTH);
  const rank = normalizedRank(value.SortId, index);
  const hostname = new URL(url).hostname;
  const publishTime = boundedText(
    value.PublishTime,
    MAX_SEARCH_METADATA_LENGTH,
  );
  const authorityLevel = typeof value.AuthInfoLevel === 'number'
      && Number.isFinite(value.AuthInfoLevel)
    ? String(value.AuthInfoLevel)
    : boundedText(value.AuthInfoDes, MAX_SEARCH_METADATA_LENGTH);
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

function normalizedWatermark(value: unknown): boolean | undefined {
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  return undefined;
}

function normalizeImage(
  value: unknown,
  index: number,
): DoubaoImageSearchItem | undefined {
  if (!isRecord(value) || !isRecord(value.Image)) return undefined;
  const imageUrl = normalizedHttpURL(value.Image.Url);
  if (!imageUrl) return undefined;

  const title = boundedText(value.Title, MAX_SEARCH_TITLE_LENGTH);
  const sourceUrl = normalizedHttpURL(value.Url);
  const siteName = boundedText(value.SiteName, MAX_SEARCH_METADATA_LENGTH);
  const publishTime = boundedText(
    value.PublishTime,
    MAX_SEARCH_METADATA_LENGTH,
  );
  const width = normalizedPositiveInteger(value.Image.Width);
  const height = normalizedPositiveInteger(value.Image.Height);
  const shape = boundedText(value.Image.Shape, MAX_SEARCH_METADATA_LENGTH);
  const blurDescription = boundedText(
    value.Image.BlurDes,
    MAX_SEARCH_METADATA_LENGTH,
  );
  const category = boundedText(
    value.Image.Category,
    MAX_SEARCH_METADATA_LENGTH,
  );
  const hasWatermark = normalizedWatermark(value.Image.Watermark);

  return {
    rank: normalizedRank(value.SortId, index),
    title,
    imageUrl,
    ...(sourceUrl ? { sourceUrl } : {}),
    ...(siteName ? { siteName } : {}),
    ...(publishTime ? { publishTime } : {}),
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(shape ? { shape } : {}),
    ...(blurDescription ? { blurDescription } : {}),
    ...(category ? { category } : {}),
    ...(hasWatermark === undefined ? {} : { hasWatermark }),
  };
}

function searchResultRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error('Doubao search returned an invalid response');
  }
  const responseMetadata = isRecord(value.ResponseMetadata)
    ? value.ResponseMetadata
    : undefined;
  const responseError = isRecord(responseMetadata?.Error)
    ? responseMetadata.Error
    : undefined;
  if (responseError) {
    const rawCode = responseError.CodeN ?? responseError.Code;
    const code = typeof rawCode === 'number' || typeof rawCode === 'string'
      ? String(rawCode)
      : 'unknown';
    throw new Error(`Doubao search failed with code ${code}`);
  }
  if (!isRecord(value.Result)) {
    throw new Error('Doubao search returned an invalid response');
  }
  return value.Result;
}

function normalizedResultCount(
  value: unknown,
  fallback: number,
): number {
  return typeof value === 'number'
      && Number.isSafeInteger(value)
      && value >= 0
    ? value
    : fallback;
}

function normalizeSearchResponse(
  value: unknown,
  query: string,
): DoubaoSearchResult {
  const result = searchResultRecord(value);
  if (!Array.isArray(result.WebResults)) {
    throw new Error('Doubao search returned an invalid response');
  }
  const results = result.WebResults
    .map((document, index) => normalizeDocument(document, index))
    .filter((document): document is DoubaoSearchDocument => Boolean(document))
    .slice(0, WEB_SEARCH_RESULT_COUNT);
  const totalDocCount = normalizedResultCount(
    result.ResultCount,
    results.length,
  );
  return { query, totalDocCount, results };
}

function normalizeImageSearchResponse(
  value: unknown,
  query: string,
): DoubaoImageSearchResult {
  const result = searchResultRecord(value);
  if (!Array.isArray(result.ImageResults)) {
    throw new Error('Doubao search returned an invalid response');
  }
  const results = result.ImageResults
    .map((image, index) => normalizeImage(image, index))
    .filter((image): image is DoubaoImageSearchItem => Boolean(image))
    .slice(0, IMAGE_SEARCH_RESULT_COUNT);
  const totalImageCount = normalizedResultCount(
    result.ResultCount,
    results.length,
  );
  return { query, totalImageCount, results };
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

async function requestDoubaoSearch(
  config: DoubaoSearchConfig,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
  abortSignal?: AbortSignal,
): Promise<unknown> {
  abortSignal?.throwIfAborted();
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
        body: JSON.stringify(body),
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
    return payload;
  } finally {
    clearTimeout(timeout);
    abortSignal?.removeEventListener('abort', onAbort);
  }
}

export async function searchDoubao(
  config: DoubaoSearchConfig,
  query: string,
  fetchImpl: typeof fetch = fetch,
  abortSignal?: AbortSignal,
): Promise<DoubaoSearchResult> {
  const normalized = normalizedQuery(query);
  const payload = await requestDoubaoSearch(
    config,
    {
      Query: normalized,
      SearchType: WEB_SEARCH_TYPE,
      Count: WEB_SEARCH_RESULT_COUNT,
      Filter: {
        NeedContent: false,
        NeedUrl: true,
      },
      ContentFormats: 'text',
    },
    fetchImpl,
    abortSignal,
  );
  return normalizeSearchResponse(payload, normalized);
}

export async function searchDoubaoImages(
  config: DoubaoSearchConfig,
  query: string,
  fetchImpl: typeof fetch = fetch,
  abortSignal?: AbortSignal,
): Promise<DoubaoImageSearchResult> {
  const normalized = normalizedQuery(query);
  const payload = await requestDoubaoSearch(
    config,
    {
      Query: normalized,
      SearchType: IMAGE_SEARCH_TYPE,
      Count: IMAGE_SEARCH_RESULT_COUNT,
    },
    fetchImpl,
    abortSignal,
  );
  return normalizeImageSearchResponse(payload, normalized);
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
    imageURLs: [],
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
    imageURLs: [],
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

function recordSearchImageURLs(
  scope: RequestContextScope,
  urls: readonly string[],
): void {
  const requestContext = searchRequestContext(scope);
  const state = getOrCreateSearchRunState(requestContext);
  requestContext.set(SEARCH_RUN_STATE_KEY, {
    ...state,
    imageURLs: [...new Set([...state.imageURLs, ...urls])],
  });
}

export function searchedDoubaoDocumentURLs(
  scope: RequestContextScope,
): readonly string[] {
  const state = readSearchRunState(searchRequestContext(scope));
  return state ? [...new Set(state.documentURLs)] : [];
}

export function searchedDoubaoImageURLs(
  scope: RequestContextScope,
): readonly string[] {
  const state = readSearchRunState(searchRequestContext(scope));
  return state ? [...new Set(state.imageURLs)] : [];
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

export async function searchDoubaoImagesForRun(
  scope: RequestContextScope,
  config: DoubaoSearchConfig,
  query: string,
  fetchImpl: typeof fetch = fetch,
  abortSignal?: AbortSignal,
): Promise<DoubaoImageSearchResult> {
  reserveSearchCall(scope);
  const result = await searchDoubaoImages(
    config,
    query,
    fetchImpl,
    abortSignal,
  );
  recordSearchImageURLs(
    scope,
    result.results.map((image) => image.imageUrl),
  );
  recordSearchDocumentURLs(
    scope,
    result.results.flatMap((image) => image.sourceUrl ? [image.sourceUrl] : []),
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
  results: z.array(searchDocumentSchema).max(WEB_SEARCH_RESULT_COUNT),
});

const imageSearchInputSchema = z.object({
  query: z.string().trim().min(1).max(MAX_SEARCH_QUERY_LENGTH).describe(
    'One focused image search query describing the subject and desired visual.',
  ),
});

const imageSearchItemSchema = z.object({
  rank: z.number().int().nonnegative(),
  title: z.string(),
  imageUrl: z.url(),
  sourceUrl: z.url().optional(),
  siteName: z.string().optional(),
  publishTime: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  shape: z.string().optional(),
  blurDescription: z.string().optional(),
  category: z.string().optional(),
  hasWatermark: z.boolean().optional(),
});

const imageSearchOutputSchema = z.object({
  query: z.string(),
  totalImageCount: z.number().int().nonnegative(),
  results: z.array(imageSearchItemSchema).max(IMAGE_SEARCH_RESULT_COUNT),
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

export function createDoubaoImageSearchTool(
  config: DoubaoSearchConfig,
  fetchImpl: typeof fetch = fetch,
) {
  return createTool({
    id: 'image_search',
    description:
      'Search the public web for existing images. Returns trusted imageUrl values plus source and quality metadata. Copy a selected imageUrl exactly into Image.url. Prefer this tool before generate_image unless the user explicitly requests original generated artwork.',
    inputSchema: imageSearchInputSchema,
    outputSchema: imageSearchOutputSchema,
    execute: ({ query }, context) =>
      searchDoubaoImagesForRun(
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

export function createOptionalDoubaoImageSearchTool(
  enabled: boolean | undefined = true,
  environment: Environment = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  if (enabled === false) return undefined;
  const result = readDoubaoSearchConfig(environment);
  if (!result.ok) return undefined;
  if (!result.enabled) return undefined;
  return createDoubaoImageSearchTool(result.config, fetchImpl);
}
