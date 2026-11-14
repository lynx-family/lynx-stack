// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, rstest, test } from '@rstest/core';

import { createModelOutput } from '../service/common/model-output.js';
import type { ModelOutputEvent } from '../service/common/types.js';

test('redacts split credentials without truncating model output or reordering tools', () => {
  const events: ModelOutputEvent[] = [];
  const output = createModelOutput({
    apiKey: 'private+/=key',
    onModelOutput: event => events.push(event),
  });
  const emit = (text: string) =>
    output.emit({
      invocationId: 'run',
      step: 1,
      type: 'reasoning-delta',
      payload: { id: 'r', text },
    });
  emit('Plan private+');
  expect(events.map(event => event.payload.text).join('')).toBe('Plan ');
  emit('/=key ');
  const encoded = encodeURIComponent('private+/=key');
  emit(encoded.slice(0, 8));
  emit(encoded.slice(8));
  emit('x'.repeat(80_000));
  emit('pri');
  output.emit({
    invocationId: 'run',
    step: 1,
    type: 'tool-call',
    payload: {
      toolCallId: 'call',
      args: { key: 'private+/=key', __mastraMetadata: { private: true } },
      providerMetadata: { encrypted: 'opaque provider state' },
    },
  });
  output.flush();
  expect(events.slice(0, -1).map(event => event.payload.text).join('')).toBe(
    'Plan [REDACTED] [REDACTED]' + 'x'.repeat(80_000) + 'pri',
  );
  expect(events.at(-1)?.payload).toEqual({
    toolCallId: 'call',
    args: { key: '[REDACTED]' },
  });
  expect(JSON.stringify(events)).not.toContain('opaque provider state');
});

test('scopes pending text to a request and flushes partial output on failure', () => {
  const first = rstest.fn();
  const second = rstest.fn();
  const a = createModelOutput({ apiKey: 'secret', onModelOutput: first });
  const b = createModelOutput({ onModelOutput: second });
  const event = {
    invocationId: 'run',
    step: 1,
    type: 'text-delta',
    payload: { text: 'sec' },
  };
  a.emit(event);
  expect(first).not.toHaveBeenCalled();
  b.emit(event);
  expect(second).toHaveBeenCalledWith(event);
  a.flush();
  expect(first).toHaveBeenCalledWith(event);
  a.flush();
  expect(first).toHaveBeenCalledTimes(1);
});
