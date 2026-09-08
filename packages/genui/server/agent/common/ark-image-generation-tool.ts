// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const IMG_GEN_ARK_API_KEY_ENV = 'IMG_GEN_ARK_API_KEY';
export const IMG_GEN_ARK_IMAGE_MODEL_ENV = 'IMG_GEN_ARK_IMAGE_MODEL';
export const IMG_GEN_ARK_IMAGE_BASE_URL_ENV = 'IMG_GEN_ARK_IMAGE_BASE_URL';
export const IMG_GEN_ARK_IMAGE_REQUEST_TIMEOUT_MS_ENV =
  'IMG_GEN_ARK_IMAGE_REQUEST_TIMEOUT_MS';

const DEFAULT_IMAGE_GENERATION_REQUEST_TIMEOUT_MS = 120_000;
const MAX_IMAGE_GENERATION_REQUEST_TIMEOUT_MS = 600_000;
const ARK_IMAGE_GENERATION_RUN_STATE_KEY =
  'a2ui:image-generation-run-state' as const;
export const MAX_ARK_IMAGE_GENERATIONS_PER_RUN = 4;

interface ArkImageGenerationRunState {
  attemptedCalls: number;
  generatedURLs: string[];
  maxCalls: number;
  scopeId: string;
}

type ArkImageGenerationRequestContextValues = Record<
  typeof ARK_IMAGE_GENERATION_RUN_STATE_KEY,
  ArkImageGenerationRunState
>;

export interface ArkImageGenerationRunScope {
  requestContext: RequestContext<ArkImageGenerationRequestContextValues>;
}

type Environment = Readonly<Record<string, string | undefined>>;

export interface ArkImageGenerationConfig {
  apiKey: string;
  baseURL: string;
  model: string;
  requestTimeoutMs: number;
}

export type ArkImageGenerationConfigResult =
  | { ok: true; config: ArkImageGenerationConfig }
  | { ok: false; error: string };

export interface GeneratedImage {
  url: string;
  size?: string;
}

const imageGenerationSuspendSchema = z.object({
  jobId: z.string().uuid(),
});

export type ArkImageGenerationSuspendPayload = z.infer<
  typeof imageGenerationSuspendSchema
>;

const imageGenerationResumeSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    jobId: z.string().uuid(),
    url: z.string().url(),
    size: z.string().optional(),
  }),
  z.object({
    ok: z.literal(false),
    jobId: z.string().uuid(),
    error: z.string().min(1),
  }),
]);

export type ArkImageGenerationResumeData = z.infer<
  typeof imageGenerationResumeSchema
>;

const pendingImageJobsByScope = new Map<
  string,
  Map<string, Promise<ArkImageGenerationResumeData>>
>();

function readNonEmpty(
  environment: Environment,
  name: string,
): string | undefined {
  const value = environment[name]?.trim();
  if (!value) return undefined;
  return value;
}

function requiredString(environment: Environment, name: string): string {
  const value = readNonEmpty(environment, name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function parsePositiveInteger(
  environment: Environment,
  name: string,
  fallback: number,
): number {
  const value = readNonEmpty(environment, name);
  if (!value) return fallback;
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed)
    || parsed < 1
    || parsed > MAX_IMAGE_GENERATION_REQUEST_TIMEOUT_MS
  ) {
    throw new Error(
      `${name} must be an integer between 1 and ${MAX_IMAGE_GENERATION_REQUEST_TIMEOUT_MS}`,
    );
  }
  return parsed;
}

