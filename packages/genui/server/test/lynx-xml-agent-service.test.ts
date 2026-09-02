// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { GENUI_MODEL_CONFIG_ENV } from '../service/common/model-config.js';
import {
  LYNX_XML_MAX_OUTPUT_TOKENS,
  buildLynxXmlRunOptions,
} from '../service/lynx-xml-agent.js';

const MODEL_CONFIG = {
  Short: {
    apiKey: 'short-secret',
    baseURL: 'https://short.example.com/v1',
    model: 'short-upstream',
    maxOutputTokens: 8192,
    default: true,
  },
  Long: {
    apiKey: 'long-secret',
    baseURL: 'https://long.example.com/v1',
    model: 'long-upstream',
    maxOutputTokens: 32768,
  },
};

describe('Lynx XML agent service', () => {
  test('targets 16K and respects lower model limits', () => {
    const previous = process.env[GENUI_MODEL_CONFIG_ENV];
    process.env[GENUI_MODEL_CONFIG_ENV] = JSON.stringify(MODEL_CONFIG);
    try {
      expect(LYNX_XML_MAX_OUTPUT_TOKENS).toBe(16_384);
      expect(buildLynxXmlRunOptions({}).modelSettings).toEqual({
        maxOutputTokens: 8192,
      });
      expect(buildLynxXmlRunOptions({ model: 'Long' }).modelSettings).toEqual({
        maxOutputTokens: 16_384,
      });
    } finally {
      if (previous === undefined) {
        delete process.env[GENUI_MODEL_CONFIG_ENV];
      } else {
        process.env[GENUI_MODEL_CONFIG_ENV] = previous;
      }
    }
  });
});
