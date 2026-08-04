// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ChatMessage } from './common/types';
import type {
  ProtocolBenchAdapter,
  ProtocolBenchAdapterInput,
  ProtocolBenchProviderConfig,
  ProtocolBenchRunArtifact,
} from './genui-bench/protocol-adapter';
import type {
  ProtocolBenchAttemptResult,
  ProtocolBenchScenario,
} from './genui-bench/types';
import { getOpenUIAgentService } from './openui-agent';
import type { OpenUIChatOptions } from './openui-agent';
import {
  OPENUI_BENCH_MATCHED_COMPONENTS,
  OPENUI_BENCH_ROOT_COMPONENT,
  createOpenUIBenchValidator,
} from './openui-bench-validator';
import type {
  OpenUIBenchComplexity,
  OpenUIBenchValidationError,
  OpenUIBenchValidationResult,
  OpenUIBenchValidator,
} from './openui-bench-validator';

export { OPENUI_BENCH_MATCHED_COMPONENTS, OPENUI_BENCH_ROOT_COMPONENT };

export interface OpenUIBenchUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface OpenUIBenchGenerationResult {
  text: string;
  usage: unknown;
  finishReason: unknown;
}

export type OpenUIBenchGenerateRaw = (
  messages: ChatMessage[],
  options: OpenUIChatOptions,
  signal?: AbortSignal,
) => Promise<OpenUIBenchGenerationResult>;

export type OpenUIBenchRetrySleep = (
  delayMs: number,
  signal?: AbortSignal,
) => Promise<void>;

export interface OpenUIBenchGenerateAttemptInput {
  index: number;
  messages: ChatMessage[];
  provider: ProtocolBenchProviderConfig;
  resourceId: string;
  signal?: AbortSignal;
}

export interface OpenUIBenchAttemptResult extends ProtocolBenchAttemptResult {
  rawText: string;
  usage: unknown;
  normalizedUsage: OpenUIBenchUsage;
  normalizedErrors: OpenUIBenchValidationError[];
  warnings: string[];
  complexity: OpenUIBenchComplexity;
  generationFailed: boolean;
}

export interface OpenUIBenchRunArtifact extends ProtocolBenchRunArtifact {
  attempts: OpenUIBenchAttemptResult[];
  rawText: string;
  normalizedErrors: OpenUIBenchValidationError[];
  complexity: OpenUIBenchComplexity;
  totalUsage: OpenUIBenchUsage;
  totalLatencyMs: number;
  attemptCount: number;
  finalFinishReason?: unknown;
}

export interface OpenUIBenchAdapter extends ProtocolBenchAdapter {
  readonly protocol: 'openui';
  readonly componentNames: readonly string[];
  validate(rawText: string): OpenUIBenchValidationResult;
  generateAttempt(
    input: OpenUIBenchGenerateAttemptInput,
  ): Promise<OpenUIBenchAttemptResult>;
  generate(
    input: ProtocolBenchAdapterInput,
    signal?: AbortSignal,
  ): Promise<OpenUIBenchRunArtifact>;
}

export interface OpenUIBenchAdapterOptions {
  generateRaw?: OpenUIBenchGenerateRaw;
  now?: () => number;
  retryDelayMs?: number;
  sleep?: OpenUIBenchRetrySleep;
  validator?: OpenUIBenchValidator;
}

const DEFAULT_TRANSPORT_RETRY_DELAY_MS = 10_000;

export const OPENUI_BENCH_SYSTEM_APPENDIX = [
  'Matched-core benchmark constraints (these override any broader catalog examples above):',
  `- The root component is ${OPENUI_BENCH_ROOT_COMPONENT}.`,
  `- Use only these components: ${OPENUI_BENCH_MATCHED_COMPONENTS.join(', ')}.`,
  '- Do not use Query(), Mutation(), external tools, remote resources, or URL-opening actions.',
  '- Return one complete OpenUI v0.5 program as plain text.',
  '- Do not wrap the program in Markdown fences and do not add prose.',
].join('\n');

