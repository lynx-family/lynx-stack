// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, rstest, test } from '@rstest/core';

import type { ProtocolBenchAdapterInput } from '../service/common/bench/protocol-adapter.js';
import { GenerationUpstreamError } from '../service/common/result.js';
import type { ChatMessage } from '../service/common/types.js';
import { createReactLynxBenchAdapter } from '../service/reactlynx/reactlynx-bench-adapter.js';

const SOURCE = JSON.stringify({
  files: {
    'App.tsx':
      'export default function App() { return <view><text>Hello</text></view>; }',
    'App.css': 'text { color: blue; }',
  },
});
const PUBLISHED = {
  id: 'id',
  zipUrl: 'https://cdn.test/reactlynx-bench/preview/id/bundle.zip',
};
const ASSETS = [{ name: 'main.lynx.js', data: Buffer.from([0, 255, 1, 128]) }];
const INPUT: ProtocolBenchAdapterInput = {
  runId: 'reactlynx-run',
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
const generated = (text = SOURCE) => ({
  text,
  usage: { inputTokens: 12, outputTokens: 8 },
  finishReason: 'stop',
});

test('repairs compiler diagnostics, retains source and usage, and judges native bundle', async () => {
  const conversations: ChatMessage[][] = [];
  const controller = new AbortController();
  const build = rstest.fn()
    .mockRejectedValueOnce(new Error('Invalid JSX in App.tsx'))
    .mockResolvedValueOnce(ASSETS);
  const artifact = await createReactLynxBenchAdapter({
    publish: () => Promise.resolve(PUBLISHED),
    generateRaw(messages, options, signal) {
      conversations.push([...messages]);
      expect(signal).toBe(controller.signal);
      expect(options).toMatchObject({
        model: 'test-model',
        disableAgentCache: true,
        maxRetries: 0,
        enableWebSearch: false,
        enableImageGeneration: false,
        enableDesignGuidance: false,
      });
      return Promise.resolve(generated());
    },
    build,
  }).generate({ ...INPUT, enableDesignGuidance: false }, controller.signal);
  expect(conversations[0]?.[0]?.content).toContain('Required action: Refresh');
  expect(conversations[1]?.[1]).toEqual({ role: 'assistant', content: SOURCE });
  expect(conversations[1]?.[2]?.content).toContain('Invalid JSX in App.tsx');
  expect(build).toHaveBeenLastCalledWith(
    JSON.parse(SOURCE),
    controller.signal,
    expect.any(Function),
  );
  expect(artifact.attempts.map(attempt => [attempt.valid, attempt.totalTokens]))
    .toEqual([[false, 20], [true, 20]]);
  expect(artifact).toMatchObject({
    finalValid: true,
    finalText: SOURCE,
    finalErrors: [],
    judgePayload: {
      kind: 'reactlynx-bundle',
      rawText: SOURCE,
      zipUrl: PUBLISHED.zipUrl,
    },
  });
});

test('rejects invalid source before compilation and retains truncated usage', async () => {
  const build = rstest.fn();
  const artifact = await createReactLynxBenchAdapter({
    publish: () => Promise.resolve(PUBLISHED),
    generateRaw: () =>
      Promise.resolve({ ...generated('{'), finishReason: 'length' }),
    build,
  }).generate({ ...INPUT, maxAttempts: 1 });
  expect(build).not.toHaveBeenCalled();
  expect(artifact.finalErrors[0]).toContain('output budget');
  expect(artifact.attempts[0]).toMatchObject({ valid: false, totalTokens: 20 });
  expect(artifact.judgePayload).toBeUndefined();
});

test('never judges a failed build and preserves generation evidence', async () => {
  const artifact = await createReactLynxBenchAdapter({
    publish: () => Promise.resolve(PUBLISHED),
    generateRaw: () => Promise.resolve(generated()),
    build: () => Promise.reject(new Error('Unsupported module')),
  }).generate({ ...INPUT, maxAttempts: 1 });
  expect(artifact.finalValid).toBe(false);
  expect(artifact.finalText).toBe(SOURCE);
  expect(artifact.finalErrors).toEqual(['Unsupported module']);
  expect(artifact.attempts[0]?.totalTokens).toBe(20);
  expect(artifact.judgePayload).toBeUndefined();
});

test('cancellation reaches the compiler and prevents repair', async () => {
  const controller = new AbortController();
  const generateRaw = rstest.fn(() => Promise.resolve(generated()));
  await expect(
    createReactLynxBenchAdapter({
      publish: () => Promise.resolve(PUBLISHED),
      generateRaw,
      build: (_source, signal) => {
        controller.abort(new Error('Stop build'));
        signal.throwIfAborted();
        return Promise.resolve(ASSETS);
      },
    }).generate(INPUT, controller.signal),
  ).rejects.toThrow('Stop build');
  expect(generateRaw).toHaveBeenCalledTimes(1);
});

test('bounds upstream retries and preserves usage without compiling failed responses', async () => {
  const build = rstest.fn();
  const generateRaw = rstest.fn(() =>
    Promise.reject(
      new GenerationUpstreamError(
        Object.assign(new Error('Unavailable'), { statusCode: 503 }),
        generated(),
      ),
    )
  );
  const artifact = await createReactLynxBenchAdapter({
    publish: () => Promise.resolve(PUBLISHED),
    generateRaw,
    build,
    retryDelayMs: 0,
  })
    .generate({ ...INPUT, maxAttempts: 99 });
  expect(generateRaw).toHaveBeenCalledTimes(4);
  expect(build).not.toHaveBeenCalled();
  expect(artifact.attempts.map(attempt => attempt.totalTokens)).toEqual([
    20,
    20,
    20,
    20,
  ]);
  expect(artifact.judgePayload).toBeUndefined();
});

test(
  'compiles ReactLynx with the real compiler for browser capture',
  async () => {
    const artifact = await createReactLynxBenchAdapter({
      publish: () => Promise.resolve(PUBLISHED),
      generateRaw: () => Promise.resolve(generated()),
    }).generate({ ...INPUT, maxAttempts: 1 });
    expect(artifact.finalErrors).toEqual([]);
    expect(artifact.finalValid).toBe(true);
    expect(artifact.finalText).toBe(SOURCE);
    expect(artifact.judgePayload).toMatchObject({
      kind: 'reactlynx-bundle',
      rawText: SOURCE,
      zipUrl: PUBLISHED.zipUrl,
    });
  },
  30_000,
);

test('publishes only the successful build and records the CDN URL and upload timing', async () => {
  const publish = rstest.fn(() => Promise.resolve(PUBLISHED));
  const build = rstest.fn().mockRejectedValueOnce(new Error('Invalid JSX'))
    .mockResolvedValueOnce(ASSETS);
  const controller = new AbortController();
  const artifact = await createReactLynxBenchAdapter({
    generateRaw: () => Promise.resolve(generated()),
    build,
    publish,
  }).generate(INPUT, controller.signal);
  expect(publish).toHaveBeenCalledExactlyOnceWith(ASSETS, controller.signal);
  expect(artifact.metadata).toMatchObject({
    zipUrl: PUBLISHED.zipUrl,
    uploadMs: expect.any(Number) as unknown,
  });
  expect(artifact.judgePayload).toEqual({
    kind: 'reactlynx-bundle',
    rawText: SOURCE,
    zipUrl: PUBLISHED.zipUrl,
  });
});

test('publication failure retains generation evidence without another model call or capture', async () => {
  const generateRaw = rstest.fn(() => Promise.resolve(generated()));
  const build = rstest.fn(() => Promise.resolve(ASSETS));
  const publish = rstest.fn(() =>
    Promise.reject(new Error('CDN upload failed'))
  );
  const artifact = await createReactLynxBenchAdapter({
    generateRaw,
    build,
    publish,
  }).generate(INPUT);
  expect(generateRaw).toHaveBeenCalledTimes(1);
  expect(build).toHaveBeenCalledTimes(1);
  expect(publish).toHaveBeenCalledTimes(1);
  expect(artifact).toMatchObject({
    finalValid: false,
    finalText: SOURCE,
    finalErrors: ['CDN upload failed'],
  });
  expect(artifact.attempts[0]?.totalTokens).toBe(20);
  expect(artifact.judgePayload).toBeUndefined();
});

test('cancellation during publication prevents Judge delivery and further generation', async () => {
  const controller = new AbortController();
  const generateRaw = rstest.fn(() => Promise.resolve(generated()));
  await expect(
    createReactLynxBenchAdapter({
      generateRaw,
      build: () => Promise.resolve(ASSETS),
      publish: (_assets, signal) => {
        expect(signal).toBe(controller.signal);
        controller.abort(new Error('Cancel publication'));
        return Promise.resolve(PUBLISHED);
      },
    }).generate(INPUT, controller.signal),
  ).rejects.toThrow('Cancel publication');
  expect(generateRaw).toHaveBeenCalledTimes(1);
});
