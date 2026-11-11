// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, expect, rstest, test } from '@rstest/core';

import {
  createJevComponentQuestions,
  createJevPropertyQuestions,
  createJevRetention,
} from '../agent/common/jev-composition.js';
import { createJevDecisionRunner } from '../agent/common/jev-evaluator.js';
import { describeJevComponents } from '../agent/common/jev-tree.js';
import { createJevValueSource } from '../agent/common/jev-values.js';
import {
  consumeJevComposition,
  createJevCompositionStream,
} from '../service/common/jev-composition.js';

afterEach(() => {
  rstest.restoreAllMocks();
  rstest.unstubAllEnvs();
});

test.each([
  {
    value: { path: '/title' },
    name: 'title',
    description: 'Bind to /title (string)',
  },
  {
    value: { k: 'StateRef', n: '$title' },
    name: 'title',
    description: 'Bind to $title (string)',
  },
])(
  'ranks protocol bindings without leaking their resolved values: %j',
  binding => {
    const choices = createJevValueSource(['{"title":"Public title"}'])(
      { name: 'title', schema: { type: 'string' }, required: true },
      { bindings: [{ ...binding, resolved: 'private-input' }] },
    );
    expect(choices[0]?.value).toEqual(binding.value);
    expect(choices[1]?.value).toBe('Public title');
    expect(JSON.stringify(choices)).not.toContain('private-input');
    expect(choices.some(choice => choice.placeholder)).toBe(false);
  },
);

test('filters invalid resources before bounding the shared candidate budget', () => {
  const choices = createJevValueSource([
    Array.from({ length: 100 }, (_, index) => `"invalid ${index}"`).join(' '),
    'https://example.com/asset.png',
  ])({ name: 'url', schema: { type: 'string' }, required: true }, {
    accept: (_value, resolved) =>
      typeof resolved === 'string' && resolved.startsWith('https://'),
  });
  expect(choices.map(choice => choice.value)).toEqual([
    'https://example.com/asset.png',
  ]);
});

test('preserves explicit empty values while omitting synthetic required display placeholders', () => {
  const prop = { name: 'items', schema: { type: 'array' }, required: true };
  expect(createJevValueSource([])(prop)).toEqual([]);
  expect(createJevValueSource(['{"items":[]}'])(prop)).toMatchObject([
    { value: [], explicit: true },
  ]);
  expect(createJevValueSource([])(prop, { allowPlaceholder: true }))
    .toMatchObject([
      { value: [], placeholder: true, explicit: false },
    ]);
});

test('keeps fixed-slot properties with their owner and removes entire omitted subtrees', () => {
  const tree = describeJevComponents([
    { id: 'root', component: 'Column', children: ['modal', 'group'] },
    { id: 'modal', component: 'Modal', trigger: 'label', content: 'body' },
    { id: 'label', component: 'Text', text: 'Open' },
    { id: 'body', component: 'Column', children: ['nested'] },
    { id: 'nested', component: 'Text', text: 'Details' },
    { id: 'group', component: 'Column', children: ['removed'] },
    { id: 'removed', component: 'Text', text: 'Gone' },
  ]);
  const questions = createJevComponentQuestions(tree, []);
  expect(questions).not.toHaveProperty('keep_label');
  expect(questions).not.toHaveProperty('keep_body');
  expect(questions.keep_root?.criteria).not.toHaveProperty('omit');
  const retained = createJevRetention(tree, {
    keep_root: 'preserve_layout',
    keep_modal: 'reorder_preserve',
    keep_nested: 'keep',
    keep_group: 'omit',
  });
  expect(retained.preservesProperties('label')).toBe(true);
  expect(retained.preservesProperties('body')).toBe(true);
  expect(retained.preservesProperties('nested')).toBe(false);
  expect(retained.layout.get('modal')).toBe('reorder');
  expect(retained.layout.get('nested')).toBe('move');
  expect(retained.removed).toEqual(new Set(['group', 'removed']));
  expect(retained.layout.has('removed')).toBe(false);
});

