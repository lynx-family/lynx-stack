// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createTypeSafeAi } from '@ai-sdk/typesafe-ai';

import { createCustomProviderFetch } from './custom-provider-security.js';
import { readBenchTokenUsage } from '../../service/common/bench/usage.js';
import type { ConfiguredModel } from '../../service/common/model-config.js';

export interface JevQuestion {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string>;
}

export type JevEvaluationPhase =
  | 'components'
  | 'properties'
  | 'copy'
  | 'layout';

export interface JevQuestionDetail {
  id: string;
  instructions: string;
  choices: string[];
  answer?: string;
}

export interface JevModelInteraction {
  provider: 'jev';
  requestIndex: number;
  phase: JevEvaluationPhase;
  status: 'started' | 'completed' | 'failed' | 'cancelled';
  request: {
    questionCount: number;
    choiceCount: number;
    stateChars: number;
    questionsChars: number;
  };
  questions?: JevQuestionDetail[];
  durationMs?: number;
  response?: {
    answerCount: number;
    tokenUsage: ReturnType<typeof readBenchTokenUsage>;
  };
  statusCode?: number;
}

export type JevEvaluator = (
  state: string,
  questions: Record<string, JevQuestion>,
  signal: AbortSignal,
  phase?: JevEvaluationPhase,
) => Promise<{ answers: Record<string, string>; usage: unknown }>;

export interface JevEvaluationOptions {
  evaluate: JevEvaluator;
  signal: AbortSignal;
  onUsage: (usage: unknown) => void;
}

export type JevDecide = (
  state: unknown,
  questions: Record<string, JevQuestion>,
  phase: JevEvaluationPhase,
) => Promise<Record<string, string>>;

export function jevQuestion(
  instructions: string,
  criteria: Record<string, string>,
): JevQuestion {
  return { type: 'choice', instructions, criteria };
}

export function createJevDecisionRunner(
  options: JevEvaluationOptions,
): JevDecide {
  return (state, questions, phase) =>
    evaluateJevQuestions(state, questions, { ...options, phase });
}

/** Evaluate independent questions from one composition phase, preserving its dependency boundary. */
export async function evaluateJevQuestions(
  state: unknown,
  questions: Record<string, JevQuestion>,
  options: JevEvaluationOptions & {
    phase?: JevEvaluationPhase;
  },
): Promise<Record<string, string>> {
  const { evaluate, signal, onUsage } = options;
  signal.throwIfAborted();
  const answers: Record<string, string> = Object.create(null) as Record<
    string,
    string
  >;
  const pending = Object.entries(questions).filter(([id, question]) => {
    const choices = Object.keys(question.criteria);
    if (choices.length === 0) {
      throw new Error('Jev question has no available choices.');
    }
    if (choices.length !== 1) return true;
    answers[id] = choices[0]!;
    return false;
  });
  if (pending.length === 0) return answers;

  const serializedState = JSON.stringify(state);
  const failed = new AbortController();
  const batchSignal = AbortSignal.any([signal, failed.signal]);
  let cursor = 0;
  const worker = async () => {
    try {
      while (cursor < pending.length) {
        batchSignal.throwIfAborted();
        const batch = Object.fromEntries(pending.slice(cursor, cursor + 32));
        cursor += 32;
        const result = await evaluate(
          serializedState,
          batch,
          batchSignal,
          options.phase,
        );
        // A sibling may fail or the client may disconnect after this call completes.
        onUsage(result.usage);
        batchSignal.throwIfAborted();
        for (const [id, question] of Object.entries(batch)) {
          const answer = result.answers[id];
          if (
            answer === undefined || !Object.hasOwn(question.criteria, answer)
          ) {
            throw new Error(
              'Jev returned a missing or unoffered component choice.',
            );
          }
          answers[id] = answer;
        }
      }
    } catch (error) {
      // Stop queued work and cancel in-flight siblings, retaining the first failure.
      if (!failed.signal.aborted) failed.abort(error);
    }
  };
  // Limit concurrency within the phase; never overlap dependent copy/layout phases.
  // Drain active requests before returning so late usage is included in failures.
  await Promise.all(
    Array.from({ length: Math.min(2, Math.ceil(pending.length / 32)) }, worker),
  );
  failed.signal.throwIfAborted();
  signal.throwIfAborted();
  return Object.fromEntries(
    Object.keys(questions).map(id => [id, answers[id]!]),
  );
}

export function createJevEvaluator(
  config: Pick<ConfiguredModel, 'apiKey' | 'baseURL' | 'model'> & {
    requestScoped?: boolean;
  },
  onInteraction?: (event: JevModelInteraction) => void,
): JevEvaluator {
  const model = createTypeSafeAi({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    ...(config.requestScoped ? { fetch: createCustomProviderFetch() } : {}),
  }).evaluationModel(config.model);
  let requestCount = 0;
  return async (state, questions, signal, phase = 'components') => {
    signal.throwIfAborted();
    const startedAt = performance.now();
    const questionDetails: JevQuestionDetail[] = Object.entries(questions).map(
      ([id, q]) => ({
        id,
        instructions: q.instructions,
        choices: Object.keys(q.criteria),
      }),
    );
    const event = {
      provider: 'jev' as const,
      requestIndex: ++requestCount,
      phase,
      request: {
        questionCount: Object.keys(questions).length,
        choiceCount: Object.values(questions).reduce(
          (sum, question) => sum + Object.keys(question.criteria).length,
          0,
        ),
        stateChars: state.length,
        questionsChars: JSON.stringify(questions).length,
      },
    };
    onInteraction?.({
      ...event,
      status: 'started',
      questions: questionDetails,
    });
    try {
      // The provider primitive performs one request, with no SDK retry loop.
      const result = await model.doEvaluate({
        state,
        questions,
        abortSignal: signal,
      });
      const answers = Object.create(null) as Record<string, string>;
      for (const id of Object.keys(questions)) {
        const answer = result.answers[id];
        answers[id] = answer?.type === 'choice' ? answer.choice : '';
      }
      const answeredDetails = questionDetails.map(detail => ({
        ...detail,
        answer: answers[detail.id],
      }));
      onInteraction?.({
        ...event,
        status: 'completed',
        questions: answeredDetails,
        durationMs: performance.now() - startedAt,
        response: {
          answerCount: Object.keys(questions).filter(id =>
            result.answers[id]?.type === 'choice'
          ).length,
          tokenUsage: readBenchTokenUsage(result.usage),
        },
      });
      return { answers, usage: result.usage };
    } catch (error) {
      const statusCode =
        error && typeof error === 'object' && 'statusCode' in error
          ? error.statusCode
          : undefined;
      onInteraction?.({
        ...event,
        status: signal.aborted ? 'cancelled' : 'failed',
        questions: questionDetails,
        durationMs: performance.now() - startedAt,
        ...(typeof statusCode === 'number' && Number.isFinite(statusCode)
          ? { statusCode }
          : {}),
      });
      throw error;
    }
  };
}
