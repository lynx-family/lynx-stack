// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { loadBasicCatalog } from '../agent/a2ui-catalog.js';
import { createA2UIImageSourcePolicy } from '../agent/a2ui-image-source-policy.js';
import { A2UIProtocolMessageStreamParser } from '../agent/a2ui-stream-parser.js';
import { validateA2UIOutput } from '../agent/a2ui-validator.js';
import {
  createArkImageGenerationRunScope,
  generateArkImage,
  generateArkImageForRun,
  generatedArkImageURLs,
  resolveArkImageGenerationConfig,
} from '../agent/ark-image-generation-tool.js';

const CONFIG = {
  apiKey: 'ark-secret',
  baseURL: 'https://ark.example.com/api/v3',
  model: 'seedream-test-model',
  requestTimeoutMs: 5_000,
};

function requestURL(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function abortReason(signal: AbortSignal | null | undefined): Error {
  return signal?.reason instanceof Error
    ? signal.reason
    : new DOMException('The operation was aborted', 'AbortError');
}

const rateLimitedFetch: typeof fetch = () =>
  Promise.resolve(new Response('secret upstream details', { status: 429 }));

const toolGeneratedFetch: typeof fetch = () =>
  Promise.resolve(
    new Response(
      JSON.stringify({
        data: [{ url: 'https://images.example.com/tool-generated.jpeg' }],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ),
  );

const pendingUntilAbortedFetch: typeof fetch = (_input, init) =>
  new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    const onAbort = () => reject(abortReason(signal));
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });

const responseBodyPendingUntilAbortedFetch: typeof fetch = (_input, init) => {
  const response = new Response('{}', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  response.json = () =>
    new Promise<unknown>((_resolve, reject) => {
      const signal = init?.signal;
      const onAbort = () => reject(abortReason(signal));
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) onAbort();
    });
  return Promise.resolve(response);
};

describe('Ark image-generation configuration', () => {
  test('requires the API key, image model, and base URL', () => {
    expect(() => resolveArkImageGenerationConfig({})).toThrow(
      'IMG_GEN_ARK_API_KEY is required',
    );
    expect(() =>
      resolveArkImageGenerationConfig({
        IMG_GEN_ARK_API_KEY: 'secret',
      })
    ).toThrow('IMG_GEN_ARK_IMAGE_MODEL is required');
    expect(() =>
      resolveArkImageGenerationConfig({
        IMG_GEN_ARK_API_KEY: 'secret',
        IMG_GEN_ARK_IMAGE_MODEL: 'seedream',
      })
    ).toThrow('IMG_GEN_ARK_IMAGE_BASE_URL is required');
    expect(() =>
      resolveArkImageGenerationConfig({
        IMG_GEN_ARK_API_KEY: 'secret',
        IMG_GEN_ARK_IMAGE_MODEL: 'seedream',
        IMG_GEN_ARK_IMAGE_BASE_URL: '   ',
      })
    ).toThrow('IMG_GEN_ARK_IMAGE_BASE_URL is required');
  });

  test('trims and validates required values', () => {
    expect(resolveArkImageGenerationConfig({
      IMG_GEN_ARK_API_KEY: ' secret ',
      IMG_GEN_ARK_IMAGE_MODEL: ' seedream ',
      IMG_GEN_ARK_IMAGE_BASE_URL: ' https://ark.example.com/api/v3/ ',
    })).toEqual({
      apiKey: 'secret',
      baseURL: 'https://ark.example.com/api/v3',
      model: 'seedream',
      requestTimeoutMs: 120_000,
    });
    expect(
      resolveArkImageGenerationConfig({
        IMG_GEN_ARK_API_KEY: 'secret',
        IMG_GEN_ARK_IMAGE_MODEL: 'seedream',
        IMG_GEN_ARK_IMAGE_BASE_URL: 'https://ark.example.com/api/v3',
        IMG_GEN_ARK_IMAGE_REQUEST_TIMEOUT_MS: '5000',
      }).requestTimeoutMs,
    ).toBe(5_000);
  });

  test('rejects unsafe endpoint, credential, and timeout overrides', () => {
    expect(() =>
      resolveArkImageGenerationConfig({
        IMG_GEN_ARK_API_KEY: 'secret',
        IMG_GEN_ARK_IMAGE_MODEL: 'seedream',
        IMG_GEN_ARK_IMAGE_BASE_URL: 'http://example.com/api/v3',
      })
    ).toThrow('must be an HTTPS URL');
    expect(() =>
      resolveArkImageGenerationConfig({
        IMG_GEN_ARK_API_KEY: 'Bearer secret',
        IMG_GEN_ARK_IMAGE_MODEL: 'seedream',
      })
    ).toThrow('must not include the Bearer prefix');
    expect(() =>
      resolveArkImageGenerationConfig({
        IMG_GEN_ARK_API_KEY: 'secret',
        IMG_GEN_ARK_IMAGE_MODEL: 'seedream',
        IMG_GEN_ARK_IMAGE_BASE_URL: 'https://user:pass@example.com/api/v3',
      })
    ).toThrow('without credentials');
    for (
      const baseURL of [
        'https://example.com/api/v3?',
        'https://example.com/api/v3#',
      ]
    ) {
      expect(() =>
        resolveArkImageGenerationConfig({
          IMG_GEN_ARK_API_KEY: 'secret',
          IMG_GEN_ARK_IMAGE_MODEL: 'seedream',
          IMG_GEN_ARK_IMAGE_BASE_URL: baseURL,
        })
      ).toThrow('without credentials, query parameters, or a fragment');
    }
    expect(() =>
      resolveArkImageGenerationConfig({
        IMG_GEN_ARK_API_KEY: 'secret',
        IMG_GEN_ARK_IMAGE_MODEL: 'seedream',
        IMG_GEN_ARK_IMAGE_BASE_URL: 'https://ark.example.com/api/v3',
        IMG_GEN_ARK_IMAGE_REQUEST_TIMEOUT_MS: '0',
      })
    ).toThrow('must be an integer between 1 and 600000');
    expect(() =>
      resolveArkImageGenerationConfig({
        IMG_GEN_ARK_API_KEY: 'secret',
        IMG_GEN_ARK_IMAGE_MODEL: 'seedream',
        IMG_GEN_ARK_IMAGE_BASE_URL: 'https://ark.example.com/api/v3',
        IMG_GEN_ARK_IMAGE_REQUEST_TIMEOUT_MS: '600001',
      })
    ).toThrow('must be an integer between 1 and 600000');
  });
});

describe('Ark image-generation request', () => {
  test('sends a bounded single-image request and returns its URL', async () => {
    let requestedURL = '';
    let requestInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = (input, init) => {
      requestedURL = requestURL(input);
      requestInit = init;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [{
              url: 'https://images.example.com/generated.jpeg',
              size: '2048x2048',
            }],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    };

    await expect(
      generateArkImage(CONFIG, 'A red panda in soft studio light', fetchImpl),
    ).resolves.toEqual({
      url: 'https://images.example.com/generated.jpeg',
      size: '2048x2048',
    });

    expect(requestedURL).toBe(
      'https://ark.example.com/api/v3/images/generations',
    );
    expect(requestInit?.method).toBe('POST');
    expect(requestInit?.headers).toEqual({
      Authorization: 'Bearer ark-secret',
      'Content-Type': 'application/json',
    });
    const body = requestInit?.body;
    expect(typeof body).toBe('string');
    if (typeof body !== 'string') throw new Error('request body is missing');
    expect(JSON.parse(body)).toEqual({
      model: 'seedream-test-model',
      prompt: 'A red panda in soft studio light',
      size: '2K',
      sequential_image_generation: 'disabled',
      stream: false,
      response_format: 'url',
      watermark: true,
    });
  });

  test('does not expose upstream response bodies in failures', async () => {
    let failure: unknown;
    try {
      await generateArkImage(CONFIG, 'prompt', rateLimitedFetch);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    if (!(failure instanceof Error)) throw new Error('expected an Error');
    expect(failure.message).toContain('request failed with status 429');
    expect(failure.message).not.toContain('secret upstream details');
  });

  test('propagates caller cancellation during the image request', async () => {
    const controller = new AbortController();
    const reason = new Error('client disconnected');
    const pending = generateArkImage(
      CONFIG,
      'prompt',
      pendingUntilAbortedFetch,
      controller.signal,
    );
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
  });

  test('propagates caller cancellation while reading the response', async () => {
    const controller = new AbortController();
    const reason = new Error('client disconnected while reading');
    const pending = generateArkImage(
      CONFIG,
      'prompt',
      responseBodyPendingUntilAbortedFetch,
      controller.signal,
    );
    await Promise.resolve();
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
  });

  test('times out image requests with a bounded error', async () => {
    await expect(generateArkImage(
      { ...CONFIG, requestTimeoutMs: 5 },
      'prompt',
      pendingUntilAbortedFetch,
    )).rejects.toThrow('timed out after 5ms');
  });

  test('enforces one request-wide call budget and records generated URLs', async () => {
    let fetchCalls = 0;
    const fetchImpl: typeof fetch = () => {
      fetchCalls += 1;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [{
              url: `https://images.example.com/generated-${fetchCalls}.jpeg`,
            }],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    };
    const scope = createArkImageGenerationRunScope(4);
    const results = await Promise.allSettled(
      Array.from(
        { length: 5 },
        (_, index) =>
          generateArkImageForRun(scope, CONFIG, `prompt ${index}`, fetchImpl),
      ),
    );

    expect(fetchCalls).toBe(4);
    expect(results.filter((result) => result.status === 'fulfilled'))
      .toHaveLength(
        4,
      );
    expect(results.filter((result) => result.status === 'rejected'))
      .toHaveLength(
        1,
      );
    expect(generatedArkImageURLs(scope)).toHaveLength(4);
  });

  test('counts failed image calls against the request budget', async () => {
    const scope = createArkImageGenerationRunScope(1);
    await expect(
      generateArkImageForRun(scope, CONFIG, 'prompt', rateLimitedFetch),
    ).rejects.toThrow('request failed with status 429');
    await expect(
      generateArkImageForRun(scope, CONFIG, 'prompt', toolGeneratedFetch),
    ).rejects.toThrow('call limit reached (1 per request)');
  });
});

describe('A2UI image URL validation', () => {
  test('rejects unresolved prompts and accepts generated URLs', async () => {
    const catalog = await loadBasicCatalog();
    const createMessages = (url: unknown, dataModel?: unknown) =>
      JSON.stringify([
        {
          version: 'v1.0',
          createSurface: {
            surfaceId: 'main',
            catalogId: catalog.id,
          },
        },
        ...(dataModel === undefined
          ? []
          : [{
            version: 'v1.0',
            updateDataModel: {
              surfaceId: 'main',
              path: '/',
              value: dataModel,
            },
          }]),
        {
          version: 'v1.0',
          updateComponents: {
            surfaceId: 'main',
            components: [{
              id: 'root',
              component: 'Image',
              url,
            }],
          },
        },
      ]);

    const unresolved = validateA2UIOutput(
      createMessages('city skyline at night'),
      catalog,
    );
    expect(unresolved.ok).toBe(false);
    expect(unresolved.errors.join('\n')).toContain('generate_image');

    expect(
      validateA2UIOutput(
        createMessages('https://images.example.com/skyline.jpeg'),
        catalog,
      ).ok,
    ).toBe(true);

    const unresolvedBinding = validateA2UIOutput(
      createMessages({ path: '/hero' }, { hero: 'city skyline at night' }),
      catalog,
    );
    expect(unresolvedBinding.ok).toBe(false);
    expect(unresolvedBinding.errors.join('\n')).toContain('generate_image');

    expect(
      validateA2UIOutput(
        createMessages(
          { path: '/hero' },
          { hero: 'https://images.example.com/generated.jpeg' },
        ),
        catalog,
      ).ok,
    ).toBe(true);

    const scope = createArkImageGenerationRunScope();
    const isImageSourceAllowed = createA2UIImageSourcePolicy(
      [
        'Use https://images.example.com/user-provided.jpeg in the hero, '
        + 'and use /assets/user-provided.png for the thumbnail.',
      ],
      () => generatedArkImageURLs(scope),
    );
    await generateArkImageForRun(scope, CONFIG, 'hero', toolGeneratedFetch);

    expect(
      validateA2UIOutput(
        createMessages('https://images.example.com/user-provided.jpeg'),
        catalog,
        { isImageSourceAllowed },
      ).ok,
    ).toBe(true);
    expect(
      validateA2UIOutput(
        createMessages('/assets/user-provided.png'),
        catalog,
        { isImageSourceAllowed },
      ).ok,
    ).toBe(true);
    expect(
      validateA2UIOutput(
        createMessages('https://images.example.com/tool-generated.jpeg'),
        catalog,
        { isImageSourceAllowed },
      ).ok,
    ).toBe(true);
    const hallucinated = validateA2UIOutput(
      createMessages('https://images.example.com/hallucinated.jpeg'),
      catalog,
      { isImageSourceAllowed },
    );
    expect(hallucinated.ok).toBe(false);
    expect(hallucinated.errors.join('\n')).toContain('untrusted url');
    expect(
      validateA2UIOutput(
        createMessages(
          { path: '/hero' },
          { hero: 'https://images.example.com/hallucinated.jpeg' },
        ),
        catalog,
        { isImageSourceAllowed },
      ).errors.join('\n'),
    ).toContain('untrusted image URL');
  });

  test('streams unresolved images as same-id loading components', async () => {
    const catalog = await loadBasicCatalog();
    const raw = JSON.stringify([
      {
        version: 'v1.0',
        createSurface: { surfaceId: 'main', catalogId: catalog.id },
      },
      {
        version: 'v1.0',
        updateComponents: {
          surfaceId: 'main',
          components: [{
            id: 'root',
            component: 'Image',
            url: 'city skyline at night',
          }],
        },
      },
    ]);
    const streamed = new A2UIProtocolMessageStreamParser({
      hasLoadingComponent: true,
    }).push(raw);
    const serialized = JSON.stringify(streamed);

    expect(serialized).toContain(
      '"id":"root","component":"Loading","variant":"block"',
    );
    expect(serialized).not.toContain('city skyline at night');

    const isImageSourceAllowed = createA2UIImageSourcePolicy([
      'https://images.example.com/user-provided.jpeg',
    ]);
    const untrustedRaw = raw.replace(
      'city skyline at night',
      'https://images.example.com/hallucinated.jpeg',
    );
    const untrustedStream = new A2UIProtocolMessageStreamParser({
      hasLoadingComponent: true,
      isImageSourceAllowed,
    }).push(untrustedRaw);
    expect(JSON.stringify(untrustedStream)).not.toContain('hallucinated.jpeg');

    const trustedRaw = raw.replace(
      'city skyline at night',
      'https://images.example.com/user-provided.jpeg',
    );
    const trustedStream = new A2UIProtocolMessageStreamParser({
      hasLoadingComponent: true,
      isImageSourceAllowed,
    }).push(trustedRaw);
    expect(JSON.stringify(trustedStream)).toContain('user-provided.jpeg');
  });
});
