// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, describe, expect, rstest, test } from '@rstest/core';

import { GENUI_MODEL_CONFIG_ENV } from '../service/common/model-config.js';
import {
  DEFAULT_AGENT_MAX_OUTPUT_TOKENS,
  ProviderAgentCache,
  buildOpenAIRunOptions,
  createStableValueHash,
  resolveModelOutputTokenBudget,
  resolveReasoningEffort,
  resolveReasoningRecoverySettings,
} from '../service/common/provider.js';

afterEach(() => {
  rstest.unstubAllEnvs();
});

describe('reasoning-only recovery settings', () => {
  test('lowers effort and grows the budget only within the selected model ceiling', () => {
    rstest.stubEnv(
      GENUI_MODEL_CONFIG_ENV,
      JSON.stringify({
        Small: {
          apiKey: 'test-secret',
          baseURL: 'https://example.com/v1',
          model: 'small',
          maxOutputTokens: 16384,
          reasoningEffort: 'high',
        },
        Large: {
          apiKey: 'test-secret',
          baseURL: 'https://example.com/v1',
          model: 'large',
          maxOutputTokens: 24000,
          reasoningEffort: 'low',
        },
      }),
    );
    expect(resolveReasoningRecoverySettings({}, 16384)).toEqual({
      maxOutputTokens: 16384,
      reasoningEffort: 'low',
    });
    expect(resolveReasoningRecoverySettings({ model: 'Large' }, 16384)).toEqual(
      {
        maxOutputTokens: 24000,
        reasoningEffort: 'low',
      },
    );
    expect(resolveReasoningRecoverySettings({
      model: 'Large',
      apiKey: 'custom-secret',
      baseURL: 'https://example.com/v1',
    }, 16384)).toEqual({ maxOutputTokens: 16384, reasoningEffort: 'low' });
    expect(resolveModelOutputTokenBudget({ model: 'Small' }, 65536)).toBe(
      16384,
    );
    expect(resolveModelOutputTokenBudget({ model: 'unknown' }, 65536)).toBe(
      16384,
    );
    expect(resolveModelOutputTokenBudget({
      model: 'Small',
      apiKey: 'custom-secret',
      baseURL: 'https://example.com/v1',
    }, 65536)).toBe(65536);
    expect(resolveReasoningRecoverySettings({ model: 'unknown' }, 16384))
      .toEqual({ maxOutputTokens: 16384, reasoningEffort: 'low' });
    expect(
      resolveReasoningRecoverySettings(
        { inheritReasoningEffort: false },
        16384,
      ),
    )
      .toBeUndefined();
  });

  test('does not increase a low or disabled effort or retry unchanged settings', () => {
    rstest.stubEnv(GENUI_MODEL_CONFIG_ENV, undefined);
    for (const reasoningEffort of ['none', 'minimal', 'low'] as const) {
      expect(resolveReasoningRecoverySettings({ reasoningEffort }, 16384))
        .toBeUndefined();
    }
    expect(resolveReasoningRecoverySettings({}, 16384)).toEqual({
      maxOutputTokens: 16384,
      reasoningEffort: 'low',
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
  test('applies a shared default and clamps per-call budgets to the effective model ceiling', () => {
    rstest.stubEnv(
      GENUI_MODEL_CONFIG_ENV,
      JSON.stringify({
        Short: {
          apiKey: 'test-secret',
          baseURL: 'https://example.com/v1',
          model: 'short-upstream',
          maxOutputTokens: 8192,
          default: true,
        },
        Long: {
          apiKey: 'test-secret',
          baseURL: 'https://example.com/v1',
          model: 'long-upstream',
          maxOutputTokens: 32768,
        },
        Unspecified: {
          apiKey: 'test-secret',
          baseURL: 'https://example.com/v1',
          model: 'unspecified-upstream',
        },
      }),
    );
    expect(DEFAULT_AGENT_MAX_OUTPUT_TOKENS).toBe(16384);
    const budget = (model?: string, desired?: number) =>
      buildOpenAIRunOptions({ model }, undefined, desired).modelSettings
        .maxOutputTokens;
    expect(budget()).toBe(8192);
    expect(budget('unknown')).toBe(8192);
    expect(budget('Long')).toBe(16384);
    expect(budget('Unspecified')).toBe(16384);
    expect(budget('Short', 2048)).toBe(2048);
    expect(budget('Short', 65536)).toBe(8192);
    expect(budget('Long', 65536)).toBe(32768);
    expect(budget('Long')).toBe(16384);
    expect(
      buildOpenAIRunOptions({
        model: 'Short',
        apiKey: 'custom-secret',
        baseURL: 'https://custom.example/v1',
      }).modelSettings.maxOutputTokens,
    ).toBe(16384);
  });

  test('rejects invalid per-call budgets', () => {
    for (const budget of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => buildOpenAIRunOptions({}, undefined, budget)).toThrow(
        'maxOutputTokens must be a positive safe integer',
      );
    }
  });

  test('keeps SDK retry overrides scoped to the invocation', () => {
    rstest.stubEnv(GENUI_MODEL_CONFIG_ENV, undefined);
    expect(buildOpenAIRunOptions({ maxRetries: 0 }).modelSettings).toEqual({
      maxRetries: 0,
      maxOutputTokens: 16384,
    });
    expect(buildOpenAIRunOptions({}).modelSettings).toEqual({
      maxOutputTokens: 16384,
    });
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
