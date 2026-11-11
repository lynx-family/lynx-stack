// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  rstest,
  test,
} from '@rstest/core';

import { createJudgeScores } from './ui-judge-fixtures.js';
import {
  JUDGE_DIMENSIONS,
  buildJudgePrompt,
  evaluateScreenshot,
} from '../agent/common/ui-judge-agent.js';
import * as requestQueue from '../agent/common/ui-judge-request-queue.js';
import { GENUI_MODEL_CONFIG_ENV } from '../service/common/model-config.js';

const { generate, agentModels } = rstest.hoisted(() => ({
  generate: rstest.fn<
    (
      messages: unknown,
      options: { abortSignal?: AbortSignal },
    ) => Promise<{ object?: unknown; error?: unknown; finishReason?: string }>
  >(),
  agentModels: [] as Array<{ modelId: string }>,
}));

rstest.mock('@mastra/core/agent', () => ({
  Agent: class {
    constructor(options: { model: { modelId: string } }) {
      agentModels.push(options.model);
    }
    generate = generate;
  },
}));

const screenshotDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
let previousConfig: string | undefined;
beforeEach(() => {
  previousConfig = process.env[GENUI_MODEL_CONFIG_ENV];
  process.env[GENUI_MODEL_CONFIG_ENV] = JSON.stringify({
    Default: {
      model: 'default-upstream',
      apiKey: 'default-secret',
      baseURL: 'https://default.example/v1',
      default: true,
    },
    Selected: {
      model: 'selected-upstream',
      apiKey: 'selected-secret',
      baseURL: 'https://selected.example/v1',
      api: 'chat',
      reasoningEffort: 'low',
      maxOutputTokens: 1024,
    },
  });
  generate.mockReset();
  agentModels.length = 0;
  rstest.spyOn(requestQueue, 'getUiJudgeRequestQueue').mockReturnValue(
    new requestQueue.UiJudgeRequestQueue({ intervalMs: 0 }),
  );
});
afterEach(() => {
  rstest.restoreAllMocks();
  if (previousConfig === undefined) delete process.env[GENUI_MODEL_CONFIG_ENV];
  else process.env[GENUI_MODEL_CONFIG_ENV] = previousConfig;
});

