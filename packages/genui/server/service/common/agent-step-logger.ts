// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { randomUUID } from 'node:crypto';

import type {
  LLMStepResult,
  MastraOnFinishCallbackArgs,
} from '@mastra/core/stream';

import { readBenchTokenUsage, sumBenchTokenUsage } from './bench/usage.js';
import type { BenchTokenUsage } from './bench/usage.js';
import { redactModelConfigSecrets } from './model-config.js';
import { resolveReasoningEffort } from './provider.js';
import type { ChatOptions } from './types.js';

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function serializedChars(value: unknown): number | undefined {
  if (typeof value === 'string') return value.length;
  try {
    return JSON.stringify(value)?.length;
  } catch {
    return undefined;
  }
}

function fieldSizes(value: unknown) {
  return Object.fromEntries(
    Object.entries(record(value)).map(([key, item]) => [key, {
      chars: serializedChars(item),
      ...(Array.isArray(item)
        ? { items: item.length }
        : (item !== null && typeof item === 'object'
          ? { entries: Object.keys(item).length }
          : {})),
    }]),
  );
}

/** Error objects can contain request bodies and tool inputs; select diagnostics only. */
function errorDetails(
  value: unknown,
  opts: ChatOptions,
  depth = 0,
): Record<string, unknown> {
  const error = record(value);
  const sanitize = (text: string) =>
    redactModelConfigSecrets(text, [opts.apiKey, opts.baseURL])
      .replace(/Value: [\s\S]*?(?=Error message:|$)/gu, 'Value: [omitted]. ')
      .slice(0, 1000);
  const message = [value, error.message, record(error.details).errorMessage]
    .find((candidate): candidate is string =>
      typeof candidate === 'string' && candidate.trim().length > 0
    );
  const nested = error.cause ?? error.error;
  const headers = record(error.responseHeaders);
  const requestId = Object.entries(headers).find(([name, header]) =>
    name.toLowerCase() === 'x-request-id' && typeof header === 'string'
  )?.[1];
  const contentType = Object.entries(headers).find(([name, header]) =>
    name.toLowerCase() === 'content-type' && typeof header === 'string'
  )?.[1];
  // SDK JSON parse errors and their SyntaxError causes quote the response body.
  const jsonParseError = error.name === 'AI_JSONParseError';
  return {
    ...(typeof error.name === 'string' ? { name: sanitize(error.name) } : {}),
    ...(typeof error.code === 'string' ? { code: sanitize(error.code) } : {}),
    ...(typeof error.statusCode === 'number'
        && Number.isInteger(error.statusCode)
        && error.statusCode >= 100 && error.statusCode <= 599
      ? { statusCode: error.statusCode }
      : {}),
    ...(typeof requestId === 'string'
      ? { upstreamRequestId: sanitize(requestId) }
      : {}),
    ...(typeof contentType === 'string'
      ? { responseContentType: sanitize(contentType) }
      : {}),
    ...(typeof error.responseBody === 'string'
      ? { responseBodyChars: error.responseBody.length }
      : {}),
    message: jsonParseError
      ? 'JSON parsing failed.'
      : (message
        ? sanitize(message)
        : 'Operation failed; no error message was provided'),
    ...(!jsonParseError && nested !== undefined && nested !== value && depth < 2
      ? { cause: errorDetails(nested, opts, depth + 1) }
      : {}),
  };
}

function readUsage(usage: LLMStepResult['usage']): BenchTokenUsage {
  return {
    ...readBenchTokenUsage(usage?.raw),
    ...readBenchTokenUsage(usage),
    ...(typeof usage?.cacheCreationInputTokens === 'number'
        && Number.isFinite(usage.cacheCreationInputTokens)
        && usage.cacheCreationInputTokens >= 0
      ? { cacheWriteTokens: usage.cacheCreationInputTokens }
      : {}),
  };
}

function requestSizes(body: unknown): Record<string, unknown> {
  let parsed: unknown = body;
  if (typeof body === 'string') {
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = undefined;
    }
  }
  const request = record(parsed);
  const messages = Array.isArray(request.messages)
    ? request.messages
    : (Array.isArray(request.input)
      ? request.input
      : undefined);
  return {
    requestBodyChars: serializedChars(body),
    instructionsChars: serializedChars(request.instructions ?? request.system),
    toolSchemasChars: serializedChars(request.tools),
    messageCount: messages?.length,
    messagesChars: serializedChars(messages ?? request.input),
    // Aggregate lengths only: never emit prompts, tool arguments, or request bodies.
    systemMessagesChars: messages
      ? serializedChars(
        messages.filter((message) =>
          record(message).role === 'system'
          || record(message).role === 'developer'
        ),
      )
      : undefined,
  };
}

