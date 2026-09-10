// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { setTimeout as sleep } from 'node:timers/promises';

import { getLynxXmlAgentService } from './lynx-xml-agent.js';
import type { LynxXmlChatOptions } from './lynx-xml-agent.js';
import { normalizeLynxXmlArtifact } from '../../agent/lynx-xml/lynx-xml-output.js';
import type {
  ProtocolBenchAdapter,
  ProtocolBenchAdapterInput,
} from '../common/bench/protocol-adapter.js';
import type { ProtocolBenchAttemptResult } from '../common/bench/protocol-types.js';
import { benchAttemptTokenCounts } from '../common/bench/usage.js';
import {
  GenerationPostprocessError,
  GenerationUpstreamError,
} from '../common/result.js';
import type { ChatMessage } from '../common/types.js';

export interface LynxXmlBenchAdapterOptions {
  generateRaw?: (
    messages: ChatMessage[],
    options: LynxXmlChatOptions,
    signal?: AbortSignal,
  ) => Promise<
    {
      text: string;
      usage: unknown;
      finishReason: unknown;
      metadata?: { modelOutput: string };
    }
  >;
  retryDelayMs?: number;
}

function buildPrompt(input: ProtocolBenchAdapterInput): string {
  return [
    'Generate one self-contained Lynx XML UI for the benchmark scenario below.',
    `Scenario name: ${input.scenario.name}`,
    `Scenario type: ${input.scenario.type}`,
    `Scenario complexity: ${input.scenario.complexity}`,
    input.scenario.action ? `Required action: ${input.scenario.action}` : '',
    '',
    input.scenario.prompt,
    '',
    input.enableHtmlFragment === true
      ? 'Return the complete intermediate fragment document with one <template> directly inside <lynx>, plus styles and scripts, following the system fragment contract.'
      : 'Return only the complete Lynx XML artifact, without benchmark metadata.',
    'Use local content and interactions. Do not load external resources, open URLs, or use network requests. Use a non-image presentation for image requests.',
  ].join('\n');
}

export function createLynxXmlBenchAdapter(
  options: LynxXmlBenchAdapterOptions = {},
): ProtocolBenchAdapter {
  const generateRaw = options.generateRaw
    ?? ((messages, chatOptions, signal) =>
      getLynxXmlAgentService().generateRaw(
        messages,
        chatOptions,
        undefined,
        signal,
      ));
  const retryDelayMs = Number.isFinite(options.retryDelayMs)
    ? Math.max(0, options.retryDelayMs!)
    : 10_000;
  return {
    protocol: 'lynx-xml',
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
            enableWebSearch: false,
            enableImageGeneration: false,
            enableHtmlFragment: input.enableHtmlFragment === true,
            inheritReasoningEffort: false,
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
            if (index < maxAttempts) {
              await sleep(retryDelayMs, undefined, { signal });
            }
            continue;
          }
        }

        finalText = generated.text;
        try {
          if (postprocessError) throw postprocessError;
          finalText = normalizeLynxXmlArtifact(generated.text);
          finalErrors = [];
          finalValid = true;
        } catch (error) {
          finalErrors = [
            error instanceof Error ? error.message : String(error),
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
            content: generated.metadata?.modelOutput ?? generated.text,
          });
          messages.push({
            role: 'user',
            content:
              `Fix the following validation errors and return the complete Lynx XML artifact:\n${
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
              kind: 'lynx-xml-source' as const,
              rawText: finalText,
            },
          }
          : {}),
      };
    },
  };
}
