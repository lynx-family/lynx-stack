// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readBenchTokenUsage } from './bench/usage.js';
import type { BenchTokenUsage } from './bench/usage.js';
import type { JevModelInteraction } from '../../agent/common/jev-evaluator.js';

export interface TextModelInteraction {
  provider: 'text';
  status: 'started' | 'completed' | 'failed' | 'cancelled';
  durationMs?: number;
  response?: {
    tokenUsage: BenchTokenUsage;
    finishReason: unknown;
  };
  statusCode?: number;
}

export type ModelInteraction = JevModelInteraction | TextModelInteraction;

export async function withTextModelInteraction<
  T extends { usage?: unknown; finishReason?: unknown },
>(
  onModelInteraction: ((event: ModelInteraction) => void) | undefined,
  abortSignal: AbortSignal | undefined,
  action: () => Promise<{
    textStream: AsyncIterable<string>;
    finalize: () => Promise<T>;
  }>,
): Promise<{ textStream: AsyncIterable<string>; finalize: () => Promise<T> }> {
  if (!onModelInteraction) return action();
  const startedAt = performance.now();
  onModelInteraction({ provider: 'text', status: 'started' });
  let emitted = false;
  const emitEnd = (
    status: TextModelInteraction['status'],
    finalized?: T,
    error?: unknown,
  ) => {
    if (emitted) return;
    emitted = true;
    const statusCode =
      error && typeof error === 'object' && 'statusCode' in error
        && typeof error.statusCode === 'number'
        ? error.statusCode
        : undefined;
    onModelInteraction({
      provider: 'text',
      status,
      durationMs: performance.now() - startedAt,
      ...(finalized
        ? {
          response: {
            tokenUsage: readBenchTokenUsage(finalized.usage),
            finishReason: finalized.finishReason,
          },
        }
        : {}),
      ...(statusCode === undefined ? {} : { statusCode }),
    });
  };
  try {
    const result = await action();
    return {
      textStream: {
        async *[Symbol.asyncIterator]() {
          try {
            for await (const chunk of result.textStream) {
              yield chunk;
            }
          } catch (error) {
            emitEnd(
              abortSignal?.aborted ? 'cancelled' : 'failed',
              undefined,
              error,
            );
            throw error;
          }
        },
      },
      finalize: async () => {
        try {
          const finalized = await result.finalize();
          emitEnd('completed', finalized);
          return finalized;
        } catch (error) {
          emitEnd(
            abortSignal?.aborted ? 'cancelled' : 'failed',
            undefined,
            error,
          );
          throw error;
        }
      },
    };
  } catch (error) {
    emitEnd(
      abortSignal?.aborted ? 'cancelled' : 'failed',
      undefined,
      error,
    );
    throw error;
  }
}
