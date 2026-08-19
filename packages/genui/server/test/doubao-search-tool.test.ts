// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { loadBasicCatalog } from '../agent/a2ui-catalog.js';
import { createA2UIImageSourcePolicy } from '../agent/a2ui-image-source-policy.js';
import {
  createA2UIOpenURLPolicy,
  userProvidedA2UIURLSources,
} from '../agent/a2ui-open-url-policy.js';
import { A2UIProtocolMessageStreamParser } from '../agent/a2ui-stream-parser.js';
import { validateA2UIOutput } from '../agent/a2ui-validator.js';
import { createArkImageGenerationRunScope } from '../agent/ark-image-generation-tool.js';
import {
  SEARCH_INFINITY_ENDPOINT,
  createOptionalDoubaoImageSearchTool,
  createOptionalDoubaoSearchTool,
  initializeDoubaoSearchRunScope,
  readDoubaoSearchConfig,
  resolveDoubaoSearchConfig,
  searchDoubao,
  searchDoubaoForRun,
  searchDoubaoImages,
  searchDoubaoImagesForRun,
  searchedDoubaoDocumentURLs,
  searchedDoubaoImageURLs,
} from '../agent/doubao-search-tool.js';

const CONFIG = {
  apiKey: 'search-secret',
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

function successfulResponse(url = 'https://news.example.com/story') {
  return new Response(
    JSON.stringify({
      ResponseMetadata: { RequestId: 'private-request-id' },
      Result: {
        ResultCount: 20,
        WebResults: [{
          SortId: 2,
          Url: url,
          Title: 'Current result',
          Snippet: 'Short excerpt.',
          Summary: 'First excerpt.\nSecond excerpt.',
          Content: 'Ignored full content.',
          PublishTime: '2026-08-18',
          AuthInfoDes: 'Normal authority',
          AuthInfoLevel: 3,
          LogoUrl: 'https://images.example.com/ignored.png',
        }, {
          SortId: 3,
          Url: 'file:///private/result',
          Title: 'Unsafe result',
          Summary: 'Unsafe excerpt.',
        }],
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function successfulImageResponse(
  imageUrl = 'https://images.example.com/beijing.jpeg?signature=trusted',
  sourceUrl = 'https://news.example.com/beijing-photo',
) {
  return new Response(
    JSON.stringify({
      ResponseMetadata: { RequestId: 'private-request-id' },
      Result: {
        ResultCount: 9,
        ImageResults: [{
          SortId: 1,
          Title: 'Beijing skyline',
          SiteName: 'Example News',
          Url: sourceUrl,
          PublishTime: '2026-08-20',
          Image: {
            Url: imageUrl,
            Width: 1600,
            Height: 900,
            Shape: '横长方形',
            BlurDes: '清晰',
            Category: '城市',
            Watermark: '0',
          },
          RankScore: 0.98,
        }, {
          SortId: 2,
          Title: 'Unsafe image',
          Url: 'file:///private/source',
          Image: {
            Url: 'file:///private/image.jpeg',
          },
        }],
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

const successfulFetch: typeof fetch = () =>
  Promise.resolve(successfulResponse());

const successfulImageFetch: typeof fetch = () =>
  Promise.resolve(successfulImageResponse());

const rateLimitedFetch: typeof fetch = () =>
  Promise.resolve(
    new Response('secret upstream details', { status: 429 }),
  );

const apiErrorFetch: typeof fetch = () =>
  Promise.resolve(
    new Response(JSON.stringify({
      ResponseMetadata: {
        Error: {
          CodeN: 1234,
          Code: '1234',
          Message: 'secret upstream details',
        },
      },
      Result: null,
    })),
  );

const invalidJsonFetch: typeof fetch = () =>
  Promise.resolve(new Response('{not-json', { status: 200 }));

const secretRejectingFetch: typeof fetch = () =>
  Promise.reject(new Error('network failure containing search-secret'));

const failingFetch: typeof fetch = () =>
  Promise.resolve(new Response('', { status: 500 }));

const pendingUntilAbortedFetch: typeof fetch = (_input, init) =>
  new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    const onAbort = () => reject(abortReason(signal));
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });

function a2uiWithOpenURL(url: unknown): string {
  return JSON.stringify([
    {
      version: 'v1.0',
      createSurface: {
        surfaceId: 'main',
        catalogId: 'https://unpkg.com/@lynx-js/genui/a2ui/dist/catalog.json',
      },
    },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: 'main',
        components: [{
          id: 'root',
          component: 'Button',
          child: 'source-label',
          action: {
            functionCall: {
              call: 'openUrl',
              args: { url },
            },
          },
        }, {
          id: 'source-label',
          component: 'Text',
          text: 'Open source',
        }],
      },
    },
  ]);
}

function a2uiWithImage(url: unknown): string {
  return JSON.stringify([
    {
      version: 'v1.0',
      createSurface: {
        surfaceId: 'main',
        catalogId: 'https://unpkg.com/@lynx-js/genui/a2ui/dist/catalog.json',
      },
    },
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
}

describe('Doubao search configuration', () => {
  test('is disabled when no search configuration is present', () => {
    expect(readDoubaoSearchConfig({})).toEqual({
      ok: true,
      enabled: false,
    });
    expect(createOptionalDoubaoSearchTool(true, {})).toBeUndefined();
    expect(createOptionalDoubaoImageSearchTool(true, {})).toBeUndefined();
    expect(readDoubaoSearchConfig({
      SEARCH_INFINITY_REQUEST_TIMEOUT_MS: '1000',
    })).toEqual({ ok: true, enabled: false });
  });

  test('trims the API key and applies the default timeout', () => {
    expect(resolveDoubaoSearchConfig({
      SEARCH_INFINITY_API_KEY: ' search-secret ',
    })).toEqual({ apiKey: 'search-secret', requestTimeoutMs: 10_000 });
    expect(
      resolveDoubaoSearchConfig({
        SEARCH_INFINITY_API_KEY: 'search-secret',
        SEARCH_INFINITY_REQUEST_TIMEOUT_MS: '2500',
      }).requestTimeoutMs,
    ).toBe(2_500);
  });

  test('rejects unsafe enabled configuration', () => {
    expect(() => resolveDoubaoSearchConfig({})).toThrow(
      'SEARCH_INFINITY_API_KEY is required',
    );
    expect(() =>
      resolveDoubaoSearchConfig({
        SEARCH_INFINITY_API_KEY: 'Bearer secret',
      })
    ).toThrow('must not include the Bearer prefix');
    for (const timeout of ['0', '60001', '1.5']) {
      expect(() =>
        resolveDoubaoSearchConfig({
          SEARCH_INFINITY_API_KEY: 'secret',
          SEARCH_INFINITY_REQUEST_TIMEOUT_MS: timeout,
        })
      ).toThrow('must be an integer between 1 and 60000');
    }
    expect(createOptionalDoubaoSearchTool(true, {
      SEARCH_INFINITY_API_KEY: 'secret',
      SEARCH_INFINITY_REQUEST_TIMEOUT_MS: '0',
    })).toBeUndefined();
    expect(createOptionalDoubaoImageSearchTool(true, {
      SEARCH_INFINITY_API_KEY: 'secret',
      SEARCH_INFINITY_REQUEST_TIMEOUT_MS: '0',
    })).toBeUndefined();
  });

  test('can be explicitly disabled even when configuration exists', () => {
    expect(createOptionalDoubaoSearchTool(false, {
      SEARCH_INFINITY_API_KEY: 'search-secret',
    })).toBeUndefined();
    expect(createOptionalDoubaoImageSearchTool(false, {
      SEARCH_INFINITY_API_KEY: 'search-secret',
    })).toBeUndefined();
    expect(createOptionalDoubaoSearchTool(true, {
      SEARCH_INFINITY_API_KEY: 'search-secret',
    })).toBeDefined();
    expect(createOptionalDoubaoImageSearchTool(true, {
      SEARCH_INFINITY_API_KEY: 'search-secret',
    })).toBeDefined();
  });
});

describe('Doubao search request', () => {
  test('sends bounded Custom web-search parameters and normalizes text results', async () => {
    let requestedURL = '';
    let requestInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = (input, init) => {
      requestedURL = requestURL(input);
      requestInit = init;
      return Promise.resolve(successfulResponse());
    };

    await expect(searchDoubao(CONFIG, ' current topic ', fetchImpl)).resolves
      .toEqual({
        query: 'current topic',
        totalDocCount: 20,
        results: [{
          rank: 2,
          title: 'Current result',
          url: 'https://news.example.com/story',
          snippet: 'First excerpt.\nSecond excerpt.',
          hostname: 'news.example.com',
          publishTime: '2026-08-18',
          authorityLevel: '3',
        }],
      });

    expect(requestedURL).toBe(SEARCH_INFINITY_ENDPOINT);
    expect(requestInit?.method).toBe('POST');
    expect(requestInit?.headers).toEqual({
      Authorization: 'Bearer search-secret',
      'Content-Type': 'application/json',
    });
    const body = requestInit?.body;
    expect(typeof body).toBe('string');
    if (typeof body !== 'string') throw new Error('request body is missing');
    expect(JSON.parse(body)).toEqual({
      Query: 'current topic',
      SearchType: 'web',
      Count: 5,
      Filter: {
        NeedContent: false,
        NeedUrl: true,
      },
      ContentFormats: 'text',
    });
    expect(JSON.stringify(await searchDoubao(CONFIG, 'topic', fetchImpl)))
      .not.toContain('ignored.png');
    await expect(
      searchDoubao(CONFIG, 'x'.repeat(101), fetchImpl),
    ).rejects.toThrow('must not exceed 100 characters');
  });

  test('requests image results and normalizes trusted image metadata', async () => {
    let requestedURL = '';
    let requestInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = (input, init) => {
      requestedURL = requestURL(input);
      requestInit = init;
      return Promise.resolve(successfulImageResponse());
    };

    await expect(searchDoubaoImages(CONFIG, ' Beijing skyline ', fetchImpl))
      .resolves.toEqual({
        query: 'Beijing skyline',
        totalImageCount: 9,
        results: [{
          rank: 1,
          title: 'Beijing skyline',
          imageUrl: 'https://images.example.com/beijing.jpeg?signature=trusted',
          sourceUrl: 'https://news.example.com/beijing-photo',
          siteName: 'Example News',
          publishTime: '2026-08-20',
          width: 1600,
          height: 900,
          shape: '横长方形',
          blurDescription: '清晰',
          category: '城市',
          hasWatermark: false,
        }],
      });

    expect(requestedURL).toBe(SEARCH_INFINITY_ENDPOINT);
    expect(requestInit?.method).toBe('POST');
    const body = requestInit?.body;
    expect(typeof body).toBe('string');
    if (typeof body !== 'string') throw new Error('request body is missing');
    expect(JSON.parse(body)).toEqual({
      Query: 'Beijing skyline',
      SearchType: 'image',
      Count: 5,
    });
  });

  test('does not expose upstream response details in failures', async () => {
    await expect(searchDoubao(CONFIG, 'topic', rateLimitedFetch)).rejects
      .toThrow('request failed with status 429');

    let failure: unknown;
    try {
      await searchDoubao(CONFIG, 'topic', apiErrorFetch);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    if (!(failure instanceof Error)) throw new Error('expected an Error');
    expect(failure.message).toBe('Doubao search failed with code 1234');
    expect(failure.message).not.toContain('secret upstream details');

    await expect(searchDoubao(CONFIG, 'topic', invalidJsonFetch)).rejects
      .toThrow('returned invalid JSON');
    await expect(searchDoubao(CONFIG, 'topic', secretRejectingFetch)).rejects
      .toThrow('Doubao search request failed');
    try {
      await searchDoubao(CONFIG, 'topic', secretRejectingFetch);
    } catch (error) {
      expect(String(error)).not.toContain('search-secret');
      expect((error as Error).cause).toBeUndefined();
    }
  });

  test('propagates cancellation and applies a bounded timeout', async () => {
    const controller = new AbortController();
    const reason = new Error('client disconnected');
    const pending = searchDoubao(
      CONFIG,
      'topic',
      pendingUntilAbortedFetch,
      controller.signal,
    );
    controller.abort(reason);
    await expect(pending).rejects.toBe(reason);

    await expect(searchDoubao(
      { ...CONFIG, requestTimeoutMs: 1 },
      'topic',
      pendingUntilAbortedFetch,
    )).rejects.toThrow('timed out after 1ms');
  });

  test('shares a request-wide call budget and records trusted URLs', async () => {
    const scope = createArkImageGenerationRunScope();
    initializeDoubaoSearchRunScope(scope, 2);
    await searchDoubaoForRun(scope, CONFIG, 'first', successfulFetch);
    await searchDoubaoImagesForRun(
      scope,
      CONFIG,
      'second',
      successfulImageFetch,
    );
    expect(searchedDoubaoDocumentURLs(scope)).toEqual([
      'https://news.example.com/story',
      'https://news.example.com/beijing-photo',
    ]);
    expect(searchedDoubaoImageURLs(scope)).toEqual([
      'https://images.example.com/beijing.jpeg?signature=trusted',
    ]);
    await expect(
      searchDoubaoForRun(scope, CONFIG, 'third', successfulFetch),
    ).rejects.toThrow('call limit reached (2 per request)');

    const failedScope = createArkImageGenerationRunScope();
    initializeDoubaoSearchRunScope(failedScope, 1);
    await expect(
      searchDoubaoForRun(failedScope, CONFIG, 'first', failingFetch),
    ).rejects.toThrow('status 500');
    await expect(
      searchDoubaoForRun(failedScope, CONFIG, 'second', successfulFetch),
    ).rejects.toThrow('call limit reached (1 per request)');
  });
});

describe('A2UI image-search source validation', () => {
  test('trusts searched images and their source pages but rejects invented images', async () => {
    const catalog = await loadBasicCatalog();
    const scope = createArkImageGenerationRunScope();
    const imagePolicy = createA2UIImageSourcePolicy(
      [],
      () => searchedDoubaoImageURLs(scope),
    );
    const openURLPolicy = createA2UIOpenURLPolicy(
      [],
      () => searchedDoubaoDocumentURLs(scope),
    );
    await searchDoubaoImagesForRun(
      scope,
      CONFIG,
      'Beijing skyline',
      successfulImageFetch,
    );

    const searchedImage =
      'https://images.example.com/beijing.jpeg?signature=trusted';
    expect(
      validateA2UIOutput(
        a2uiWithImage(searchedImage),
        catalog,
        { isImageSourceAllowed: imagePolicy },
      ).ok,
    ).toBe(true);
    expect(openURLPolicy('https://news.example.com/beijing-photo')).toBe(true);

    const inventedImage = 'https://images.example.com/invented.jpeg';
    const invented = validateA2UIOutput(
      a2uiWithImage(inventedImage),
      catalog,
      { isImageSourceAllowed: imagePolicy },
    );
    expect(invented.ok).toBe(false);
    expect(invented.errors.join('\n')).toContain(
      'returned by image_search or generate_image',
    );

    const trustedStream = new A2UIProtocolMessageStreamParser({
      hasLoadingComponent: true,
      isImageSourceAllowed: imagePolicy,
    }).push(a2uiWithImage(searchedImage));
    expect(JSON.stringify(trustedStream)).toContain(searchedImage);

    const untrustedStream = new A2UIProtocolMessageStreamParser({
      hasLoadingComponent: true,
      isImageSourceAllowed: imagePolicy,
    }).push(a2uiWithImage(inventedImage));
    expect(JSON.stringify(untrustedStream)).toContain(
      '"component":"Loading"',
    );
    expect(JSON.stringify(untrustedStream)).not.toContain(inventedImage);
  });
});

describe('A2UI web-search source validation', () => {
  test('trusts user messages but not assistant or system history', () => {
    const policy = createA2UIOpenURLPolicy(
      userProvidedA2UIURLSources(
        [{
          role: 'user',
          content: 'Use https://user.example.com/reference',
        }],
        [{
          role: 'assistant',
          content: 'Invented https://assistant.example.com/reference',
        }, {
          role: 'system',
          content: 'System https://system.example.com/reference',
        }],
      ),
    );
    expect(policy('https://user.example.com/reference')).toBe(true);
    expect(policy('https://assistant.example.com/reference')).toBe(false);
    expect(policy('https://system.example.com/reference')).toBe(false);
  });

  test('allows user and search URLs but rejects invented openUrl targets', async () => {
    const catalog = await loadBasicCatalog();
    const scope = createArkImageGenerationRunScope();
    await searchDoubaoForRun(scope, CONFIG, 'topic', successfulFetch);
    const policy = createA2UIOpenURLPolicy(
      ['User supplied https://user.example.com/reference'],
      () => searchedDoubaoDocumentURLs(scope),
    );

    expect(
      validateA2UIOutput(
        a2uiWithOpenURL('https://news.example.com/story'),
        catalog,
        { isOpenUrlAllowed: policy },
      ).ok,
    ).toBe(true);
    expect(
      validateA2UIOutput(
        a2uiWithOpenURL('https://user.example.com/reference'),
        catalog,
        { isOpenUrlAllowed: policy },
      ).ok,
    ).toBe(true);
    const invented = validateA2UIOutput(
      a2uiWithOpenURL('https://invented.example.com/source'),
      catalog,
      { isOpenUrlAllowed: policy },
    );
    expect(invented.ok).toBe(false);
    expect(invented.errors).toContain(
      'Function "openUrl" at component.root.action.functionCall has untrusted url "https://invented.example.com/source". Use a URL supplied by the request or returned by web_search or image_search.',
    );
  });

  test('rejects dynamically bound openUrl targets', async () => {
    const catalog = await loadBasicCatalog();
    const binding = { path: '/sources/0/url' };
    const result = validateA2UIOutput(
      a2uiWithOpenURL(binding),
      catalog,
      { isOpenUrlAllowed: () => true },
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'Function "openUrl" at component.root.action.functionCall has untrusted url {"path":"/sources/0/url"}. Use a URL supplied by the request or returned by web_search or image_search.',
    );
  });

  test('extracts nested and Markdown URLs while remaining HTTP-only', () => {
    const policy = createA2UIOpenURLPolicy([
      {
        nested: JSON.stringify({
          markdown: '[source](https://docs.example.com/story)',
        }),
      },
      '/local/path',
      'data:text/plain,hello',
    ]);

    expect(policy('https://docs.example.com/story')).toBe(true);
    expect(policy('/local/path')).toBe(false);
    expect(policy('data:text/plain,hello')).toBe(false);
    expect(policy('file:///tmp/story')).toBe(false);
  });

  test('does not stream a component containing an untrusted openUrl', () => {
    const trustedURL = 'https://news.example.com/story';
    const untrusted = new A2UIProtocolMessageStreamParser({
      hasLoadingComponent: true,
      isOpenUrlAllowed: (url) => url === trustedURL,
    }).push(a2uiWithOpenURL('https://invented.example.com/source'));
    expect(JSON.stringify(untrusted)).toContain('"component":"Loading"');
    expect(JSON.stringify(untrusted)).not.toContain('invented.example.com');

    const trusted = new A2UIProtocolMessageStreamParser({
      hasLoadingComponent: true,
      isOpenUrlAllowed: (url) => url === trustedURL,
    }).push(a2uiWithOpenURL(trustedURL));
    expect(JSON.stringify(trusted)).toContain('"component":"Button"');
    expect(JSON.stringify(trusted)).toContain(trustedURL);
  });

  test('does not stream a component containing a bound openUrl', () => {
    const streamed = new A2UIProtocolMessageStreamParser({
      hasLoadingComponent: true,
      isOpenUrlAllowed: () => true,
    }).push(a2uiWithOpenURL({ path: '/sources/0/url' }));

    expect(JSON.stringify(streamed)).toContain('"component":"Loading"');
    expect(JSON.stringify(streamed)).not.toContain('/sources/0/url');
  });
});
