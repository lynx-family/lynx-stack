// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Agent } from '@mastra/core/agent';
import { z } from 'zod';

import type { BenchJobRequest, BenchScenarioRequest } from './a2ui-bench-types';
import type { OpenAIProviderOptions } from '../agent/openai-provider';
import { createLLMProvider } from '../agent/openai-provider';
import { ProviderAgentCache } from './common/provider';

const judgeSchema = z.object({
  score: z.number().min(0).max(5),
  reason: z.string(),
  summary: z.string(),
});

type JudgeOutput = z.infer<typeof judgeSchema>;

interface BenchJudgeAgent {
  generate: (
    messages: unknown,
    options: unknown,
  ) => Promise<{
    error?: Error;
    object?: unknown;
  }>;
}

export interface BenchJudgeOptions {
  abortSignal?: AbortSignal;
  request: BenchJobRequest;
  scenario: BenchScenarioRequest;
  screenshot: Uint8Array;
}

export interface BenchJudgeResult extends JudgeOutput {
  score: number;
}

const agentCache = new ProviderAgentCache<BenchJudgeAgent>();

function readApiStyle(
  value: string | undefined,
): 'chat' | 'responses' | undefined {
  return value === 'chat' || value === 'responses' ? value : undefined;
}

export function resolveBenchJudgeProvider(
  request: BenchJobRequest,
): OpenAIProviderOptions {
  return {
    apiKey: process.env.A2UI_BENCH_JUDGE_API_KEY
      ?? process.env.MIDSCENE_MODEL_API_KEY
      ?? request.provider.apiKey
      ?? process.env.OPENAI_API_KEY,
    baseURL: process.env.A2UI_BENCH_JUDGE_BASE_URL
      ?? process.env.MIDSCENE_MODEL_BASE_URL
      ?? request.provider.baseURL
      ?? process.env.OPENAI_BASE_URL,
    model: process.env.A2UI_BENCH_JUDGE_MODEL
      ?? process.env.JUDGE_MODEL
      ?? process.env.MIDSCENE_MODEL_NAME
      ?? request.provider.model
      ?? process.env.OPENAI_MODEL,
    api: readApiStyle(process.env.A2UI_BENCH_JUDGE_API)
      ?? request.provider.api,
  };
}

function createJudgeAgent(
  providerOptions: OpenAIProviderOptions,
): BenchJudgeAgent {
  const { buildModel, model } = createLLMProvider(providerOptions);
  return new Agent({
    id: 'genui-bench-visual-judge',
    name: 'GenUIBenchVisualJudge',
    instructions: [
      'You are a strict visual UI benchmark judge.',
      'Evaluate only the supplied screenshot against the requested task.',
      'Score visual correctness, content completeness, hierarchy, readability,',
      'and whether the requested action is visibly discoverable.',
      'Use an integer score from 0 to 5, where 5 fully satisfies the task.',
      'Do not reward implementation details that are not visible.',
    ].join(' '),
    model: buildModel(model),
  }) as unknown as BenchJudgeAgent;
}

export function buildJudgePrompt(scenario: BenchScenarioRequest): string {
  const details = [
    `Scenario: ${scenario.name}`,
    `Type: ${scenario.type}`,
    `Task: ${scenario.judgeTask ?? scenario.prompt}`,
    scenario.action ? `Required visible action: ${scenario.action}` : undefined,
    scenario.judgeSteps && scenario.judgeSteps.length > 0
      ? `Expected interaction steps: ${scenario.judgeSteps.join(' -> ')}`
      : undefined,
    '',
    'Judge the final rendered screenshot. Return a concise reason and summary.',
  ];
  return details
    .filter((line): line is string => line !== undefined)
    .join('\n');
}

export async function judgeBenchScreenshot(
  options: BenchJudgeOptions,
): Promise<BenchJudgeResult> {
  const providerOptions = resolveBenchJudgeProvider(options.request);
  const agent = await agentCache.get(
    providerOptions,
    () => createJudgeAgent(providerOptions),
    'genui-bench-visual-judge',
  );
  const result = await agent.generate(
    [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: buildJudgePrompt(options.scenario),
          },
          {
            type: 'image',
            image: options.screenshot,
            mediaType: 'image/jpeg',
          },
        ],
      },
    ],
    {
      abortSignal: options.abortSignal,
      structuredOutput: {
        schema: judgeSchema,
      },
    },
  );
  if (result.error) throw result.error;

  const parsed = judgeSchema.safeParse(result.object);
  if (!parsed.success) {
    throw new Error(
      `ui-judge returned an invalid structured result: ${
        parsed.error.issues.map((issue) => issue.message).join('; ')
      }`,
    );
  }
  return {
    ...parsed.data,
    score: Math.round(parsed.data.score),
  };
}