/** One logger per invocation; cached agents must not share step counters. */
export function createAgentStepLogger<OUTPUT = undefined>(
  opts: ChatOptions,
  agent: string,
  configuration?: Record<string, boolean>,
) {
  const invocationId = randomUUID();
  const reasoningEffort = resolveReasoningEffort(opts);
  const startedAt = performance.now();
  let previousStepAt = startedAt;
  const usages: BenchTokenUsage[] = [];
  const emit = (event: string, details: Record<string, unknown>) => {
    const payload = {
      agent,
      invocationId,
      resourceId: opts.resourceId,
      model: opts.model,
      reasoningEffort,
      configuration,
      ...details,
    };
    if (opts.onPerformanceEvent) opts.onPerformanceEvent(event, payload);
    else console.info('[genui:agent]', JSON.stringify({ event, ...payload }));
  };
  emit('agent.model.started', {});
  return {
    // A direct SDK failure can throw before Mastra invokes onFinish.
    onError({ error }: { error: unknown }) {
      emit('agent.model.error', {
        failed: true,
        stepCount: usages.length,
        durationMs: Math.round(performance.now() - startedAt),
        stepUsageTotal: sumBenchTokenUsage(usages),
        error: errorDetails(error, opts),
      });
    },
    onStepFinish(step: LLMStepResult<OUTPUT> & { runId?: string }) {
      const now = performance.now();
      const usage = readUsage(step.usage);
      usages.push(usage);
      const toolErrors = new Map<string, Record<string, unknown>>();
      const addToolError = (
        toolCallId: string,
        toolName: string,
        error: unknown,
      ) => {
        toolErrors.set(toolCallId, {
          toolCallId,
          toolName,
          error: errorDetails(error, opts),
        });
      };
      // Mastra omits tool-error chunks from toolResults, but preserves them in
      // step content as tool results with error-text/error-json output.
      for (const part of step.content ?? []) {
        if (part.type === 'tool-error') {
          addToolError(part.toolCallId, part.toolName, part.error);
        }
        if (part.type === 'tool-result') {
          const output = record(part.output);
          if (output.type === 'error-text' || output.type === 'error-json') {
            addToolError(part.toolCallId, part.toolName, output.value);
          }
        }
      }
      for (const { payload } of step.toolResults) {
        if (payload.isError) {
          addToolError(payload.toolCallId, payload.toolName, payload.result);
        }
      }
      emit('agent.model.step.completed', {
        runId: step.runId,
        step: usages.length,
        stepType: step.stepType,
        durationMs: Math.round(now - previousStepAt),
        elapsedMs: Math.round(now - startedAt),
        upstreamModel: step.response?.modelId,
        finishReason: step.finishReason,
        usage,
        ...requestSizes(step.request?.body),
        outputTextChars: step.text?.length,
        reasoningTextChars: step.reasoningText?.length,
        toolErrors: [...toolErrors.values()],
        toolCalls: step.toolCalls.map(({ payload }) => ({
          toolCallId: payload.toolCallId,
          toolName: payload.toolName,
          argumentsChars: serializedChars(payload.args),
          argumentSizes: fieldSizes(payload.args),
        })),
        toolResults: step.toolResults.map(({ payload }) => ({
          toolCallId: payload.toolCallId,
          toolName: payload.toolName,
          status: payload.isError ? 'error' : 'success',
          resultChars: serializedChars(payload.result),
          resultSizes: fieldSizes(payload.result),
        })),
      });
      previousStepAt = now;
    },
    onFinish(result: MastraOnFinishCallbackArgs<OUTPUT>) {
      emit('agent.model.completed', {
        runId: result.runId,
        stepCount: usages.length,
        reportedStepCount: result.steps?.length,
        durationMs: Math.round(performance.now() - startedAt),
        finishReason: result.finishReason,
        failed: result.error != null || result.finishReason === 'error',
        ...(result.error == null
          ? {}
          : { error: errorDetails(result.error, opts) }),
        stepUsageTotal: sumBenchTokenUsage(usages),
        totalUsage: readUsage(result.totalUsage),
      });
    },
  };
}
