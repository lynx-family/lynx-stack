// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import type {
  ProtocolBenchAdapterInput,
} from '../service/genui-bench/protocol-adapter.js';
import type { ProtocolBenchScenario } from '../service/genui-bench/types.js';
import type { OpenUIChatOptions } from '../service/openui-agent.js';
import {
  OPENUI_BENCH_CAPABILITY_PROFILE,
  OPENUI_BENCH_MATCHED_COMPONENTS,
  OPENUI_BENCH_PROMPT_OPTIONS,
  createOpenUIBenchAdapter,
} from '../service/openui-bench-adapter.js';
import type {
  OpenUIBenchGenerateRaw,
} from '../service/openui-bench-adapter.js';
import {
  validateOpenUIBenchOutput,
} from '../service/openui-bench-validator.js';

const VALID_OPENUI = [
  'root = Column([title, card], "start", "stretch", "m")',
  'title = Text("Bench result", "h2")',
  'card = Card([TextContent("Ready.", "default"), Button("Continue")], "card", "column", false, "s", "start", "start")',
].join('\n');

const scenario: ProtocolBenchScenario = {
  id: 'information-card',
  name: 'Information card',
  prompt: 'Build a compact status card with a continue button.',
  type: 'Information',
  complexity: 2,
  action: 'Continue',
};

function adapterInput(maxAttempts = 2): ProtocolBenchAdapterInput {
  return {
    runId: 'run-openui-1',
    pairId: 'pair-1',
    scenario,
    repeatIndex: 1,
    maxAttempts,
    provider: {
      api: 'responses',
      baseURL: 'https://provider.test/v1',
      model: 'test-model',
    },
  };
}

function sequenceNow(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values[values.length - 1] ?? 0;
}

describe('OpenUI Bench validator', () => {
  test('parses matched-core output and measures component complexity', () => {
    const result = validateOpenUIBenchOutput(VALID_OPENUI);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.complexity).toMatchObject({
      componentCount: 5,
      componentTypes: {
        Button: 1,
        Card: 1,
        Column: 1,
        Text: 1,
        TextContent: 1,
      },
      maxComponentDepth: 3,
      mutationCount: 0,
      queryCount: 0,
      statementCount: 3,
      unknownComponentCount: 0,
    });
  });

  test('rejects a nested unknown component even when a root still renders', () => {
    const result = validateOpenUIBenchOutput([
      'root = Column([known, missing])',
      'known = Text("Still renderable")',
      'missing = SecretWidget("must not disappear silently")',
    ].join('\n'));

    expect(result.parseResult?.root?.typeName).toBe('Column');
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'unknown-component',
        component: 'SecretWidget',
        statementId: 'missing',
      }),
    ]));
    expect(result.complexity.unknownComponentCount).toBe(1);
  });

  test('hard-gates full-catalog components, tools, and external URLs', () => {
    const disallowedComponent = validateOpenUIBenchOutput(
      'root = Column([Icon("home")])',
    );
    const query = validateOpenUIBenchOutput([
      'weather = Query("get_weather", {}, {})',
      'root = Column([Text("Weather")])',
    ].join('\n'));
    const externalUrl = validateOpenUIBenchOutput(
      'root = Column([Text("https://example.com")])',
    );

    expect(disallowedComponent.errors[0]).toMatchObject({
      code: 'unknown-component',
      component: 'Icon',
    });
    expect(query.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'query-not-allowed' }),
    ]));
    expect(externalUrl.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'external-url-not-allowed' }),
    ]));
  });
});

