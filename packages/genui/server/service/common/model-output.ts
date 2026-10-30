// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { modelConfigSensitiveValues } from './model-config.js';
import type { ChatOptions, ModelOutputEvent } from './types.js';

/** Stream visible model content without exposing provider metadata or split secrets. */
export function createModelOutput(opts: ChatOptions) {
  const secrets = opts.onModelOutput
    ? modelConfigSensitiveValues([opts.apiKey, opts.baseURL])
    : [];
  let pending: ModelOutputEvent | undefined;
  let text = '';
  const redact = (value: string) =>
    secrets.reduce(
      (result, secret) => result.replaceAll(secret, '[REDACTED]'),
      value,
    );
  const sanitize = (value: unknown): unknown => {
    if (typeof value === 'string') return redact(value);
    if (Array.isArray(value)) return value.map(item => sanitize(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).filter(([key]) =>
          !['providerMetadata', '__mastraMetadata', 'observability'].includes(
            key,
          )
        ).map(([key, item]) => [key, sanitize(item)]),
      );
    }
    return value;
  };
  const flush = () => {
    if (pending && text) {
      opts.onModelOutput?.({
        ...pending,
        payload: { ...pending.payload, text: redact(text) },
      });
    }
    pending = undefined;
    text = '';
  };
  return {
    flush,
    emit(event: ModelOutputEvent) {
      if (!opts.onModelOutput) return;
      const payload = sanitize(event.payload) as Record<string, unknown>;
      const next = { ...event, payload };
      if (
        !['text-delta', 'reasoning-delta', 'tool-call-delta'].includes(
          event.type,
        )
      ) {
        flush();
        opts.onModelOutput(next);
        return;
      }
      if (typeof event.payload.text !== 'string') return;
      if (
        pending && (pending.type !== event.type || pending.step !== event.step
          || pending.invocationId !== event.invocationId
          || pending.payload.id !== payload.id
          || pending.payload.toolCallId !== payload.toolCallId)
      ) flush();
      pending = next;
      text = redact(text + event.payload.text);
      // Retain only a suffix that might become a credential in the next chunk.
      let held = 0;
      for (const secret of secrets) {
        for (
          let length = Math.min(text.length, secret.length - 1);
          length > held;
          length--
        ) {
          if (text.endsWith(secret.slice(0, length))) {
            held = length;
            break;
          }
        }
      }
      const ready = text.slice(0, text.length - held);
      text = text.slice(text.length - held);
      if (ready) {
        opts.onModelOutput({ ...next, payload: { ...payload, text: ready } });
      }
    },
  };
}