describe('GenUI screenshot evaluation', () => {
  test('uses the selected GenUI model and preserves weighted scoring', async () => {
    generate.mockResolvedValueOnce({
      object: Object.fromEntries(
        Object.entries(createJudgeScores([4, 5, 4, 3, 2])).reverse(),
      ),
    });
    const result = await evaluateScreenshot({
      model: 'Selected',
      screenshotDataUrl,
      task: 'Build a greeting',
    });
    expect(agentModels[0]?.modelId).toBe('selected-upstream');
    expect(result.score).toBe(4);
    expect(result.dimensions.map(({ score }) => score)).toEqual([5, 4, 3, 2]);
    expect(result.geqiScore).toBeCloseTo(65 / 85 * 100);
    expect(generate).toHaveBeenCalledTimes(1);
    for (const [messages, options] of generate.mock.calls) {
      expect(messages).toEqual([{
        role: 'user',
        content: [
          { type: 'image', image: screenshotDataUrl, mediaType: 'image/png' },
          {
            type: 'text',
            text: expect.stringContaining('Task: Build a greeting') as unknown,
          },
        ],
      }]);
      expect(options).toMatchObject({
        maxSteps: 1,
        structuredOutput: { jsonPromptInjection: true },
        modelSettings: { maxOutputTokens: 1024, maxRetries: 0 },
        providerOptions: { openai: { reasoningEffort: 'low' } },
      });
    }
  });

  test('uses the GenUI default when no model is selected', async () => {
    generate.mockResolvedValue({
      object: createJudgeScores(3),
    });
    await evaluateScreenshot({ screenshotDataUrl, task: 'Build a greeting' });
    expect(agentModels[0]?.modelId).toBe('default-upstream');
    expect(requestQueue.getUiJudgeRequestQueue).toHaveBeenCalledWith(
      'https://default.example/v1',
      'default-upstream',
    );
    for (const [, options] of generate.mock.calls) {
      expect(options).toMatchObject({
        modelSettings: { maxOutputTokens: 4096 },
      });
    }
  });

  test('uses the shared GenUI fallback instead of treating an unknown name as an upstream ID', async () => {
    generate.mockResolvedValue({
      object: createJudgeScores(3),
    });
    await evaluateScreenshot({
      model: 'unknown',
      screenshotDataUrl,
      task: 'Build a greeting',
    });
    expect(agentModels[0]?.modelId).toBe('default-upstream');
  });

  test('includes every dimension rubric in one prompt with screenshot-only evidence', () => {
    const prompt = buildJudgePrompt({
      screenshotDataUrl,
      task: 'Build a greeting',
      reference: 'Show Hello',
    });
    expect(prompt).toContain('Reference answer or target: Show Hello');
    expect(prompt).toContain('Do not assume hidden behavior');
    expect(prompt).toContain('Assess each dimension separately');
    for (const dimension of JUDGE_DIMENSIONS) {
      expect(prompt).toContain(`Result key: ${dimension.id}`);
      expect(prompt).toContain(dimension.focus);
      for (const criterion of dimension.criteria) {
        expect(prompt).toContain(criterion);
      }
    }
  });

  test.each(
    [
      ['fractional score', () => createJudgeScores([4, 4, 4, 4, 4.5])],
      ['out-of-range score', () => createJudgeScores([4, 4, 4, 4, 6])],
      ['missing dimension', () => {
        const scores = createJudgeScores();
        delete scores['architecture-writing'];
        return scores;
      }],
      ['unknown dimension', () => ({ ...createJudgeScores(), unknown: {} })],
      ['missing evidence', () => {
        const scores = createJudgeScores();
        scores['architecture-writing']!.reason = '';
        return scores;
      }],
    ] as const,
  )('rejects %s without retrying malformed output', async (_name, output) => {
    generate.mockResolvedValue({ object: output() });
    await expect(
      evaluateScreenshot({ screenshotDataUrl, task: 'Build a greeting' }),
    ).rejects.toThrow();
    expect(generate).toHaveBeenCalledTimes(1);
  });

  test('forwards cancellation to the single model call', async () => {
    const controller = new AbortController();
    generate.mockImplementation((_messages, options) =>
      new Promise((_resolve, reject) => {
        options.abortSignal?.addEventListener(
          'abort',
          () => reject(new Error('aborted')),
          { once: true },
        );
      })
    );
    const pending = evaluateScreenshot({
      screenshotDataUrl,
      task: 'Build a greeting',
      signal: controller.signal,
    });
    await rstest.waitUntil(() => generate.mock.calls.length === 1);
    controller.abort();
    await expect(pending).rejects.toThrow('aborted');
    expect(
      generate.mock.calls.every(([, options]) => options.abortSignal?.aborted),
    ).toBe(true);
  });

  test('waits for the cancelled model call to settle before releasing the scoring task', async () => {
    const controller = new AbortController();
    let settle!: () => void;
    generate.mockImplementationOnce(() =>
      new Promise((resolve) => {
        settle = () =>
          resolve({
            object: createJudgeScores(),
          });
      })
    );
    let finished = false;
    const pending = evaluateScreenshot({
      screenshotDataUrl,
      task: 'Build a greeting',
      signal: controller.signal,
    })
      .catch((error: unknown) => {
        finished = true;
        return error;
      });
    await rstest.waitUntil(() => generate.mock.calls.length === 1);
    controller.abort();
    await Promise.resolve();
    expect(finished).toBe(false);
    settle();
    expect(await pending).toMatchObject({ name: 'AbortError' });
    expect(finished).toBe(true);
  });

  test('retries the complete scoring request after SDK result errors', async () => {
    let now = 0;
    const waits: number[] = [];
    const onPhase = rstest.fn();
    rstest.mocked(requestQueue.getUiJudgeRequestQueue).mockReturnValue(
      new requestQueue.UiJudgeRequestQueue({
        intervalMs: 0,
        now: () => now,
        sleep: (delay) => {
          waits.push(delay);
          now += delay;
          return Promise.resolve();
        },
      }),
    );
    generate.mockResolvedValueOnce({
      finishReason: 'error',
      error: { statusCode: 429, message: 'RPM limit exceeded' },
    });
    generate.mockResolvedValue({
      object: createJudgeScores(),
    });
    const result = await evaluateScreenshot({
      model: 'Selected',
      screenshotDataUrl,
      task: 'Build a greeting',
      onPhase,
    });
    expect(result).toMatchObject({ score: 4, geqiScore: 80 });
    expect(result.dimensions).toHaveLength(4);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(waits).toContain(60_000);
    expect(onPhase).toHaveBeenCalledWith('judge-retry');
    expect(onPhase).toHaveBeenLastCalledWith('judge');
    const prompts = generate.mock.calls.map(([messages]) =>
      JSON.stringify(messages)
    );
    expect(
      prompts.filter(prompt =>
        prompt.includes('Dimension: Visual Correctness')
      ),
    )
      .toHaveLength(2);
    expect(new Set(prompts).size).toBe(1);
  });
});