test('deduplicates retained objects structurally and resolves single choices without a model call', async () => {
  const plan = createJevPropertyQuestions();
  const set = rstest.fn();
  plan.offer('appearance', 'Choose appearance', [
    { value: { width: 10, color: 'blue' }, description: 'Keep' },
    { value: { color: 'blue', width: 10 }, description: 'Candidate' },
  ], set);
  const evaluate = rstest.fn();
  const decide = createJevDecisionRunner({
    evaluate,
    signal: new AbortController().signal,
    onUsage: rstest.fn(),
  });
  plan.apply(await decide({}, plan.questions, 'properties'));
  expect(evaluate).not.toHaveBeenCalled();
  expect(set).toHaveBeenCalledWith({ width: 10, color: 'blue' });
  expect(() => plan.apply({ appearance: '1' })).toThrow(
    'unoffered property choice',
  );
});

function configure() {
  rstest.stubEnv(
    'GENUI_MODEL_CONFIG_JSON',
    JSON.stringify({
      Jev: {
        provider: 'typesafe',
        model: 'jev-latest',
        apiKey: 'private-key',
        baseURL: 'https://api.typesafe.ai/v1',
      },
    }),
  );
  return { model: 'Jev' };
}

test('aggregates phases, separates wire chunks from the artifact, and consumes a stream once', async () => {
  let signal: AbortSignal | undefined;
  const onPerformanceEvent = rstest.fn();
  const stream = createJevCompositionStream(
    { ...configure(), onPerformanceEvent },
    undefined,
    async function*(runtime) {
      signal = runtime.signal;
      runtime.onUsage({ inputTokens: 100, outputTokens: 5 });
      yield await Promise.resolve({
        text: 'artifact',
        delta: 'wire-1',
        step: 1,
      });
      runtime.onUsage({ inputTokens: 50, outputTokens: 2 });
      yield { text: 'artifact', delta: 'wire-2' };
    },
  );
  await expect(stream.finalize()).rejects.toThrow('has not completed');
  const chunks: string[] = [];
  for await (const chunk of stream.textStream) chunks.push(chunk);
  expect(chunks).toEqual(['wire-1', 'wire-2']);
  expect(await stream.finalize()).toMatchObject({
    text: 'artifact',
    usage: { inputTokens: 150, outputTokens: 7 },
    finishReason: 'stop',
  });
  expect(onPerformanceEvent).toHaveBeenCalledWith('jev.composition.step', {
    step: 1,
  });
  expect(signal?.aborted).toBe(true);
  await expect(consumeJevComposition(stream)).rejects.toThrow(
    'only be consumed once',
  );
});

test('retains completed usage and artifact evidence on a later sanitized provider failure', async () => {
  const stream = createJevCompositionStream(
    configure(),
    undefined,
    async function*(runtime) {
      runtime.onUsage({ inputTokens: 100, outputTokens: 5 });
      yield await Promise.resolve({
        text: 'validated-artifact',
        delta: 'chunk',
      });
      throw Object.assign(new Error('private-provider-body'), {
        name: 'AI_APICallError',
        statusCode: 400,
      });
    },
  );
  await expect(consumeJevComposition(stream)).rejects.toMatchObject({
    message: 'TypeSafe evaluation failed (HTTP 400).',
    result: {
      text: 'validated-artifact',
      usage: { inputTokens: 100, outputTokens: 5 },
      finishReason: 'error',
    },
  });
  await expect(stream.finalize()).rejects.toThrow('has not completed');
});

test('closes the invocation when a consumer stops early and never finalizes partial output', async () => {
  let signal: AbortSignal | undefined;
  const afterYield = rstest.fn();
  const stream = createJevCompositionStream(
    configure(),
    undefined,
    async function*(runtime) {
      signal = runtime.signal;
      yield await Promise.resolve({ text: 'artifact', delta: 'chunk' });
      afterYield();
    },
  );
  for await (const _chunk of stream.textStream) break;
  expect(signal?.aborted).toBe(true);
  expect(afterYield).not.toHaveBeenCalled();
  await expect(stream.finalize()).rejects.toThrow('has not completed');
});
