// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readBenchTokenUsage } from './bench/usage.js';
import { buildCompactGenerationMessages } from './generation-repair.js';
import type { ReasoningRecoverySettings } from './provider.js';
import {
  GenerationPostprocessError,
  GenerationUpstreamError,
  finalizeResult,
  toAsyncIterable,
} from './result.js';
import type { ChatMessage, ChatOptions, MastraStreamResult } from './types.js';

interface TextGenerationResult {
  text: string;
  usage: unknown;
  finishReason: unknown;
}

interface TextArtifact {
  text: string;
  metadata?: Record<string, unknown>;
}

interface TextRecoveryOptions<T extends TextArtifact> {
  initialMessages: readonly ChatMessage[];
  initialResult: MastraStreamResult;
  /** Total model invocations, including the initial stream. */
  maxAttempts: number;
  stream: (
    messages: ChatMessage[],
    settings?: ReasoningRecoverySettings,
  ) => Promise<MastraStreamResult>;
  reasoningRecovery?: {
    maxOutputTokens: number;
    retrySettings: ReasoningRecoverySettings;
  } | undefined;
  postprocess: (result: TextGenerationResult) => T;
  canContinue: (text: string) => boolean;
  abortSignal?: AbortSignal | undefined;
  onPerformanceEvent?: ChatOptions['onPerformanceEvent'];
}

// Bound retained source independently of the provider's token limit.
const MAX_CONTINUATION_CHARS = 128 * 1024;
const CONTINUATION_ANCHOR_CHARS = 128;

function exhaustedByReasoning(
  result: TextGenerationResult,
  maxOutputTokens: number,
): boolean {
  const usage = readBenchTokenUsage(result.usage);
  return result.text.trim().length === 0
    && Number.isSafeInteger(maxOutputTokens) && maxOutputTokens > 0
    && (usage.inputTokens ?? 0) > 0
    && usage.outputTokens === maxOutputTokens
    && usage.reasoningTokens === usage.outputTokens;
}

function isEmptyInputFailure(error: GenerationUpstreamError): boolean {
  // A narrowly observed compatible-provider failure, not a general 400 retry.
  // Keep the original error/finish reason; this does not prove its root cause.
  return error.statusCode === 400
    && /parameter\s+`input`.*not valid:\s*`<nil>`/iu.test(error.message);
}

async function hasNonTextOutput(result: MastraStreamResult): Promise<boolean> {
  try {
    const content = await Promise.resolve(result.content);
    return Array.isArray(content) && content.some((part: unknown) => {
      if (!part || typeof part !== 'object' || !('type' in part)) return false;
      // Do not replay tool work, refusals, or other non-text output as generation.
      return part.type !== 'reasoning' && part.type !== 'text';
    });
  } catch {
    // Unknown content must not hide the original failure or justify replaying it.
    return true;
  }
}

/**
 * Recover a truncated artifact or reasoning-only run at the service boundary.
 * Later attempts are buffered: a regenerated document must not be appended to
 * the already-streamed prefix. The caller publishes the validated final text.
 */
