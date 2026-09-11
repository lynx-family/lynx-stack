// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getHtmlAgentService } from './html-agent.js';
import type { HtmlChatOptions } from './html-agent.js';
import { normalizeHtmlArtifact } from '../../agent/html/html-output.js';
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
import {
  GenerationPostprocessError,
  GenerationUpstreamError,
} from '../common/result.js';
import type { ChatMessage } from '../common/types.js';

export interface HtmlBenchAdapterOptions {
  generateRaw?: (
    messages: ChatMessage[],
    options: HtmlChatOptions,
    signal?: AbortSignal,
  ) => Promise<
    {
      text: string;
      usage: unknown;
      finishReason: unknown;
    }
  >;
  retryDelayMs?: number;
  sleep?: BenchRetrySleep;
}

function buildPrompt(input: ProtocolBenchAdapterInput): string {
  return [
    'Generate one self-contained HTML UI for the benchmark scenario below.',
    `Scenario name: ${input.scenario.name}`,
    `Scenario type: ${input.scenario.type}`,
    `Scenario complexity: ${input.scenario.complexity}`,
    input.scenario.action ? `Required action: ${input.scenario.action}` : '',
    '',
    input.scenario.prompt,
    '',
    'Return only the complete HTML5 document with inline styles and scripts, without benchmark metadata.',
    'Use local content and interactions. Do not load external resources, open URLs, or use network requests. Use a non-image presentation for image requests.',
  ].join('\n');
}

export function createHtmlBenchAdapter(
  options: HtmlBenchAdapterOptions = {},
): ProtocolBenchAdapter {
  const generateRaw = options.generateRaw
    ?? ((messages, chatOptions, signal) =>
      getHtmlAgentService().generateRaw(
        messages,
        chatOptions,
        undefined,
        signal,
      ));
  return {
    protocol: 'html',
    async generate(input, signal) {
      signal?.throwIfAborted();
      const messages: ChatMessage[] = [{
        role: 'user',
        content: buildPrompt(input),
      }];
      const attempts: ProtocolBenchAttemptResult[] = [];
      const maxAttempts = Number.isFinite(input.maxAttempts)
        ? Math.min(4, Math.max(1, Math.floor(input.maxAttempts)))
        : 1;
      let finalText = '';
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
            enableWebSearch: false,
            enableImageGeneration: false,
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
          finalText = normalizeHtmlArtifact(generated.text);
          finalErrors = [];
          finalValid = true;
        } catch (error) {
          finalErrors = [
            generated.finishReason === 'length'
              ? 'HTML generation exhausted the model output budget before completing the document.'
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
          messages.push({
            role: 'assistant',
            content: generated.text,
          });
          messages.push({
            role: 'user',
            content:
              `Fix the following validation errors and return the complete HTML artifact:\n${
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
        ...(finalValid
          ? {
            judgePayload: {
              kind: 'html-source' as const,
              rawText: finalText,
            },
          }
          : {}),
      };
    },
  };
}
