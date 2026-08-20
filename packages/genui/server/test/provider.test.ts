// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { GENUI_MODEL_CONFIG_ENV } from '../service/common/model-config.js';
import {
  ProviderAgentCache,
  buildOpenAIRunOptions,
  createStableValueHash,
  resolveReasoningEffort,
} from '../service/common/provider.js';

function withModelConfig(raw: string, run: () => void): void {
  const previous = process.env[GENUI_MODEL_CONFIG_ENV];
  process.env[GENUI_MODEL_CONFIG_ENV] = raw;
  try {
    run();
  } finally {
    if (previous === undefined) {
      delete process.env[GENUI_MODEL_CONFIG_ENV];
    } else {
      process.env[GENUI_MODEL_CONFIG_ENV] = previous;
    }
  }
}

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

describe('buildOpenAIRunOptions', () => {
  test('passes the request abort signal and minimum reasoning effort', () => {
    const controller = new AbortController();

    withModelConfig(
      JSON.stringify({
        Fast: {
          apiKey: 'server-secret',
          baseURL: 'https://example.com/v1',
          model: 'fast-upstream',
        },
      }),
      () => {
        expect(buildOpenAIRunOptions({}, controller.signal)).toMatchObject({
          abortSignal: controller.signal,
          providerOptions: { openai: { reasoningEffort: 'none' } },
        });
      },
    );
  });

  test('prefers explicit and configured reasoning effort over the default', () => {
    withModelConfig(
      JSON.stringify({
        Fast: {
          apiKey: 'server-secret',
          baseURL: 'https://example.com/v1',
          model: 'fast-upstream',
          reasoningEffort: 'low',
        },
      }),
      () => {
        expect(resolveReasoningEffort({ model: 'Fast' })).toBe('low');
        expect(resolveReasoningEffort({
          model: 'Fast',
          reasoningEffort: 'high',
        })).toBe('high');
      },
    );
  });

  test('lets controlled runs opt out of the server default', () => {
    expect(resolveReasoningEffort({ inheritReasoningEffort: false })).toBe(
      undefined,
    );
    expect(buildOpenAIRunOptions({ inheritReasoningEffort: false })).toEqual(
      {},
    );
  });
});
