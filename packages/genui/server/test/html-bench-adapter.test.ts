// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import type { ProtocolBenchAdapterInput } from '../service/common/bench/protocol-adapter.js';
import { GenerationUpstreamError } from '../service/common/result.js';
import type { ChatMessage } from '../service/common/types.js';
import { createHtmlBenchAdapter } from '../service/html/html-bench-adapter.js';

const SOURCE = '<!doctype html><html><head></head><body>Hello</body></html>';
const INPUT: ProtocolBenchAdapterInput = {
  runId: 'html-run',
  pairId: 'pair-1',
  scenario: {
    id: 'greeting',
    name: 'Greeting',
    type: 'Information',
    complexity: 1,
    prompt: 'Show Hello',
    action: 'Refresh',
  },
  repeatIndex: 1,
  maxAttempts: 2,
  provider: { model: 'test-model' },
};

describe('HTML Bench adapter', () => {
  test('keeps usage on upstream failure without treating it as an HTML validation failure', async () => {
    const adapter = createHtmlBenchAdapter({
      generateRaw() {
        throw new GenerationUpstreamError(new Error('Invalid input'), {
          text: '',
          usage: { inputTokens: 10, outputTokens: 20 },
          finishReason: 'error',
        });
      },
    });
    const result = await adapter.generate({ ...INPUT, maxAttempts: 4 });
    expect(result.finalValid).toBe(false);
    expect(result.finalErrors).toEqual(['Invalid input']);
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]).toMatchObject({
      totalTokens: 30,
      usage: { inputTokens: 10, outputTokens: 20 },
      finishReason: 'error',
      outputChars: 0,
    });
    expect(result.judgePayload).toBeUndefined();
  });

  test('repairs the document contract and preserves token usage and source', async () => {
    const conversations: ChatMessage[][] = [];
    const controller = new AbortController();
    const adapter = createHtmlBenchAdapter({
      generateRaw(messages, options, signal) {
        conversations.push([...messages]);
        expect(signal).toBe(controller.signal);
        expect(options).toMatchObject({
          model: 'test-model',
          disableAgentCache: true,
          maxRetries: 0,
          enableWebSearch: false,
          enableImageGeneration: false,
        });
        expect(options.inheritReasoningEffort).toBeUndefined();
        return Promise.resolve({
          text: conversations.length === 1
            ? '<!doctype html>'
            : `\`\`\`html\n${SOURCE}\n\`\`\``,
          usage: {
            inputTokens: { total: 12, cacheRead: 5, cacheWrite: 0 },
            outputTokens: { total: 8, reasoning: 2 },
          },
          finishReason: 'stop',
        });
      },
    });
    const artifact = await adapter.generate(INPUT, controller.signal);
    expect(artifact.attempts[0]?.usage).toMatchObject({
      inputTokens: { total: 12, cacheRead: 5, cacheWrite: 0 },
    });
    expect(conversations.map((messages) => messages.length)).toEqual([1, 3]);
    expect(conversations[0]?.[0]?.content).toContain(
      'Required action: Refresh',
    );
    expect(conversations[1]?.[2]?.content).toContain('closing </html>');
    expect(
      artifact.attempts.map((attempt) => [attempt.valid, attempt.totalTokens]),
    ).toEqual([[false, 20], [true, 20]]);
    expect(artifact).toMatchObject({
      finalValid: true,
      finalText: SOURCE,
      finalErrors: [],
      judgePayload: { kind: 'html-source', rawText: SOURCE },
    });
  });

  test('bounds transport retries and never supplies invalid output to Judge', async () => {
    let calls = 0;
    const adapter = createHtmlBenchAdapter({
      retryDelayMs: 0,
      generateRaw() {
        calls++;
        return Promise.reject(
          Object.assign(new Error('provider unavailable'), { statusCode: 503 }),
        );
      },
    });
    const artifact = await adapter.generate({ ...INPUT, maxAttempts: 99 });
    expect(calls).toBe(4);
    expect(artifact.finalValid).toBe(false);
    expect(artifact.finalErrors).toEqual(['provider unavailable']);
    expect(artifact.judgePayload).toBeUndefined();
  });

  test('cancels transport backoff before another request', async () => {
    const controller = new AbortController();
    let calls = 0;
    const adapter = createHtmlBenchAdapter({
      sleep() {
        controller.abort();
        return Promise.resolve();
      },
      generateRaw() {
        calls++;
        return Promise.reject(
          Object.assign(new Error('provider unavailable'), { statusCode: 503 }),
        );
      },
    });
    await expect(adapter.generate(INPUT, controller.signal)).rejects
      .toMatchObject({ name: 'AbortError' });
    expect(calls).toBe(1);
  });
});

test('reports truncation as output-budget exhaustion and retains generation usage', async () => {
  const artifact = await createHtmlBenchAdapter({
    generateRaw: () =>
      Promise.resolve({
        text: '<!doctype html><html>',
        usage: { inputTokens: 3, outputTokens: 10 },
        finishReason: 'length',
      }),
  }).generate({ ...INPUT, maxAttempts: 1 });
  expect(artifact.finalErrors[0]).toContain('output budget');
  expect(artifact.attempts[0]).toMatchObject({
    totalTokens: 13,
    finishReason: 'length',
    valid: false,
  });
  expect(artifact.judgePayload).toBeUndefined();
});
