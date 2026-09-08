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

import { evaluateScreenshot } from '../agent/common/ui-judge-agent.js';
import { GENUI_MODEL_CONFIG_ENV } from '../service/common/model-config.js';

const { generate, agentModels } = rstest.hoisted(() => ({
  generate: rstest.fn<
    (
      messages: unknown,
      options: { abortSignal?: AbortSignal },
    ) => Promise<{ object: unknown }>
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
});
afterEach(() => {
  if (previousConfig === undefined) delete process.env[GENUI_MODEL_CONFIG_ENV];
  else process.env[GENUI_MODEL_CONFIG_ENV] = previousConfig;
});

describe('GenUI screenshot evaluation', () => {
  test('uses the selected GenUI model and preserves weighted scoring', async () => {
    for (const score of [4, 5, 4, 3, 2]) {
      generate.mockResolvedValueOnce({
        object: { score, reason: 'Evidence.', summary: 'Visible details.' },
      });
    }
    const result = await evaluateScreenshot({
      model: 'Selected',
      screenshotDataUrl,
      task: 'Build a greeting',
    });
    expect(agentModels[0]?.modelId).toBe('selected-upstream');
    expect(result.score).toBe(4);
    expect(result.dimensions.map(({ score }) => score)).toEqual([5, 4, 3, 2]);
    expect(result.geqiScore).toBeCloseTo(65 / 85 * 100);
    expect(generate).toHaveBeenCalledTimes(5);
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
        modelSettings: { maxOutputTokens: 1024 },
        providerOptions: { openai: { reasoningEffort: 'low' } },
      });
    }
  });

  test('uses the GenUI default when no model is selected', async () => {
    generate.mockResolvedValue({
      object: { score: 3, reason: 'Evidence.', summary: 'Visible details.' },
    });
    await evaluateScreenshot({ screenshotDataUrl, task: 'Build a greeting' });
    expect(agentModels[0]?.modelId).toBe('default-upstream');
  });

  test('uses the shared GenUI fallback instead of treating an unknown name as an upstream ID', async () => {
    generate.mockResolvedValue({
      object: { score: 3, reason: 'Evidence.', summary: 'Visible details.' },
    });
    await evaluateScreenshot({
      model: 'unknown',
      screenshotDataUrl,
      task: 'Build a greeting',
    });
    expect(agentModels[0]?.modelId).toBe('default-upstream');
  });

  test('rejects malformed scores and cancels the other dimensions', async () => {
    generate.mockResolvedValue({
      object: { score: 4.5, reason: 'Evidence.', summary: 'Visible details.' },
    });
    await expect(
      evaluateScreenshot({ screenshotDataUrl, task: 'Build a greeting' }),
    ).rejects.toThrow();
    expect(
      generate.mock.calls.every(([, options]) => options.abortSignal?.aborted),
    ).toBe(true);
  });

  test('forwards cancellation to every active model call', async () => {
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
    controller.abort();
    await expect(pending).rejects.toThrow('aborted');
    expect(
      generate.mock.calls.every(([, options]) => options.abortSignal?.aborted),
    ).toBe(true);
  });
});