export function recoverTextGeneration<T extends TextArtifact>(
  options: TextRecoveryOptions<T>,
): {
  textStream: AsyncIterable<string>;
  finalize: () => Promise<T & TextGenerationResult>;
} {
  const {
    initialMessages,
    initialResult,
    stream,
    postprocess,
    canContinue,
    reasoningRecovery,
    abortSignal,
    onPerformanceEvent,
  } = options;
  const maxAttempts = Number.isFinite(options.maxAttempts)
    ? Math.min(3, Math.max(1, Math.floor(options.maxAttempts)))
    : 1;
  const attempts: {
    mode: 'initial' | 'continue' | 'regenerate';
    outputChars: number;
    usage: unknown;
    finishReason: unknown;
    error?: {
      name: string;
      statusCode?: number | undefined;
      upstreamRequestId?: string | undefined;
    };
  }[] = [];
  const totalUsage = () =>
    attempts.length === 1
      ? attempts[0]!.usage
      : readBenchTokenUsage(attempts.map(attempt => attempt.usage));
  let finalResult: (T & TextGenerationResult) | undefined;
  let failure: Error | undefined;
  let consumed = false;

  return {
    textStream: {
      [Symbol.asyncIterator]: async function*() {
        if (consumed) {
          throw new Error('Generation stream has already been consumed');
        }
        consumed = true;
        let current = initialResult;
        let mode: 'initial' | 'continue' | 'regenerate' = 'initial';
        let prefix = '';
        let anchor = '';
        let continued = false;
        let recovering = false;
        let retrySettings: ReasoningRecoverySettings | undefined;
        let recordedCurrentAttempt = false;
        try {
          for (let index = 1; index <= maxAttempts; index++) {
            abortSignal?.throwIfAborted();
            let streamedText = '';
            for await (const chunk of toAsyncIterable(current.textStream)) {
              abortSignal?.throwIfAborted();
              streamedText += chunk;
              if (index === 1) yield chunk;
            }
            abortSignal?.throwIfAborted();
            let upstreamError: GenerationUpstreamError | undefined;
            const completed = await finalizeResult(current).catch(error => {
              if (!(error instanceof GenerationUpstreamError)) throw error;
              upstreamError = error;
              return error.result;
            });
            const modelText = completed.text ?? streamedText;
            attempts.push({
              mode,
              outputChars: modelText.length,
              usage: completed.usage,
              finishReason: completed.finishReason,
              ...(upstreamError
                ? {
                  error: {
                    name: upstreamError.name,
                    statusCode: upstreamError.statusCode,
                    upstreamRequestId: upstreamError.upstreamRequestId,
                  },
                }
                : {}),
            });
            recordedCurrentAttempt = true;
            const result = {
              ...completed,
              text: modelText,
              usage: totalUsage(),
            };
            const recoverReasoning = reasoningRecovery !== undefined
              && retrySettings === undefined && index < maxAttempts
              && streamedText.trim().length === 0
              && (upstreamError
                ? isEmptyInputFailure(upstreamError)
                : completed.finishReason === 'length')
              && exhaustedByReasoning(
                { ...completed, text: modelText },
                reasoningRecovery.maxOutputTokens,
              )
              && !await hasNonTextOutput(current);
            if (upstreamError && !recoverReasoning) throw upstreamError;
            if (recoverReasoning) {
              retrySettings = reasoningRecovery.retrySettings;
              mode = 'regenerate';
              recovering = true;
              onPerformanceEvent?.('agent.recovery.started', {
                attempt: index + 1,
                maxAttempts,
                mode,
                reason: 'reasoning-only-output',
                previousFinishReason: completed.finishReason,
                previousOutputChars: modelText.length,
                ...retrySettings,
              });
              abortSignal?.throwIfAborted();
              recordedCurrentAttempt = false;
              current = await stream(
                buildCompactGenerationMessages(initialMessages),
                retrySettings,
              );
              continue;
            }
            let validationError: unknown;
            try {
              if (mode === 'continue') {
                // The model must echo the exact boundary, including whitespace.
                // Never guess overlaps or fabricate missing syntax.
                if (
                  !modelText.startsWith(anchor)
                  || modelText.length <= anchor.length
                ) {
                  throw new Error(
                    'Continuation did not match the source boundary or made no progress',
                  );
                }
                result.text = prefix + modelText.slice(anchor.length);
              }
              const artifact = postprocess(result);
              abortSignal?.throwIfAborted();
              finalResult = {
                ...result,
                ...artifact,
                ...(attempts.length > 1
                  ? {
                    metadata: {
                      ...artifact.metadata,
                      generationAttempts: attempts,
                    },
                  }
                  : {}),
              };
              return;
            } catch (error) {
              abortSignal?.throwIfAborted();
              validationError = error instanceof GenerationPostprocessError
                ? error.cause
                : error;
            }
            recovering ||= completed.finishReason === 'length';
            if (!recovering || index === maxAttempts) {
              throw new GenerationPostprocessError(validationError, result);
            }

            let messages: ChatMessage[];
            if (
              !continued
              && completed.finishReason === 'length'
              && modelText.length > 0
              && modelText.length <= MAX_CONTINUATION_CHARS
              && canContinue(modelText)
            ) {
              continued = true;
              mode = 'continue';
              prefix = modelText;
              anchor = prefix.slice(-CONTINUATION_ANCHOR_CHARS);
              messages = [
                ...initialMessages,
                { role: 'assistant', content: prefix },
                {
                  role: 'user',
                  content: [
                    'The artifact above was truncated by the output token limit.',
                    'Continue the same artifact. Start your response by repeating the exact suffix below, then append only the missing remainder.',
                    'Preserve every character of this boundary, including whitespace; it may end inside a string or token. Do not restart the document, add Markdown fences, or explain.',
                    'Complete the required content and actions concisely within this response.',
                    `Exact suffix (JSON string): ${JSON.stringify(anchor)}`,
                  ].join('\n'),
                },
              ];
            } else {
              mode = 'regenerate';
              messages = buildCompactGenerationMessages(initialMessages);
            }
            onPerformanceEvent?.('agent.recovery.started', {
              attempt: index + 1,
              maxAttempts,
              mode,
              previousFinishReason: completed.finishReason,
              previousOutputChars: modelText.length,
            });
            abortSignal?.throwIfAborted();
            recordedCurrentAttempt = false;
            current = await stream(messages, retrySettings);
          }
        } catch (error) {
          if (error instanceof GenerationUpstreamError) {
            if (!recordedCurrentAttempt) {
              attempts.push({
                mode,
                outputChars: error.result.text.length,
                usage: error.result.usage,
                finishReason: error.result.finishReason,
              });
            }
            failure = new GenerationUpstreamError(error, {
              ...error.result,
              usage: totalUsage(),
            });
          } else {
            failure = error instanceof Error
              ? error
              : new Error(String(error), { cause: error });
          }
        }
      },
    },
    finalize: () => {
      abortSignal?.throwIfAborted();
      if (failure !== undefined) return Promise.reject(failure);
      if (!finalResult) {
        return Promise.reject(new Error('Generation stream did not complete'));
      }
      return Promise.resolve(finalResult);
    },
  };
}
