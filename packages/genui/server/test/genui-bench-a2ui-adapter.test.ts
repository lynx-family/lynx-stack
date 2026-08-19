// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import type { A2UIChatOptions } from '../service/a2ui-agent.js';
import { createA2UIBenchAdapter } from '../service/genui-bench/a2ui-adapter.js';
import type {
  ProtocolBenchAdapterInput,
} from '../service/genui-bench/protocol-adapter.js';

function adapterInput(maxAttempts = 2): ProtocolBenchAdapterInput {
  return {
    runId: 'a2ui-run-1',
    pairId: 'pair-1',
    scenario: {
      id: 'scenario-1',
      name: 'Scenario',
      prompt: 'Build a card.',
      type: 'Information',
      complexity: 1,
    },
    repeatIndex: 1,
    maxAttempts,
    provider: {
      apiKey: 'request-scoped-key',
      baseURL: 'https://provider.test/v1',
      model: 'test-model',
      api: 'chat',
    },
  };
}

function validA2UIOutput(catalogId: string | undefined): string {
  return JSON.stringify([
    {
      version: 'v0.9',
      createSurface: {
        surfaceId: 'main',
        catalogId,
      },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'main',
        components: [{
          id: 'root',
          component: 'Text',
          text: 'Ready',
          variant: 'body',
        }],
      },
    },
  ]);
}

describe('A2UI matched-core bench adapter', () => {
  test('uses an ephemeral agent and threads cancellation into generation', async () => {
    const abortController = new AbortController();
    let receivedOptions: A2UIChatOptions | undefined;
    let receivedSignal: AbortSignal | undefined;
    const adapter = createA2UIBenchAdapter({
      generateRaw(_messages, options, signal) {
        receivedOptions = options;
        receivedSignal = signal;
        return Promise.resolve({
          text: 'not valid A2UI',
          usage: {},
          finishReason: 'stop',
        });
      },
    });

    await adapter.generate({
      runId: 'a2ui-run-1',
      pairId: 'pair-1',
      scenario: {
        id: 'scenario-1',
        name: 'Scenario',
        prompt: 'Build a card.',
        type: 'Information',
        complexity: 1,
      },
      repeatIndex: 1,
      maxAttempts: 1,
      provider: {
        apiKey: 'request-scoped-key',
        baseURL: 'https://provider.test/v1',
        model: 'test-model',
        api: 'chat',
      },
    }, abortController.signal);

    expect(receivedOptions).toMatchObject({
      apiKey: 'request-scoped-key',
      disableAgentCache: true,
      enableWebSearch: false,
      inheritReasoningEffort: false,
    });
    expect(receivedSignal).toBe(abortController.signal);
    expect(receivedOptions?.catalog?.examples).toEqual([]);
    expect(receivedOptions?.catalog?.functions).toEqual([]);
  });

  test('accepts a later updateComponents message that replaces an id', async () => {
    const adapter = createA2UIBenchAdapter({
      generateRaw(_messages, options) {
        return Promise.resolve({
          text: JSON.stringify([
            {
              version: 'v0.9',
              createSurface: {
                surfaceId: 'main',
                catalogId: options.catalog?.id,
              },
            },
            {
              version: 'v0.9',
              updateComponents: {
                surfaceId: 'main',
                components: [{
                  id: 'root',
                  component: 'Text',
                  text: 'Loading',
                  variant: 'body',
                }],
              },
            },
            {
              version: 'v0.9',
              updateComponents: {
                surfaceId: 'main',
                components: [{
                  id: 'root',
                  component: 'Text',
                  text: 'Ready',
                  variant: 'body',
                }],
              },
            },
          ]),
          usage: {},
          finishReason: 'stop',
        });
      },
    });

    const artifact = await adapter.generate({
      runId: 'a2ui-replacement-run',
      pairId: 'pair-1',
      scenario: {
        id: 'scenario-1',
        name: 'Scenario',
        prompt: 'Build a card.',
        type: 'Information',
        complexity: 1,
      },
      repeatIndex: 1,
      maxAttempts: 1,
      provider: {
        apiKey: 'request-scoped-key',
        baseURL: 'https://provider.test/v1',
        model: 'test-model',
        api: 'chat',
      },
    });

    expect(artifact.finalValid).toBe(true);
    expect(artifact.finalErrors).toEqual([]);
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
    const adapter = createA2UIBenchAdapter({
      generateRaw(messages, options) {
        receivedMessages.push(messages.map((message) => message.content));
        callCount += 1;
        if (callCount === 1) {
          return Promise.reject(new Error('provider temporarily unavailable'));
        }
        return Promise.resolve({
          text: validA2UIOutput(options.catalog?.id),
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
          },
          finishReason: 'stop',
        });
      },
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
    const artifact = await generation;
    expect(callCount).toBe(2);
    expect(receivedMessages.map((messages) => messages.length)).toEqual([1, 1]);
    expect(artifact.attempts.map((attempt) => attempt.valid)).toEqual([
      false,
      true,
    ]);
    expect(artifact.finalValid).toBe(true);
    expect(artifact.finalErrors).toEqual([]);
    expect(artifact.judgePayload).toMatchObject({
      kind: 'a2ui-messages',
    });
  });

  test('aborts during transport backoff without starting another request', async () => {
    const abortController = new AbortController();
    let markBackoffStarted: (() => void) | undefined;
    const backoffStarted = new Promise<void>((resolve) => {
      markBackoffStarted = resolve;
    });
    let callCount = 0;
    const adapter = createA2UIBenchAdapter({
      generateRaw() {
        callCount += 1;
        return Promise.reject(new Error('provider temporarily unavailable'));
      },
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

  test('repairs protocol validation failures without transport backoff', async () => {
    const receivedMessages: string[][] = [];
    const sleepCalls: number[] = [];
    let callCount = 0;
    const adapter = createA2UIBenchAdapter({
      generateRaw(messages, options) {
        receivedMessages.push(messages.map((message) => message.content));
        callCount += 1;
        return Promise.resolve({
          text: callCount === 1
            ? 'not valid A2UI'
            : validA2UIOutput(options.catalog?.id),
          usage: {},
          finishReason: 'stop',
        });
      },
      sleep(delayMs) {
        sleepCalls.push(delayMs);
        return Promise.resolve();
      },
    });

    const artifact = await adapter.generate(adapterInput());

    expect(callCount).toBe(2);
    expect(sleepCalls).toEqual([]);
    expect(receivedMessages.map((messages) => messages.length)).toEqual([1, 3]);
    expect(artifact.finalValid).toBe(true);
  });

  test('bounds and exhausts repeated generation failures', async () => {
    let callCount = 0;
    const adapter = createA2UIBenchAdapter({
      generateRaw() {
        callCount += 1;
        return Promise.reject(
          new Error(`provider failure ${callCount}`),
        );
      },
      retryDelayMs: 0,
    });

    const artifact = await adapter.generate(adapterInput(99));

    expect(callCount).toBe(4);
    expect(artifact.attempts.map((attempt) => attempt.index)).toEqual([
      1,
      2,
      3,
      4,
    ]);
    expect(artifact.finalValid).toBe(false);
    expect(artifact.finalErrors).toEqual(['provider failure 4']);
    expect(artifact.judgePayload).toBeUndefined();
  });
});
