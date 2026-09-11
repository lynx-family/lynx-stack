// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getA2UIAgentService } from './a2ui-agent.js';
import type { A2UIChatOptions } from './a2ui-agent.js';
import { resolveBenchCatalog } from './a2ui-bench-catalog.js';
import type { A2UICatalog } from '../../agent/a2ui/a2ui-catalog.js';
import {
  formatErrorsForModel,
  validateA2UIOutput,
} from '../../agent/a2ui/a2ui-validator.js';
import type { ArkImageGenerationRunScope } from '../../agent/common/ark-image-generation-tool.js';
import { createArkImageGenerationRunScope } from '../../agent/common/ark-image-generation-tool.js';
import type {
  ProtocolBenchAdapter,
  ProtocolBenchAdapterInput,
  ProtocolBenchRunArtifact,
} from '../common/bench/protocol-adapter.js';
import type { ProtocolBenchAttemptResult } from '../common/bench/protocol-types.js';
import {
  resolveBenchRetryDelay,
  waitForBenchRetry,
} from '../common/bench/retry.js';
import type { BenchRetrySleep } from '../common/bench/retry.js';
import { benchAttemptTokenCounts } from '../common/bench/usage.js';
import { GenerationUpstreamError } from '../common/result.js';
import type { ChatMessage } from '../common/types.js';

export type A2UIBenchGenerateRaw = (
  messages: ChatMessage[],
  options: A2UIChatOptions,
  signal?: AbortSignal,
  imageGenerationScope?: ArkImageGenerationRunScope,
) => Promise<{ text: string; usage: unknown; finishReason: unknown }>;

export type A2UIBenchRetrySleep = BenchRetrySleep;

export interface A2UIBenchAdapterOptions {
  generateRaw?: A2UIBenchGenerateRaw;
  retryDelayMs?: number;
  sleep?: A2UIBenchRetrySleep;
}

const MATCHED_CORE_COMPONENTS = new Set([
  'Text',
  'Row',
  'Column',
  'List',
  'Card',
  'Button',
  'Divider',
]);

function createMatchedCoreCatalog(): A2UICatalog {
  const base = resolveBenchCatalog('Full Catalog');
  const components = base.components.filter((component) =>
    MATCHED_CORE_COMPONENTS.has(component.name)
  );
  return {
    ...base,
    id: `${base.id}#matched-core`,
    label: 'Lynx GenUI matched core',
    components,
    examples: [],
    functions: [],
    extraRules: [
      ...(base.extraRules ?? []),
      `Matched-core track: use only ${
        components.map((component) => component.name).join(', ')
      }. Image and protocol-native extension components are excluded.`,
    ],
  };
}

function normalizedAttemptLimit(maxAttempts: number): number {
  if (!Number.isFinite(maxAttempts)) return 1;
  return Math.min(4, Math.max(1, Math.floor(maxAttempts)));
}

function buildPrompt(input: ProtocolBenchAdapterInput): string {
  return [
    'Generate one Lynx UI for the benchmark scenario below.',
    '',
    `Scenario name: ${input.scenario.name}`,
    `Scenario type: ${input.scenario.type}`,
    `Scenario complexity: ${input.scenario.complexity}`,
    input.scenario.action
      ? `Required action: ${input.scenario.action}`
      : undefined,
    '',
    'User request:',
    input.scenario.prompt,
    '',
    'Return only valid A2UI v0.9 protocol messages using the selected catalog.',
    'Do not include benchmark metadata in the generated UI.',
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n');
}

function abortedArtifact(message: string): ProtocolBenchRunArtifact {
  return {
    attempts: [],
    finalValid: false,
    finalErrors: [message],
  };
}

export function createA2UIBenchAdapter(
  options: A2UIBenchAdapterOptions = {},
): ProtocolBenchAdapter {
  const generateRaw = options.generateRaw
    ?? ((messages, chatOptions, signal, imageGenerationScope) =>
      getA2UIAgentService().generateRaw(
        messages,
        chatOptions,
        undefined,
        signal,
        imageGenerationScope,
      ));
  return {
    protocol: 'a2ui',
    async generate(input, signal) {
      if (signal?.aborted) {
        return abortedArtifact(
          'A2UI generation was cancelled before it started.',
        );
      }

      const catalog = createMatchedCoreCatalog();
      const messages: ChatMessage[] = [{
        role: 'user',
        content: buildPrompt(input),
      }];
      const attempts: ProtocolBenchAttemptResult[] = [];
      const warnings: string[] = [];
      let finalText = '';
      let finalErrors: string[] = [];
      let finalMessages: unknown[] | undefined;
      const maxAttempts = normalizedAttemptLimit(input.maxAttempts);
      const imageGenerationScope = createArkImageGenerationRunScope();

      for (let index = 1; index <= maxAttempts; index++) {
        if (signal?.aborted) {
          finalErrors = ['A2UI generation was cancelled.'];
          break;
        }

        const startedAt = performance.now();
        try {
          const generated = await generateRaw(
            messages,
            {
              resourceId: `genui-bench:${input.runId}:attempt-${index}`,
              apiKey: input.provider.apiKey,
              baseURL: input.provider.baseURL,
              model: input.provider.model,
              api: input.provider.api,
              catalog,
              disableAgentCache: true,
              maxRetries: 0,
              enableWebSearch: false,
              enableImageGeneration: false,
            },
            signal,
            imageGenerationScope,
          );
          const durationMs = Math.max(
            0,
            Math.round(performance.now() - startedAt),
          );
          finalText = generated.text;
          const validation = validateA2UIOutput(generated.text, catalog);
          finalErrors = validation.errors;
          warnings.push(...validation.warnings);
          const usage = benchAttemptTokenCounts(generated.usage);
          attempts.push({
            index,
            durationMs,
            ...usage,
            usage: generated.usage,
            valid: validation.ok,
            validationErrors: [...validation.errors],
            outputChars: generated.text.length,
            finishReason: generated.finishReason,
          });

          if (validation.ok) {
            finalMessages = validation.messages;
            break;
          }
          if (index < maxAttempts) {
            messages.push({ role: 'assistant', content: generated.text });
            messages.push({
              role: 'user',
              content: formatErrorsForModel(validation.errors),
            });
          }
        } catch (error) {
          signal?.throwIfAborted();
          const message = error instanceof Error
            ? error.message
            : String(error);
          finalErrors = [message];
          const failed = error instanceof GenerationUpstreamError
            ? error.result
            : undefined;
          attempts.push({
            index,
            durationMs: Math.max(
              0,
              Math.round(performance.now() - startedAt),
            ),
            ...benchAttemptTokenCounts(failed?.usage),
            ...(failed
              ? { usage: failed.usage, finishReason: failed.finishReason }
              : {}),
            valid: false,
            validationErrors: [message],
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

      return {
        attempts,
        finalValid: finalMessages !== undefined,
        ...(finalText ? { finalText } : {}),
        finalErrors,
        warnings,
        ...(finalMessages
          ? {
            judgePayload: {
              kind: 'a2ui-messages' as const,
              messages: finalMessages,
            },
          }
          : {}),
      };
    },
  };
}
