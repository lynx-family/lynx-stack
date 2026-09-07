// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { createLLMProvider } from '../agent/openai-provider.js';
import { errorMessage } from '../app/common/errors.js';
import { pickProviderOptions } from '../app/common/provider-options.js';
import { redactBenchText } from '../service/a2ui-bench-redaction.js';
import {
  GENUI_MODEL_CONFIG_ENV,
  configuredModelName,
  parseModelConfig,
  redactModelConfigSecrets,
  resolveModelConfig,
} from '../service/common/model-config.js';

const CONFIG = {
  'Doubao Seed': {
    apiKey: 'seed-secret',
    baseURL: 'https://seed.example.com/api/v3',
    model: 'doubao-seed-upstream',
    api: 'chat',
    default: true,
    maxOutputTokens: 8192,
    reasoningEffort: 'medium',
  },
  'Doubao Pro': {
    apiKey: 'pro-secret',
    baseURL: 'https://pro.example.com/api/v3',
    model: 'doubao-pro-upstream',
    api: 'responses',
  },
};

describe('GenUI model configuration', () => {
  test('parses a provider config map keyed by public model name', () => {
    expect(parseModelConfig(JSON.stringify(CONFIG))).toEqual({
      defaultModel: 'Doubao Seed',
      models: CONFIG,
    });
  });

  test('defaults to the first model and rejects multiple defaults', () => {
    expect(
      parseModelConfig(JSON.stringify({
        Doubao: {
          apiKey: 'server-secret',
          baseURL: 'https://example.com/v1',
          model: 'doubao-seed',
        },
      })).defaultModel,
    ).toBe('Doubao');

    expect(() =>
      parseModelConfig(JSON.stringify({
        ...CONFIG,
        'Doubao Pro': { ...CONFIG['Doubao Pro'], default: true },
      }))
    ).toThrow('only one configured model may be marked as default');
  });

  test('rejects invalid model output token limits', () => {
    for (const maxOutputTokens of [0, -1, 1.5, '8192']) {
      expect(() =>
        parseModelConfig(JSON.stringify({
          Doubao: {
            apiKey: 'server-secret',
            baseURL: 'https://example.com/v1',
            model: 'doubao-seed',
            maxOutputTokens,
          },
        }))
      ).toThrow('maxOutputTokens must be a positive safe integer');
    }
  });

  test('resolves a model name to its independent upstream configuration', () => {
    const previous = process.env[GENUI_MODEL_CONFIG_ENV];
    process.env[GENUI_MODEL_CONFIG_ENV] = JSON.stringify(CONFIG);
    try {
      expect(createLLMProvider({ model: 'Doubao Pro' })).toMatchObject({
        model: 'doubao-pro-upstream',
        api: 'responses',
        baseURL: 'https://pro.example.com/api/v3',
      });
    } finally {
      if (previous === undefined) {
        delete process.env[GENUI_MODEL_CONFIG_ENV];
      } else {
        process.env[GENUI_MODEL_CONFIG_ENV] = previous;
      }
    }
  });

  test('allows configured selection without accepting partial overrides', () => {
    const previous = process.env[GENUI_MODEL_CONFIG_ENV];
    process.env[GENUI_MODEL_CONFIG_ENV] = JSON.stringify(CONFIG);
    try {
      expect(pickProviderOptions({
        apiKey: 'client-secret',
        model: 'Doubao Pro',
        api: 'responses',
      })).toEqual({
        resourceId: undefined,
        model: 'Doubao Pro',
        apiKey: undefined,
        baseURL: undefined,
        api: undefined,
        reasoningEffort: undefined,
        disableAgentCache: undefined,
      });
      expect(pickProviderOptions({ model: 'Unknown Model' }).model).toBe(
        undefined,
      );
      expect(createLLMProvider({
        baseURL: 'https://openrouter.ai/api/v1',
        model: 'Doubao Pro',
      })).toMatchObject({
        model: 'doubao-pro-upstream',
        api: 'responses',
        baseURL: 'https://pro.example.com/api/v3',
      });
      expect(createLLMProvider({
        api: 'chat',
        apiKey: 'client-secret',
        model: 'Doubao Pro',
      })).toMatchObject({
        model: 'doubao-pro-upstream',
        api: 'responses',
        baseURL: 'https://pro.example.com/api/v3',
      });
    } finally {
      if (previous === undefined) {
        delete process.env[GENUI_MODEL_CONFIG_ENV];
      } else {
        process.env[GENUI_MODEL_CONFIG_ENV] = previous;
      }
    }
  });

  test('uses a complete client provider without server model config', () => {
    const previous = process.env[GENUI_MODEL_CONFIG_ENV];
    delete process.env[GENUI_MODEL_CONFIG_ENV];
    try {
      const options = pickProviderOptions({
        apiKey: '  client-secret  ',
        baseURL: '  https://api.openai.com/v1  ',
        model: '  gpt-client  ',
      });
      expect(options.disableAgentCache).toBe(true);
      expect(createLLMProvider(options)).toMatchObject({
        model: 'gpt-client',
        api: 'responses',
        baseURL: 'https://api.openai.com/v1',
      });
      expect(() =>
        createLLMProvider(pickProviderOptions({
          baseURL: 'https://api.openai.com/v1',
          model: 'gpt-client',
        }))
      ).toThrow(`${GENUI_MODEL_CONFIG_ENV} is required`);
      expect(() =>
        createLLMProvider(pickProviderOptions({
          apiKey: 'client-secret',
          baseURL: 'https://127.0.0.1/v1',
          model: 'gpt-client',
        }))
      ).toThrow('must be one of the supported provider URLs');
    } finally {
      if (previous === undefined) {
        delete process.env[GENUI_MODEL_CONFIG_ENV];
      } else {
        process.env[GENUI_MODEL_CONFIG_ENV] = previous;
      }
    }
  });

  test('rejects inherited object property names as model selections', () => {
    const parsed = parseModelConfig(JSON.stringify(CONFIG));
    expect(Object.getPrototypeOf(parsed.models)).toBeNull();

    const previous = process.env[GENUI_MODEL_CONFIG_ENV];
    process.env[GENUI_MODEL_CONFIG_ENV] = JSON.stringify(CONFIG);
    try {
      expect(configuredModelName('toString')).toBeUndefined();
      expect(pickProviderOptions({ model: 'toString' }).model).toBeUndefined();
      expect(resolveModelConfig('toString')).toEqual({
        name: 'Doubao Seed',
        config: CONFIG['Doubao Seed'],
      });
    } finally {
      if (previous === undefined) {
        delete process.env[GENUI_MODEL_CONFIG_ENV];
      } else {
        process.env[GENUI_MODEL_CONFIG_ENV] = previous;
      }
    }
  });

  test('redacts private model configuration from client-visible errors', () => {
    const previous = process.env[GENUI_MODEL_CONFIG_ENV];
    const previousArkApiKey = process.env.IMG_GEN_ARK_API_KEY;
    const previousArkImageModel = process.env.IMG_GEN_ARK_IMAGE_MODEL;
    const previousArkImageBaseURL = process.env.IMG_GEN_ARK_IMAGE_BASE_URL;
    const previousSearchApiKey = process.env.SEARCH_INFINITY_API_KEY;
    process.env[GENUI_MODEL_CONFIG_ENV] = JSON.stringify(CONFIG);
    process.env.IMG_GEN_ARK_API_KEY = 'ark-image-secret';
    process.env.IMG_GEN_ARK_IMAGE_MODEL = 'private-image-model';
    process.env.IMG_GEN_ARK_IMAGE_BASE_URL =
      'https://ark-private.example.com/api/v3';
    process.env.SEARCH_INFINITY_API_KEY = 'search-infinity-secret';
    try {
      const privateMessage =
        'Doubao Seed failed at https://seed.example.com/api/v3 '
        + 'for doubao-seed-upstream with seed-secret and Bearer session-token; '
        + 'image config ark-image-secret private-image-model '
        + 'https://ark-private.example.com/api/v3; '
        + 'search config search-infinity-secret';
      const publicMessage =
        'Doubao Seed failed at [REDACTED] for [REDACTED] with [REDACTED] '
        + 'and Bearer [REDACTED]; image config [REDACTED] [REDACTED] '
        + '[REDACTED]; search config [REDACTED]';
      const upstreamError = new Error(privateMessage);
      upstreamError.name = 'ProviderError seed-secret';
      expect(errorMessage(upstreamError)).toEqual({
        message: publicMessage,
        name: 'ProviderError [REDACTED]',
      });
      expect(redactBenchText(privateMessage, {})).toBe(publicMessage);

      process.env[GENUI_MODEL_CONFIG_ENV] = '{invalid json';
      expect(redactModelConfigSecrets(
        'image config ark-image-secret private-image-model '
          + 'https://ark-private.example.com/api/v3; '
          + 'search config search-infinity-secret',
      )).toBe(
        'image config [REDACTED] [REDACTED] [REDACTED]; '
          + 'search config [REDACTED]',
      );
    } finally {
      if (previous === undefined) {
        delete process.env[GENUI_MODEL_CONFIG_ENV];
      } else {
        process.env[GENUI_MODEL_CONFIG_ENV] = previous;
      }
      if (previousArkApiKey === undefined) {
        delete process.env.IMG_GEN_ARK_API_KEY;
      } else {
        process.env.IMG_GEN_ARK_API_KEY = previousArkApiKey;
      }
      if (previousArkImageModel === undefined) {
        delete process.env.IMG_GEN_ARK_IMAGE_MODEL;
      } else {
        process.env.IMG_GEN_ARK_IMAGE_MODEL = previousArkImageModel;
      }
      if (previousArkImageBaseURL === undefined) {
        delete process.env.IMG_GEN_ARK_IMAGE_BASE_URL;
      } else {
        process.env.IMG_GEN_ARK_IMAGE_BASE_URL = previousArkImageBaseURL;
      }
      if (previousSearchApiKey === undefined) {
        delete process.env.SEARCH_INFINITY_API_KEY;
      } else {
        process.env.SEARCH_INFINITY_API_KEY = previousSearchApiKey;
      }
    }
  });

  test('redacts request-scoped API key variants without global state', () => {
    const requestKey = 'request-"secret\\+/=';
    const encodedKey = encodeURIComponent(requestKey);
    const escapedKey = JSON.stringify(requestKey).slice(1, -1);
    const upstreamError = new Error(
      `raw ${requestKey}; encoded ${encodedKey}; escaped ${escapedKey}; `
        + `authorization Bearer ${requestKey}; query ?apiKey=${encodedKey}`,
    );
    upstreamError.name = `ProviderError ${requestKey}`;

    expect(errorMessage(upstreamError, { secrets: [requestKey] })).toEqual({
      message: 'raw [REDACTED]; encoded [REDACTED]; escaped [REDACTED]; '
        + 'authorization Bearer [REDACTED]; query ?apiKey=[REDACTED]',
      name: 'ProviderError [REDACTED]',
    });
    expect(errorMessage(new Error(`retry ${requestKey}`))).toEqual({
      message: `retry ${requestKey}`,
      name: 'Error',
    });
  });
});
