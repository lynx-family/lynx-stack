// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { buildReactWeb, parseReactWebSource } from '@lynx-js/genui-reactweb';

import { getReactWebAgentService } from './reactweb-agent.js';
import type {
  ProtocolBenchAdapter,
  ProtocolBenchAdapterInput,
} from '../common/bench/protocol-adapter.js';
import type { ProtocolBenchAttemptResult } from '../common/bench/protocol-types.js';
import {
  resolveBenchRetryDelay,
  waitForBenchRetry,
} from '../common/bench/retry.js';
import type { BenchRetrySleep } from '../common/bench/retry.js';
import { benchAttemptTokenCounts } from '../common/bench/usage.js';
import { buildGenerationRepairMessages } from '../common/generation-repair.js';
import {
  GenerationPostprocessError,
  GenerationUpstreamError,
} from '../common/result.js';
import type { ChatMessage, ChatOptions } from '../common/types.js';

export interface ReactWebBenchAdapterOptions {
  generateRaw?: (
    messages: ChatMessage[],
    options: ChatOptions,
    signal?: AbortSignal,
  ) => Promise<
    {
      text: string;
      usage: unknown;
      finishReason: unknown;
    }
  >;
  build?: typeof buildReactWeb;
  retryDelayMs?: number;
  sleep?: BenchRetrySleep;
}

function buildPrompt(input: ProtocolBenchAdapterInput): string {
  return [
    'Generate one React DOM UI for the benchmark scenario below.',
    `Scenario name: ${input.scenario.name}`,
    `Scenario type: ${input.scenario.type}`,
    `Scenario complexity: ${input.scenario.complexity}`,
    input.scenario.action ? `Required action: ${input.scenario.action}` : '',
    '',
    input.scenario.prompt,
    '',
    'Return only the source JSON containing exactly App.tsx and App.css, without benchmark metadata.',
    'Use local content and interactions. Do not load external resources, open URLs, or use network requests. Use a non-image presentation for image requests.',
  ].join('\n');
}

export function createReactWebBenchAdapter(
  options: ReactWebBenchAdapterOptions = {},
): ProtocolBenchAdapter {
  const generateRaw = options.generateRaw
    ?? ((messages, chatOptions, signal) =>
      getReactWebAgentService().generateRaw(
        messages,
        chatOptions,
        signal,
      ));
  return {
    protocol: 'reactweb',
    async generate(input, signal) {
      signal?.throwIfAborted();
      const initialMessages: ChatMessage[] = [{
        role: 'user',
        content: buildPrompt(input),
      }];
      let messages = initialMessages;
      const attempts: ProtocolBenchAttemptResult[] = [];
      const maxAttempts = Number.isFinite(input.maxAttempts)
        ? Math.min(4, Math.max(1, Math.floor(input.maxAttempts)))
        : 1;
      let finalText = '';
      let html = '';
      let buildMs = 0;
      let finalErrors: string[] = [];
      let finalValid = false;
      for (let index = 1; index <= maxAttempts; index++) {
        signal?.throwIfAborted();
        const startedAt = performance.now();
        let generated: Awaited<ReturnType<typeof generateRaw>>;
        let postprocessError: GenerationPostprocessError | undefined;
        try {
          generated = await generateRaw(messages, {
            ...input.provider,
            resourceId: `genui-bench:${input.runId}:attempt-${index}`,
            disableAgentCache: true,
            maxRetries: 0,
            reasoningEffort: input.reasoningEffort,
            streamRawGeneration: true,
            onPerformanceEvent: input.onPerformanceEvent,
            enableWebSearch: false,
            enableImageGeneration: false,
            enableDesignGuidance: input.enableDesignGuidance !== false,
          }, signal);
          signal?.throwIfAborted();
        } catch (error) {
          signal?.throwIfAborted();
          if (error instanceof GenerationPostprocessError) {
            generated = error.result;
            postprocessError = error;
          } else {
            const failed = error instanceof GenerationUpstreamError
              ? error.result
              : undefined;
            finalErrors = [
              error instanceof Error ? error.message : String(error),
            ];
            attempts.push({
              index,
              durationMs: Math.round(performance.now() - startedAt),
              ...benchAttemptTokenCounts(failed?.usage),
              ...(failed
                ? { usage: failed.usage, finishReason: failed.finishReason }
                : {}),
              valid: false,
              validationErrors: [...finalErrors],
              outputChars: failed?.text.length ?? 0,
            });
            const retryDelayMs = resolveBenchRetryDelay(error, index, options);
            if (index < maxAttempts && retryDelayMs !== undefined) {
              await waitForBenchRetry(retryDelayMs, signal, options.sleep);
              continue;
            }
            break;
          }
        }

        finalText = generated.text;
        try {
          if (postprocessError) throw postprocessError;
          const source = parseReactWebSource(generated.text);
          finalText = JSON.stringify(source);
          const buildStartedAt = performance.now();
          try {
            html = await (options.build ?? buildReactWeb)(
              source,
              signal ?? new AbortController().signal,
              () => undefined,
            );
            signal?.throwIfAborted();
          } finally {
            buildMs += performance.now() - buildStartedAt;
          }
          finalErrors = [];
          finalValid = true;
        } catch (error) {
          signal?.throwIfAborted();
          finalErrors = [
            generated.finishReason === 'length'
              ? 'ReactWeb generation exhausted the model output budget before completing the source files.'
              : (error instanceof Error ? error.message : String(error)),
          ];
        }
        attempts.push({
          index,
          durationMs: Math.round(performance.now() - startedAt),
          ...benchAttemptTokenCounts(generated.usage),
          usage: generated.usage,
          valid: finalValid,
          validationErrors: [...finalErrors],
          outputChars: generated.text.length,
          finishReason: generated.finishReason,
        });
        if (finalValid) break;
        if (index < maxAttempts) {
          messages = buildGenerationRepairMessages({
            initialMessages,
            messages,
            result: generated,
            repairPrompt:
              `Fix the following validation errors and return the complete ReactWeb source JSON:\n${
                finalErrors.join('\n')
              }`,
          });
        }
      }
      return {
        attempts,
        finalValid,
        finalText,
        finalErrors,
        metadata: { buildMs: Math.round(buildMs) },
        ...(finalValid
          ? {
            judgePayload: {
              kind: 'reactweb-html' as const,
              rawText: html,
            },
          }
          : {}),
      };
    },
  };
}