function parseBaseURL(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${IMG_GEN_ARK_IMAGE_BASE_URL_ENV} must be a valid URL`);
  }
  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || raw.includes('?')
    || raw.includes('#')
    || url.search
    || url.hash
  ) {
    throw new Error(
      `${IMG_GEN_ARK_IMAGE_BASE_URL_ENV} must be an HTTPS URL without credentials, query parameters, or a fragment`,
    );
  }
  url.pathname = url.pathname.replace(/\/+$/u, '');
  return url.toString().replace(/\/$/u, '');
}

export function resolveArkImageGenerationConfig(
  environment: Environment = process.env,
): ArkImageGenerationConfig {
  const apiKey = requiredString(environment, IMG_GEN_ARK_API_KEY_ENV);
  if (/^Bearer(?:\s|$)/iu.test(apiKey)) {
    throw new Error(
      `${IMG_GEN_ARK_API_KEY_ENV} must not include the Bearer prefix`,
    );
  }

  return {
    apiKey,
    model: requiredString(environment, IMG_GEN_ARK_IMAGE_MODEL_ENV),
    baseURL: parseBaseURL(
      requiredString(environment, IMG_GEN_ARK_IMAGE_BASE_URL_ENV),
    ),
    requestTimeoutMs: parsePositiveInteger(
      environment,
      IMG_GEN_ARK_IMAGE_REQUEST_TIMEOUT_MS_ENV,
      DEFAULT_IMAGE_GENERATION_REQUEST_TIMEOUT_MS,
    ),
  };
}

export function readArkImageGenerationConfig(
  environment: Environment = process.env,
): ArkImageGenerationConfigResult {
  try {
    return { ok: true, config: resolveArkImageGenerationConfig(environment) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function createArkImageGenerationRunScope(
  maxCalls = MAX_ARK_IMAGE_GENERATIONS_PER_RUN,
): ArkImageGenerationRunScope {
  if (!Number.isSafeInteger(maxCalls) || maxCalls < 1 || maxCalls > 10) {
    throw new Error(
      'image generation maxCalls must be an integer from 1 to 10',
    );
  }
  const requestContext = new RequestContext<
    ArkImageGenerationRequestContextValues
  >();
  requestContext.set(ARK_IMAGE_GENERATION_RUN_STATE_KEY, {
    attemptedCalls: 0,
    generatedURLs: [],
    maxCalls,
    scopeId: crypto.randomUUID(),
  });
  return { requestContext };
}

export function generatedArkImageURLs(
  scope: ArkImageGenerationRunScope,
): readonly string[] {
  const state = scope.requestContext.get(ARK_IMAGE_GENERATION_RUN_STATE_KEY);
  return [...new Set(state.generatedURLs)];
}

function reserveImageGenerationCall(
  requestContext: RequestContext<ArkImageGenerationRequestContextValues>,
): void {
  const state = requestContext.get(ARK_IMAGE_GENERATION_RUN_STATE_KEY);
  if (state.attemptedCalls >= state.maxCalls) {
    throw new Error(
      `Image generation call limit reached (${state.maxCalls} per request)`,
    );
  }
  requestContext.set(ARK_IMAGE_GENERATION_RUN_STATE_KEY, {
    ...state,
    attemptedCalls: state.attemptedCalls + 1,
  });
}

function recordGeneratedImageURL(
  requestContext: RequestContext<ArkImageGenerationRequestContextValues>,
  url: string,
): void {
  const state = requestContext.get(ARK_IMAGE_GENERATION_RUN_STATE_KEY);
  requestContext.set(ARK_IMAGE_GENERATION_RUN_STATE_KEY, {
    ...state,
    generatedURLs: state.generatedURLs.includes(url)
      ? state.generatedURLs
      : [...state.generatedURLs, url],
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function startPendingImageGeneration(
  requestContext: RequestContext<ArkImageGenerationRequestContextValues>,
  config: ArkImageGenerationConfig,
  prompt: string,
  fetchImpl: typeof fetch,
  abortSignal?: AbortSignal,
): ArkImageGenerationSuspendPayload {
  reserveImageGenerationCall(requestContext);
  const { scopeId } = requestContext.get(ARK_IMAGE_GENERATION_RUN_STATE_KEY);
  const jobId = crypto.randomUUID();
  const jobs = pendingImageJobsByScope.get(scopeId)
    ?? new Map<string, Promise<ArkImageGenerationResumeData>>();
  const pending: Promise<ArkImageGenerationResumeData> = generateArkImage(
    config,
    prompt,
    fetchImpl,
    abortSignal,
  ).then(
    (generated): ArkImageGenerationResumeData => ({
      ok: true,
      jobId,
      url: generated.url,
      ...(typeof generated.size === 'string' ? { size: generated.size } : {}),
    }),
  ).catch(
    (error: unknown): ArkImageGenerationResumeData => ({
      ok: false,
      jobId,
      error: errorMessage(error),
    }),
  );
  jobs.set(jobId, pending);
  pendingImageJobsByScope.set(scopeId, jobs);
  return { jobId };
}

export async function waitForPendingArkImageGeneration(
  scope: ArkImageGenerationRunScope,
  suspendPayload: unknown,
): Promise<ArkImageGenerationResumeData> {
  const { jobId } = imageGenerationSuspendSchema.parse(suspendPayload);
  const { scopeId } = scope.requestContext.get(
    ARK_IMAGE_GENERATION_RUN_STATE_KEY,
  );
  const jobs = pendingImageJobsByScope.get(scopeId);
  const pending = jobs?.get(jobId);
  if (!pending) {
    throw new Error(`Image generation job "${jobId}" was not found`);
  }

  try {
    return await pending;
  } finally {
    jobs?.delete(jobId);
    if (jobs?.size === 0) pendingImageJobsByScope.delete(scopeId);
  }
}

function imageGenerationEndpoint(baseURL: string): string {
  return `${baseURL}/images/generations`;
}

function abortError(reason: unknown): Error {
  if (reason instanceof Error) return reason;
  return new DOMException('The operation was aborted', 'AbortError');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseGeneratedImage(value: unknown): GeneratedImage {
  if (!isRecord(value)) {
    throw new Error('Ark image generation returned an invalid response');
  }
  const data: unknown = value.data;
  if (!Array.isArray(data)) {
    throw new Error('Ark image generation returned an invalid response');
  }
  const first: unknown = (data as unknown[])[0];
  if (!isRecord(first) || typeof first.url !== 'string') {
    throw new Error('Ark image generation returned no image URL');
  }

  let url: URL;
  try {
    url = new URL(first.url);
  } catch {
    throw new Error('Ark image generation returned an invalid image URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Ark image generation returned a non-HTTP image URL');
  }

  return {
    url: url.toString(),
    ...(typeof first.size === 'string' ? { size: first.size } : {}),
  };
}

function throwIfImageGenerationAborted(
  config: ArkImageGenerationConfig,
  controller: AbortController,
  abortSignal?: AbortSignal,
): void {
  if (abortSignal?.aborted) throw abortError(abortSignal.reason);
  if (controller.signal.aborted) {
    throw new Error(
      `Ark image generation timed out after ${config.requestTimeoutMs}ms`,
    );
  }
}

export async function generateArkImage(
  config: ArkImageGenerationConfig,
  prompt: string,
  fetchImpl: typeof fetch = fetch,
  abortSignal?: AbortSignal,
): Promise<GeneratedImage> {
  abortSignal?.throwIfAborted();

  const controller = new AbortController();
  const onAbort = () => controller.abort(abortSignal?.reason);
  abortSignal?.addEventListener('abort', onAbort, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new Error('image generation timed out')),
    config.requestTimeoutMs,
  );

  try {
    let response: Response;
    try {
      response = await fetchImpl(imageGenerationEndpoint(config.baseURL), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          prompt,
          size: '2K',
          sequential_image_generation: 'disabled',
          stream: false,
          response_format: 'url',
          watermark: true,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      throwIfImageGenerationAborted(config, controller, abortSignal);
      throw new Error('Ark image generation request failed', { cause: error });
    }
    throwIfImageGenerationAborted(config, controller, abortSignal);

    if (!response.ok) {
      throw new Error(
        `Ark image generation request failed with status ${response.status}`,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json() as unknown;
    } catch {
      throwIfImageGenerationAborted(config, controller, abortSignal);
      throw new Error('Ark image generation returned invalid JSON');
    }
    throwIfImageGenerationAborted(config, controller, abortSignal);
    return parseGeneratedImage(payload);
  } finally {
    clearTimeout(timeout);
    abortSignal?.removeEventListener('abort', onAbort);
  }
}

export async function generateArkImageForRun(
  scope: ArkImageGenerationRunScope,
  config: ArkImageGenerationConfig,
  prompt: string,
  fetchImpl: typeof fetch = fetch,
  abortSignal?: AbortSignal,
): Promise<GeneratedImage> {
  reserveImageGenerationCall(scope.requestContext);
  const generated = await generateArkImage(
    config,
    prompt,
    fetchImpl,
    abortSignal,
  );
  recordGeneratedImageURL(scope.requestContext, generated.url);
  return generated;
}

const imageGenerationInputSchema = z.object({
  prompt: z.string().trim().min(1).max(4000).describe(
    'A detailed image-generation prompt describing subject, setting, composition, lighting, colors, and visual style.',
  ),
});

const imageGenerationOutputSchema = z.object({
  url: z.string().url().describe(
    'The generated image URL. Copy this value exactly into Image.url or the bound data-model field.',
  ),
  size: z.string().optional(),
});

const imageGenerationRequestContextSchema = z.object({
  [ARK_IMAGE_GENERATION_RUN_STATE_KEY]: z.object({
    attemptedCalls: z.number().int().nonnegative(),
    generatedURLs: z.array(z.string().url()),
    maxCalls: z.number().int().min(1).max(10),
    scopeId: z.string().uuid(),
  }),
});

export function createArkImageGenerationTool(
  config: ArkImageGenerationConfig = resolveArkImageGenerationConfig(),
  fetchImpl: typeof fetch = fetch,
) {
  return createTool({
    id: 'generate_image',
    description:
      'Asynchronously generate one original image for an A2UI Image component. Emit a complete renderable A2UI array with a same-id Loading placeholder in the assistant content before calling this tool. The agent run suspends while the image is generated, then resumes with the generated URL so the agent can return the A2UI patch. Reuse a returned URL when the same visual can serve multiple components.',
    inputSchema: imageGenerationInputSchema,
    outputSchema: imageGenerationOutputSchema,
    suspendSchema: imageGenerationSuspendSchema,
    resumeSchema: imageGenerationResumeSchema,
    requestContextSchema: imageGenerationRequestContextSchema,
    execute: async ({ prompt }, context) => {
      const requestContext = context.requestContext as RequestContext<
        ArkImageGenerationRequestContextValues
      >;

      const resumeData = context.agent?.resumeData;
      if (resumeData !== undefined) {
        const resumed = imageGenerationResumeSchema.parse(resumeData);
        if (!resumed.ok) throw new Error(resumed.error);
        recordGeneratedImageURL(requestContext, resumed.url);
        return {
          url: resumed.url,
          ...(typeof resumed.size === 'string' ? { size: resumed.size } : {}),
        };
      }

      const suspend = context.agent?.suspend;
      if (!suspend) {
        return generateArkImageForRun(
          { requestContext },
          config,
          prompt,
          fetchImpl,
          context.abortSignal,
        );
      }

      const suspendPayload = startPendingImageGeneration(
        requestContext,
        config,
        prompt,
        fetchImpl,
        context.abortSignal,
      );
      await suspend(suspendPayload);
    },
  });
}
