// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readBenchTokenUsage } from './bench/usage.js';
import { resolveJevModel } from './jev-provider.js';
import { GenerationPostprocessError } from './result.js';
import type { ChatOptions } from './types.js';
import { createJevEvaluator } from '../../agent/common/jev-evaluator.js';
import type { JevEvaluationOptions } from '../../agent/common/jev-evaluator.js';

export interface JevCompositionChunk {
  /** The latest complete artifact, independently of the protocol's wire framing. */
  text: string;
  delta: string;
  step?: number;
}

/** One invocation owns its connection, deadline, diagnostics, usage and stream lifecycle. */
export function createJevCompositionStream(
  options: ChatOptions,
  abortSignal: AbortSignal | undefined,
  compose: (
    runtime: JevEvaluationOptions,
  ) => AsyncIterable<JevCompositionChunk>,
) {
  const config = resolveJevModel(options);
  if (!config) throw new Error('A TypeSafe model connection is required.');
  const closed = new AbortController();
  const signal = AbortSignal.any([
    ...(abortSignal ? [abortSignal] : []),
    AbortSignal.timeout(60_000),
    closed.signal,
  ]);
  const usage: unknown[] = [];
  let text = '';
  let consumed = false;
  let completed = false;
  const textStream: AsyncIterable<string> = {
    async *[Symbol.asyncIterator]() {
      if (consumed) {
        throw new Error('Jev composition can only be consumed once.');
      }
      consumed = true;
      try {
        signal.throwIfAborted();
        const runtime: JevEvaluationOptions = {
          signal,
          evaluate: createJevEvaluator(config, event => {
            options.onPerformanceEvent?.(`jev.model.${event.status}`, {
              ...event,
            });
            options.onModelInteraction?.(event);
          }),
          onUsage: value => usage.push(value),
        };
        for await (const chunk of compose(runtime)) {
          signal.throwIfAborted();
          text = chunk.text;
          yield chunk.delta;
          if (chunk.step !== undefined) {
            options.onPerformanceEvent?.('jev.composition.step', {
              step: chunk.step,
            });
          }
        }
        signal.throwIfAborted();
        completed = true;
      } catch (error) {
        const status =
          error && typeof error === 'object' && 'statusCode' in error
            ? error.statusCode
            : undefined;
        // Provider validation errors may contain private request/response bodies.
        const message = typeof status === 'number'
          ? `TypeSafe evaluation failed (HTTP ${status}).`
          : (error instanceof Error && error.name === 'Error'
            ? error.message
            : 'TypeSafe evaluation failed or timed out.');
        throw new GenerationPostprocessError(new Error(message), {
          text,
          usage: readBenchTokenUsage(usage),
          finishReason: 'error',
        });
      } finally {
        closed.abort();
      }
    },
  };
  return {
    textStream,
    finalize: () =>
      completed
        ? Promise.resolve({
          text,
          usage: readBenchTokenUsage(usage),
          finishReason: 'stop',
        })
        : Promise.reject(new Error('Jev composition has not completed.')),
  };
}

export async function consumeJevComposition(
  stream: ReturnType<typeof createJevCompositionStream>,
) {
  for await (const _chunk of stream.textStream) {
    /* Drain before finalizing. */
  }
  return stream.finalize();
}
