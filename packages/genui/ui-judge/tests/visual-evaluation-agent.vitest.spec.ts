// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const generate = vi.fn();
  const provider = Object.assign(
    vi.fn((id: string) => ({ api: 'responses', id })),
    {
      chat: vi.fn((id: string) => ({ api: 'chat', id })),
    },
  );

  return {
    agent: vi.fn((config: unknown) => ({ config, generate })),
    createOpenAI: vi.fn(() => provider),
    generate,
    provider,
  };
});

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: mocks.createOpenAI,
}));

vi.mock('@mastra/core/agent', () => ({
  Agent: mocks.agent,
}));

import {
  buildVisualEvaluationMessages,
  evaluateImagesWithAgent,
  runVisualEvaluation,
} from '../src/index.js';

describe('evaluateImagesWithAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mocks.generate.mockResolvedValue({
      text: JSON.stringify(createEvaluationPayload({ score: 0.87 })),
    });
  });

  it('builds AI SDK image messages from data URLs', () => {
    const messages = buildVisualEvaluationMessages(
      'data:image/png;base64, cmVm ',
      'data:image/jpeg;base64, cmVuZA== ',
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]?.content[1]).toEqual({
      image: 'cmVm',
      mimeType: 'image/png',
      type: 'image',
    });
    expect(messages[0]?.content[2]).toEqual({
      image: 'cmVuZA==',
      mimeType: 'image/jpeg',
      type: 'image',
    });
  });

  it('uses the OpenAI Responses API by default for official OpenAI URLs', async () => {
    const result = await evaluateImagesWithAgent(
      'data:image/png;base64,cmVm',
      'data:image/png;base64,cmVuZGVyZWQ=',
      { apiKey: 'test-key', resourceId: 'run-1' },
    );

    expect(result.score).toBe(0.87);
    expect(mocks.createOpenAI).toHaveBeenCalledWith({
      apiKey: 'test-key',
      baseURL: 'https://api.openai.com/v1',
    });
    expect(mocks.provider).toHaveBeenCalledWith('gpt-4o-mini');
    expect(mocks.provider.chat).not.toHaveBeenCalled();
    expect(mocks.agent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'visual-evaluation-agent',
        name: 'VisualEvaluationAgent',
      }),
    );
    expect(mocks.generate).toHaveBeenCalledWith(expect.any(Array), {
      resourceId: 'run-1',
    });
  });

  it('uses chat completions by default for non-official base URLs', async () => {
    await evaluateImagesWithAgent(
      'data:image/png;base64,cmVm',
      'data:image/png;base64,cmVuZGVyZWQ=',
      {
        apiKey: 'test-key',
        baseURL: 'https://proxy.example/v1',
        model: 'custom-model',
      },
    );

    expect(mocks.createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-key',
        baseURL: 'https://proxy.example/v1',
        fetch: expect.any(Function),
      }),
    );
    expect(mocks.provider.chat).toHaveBeenCalledWith('custom-model');
    expect(mocks.provider).not.toHaveBeenCalled();
  });

  it('uses an injected agent from runVisualEvaluation options', async () => {
    const injectedAgent = {
      generate: vi.fn().mockResolvedValue({
        object: createEvaluationPayload({ score: 0.66 }),
      }),
    };
    const image = await createPatternPng();

    const result = await runVisualEvaluation(
      {
        referenceImage: image.toString('base64'),
        renderedImage: image.toString('base64'),
      },
      {
        agent: {
          agent: injectedAgent,
          resourceId: 'visual-run',
        },
      },
    );

    expect(result.score).toBe(0.66);
    expect(injectedAgent.generate).toHaveBeenCalledWith(expect.any(Array), {
      resourceId: 'visual-run',
    });
    expect(mocks.agent).not.toHaveBeenCalled();
  });
});

function createEvaluationPayload(options: { score: number }) {
  return {
    issues: [],
    reason: 'The screenshots match.',
    score: options.score,
    summary: 'The render matches the reference.',
  };
}

async function createPatternPng(): Promise<Buffer> {
  const width = 8;
  const height = 8;
  const data = Buffer.alloc(width * height * 4, 255);
  return await sharp(data, {
    raw: {
      channels: 4,
      height,
      width,
    },
  }).png().toBuffer();
}
