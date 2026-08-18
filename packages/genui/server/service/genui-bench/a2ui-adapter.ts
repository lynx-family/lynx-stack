// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { A2UICatalog } from '../../agent/a2ui-catalog';
import {
  formatErrorsForModel,
  validateA2UIOutput,
} from '../../agent/a2ui-validator';
import type { ArkImageGenerationRunScope } from '../../agent/ark-image-generation-tool.js';
import { createArkImageGenerationRunScope } from '../../agent/ark-image-generation-tool.js';
import { getA2UIAgentService } from '../a2ui-agent';
import type { A2UIChatOptions } from '../a2ui-agent';
import { resolveBenchCatalog } from '../a2ui-bench-catalog';
import type {
  ProtocolBenchAdapter,
  ProtocolBenchAdapterInput,
  ProtocolBenchRunArtifact,
} from './protocol-adapter';
import type { ProtocolBenchAttemptResult } from './types';
import type { ChatMessage } from '../common/types';

interface UsageRecord {
  promptTokens?: unknown;
  completionTokens?: unknown;
  totalTokens?: unknown;
  inputTokens?: unknown;
  outputTokens?: unknown;
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
  total_tokens?: unknown;
}

export type A2UIBenchGenerateRaw = (
  messages: ChatMessage[],
  options: A2UIChatOptions,
  signal?: AbortSignal,
  imageGenerationScope?: ArkImageGenerationRunScope,
) => Promise<{ text: string; usage: unknown; finishReason: unknown }>;

export type A2UIBenchRetrySleep = (
  delayMs: number,
  signal?: AbortSignal,
) => Promise<void>;

export interface A2UIBenchAdapterOptions {
  generateRaw?: A2UIBenchGenerateRaw;
  retryDelayMs?: number;
  sleep?: A2UIBenchRetrySleep;
}

const DEFAULT_TRANSPORT_RETRY_DELAY_MS = 10_000;

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

function pickToken(
  usage: UsageRecord,
  keys: (keyof UsageRecord)[],
): number {
  for (const key of keys) {
    const value = usage[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.round(value));
    }
  }
  return 0;
}

function readUsage(usage: unknown): {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
} {
  if (!usage || typeof usage !== 'object') {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  }
  const record = usage as UsageRecord;
  const inputTokens = pickToken(record, [
    'promptTokens',
    'inputTokens',
    'prompt_tokens',
  ]);
  const outputTokens = pickToken(record, [
    'completionTokens',
    'outputTokens',
    'completion_tokens',
  ]);
  const reportedTotal = pickToken(record, ['totalTokens', 'total_tokens']);
  return {
    inputTokens,
    outputTokens,
    totalTokens: reportedTotal || inputTokens + outputTokens,
  };
}

function normalizedAttemptLimit(maxAttempts: number): number {
  if (!Number.isFinite(maxAttempts)) return 1;
  return Math.min(4, Math.max(1, Math.floor(maxAttempts)));
}

function normalizedRetryDelayMs(retryDelayMs: number | undefined): number {
  if (retryDelayMs === undefined || !Number.isFinite(retryDelayMs)) {
    return DEFAULT_TRANSPORT_RETRY_DELAY_MS;
  }
  return Math.max(0, Math.floor(retryDelayMs));
}

function abortError(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException('The operation was aborted.', 'AbortError');
}

const defaultRetrySleep: A2UIBenchRetrySleep = (
  delayMs,
  signal,
) => {
  signal?.throwIfAborted();
  if (delayMs === 0) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);
    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      reject(signal ? abortError(signal) : new Error('Retry was aborted.'));
    };

    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
};

async function waitForTransportRetry(
  sleep: A2UIBenchRetrySleep,
  delayMs: number,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  if (!signal) {
    await sleep(delayMs);
    return;
  }

  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(abortError(signal));
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });

  try {
    await Promise.race([
      Promise.resolve().then(() => sleep(delayMs, signal)),
      aborted,
    ]);
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort);
  }
  signal.throwIfAborted();
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
  const retryDelayMs = normalizedRetryDelayMs(options.retryDelayMs);
  const sleep = options.sleep ?? defaultRetrySleep;
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
              enableWebSearch: false,
              inheritReasoningEffort: false,
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
          const usage = readUsage(generated.usage);
          attempts.push({
            index,
            durationMs,
            ...usage,
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
          attempts.push({
            index,
            durationMs: Math.max(
              0,
              Math.round(performance.now() - startedAt),
            ),
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            valid: false,
            validationErrors: [message],
            outputChars: 0,
          });
          if (index < maxAttempts) {
            await waitForTransportRetry(sleep, retryDelayMs, signal);
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
