// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { A2UIChatOptions } from './a2ui-agent.js';
import { loadBasicCatalog } from '../../agent/a2ui/a2ui-catalog.js';
import { createA2UIImageSourcePolicy } from '../../agent/a2ui/a2ui-image-source-policy.js';
import {
  createA2UIOpenURLPolicy,
  userProvidedA2UIURLSources,
} from '../../agent/a2ui/a2ui-open-url-policy.js';
import { composeJevA2UI } from '../../agent/a2ui/jev-composer.js';
import {
  CUSTOM_JEV_BASE_URL,
  isCustomJevBaseURL,
} from '../../agent/common/custom-provider-security.js';
import { createJevEvaluator } from '../../agent/common/jev-evaluator.js';
import { readBenchTokenUsage } from '../common/bench/usage.js';
import { readModelConfig } from '../common/model-config.js';
import { GenerationPostprocessError } from '../common/result.js';
import type { ChatMessage, ConversationContext } from '../common/types.js';

export function resolveJevModel(opts: A2UIChatOptions) {
  if ([opts.model, opts.apiKey, opts.baseURL].every(value => value?.trim())) {
    if (!isCustomJevBaseURL(opts.baseURL!.trim())) return undefined;
    return {
      apiKey: opts.apiKey!.trim(),
      baseURL: CUSTOM_JEV_BASE_URL,
      model: opts.model!.trim(),
      requestScoped: true,
    };
  }
  const result = readModelConfig();
  if (!result.ok) return undefined;
  const config = result.config.models[opts.model ?? '']
    ?? result.config.models[result.config.defaultModel];
  return config?.provider === 'typesafe' ? config : undefined;
}

export async function streamJevComposition(
  messages: ChatMessage[],
  opts: A2UIChatOptions,
  conversation?: ConversationContext,
  abortSignal?: AbortSignal,
) {
  const config = resolveJevModel(opts);
  if (!config) throw new Error('A TypeSafe model connection is required.');
  const catalog = opts.catalog ?? await loadBasicCatalog();
  const signal = AbortSignal.any([
    ...(abortSignal ? [abortSignal] : []),
    AbortSignal.timeout(60_000),
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
      let snapshots = 0;
      try {
        const validationOptions = {
          isImageSourceAllowed: createA2UIImageSourcePolicy([
            messages,
            conversation,
            catalog,
          ]),
          isOpenUrlAllowed: createA2UIOpenURLPolicy(
            userProvidedA2UIURLSources(messages, conversation?.history),
          ),
        };
        for await (
          const snapshot of composeJevA2UI({
            messages,
            conversation,
            catalog,
            validationOptions,
            signal,
            enableDesignGuidance: opts.enableDesignGuidance,
            hostedMcpApps: opts.hostedMcpApps,
            evaluate: createJevEvaluator(config, event => {
              opts.onPerformanceEvent?.(`jev.model.${event.status}`, {
                ...event,
              });
              opts.onModelInteraction?.(event);
            }),
            onUsage: value => usage.push(value),
          })
        ) {
          signal.throwIfAborted();
          text = JSON.stringify(snapshot);
          const delta = snapshots === 0 ? snapshot : snapshot.slice(2);
          yield `${snapshots === 0 ? '[' : ','}${
            delta.map(item => JSON.stringify(item)).join(',')
          }`;
          snapshots++;
          opts.onPerformanceEvent?.('jev.composition.step', {
            step: snapshots,
          });
        }
        signal.throwIfAborted();
        completed = true;
        yield ']';
      } catch (error) {
        const status =
          error && typeof error === 'object' && 'statusCode' in error
            ? error.statusCode
            : undefined;
        // SDK validation errors may include provider response bodies. Do not expose them.
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
      }
    },
  };
  return {
    textStream,
    finalize: () => {
      if (!completed) {
        return Promise.reject(new Error('Jev composition has not completed.'));
      }
      return Promise.resolve({
        text,
        usage: readBenchTokenUsage(usage),
        finishReason: 'stop',
      });
    },
  };
}

export async function generateJevComposition(
  messages: ChatMessage[],
  opts: A2UIChatOptions,
  conversation?: ConversationContext,
  signal?: AbortSignal,
) {
  const stream = await streamJevComposition(
    messages,
    opts,
    conversation,
    signal,
  );
  for await (
    const _chunk of stream.textStream
  ) { /* Drain the composition phases. */ }
  return stream.finalize();
}
