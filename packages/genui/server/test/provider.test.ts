// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import {
  createOpenAICompatFetch,
  resolveOpenAIFetchTimeoutMs,
} from '../agent/openai-provider.js';
import {
  defaultOpenAIAPIStyle,
  isAIDPChatEndpoint,
  rewriteAIDPChatURL,
} from '../agent/openai-utils.js';
import {
  ProviderAgentCache,
  buildOpenAIRunOptions,
  buildResourceRunOptions,
  createStableValueHash,
} from '../service/common/provider.js';

describe('OpenAI API style', () => {
  test('uses a configurable timeout longer than the Undici default', () => {
    expect(resolveOpenAIFetchTimeoutMs(undefined)).toBe(600_000);
    expect(resolveOpenAIFetchTimeoutMs('900000')).toBe(900_000);
    expect(resolveOpenAIFetchTimeoutMs('500')).toBe(1000);
    expect(resolveOpenAIFetchTimeoutMs('999999999')).toBe(1_800_000);
    expect(resolveOpenAIFetchTimeoutMs('invalid')).toBe(600_000);
  });

  test('uses Responses for official OpenAI and Chat for AIDP', () => {
    expect(defaultOpenAIAPIStyle('https://api.openai.com/v1')).toBe(
      'responses',
    );
    expect(
      defaultOpenAIAPIStyle(
        'https://aidp.bytedance.net/api/modelhub/online/v2/crawl',
      ),
    ).toBe('chat');
    expect(
      isAIDPChatEndpoint(
        'https://aidp.bytedance.net/api/modelhub/online/v2/crawl/',
      ),
    ).toBe(true);
  });

  test('keeps other OpenAI-compatible endpoints on Chat Completions', () => {
    expect(defaultOpenAIAPIStyle('https://example.com/v1')).toBe('chat');
    expect(
      isAIDPChatEndpoint(
        'https://aidp.bytedance.net/api/modelhub/online/v2/crawl-proxy',
      ),
    ).toBe(false);
  });

  test('uses the AIDP crawl endpoint without appending a target region', () => {
    const baseURL = 'https://aidp.bytedance.net/api/modelhub/online/v2/crawl';

    expect(
      rewriteAIDPChatURL(
        `${baseURL}/chat/completions`,
        baseURL,
        'test key',
      ),
    ).toBe(`${baseURL}?ak=test+key`);
    expect(
      rewriteAIDPChatURL(
        'https://example.com/v1/chat/completions',
        'https://example.com/v1',
        'test-key',
      ),
    ).toBe('https://example.com/v1/chat/completions');
  });

  test('matches the AIDP curl authentication and message format', async () => {
    const baseURL = 'https://aidp.bytedance.net/api/modelhub/online/v2/crawl';
    let capturedURL = '';
    let capturedInit: RequestInit | undefined;
    let capturedBody = '';
    const fetchImpl: typeof fetch = (input, init) => {
      if (typeof input === 'string') {
        capturedURL = input;
      } else if (input instanceof URL) {
        capturedURL = input.href;
      } else {
        capturedURL = input.url;
      }
      capturedInit = init;
      capturedBody = typeof init?.body === 'string' ? init.body : '';
      return Promise.resolve(new Response('{}', { status: 200 }));
    };
    const compatFetch = createOpenAICompatFetch(
      baseURL,
      'test-key',
      fetchImpl,
      'test-log-id',
    );

    await compatFetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'developer', content: 'instructions' }],
      }),
    });

    expect(capturedURL).toBe(`${baseURL}?ak=test-key`);
    const headers = new Headers(capturedInit?.headers);
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('x-tt-logid')).toBe('test-log-id');
    expect(JSON.parse(capturedBody)).toEqual({
      messages: [{ role: 'system', content: 'instructions' }],
    });
  });

  test('adds omitted choice indexes to AIDP JSON responses', async () => {
    const baseURL = 'https://aidp.bytedance.net/api/modelhub/online/v2/crawl';
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'chatcmpl-test',
            choices: [
              {
                finish_reason: 'stop',
                message: {
                  role: 'assistant',
                  content: '<!DOCTYPE lynx>',
                },
              },
              {
                finish_reason: 'stop',
                index: 7,
                message: {
                  role: 'assistant',
                  content: 'existing index',
                },
              },
            ],
          }),
          {
            headers: {
              'content-encoding': 'gzip',
              'content-length': '123',
              'content-type': 'application/json; charset=utf-8',
            },
          },
        ),
      );
    const compatFetch = createOpenAICompatFetch(
      baseURL,
      'test-key',
      fetchImpl,
      'test-log-id',
    );

    const response = await compatFetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      body: JSON.stringify({ messages: [] }),
    });

    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('content-length')).toBeNull();
    await expect(response.json()).resolves.toMatchObject({
      choices: [{ index: 0 }, { index: 7 }],
    });
  });
});