export const OPENUI_BENCH_CAPABILITY_PROFILE = 'matched-core-v1';

export const OPENUI_BENCH_MATCHED_CAPABILITIES = Object.freeze(
  [
    'vertical-layout',
    'horizontal-layout',
    'list',
    'card',
    'text',
    'button-action',
    'divider',
  ] as const,
);

export const OPENUI_BENCH_PROMPT_OPTIONS: NonNullable<
  OpenUIChatOptions['promptOptions']
> = {
  bindings: false,
  toolCalls: false,
  examples: [],
};

interface UsageRecord {
  promptTokens?: unknown;
  completionTokens?: unknown;
  totalTokens?: unknown;
  inputTokens?: unknown;
  outputTokens?: unknown;
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
  total_tokens?: unknown;
  input_tokens?: unknown;
  output_tokens?: unknown;
}

function pickTokenCount(
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

export function normalizeOpenUIBenchUsage(usage: unknown): OpenUIBenchUsage {
  if (usage === null || typeof usage !== 'object' || Array.isArray(usage)) {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  }
  const record = usage as UsageRecord;
  const inputTokens = pickTokenCount(record, [
    'inputTokens',
    'promptTokens',
    'input_tokens',
    'prompt_tokens',
  ]);
  const outputTokens = pickTokenCount(record, [
    'outputTokens',
    'completionTokens',
    'output_tokens',
    'completion_tokens',
  ]);
  const reportedTotal = pickTokenCount(record, [
    'totalTokens',
    'total_tokens',
  ]);
  return {
    inputTokens,
    outputTokens,
    totalTokens: reportedTotal || inputTokens + outputTokens,
  };
}

function sumUsage(attempts: OpenUIBenchAttemptResult[]): OpenUIBenchUsage {
  return attempts.reduce<OpenUIBenchUsage>(
    (total, attempt) => ({
      inputTokens: total.inputTokens + attempt.normalizedUsage.inputTokens,
      outputTokens: total.outputTokens + attempt.normalizedUsage.outputTokens,
      totalTokens: total.totalTokens + attempt.normalizedUsage.totalTokens,
    }),
    { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
  );
}

export function buildOpenUIBenchPrompt(
  scenario: ProtocolBenchScenario,
): string {
  return [
    'Generate one OpenUI v0.5 UI for the following benchmark scenario.',
    '',
    `Scenario name: ${scenario.name}`,
    `Scenario type: ${scenario.type}`,
    `Scenario complexity: ${scenario.complexity}`,
    scenario.action ? `Required action: ${scenario.action}` : undefined,
    '',
    'User request:',
    scenario.prompt,
    '',
    'Benchmark constraints:',
    `- Assign the renderable root to ${OPENUI_BENCH_ROOT_COMPONENT}.`,
    `- Use only: ${OPENUI_BENCH_MATCHED_COMPONENTS.join(', ')}.`,
    '- Return only a complete OpenUI v0.5 program.',
    '- Do not use Query, Mutation, external tools, external URLs, or benchmark metadata.',
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n');
}

export function formatOpenUIBenchError(
  error: OpenUIBenchValidationError,
): string {
  const location = [
    error.statementId ? `statement=${error.statementId}` : undefined,
    error.component ? `component=${error.component}` : undefined,
    error.path ? `path=${error.path}` : undefined,
  ].filter((part): part is string => part !== undefined).join(' ');
  return `[${error.code}]${location ? ` ${location}` : ''} ${error.message}${
    error.hint ? ` Fix: ${error.hint}` : ''
  }`;
}

export function formatOpenUIBenchRepairPrompt(
  errors: OpenUIBenchValidationError[],
): string {
  return [
    'Your previous response is not a valid matched-core OpenUI v0.5 program.',
    'Return the entire corrected program, not a patch.',
    'Output only plain OpenUI code without Markdown fences or commentary.',
    '',
    'Validation errors:',
    ...errors.map((error) => `- ${formatOpenUIBenchError(error)}`),
  ].join('\n');
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

const defaultRetrySleep: OpenUIBenchRetrySleep = (
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
  sleep: OpenUIBenchRetrySleep,
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

function redactMessage(
  error: unknown,
  secrets: (string | undefined)[],
): string {
  let message = error instanceof Error ? error.message : String(error);
  for (const secret of secrets) {
    if (secret) message = message.replaceAll(secret, '[REDACTED]');
  }
  return message.replace(/https?:\/\/[^\s"'<>]+/giu, '[REDACTED_URL]');
}

class DefaultOpenUIBenchAdapter implements OpenUIBenchAdapter {
  public readonly protocol = 'openui' as const;
  public readonly componentNames: readonly string[];

  private readonly generateRaw: OpenUIBenchGenerateRaw;
  private readonly now: () => number;
  private readonly retryDelayMs: number;
  private readonly sleep: OpenUIBenchRetrySleep;
  private readonly validator: OpenUIBenchValidator;

  public constructor(options: OpenUIBenchAdapterOptions) {
    this.generateRaw = options.generateRaw
      ?? ((messages, agentOptions, signal) =>
        getOpenUIAgentService().generateRaw(
          messages,
          agentOptions,
          undefined,
          signal,
        ));
    this.now = options.now ?? (() => performance.now());
    this.retryDelayMs = normalizedRetryDelayMs(options.retryDelayMs);
    this.sleep = options.sleep ?? defaultRetrySleep;
    this.validator = options.validator ?? createOpenUIBenchValidator();
    this.componentNames = this.validator.componentNames;
  }

  public validate(rawText: string): OpenUIBenchValidationResult {
    return this.validator.validate(rawText);
  }

  public async generateAttempt(
    input: OpenUIBenchGenerateAttemptInput,
  ): Promise<OpenUIBenchAttemptResult> {
    input.signal?.throwIfAborted();
    const startedAt = this.now();
    let generated: OpenUIBenchGenerationResult;
    try {
      generated = await this.generateRaw(input.messages, {
        ...input.provider,
        disableAgentCache: true,
        inheritReasoningEffort: false,
        resourceId: input.resourceId,
        promptComponentNames: OPENUI_BENCH_MATCHED_COMPONENTS,
        promptOptions: OPENUI_BENCH_PROMPT_OPTIONS,
        promptRoot: OPENUI_BENCH_ROOT_COMPONENT,
        systemAppendix: OPENUI_BENCH_SYSTEM_APPENDIX,
      }, input.signal);
    } catch (error) {
      input.signal?.throwIfAborted();
      const durationMs = Math.max(0, this.now() - startedAt);
      const normalizedError: OpenUIBenchValidationError = {
        source: 'generation',
        code: 'generation-error',
        message: redactMessage(error, [input.provider.apiKey]),
        hint:
          'Retry the benchmark run after checking the configured model endpoint.',
      };
      const emptyValidation = this.validator.validate('');
      return {
        index: input.index,
        durationMs,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        valid: false,
        validationErrors: [formatOpenUIBenchError(normalizedError)],
        outputChars: 0,
        rawText: '',
        usage: undefined,
        normalizedUsage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
        normalizedErrors: [normalizedError],
        warnings: [],
        complexity: emptyValidation.complexity,
        generationFailed: true,
      };
    }

    input.signal?.throwIfAborted();
    const durationMs = Math.max(0, this.now() - startedAt);
    const validation = this.validator.validate(generated.text);
    const normalizedUsage = normalizeOpenUIBenchUsage(generated.usage);
    return {
      index: input.index,
      durationMs,
      inputTokens: normalizedUsage.inputTokens,
      outputTokens: normalizedUsage.outputTokens,
      totalTokens: normalizedUsage.totalTokens,
      valid: validation.valid,
      validationErrors: validation.errors.map((error) =>
        formatOpenUIBenchError(error)
      ),
      outputChars: generated.text.length,
      ...(generated.finishReason === undefined
        ? {}
        : { finishReason: generated.finishReason }),
      rawText: generated.text,
      usage: generated.usage,
      normalizedUsage,
      normalizedErrors: validation.errors,
      warnings: validation.warnings,
      complexity: validation.complexity,
      generationFailed: false,
    };
  }

  public async generate(
    input: ProtocolBenchAdapterInput,
    signal?: AbortSignal,
  ): Promise<OpenUIBenchRunArtifact> {
    const attempts: OpenUIBenchAttemptResult[] = [];
    const messages: ChatMessage[] = [{
      role: 'user',
      content: buildOpenUIBenchPrompt(input.scenario),
    }];
    const maxAttempts = normalizedAttemptLimit(input.maxAttempts);

    for (let index = 1; index <= maxAttempts; index += 1) {
      const attempt = await this.generateAttempt({
        index,
        messages,
        provider: input.provider,
        resourceId: `bench:${input.runId}:attempt:${index}`,
        ...(signal ? { signal } : {}),
      });
      attempts.push(attempt);
      if (attempt.valid) break;
      if (attempt.generationFailed) {
        if (index < maxAttempts) {
          await waitForTransportRetry(
            this.sleep,
            this.retryDelayMs,
            signal,
          );
          continue;
        }
        break;
      }
      if (index < maxAttempts) {
        messages.push({ role: 'assistant', content: attempt.rawText });
        messages.push({
          role: 'user',
          content: formatOpenUIBenchRepairPrompt(attempt.normalizedErrors),
        });
      }
    }

    const finalAttempt = attempts[attempts.length - 1];
    if (!finalAttempt) {
      throw new Error('OpenUI benchmark did not execute a generation attempt.');
    }
    const finalValid = finalAttempt.valid;
    const totalUsage = sumUsage(attempts);
    const totalLatencyMs = attempts.reduce(
      (total, attempt) => total + attempt.durationMs,
      0,
    );
    const finalErrors = finalAttempt.normalizedErrors.map(
      (error) => formatOpenUIBenchError(error),
    );

    return {
      attempts,
      finalValid,
      ...(finalAttempt.rawText ? { finalText: finalAttempt.rawText } : {}),
      finalErrors,
      warnings: finalAttempt.warnings,
      ...(finalValid
        ? {
          judgePayload: {
            kind: 'openui-text' as const,
            rawText: finalAttempt.rawText,
          },
        }
        : {}),
      metadata: {
        protocol: this.protocol,
        rootComponent: OPENUI_BENCH_ROOT_COMPONENT,
        matchedComponents: [...this.componentNames],
        matchedCapabilities: [...OPENUI_BENCH_MATCHED_CAPABILITIES],
        capabilityProfile: OPENUI_BENCH_CAPABILITY_PROFILE,
        policy: 'resource-safe-matched-core',
        attemptCount: attempts.length,
        totalInputTokens: totalUsage.inputTokens,
        totalOutputTokens: totalUsage.outputTokens,
        totalTokens: totalUsage.totalTokens,
        totalLatencyMs,
        complexity: finalAttempt.complexity,
      },
      rawText: finalAttempt.rawText,
      normalizedErrors: finalAttempt.normalizedErrors,
      complexity: finalAttempt.complexity,
      totalUsage,
      totalLatencyMs,
      attemptCount: attempts.length,
      ...(finalAttempt.finishReason === undefined
        ? {}
        : { finalFinishReason: finalAttempt.finishReason }),
    };
  }
}

export function createOpenUIBenchAdapter(
  options: OpenUIBenchAdapterOptions = {},
): OpenUIBenchAdapter {
  return new DefaultOpenUIBenchAdapter(options);
}
