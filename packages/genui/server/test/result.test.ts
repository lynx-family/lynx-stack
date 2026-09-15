// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import {
  GenerationUpstreamError,
  extractGenerationResult,
  finalizeResult,
} from '../service/common/result.js';

describe('Mastra result finalization', () => {
  test('reads the upstream error after completion and preserves aggregate usage', async () => {
    const upstream = Object.assign(new Error('Invalid input'), {
      statusCode: 400,
      responseHeaders: { 'x-request-id': 'upstream-request-1' },
      requestBodyValues: { input: 'private prompt' },
    });
    let completed = false;
    const usage = {
      inputTokens: 9685,
      outputTokens: 16384,
      reasoningTokens: 16384,
    };
    await expect(finalizeResult({
      text: '',
      finishReason: Promise.resolve().then(() => {
        completed = true;
        return 'error';
      }),
      get error() {
        return completed ? upstream : undefined;
      },
      totalUsage: usage,
      usage: { inputTokens: 0, outputTokens: 0 },
    })).rejects.toMatchObject({
      name: 'GenerationUpstreamError',
      message: 'Invalid input',
      cause: upstream,
      statusCode: 400,
      upstreamRequestId: 'upstream-request-1',
      result: { text: '', usage, finishReason: 'error' },
    });
  });

  test('rejects failed generation even when it contains apparently valid text', async () => {
    await expect(extractGenerationResult({
      text: 'apparently complete output',
      finishReason: 'error',
    })).rejects.toMatchObject({
      message: 'Upstream model generation failed without error details',
      result: { text: 'apparently complete output', finishReason: 'error' },
    });
  });

  test('preserves errors from rejected completion promises', async () => {
    const upstream = new Error('Connection failed');
    await expect(finalizeResult({
      text: Promise.reject(upstream),
      finishReason: Promise.reject(upstream),
      usage: { inputTokens: 12 },
    })).rejects.toMatchObject({
      cause: upstream,
      result: { finishReason: 'error', usage: { inputTokens: 12 } },
    });
  });

  test('retains diagnostics from wrapped provider errors', () => {
    const provider = Object.assign(new Error('Invalid input'), {
      statusCode: 400,
      responseHeaders: { 'X-Request-ID': 'wrapped-request' },
    });
    const error = new GenerationUpstreamError(
      new Error('Provider failed', { cause: provider }),
      {
        text: '',
        usage: undefined,
        finishReason: 'error',
      },
    );
    expect(error.statusCode).toBe(400);
    expect(error.upstreamRequestId).toBe('wrapped-request');
  });

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
