// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, describe, expect, rstest, test } from '@rstest/core';

import { GENUI_MODEL_CONFIG_ENV } from '../service/common/model-config.js';
import {
  ProviderAgentCache,
  buildOpenAIRunOptions,
  createStableValueHash,
  resolveReasoningEffort,
} from '../service/common/provider.js';

afterEach(() => {
  rstest.unstubAllEnvs();
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
  test('keeps SDK retry overrides scoped to the invocation', () => {
    expect(buildOpenAIRunOptions({ maxRetries: 0 }).modelSettings).toEqual({
      maxRetries: 0,
    });
    expect(buildOpenAIRunOptions({})).not.toHaveProperty('modelSettings');
  });
  test('resolves effort per selected model while preserving explicit overrides', () => {
    rstest.stubEnv(
      GENUI_MODEL_CONFIG_ENV,
      JSON.stringify({
        Fast: {
          apiKey: 'test-secret',
          baseURL: 'https://api.openai.com/v1',
          model: 'gpt-5',
          reasoningEffort: 'low',
        },
        Default: {
          apiKey: 'test-secret',
          baseURL: 'https://api.openai.com/v1',
          model: 'gpt-5',
        },
      }),
    );
    expect(resolveReasoningEffort({})).toBe('low');
    expect(resolveReasoningEffort({ model: 'Default' })).toBeUndefined();
    expect(resolveReasoningEffort({ reasoningEffort: 'none' })).toBe('none');
    expect(resolveReasoningEffort({ inheritReasoningEffort: false }))
      .toBeUndefined();
    expect(resolveReasoningEffort({
      inheritReasoningEffort: false,
      reasoningEffort: 'high',
    })).toBe('high');
    expect(buildOpenAIRunOptions({ model: 'Fast' }).providerOptions).toEqual({
      openai: { reasoningEffort: 'low' },
    });
    expect(buildOpenAIRunOptions({ model: 'Default' }))
      .not.toHaveProperty('providerOptions');
    const custom = {
      model: 'Fast',
      apiKey: 'custom-secret',
      baseURL: 'https://custom.example.com/v1',
    };
    expect(resolveReasoningEffort(custom)).toBeUndefined();
    expect(resolveReasoningEffort({ ...custom, reasoningEffort: 'low' })).toBe(
      'low',
    );
  });

  test('omits reasoning options without configuration', () => {
    rstest.stubEnv(GENUI_MODEL_CONFIG_ENV, undefined);
    expect(buildOpenAIRunOptions({})).not.toHaveProperty('providerOptions');
  });

  test('passes the request abort signal to model runs', () => {
    const controller = new AbortController();

    expect(buildOpenAIRunOptions({}, controller.signal)).toMatchObject({
      abortSignal: controller.signal,
    });
  });
});