describe('ProviderAgentCache', () => {
  test('reuses an in-flight creation for identical requests', async () => {
    const cache = new ProviderAgentCache<object>();
    let createCount = 0;
    const create = async () => {
      createCount += 1;
      await Promise.resolve();
      return {};
    };

    const first = cache.get({ model: 'test-model' }, create);
    const second = cache.get({ model: 'test-model' }, create);

    expect(second).toBe(first);
    expect(await second).toBe(await first);
    expect(createCount).toBe(1);
  });

  test('evicts the least recently used entry at its capacity', async () => {
    const cache = new ProviderAgentCache<string>(2);
    const firstA = cache.get({ model: 'a' }, () => 'agent-a');
    const firstB = cache.get({ model: 'b' }, () => 'agent-b');

    expect(cache.get({ model: 'a' }, () => 'unused')).toBe(firstA);
    void cache.get({ model: 'c' }, () => 'agent-c');

    expect(cache.get({ model: 'a' }, () => 'unused')).toBe(firstA);
    expect(cache.get({ model: 'b' }, () => 'new-agent-b')).not.toBe(firstB);
    await expect(firstB).resolves.toBe('agent-b');
  });

  test('does not let an evicted rejection delete its replacement', async () => {
    const cache = new ProviderAgentCache<string>(1);
    let rejectFirst!: (reason: Error) => void;
    const firstCreation = new Promise<string>((_resolve, reject) => {
      rejectFirst = reject;
    });
    const failed = cache.get(
      { model: 'a' },
      () => firstCreation,
    );

    void cache.get({ model: 'b' }, () => 'agent-b');
    const replacement = cache.get({ model: 'a' }, () => 'replacement');
    rejectFirst(new Error('creation failed'));

    await expect(failed).rejects.toThrow('creation failed');
    expect(cache.get({ model: 'a' }, () => 'unused')).toBe(replacement);
    await expect(replacement).resolves.toBe('replacement');
  });

  test('retries creation after a cached rejection', async () => {
    const cache = new ProviderAgentCache<string>();
    const failed = cache.get(
      { model: 'a' },
      () => Promise.reject(new Error('creation failed')),
    );
    await expect(failed).rejects.toThrow('creation failed');

    await expect(cache.get({ model: 'a' }, () => 'recovered')).resolves.toBe(
      'recovered',
    );
  });
});

describe('provider run options', () => {
  test('forwards the SDK retry limit without changing provider identity', () => {
    expect(
      buildOpenAIRunOptions({
        apiKey: 'test-key',
        maxRetries: 4,
        model: 'test-model',
        resourceId: 'bench:test',
      }),
    ).toEqual({
      maxRetries: 4,
      resourceId: 'bench:test',
    });
  });

  test('forwards the retry limit and abort signal to resource agents', () => {
    const abortController = new AbortController();

    expect(
      buildResourceRunOptions(
        { maxRetries: 4, resourceId: 'bench:test' },
        abortController.signal,
      ),
    ).toEqual({
      abortSignal: abortController.signal,
      maxRetries: 4,
      resourceId: 'bench:test',
    });
  });
});

describe('createStableValueHash', () => {
  test('is order-independent and changes when catalog content changes', () => {
    const first = {
      id: 'catalog',
      components: [{ name: 'Card', props: { title: 'string' } }],
    };
    const reordered = {
      components: [{ props: { title: 'string' }, name: 'Card' }],
      id: 'catalog',
    };
    const changed = {
      id: 'catalog',
      components: [{ name: 'Card', props: { title: 'number' } }],
    };

    expect(createStableValueHash(reordered)).toBe(
      createStableValueHash(first),
    );
    expect(createStableValueHash(changed)).not.toBe(
      createStableValueHash(first),
    );
  });
});
