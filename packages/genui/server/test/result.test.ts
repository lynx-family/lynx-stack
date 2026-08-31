// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { finalizeResult } from '../service/common/result.js';

describe('Mastra result finalization', () => {
  test('prefers aggregate token usage for streamed results', async () => {
    await expect(finalizeResult({
      text: Promise.resolve('generated'),
      usage: Promise.resolve({
        inputTokens: 2,
        outputTokens: 3,
        totalTokens: 5,
      }),
      totalUsage: Promise.resolve({
        inputTokens: 7,
        outputTokens: 11,
        totalTokens: 18,
      }),
      finishReason: Promise.resolve('stop'),
    })).resolves.toEqual({
      text: 'generated',
      usage: {
        inputTokens: 7,
        outputTokens: 11,
        totalTokens: 18,
      },
      finishReason: 'stop',
    });
  });

  test('falls back to step usage when aggregate usage is unavailable', async () => {
    const usage = { inputTokens: 3, outputTokens: 5, totalTokens: 8 };

    await expect(finalizeResult({
      text: 'generated',
      usage,
      totalUsage: Promise.reject(new Error('aggregate usage unavailable')),
      finishReason: 'stop',
    })).resolves.toEqual({
      text: 'generated',
      usage,
      finishReason: 'stop',
    });
  });
});