describe('OpenUI Bench adapter', () => {
  test('returns a valid first attempt with normalized usage and latency', async () => {
    let receivedOptions: OpenUIChatOptions | undefined;
    const generateRaw: OpenUIBenchGenerateRaw = (_messages, options) => {
      receivedOptions = options;
      return Promise.resolve({
        text: VALID_OPENUI,
        usage: {
          prompt_tokens: 13,
          completion_tokens: 8,
          total_tokens: 21,
        },
        finishReason: 'stop',
      });
    };
    const adapter = createOpenUIBenchAdapter({
      generateRaw,
      now: sequenceNow([100, 125]),
    });

    const result = await adapter.generate(adapterInput());

    expect(result.finalValid).toBe(true);
    expect(result.rawText).toBe(VALID_OPENUI);
    expect(result.attemptCount).toBe(1);
    expect(result.totalLatencyMs).toBe(25);
    expect(result.totalUsage).toEqual({
      inputTokens: 13,
      outputTokens: 8,
      totalTokens: 21,
    });
    expect(result.attempts[0]).toMatchObject({
      durationMs: 25,
      inputTokens: 13,
      outputTokens: 8,
      totalTokens: 21,
      valid: true,
    });
    expect(result.judgePayload).toEqual({
      kind: 'openui-text',
      rawText: VALID_OPENUI,
    });
    expect(result.metadata).toMatchObject({
      capabilityProfile: OPENUI_BENCH_CAPABILITY_PROFILE,
      rootComponent: 'Column',
      policy: 'resource-safe-matched-core',
    });
    expect(result.metadata?.matchedComponents).toEqual(
      [...OPENUI_BENCH_MATCHED_COMPONENTS].sort(),
    );
    expect(receivedOptions).toMatchObject({
      api: 'responses',
      baseURL: 'https://provider.test/v1',
      disableAgentCache: true,
      inheritReasoningEffort: false,
      model: 'test-model',
      promptRoot: 'Column',
      promptOptions: OPENUI_BENCH_PROMPT_OPTIONS,
    });
    expect(receivedOptions?.systemAppendix).toContain(
      'Matched-core benchmark',
    );
    expect(receivedOptions?.promptComponentNames).toEqual(
      OPENUI_BENCH_MATCHED_COMPONENTS,
    );
    expect(OPENUI_BENCH_PROMPT_OPTIONS.examples).toEqual([]);
  });

  test('threads cancellation into generation and includes scenario complexity', async () => {
    const abortController = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    let receivedPrompt = '';
    const adapter = createOpenUIBenchAdapter({
      generateRaw: (messages, _options, signal) => {
        receivedSignal = signal;
        receivedPrompt = messages[0]?.content ?? '';
        return Promise.resolve({
          text: VALID_OPENUI,
          usage: {},
          finishReason: 'stop',
        });
      },
      now: sequenceNow([0, 1]),
    });

    await adapter.generate(adapterInput(), abortController.signal);

    expect(receivedSignal).toBe(abortController.signal);
    expect(receivedPrompt).toContain('Scenario complexity: 2');
  });

  test('repairs once without backoff and accumulates both attempt records', async () => {
    const generated = [
      {
        text: 'root = Column([SecretWidget("bad")])',
        usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14 },
        finishReason: 'stop',
      },
      {
        text: VALID_OPENUI,
        usage: { input_tokens: 15, output_tokens: 6, total_tokens: 21 },
        finishReason: 'stop',
      },
    ];
    const receivedMessages: string[][] = [];
    const sleepCalls: number[] = [];
    let callCount = 0;
    const adapter = createOpenUIBenchAdapter({
      generateRaw: (messages) => {
        receivedMessages.push(messages.map((message) => message.content));
        return Promise.resolve(generated[callCount++]!);
      },
      now: sequenceNow([0, 10, 10, 35]),
      sleep(delayMs) {
        sleepCalls.push(delayMs);
        return Promise.resolve();
      },
    });

    const result = await adapter.generate(adapterInput(99));

    expect(callCount).toBe(2);
    expect(result.finalValid).toBe(true);
    expect(result.attemptCount).toBe(2);
    expect(result.totalLatencyMs).toBe(35);
    expect(result.totalUsage).toEqual({
      inputTokens: 25,
      outputTokens: 10,
      totalTokens: 35,
    });
    expect(result.attempts.map((attempt) => attempt.valid)).toEqual([
      false,
      true,
    ]);
    expect(receivedMessages[1]).toHaveLength(3);
    expect(receivedMessages[1]?.[1]).toContain('SecretWidget');
    expect(receivedMessages[1]?.[2]).toContain('[unknown-component]');
    expect(sleepCalls).toEqual([]);
    expect(result.rawText).toBe(VALID_OPENUI);
  });

  test('honors the normalized attempt budget', async () => {
    let callCount = 0;
    const adapter = createOpenUIBenchAdapter({
      generateRaw: () => {
        callCount += 1;
        return Promise.resolve({
          text: `root = Column([Unknown${callCount}()])`,
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          finishReason: 'stop',
        });
      },
      now: sequenceNow([0, 1, 1, 2, 2, 3]),
    });

    const result = await adapter.generate(adapterInput(3));

    expect(callCount).toBe(3);
    expect(result.attemptCount).toBe(3);
    expect(result.finalValid).toBe(false);
    expect(result.judgePayload).toBeUndefined();
    expect(result.finalErrors[0]).toContain('unknown-component');
  });

  test('waits before retrying a transient generation failure', async () => {
    const receivedMessages: string[][] = [];
    const sleepCalls: number[] = [];
    let releaseBackoff: (() => void) | undefined;
    let markBackoffStarted: (() => void) | undefined;
    const backoffStarted = new Promise<void>((resolve) => {
      markBackoffStarted = resolve;
    });
    const backoff = new Promise<void>((resolve) => {
      releaseBackoff = resolve;
    });
    let callCount = 0;
    const adapter = createOpenUIBenchAdapter({
      generateRaw: (messages) => {
        receivedMessages.push(messages.map((message) => message.content));
        callCount += 1;
        if (callCount === 1) {
          return Promise.reject(new Error('provider temporarily unavailable'));
        }
        return Promise.resolve({
          text: VALID_OPENUI,
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          finishReason: 'stop',
        });
      },
      now: sequenceNow([0, 5, 5, 15]),
      sleep(delayMs) {
        sleepCalls.push(delayMs);
        markBackoffStarted?.();
        return backoff;
      },
    });

    const generation = adapter.generate(adapterInput());
    await backoffStarted;

    expect(callCount).toBe(1);
    expect(sleepCalls).toEqual([10_000]);
    releaseBackoff?.();
    const result = await generation;
    expect(callCount).toBe(2);
    expect(receivedMessages.map((messages) => messages.length)).toEqual([1, 1]);
    expect(
      result.attempts.map((attempt) => attempt.generationFailed),
    ).toEqual([true, false]);
    expect(result.attempts.map((attempt) => attempt.valid)).toEqual([
      false,
      true,
    ]);
    expect(result.finalValid).toBe(true);
    expect(result.finalErrors).toEqual([]);
    expect(result.judgePayload).toEqual({
      kind: 'openui-text',
      rawText: VALID_OPENUI,
    });
  });

  test('aborts during transport backoff without starting another request', async () => {
    const abortController = new AbortController();
    let markBackoffStarted: (() => void) | undefined;
    const backoffStarted = new Promise<void>((resolve) => {
      markBackoffStarted = resolve;
    });
    let callCount = 0;
    const adapter = createOpenUIBenchAdapter({
      generateRaw: () => {
        callCount += 1;
        return Promise.reject(new Error('provider temporarily unavailable'));
      },
      now: sequenceNow([0, 5]),
      sleep() {
        markBackoffStarted?.();
        return new Promise<void>(() => {
          // Keep backoff pending so cancellation must win the race.
        });
      },
    });

    const generation = adapter.generate(
      adapterInput(),
      abortController.signal,
    );
    await backoffStarted;
    abortController.abort();

    await expect(generation).rejects.toMatchObject({ name: 'AbortError' });
    expect(callCount).toBe(1);
  });

  test('redacts provider credentials and exhausts the transport retry budget', async () => {
    const receivedMessages: string[][] = [];
    let callCount = 0;
    const adapter = createOpenUIBenchAdapter({
      generateRaw: (messages) => {
        receivedMessages.push(messages.map((message) => message.content));
        callCount += 1;
        return Promise.reject(
          new Error('request failed for api-key-must-not-leak'),
        );
      },
      now: sequenceNow([2, 7, 7, 12]),
      retryDelayMs: 0,
    });
    const input = adapterInput();
    input.provider.apiKey = 'api-key-must-not-leak';

    const result = await adapter.generate(input);

    expect(callCount).toBe(2);
    expect(receivedMessages.map((messages) => messages.length)).toEqual([1, 1]);
    expect(result.finalValid).toBe(false);
    expect(result.attempts).toHaveLength(2);
    expect(
      result.attempts.every((attempt) => attempt.generationFailed),
    ).toBe(true);
    expect(JSON.stringify(result.attempts)).not.toContain(
      'api-key-must-not-leak',
    );
    expect(result.finalErrors.join('\n')).not.toContain(
      'api-key-must-not-leak',
    );
    expect(result.finalErrors[0]).toContain('[REDACTED]');
  });
});
