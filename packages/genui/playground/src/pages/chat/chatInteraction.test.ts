// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { expect, test } from '@rstest/core';

import {
  appendChatInteraction,
  describeChatRequest,
  serializeChatInteraction,
} from './chatInteraction.js';
import type { ChatInteractionLog } from './type.js';

test('collects interleaved deltas in one raw output without duplicating timeline entries', () => {
  const start = appendChatInteraction(
    { entries: [], omittedEntries: 0 },
    'request',
    0,
    { model: 'test-model' },
  );
  const first = appendChatInteraction(start, 'delta', 20, { text: 'Hello ' });
  const second = appendChatInteraction(first, 'delta', 30, { text: 'world' });
  const message = appendChatInteraction(second, 'message', 40, {
    messages: [
      { createSurface: { surfaceId: 'main', catalogId: 'catalog-url' } },
      {
        updateComponents: {
          surfaceId: 'main',
          components: [
            { id: 'title', component: 'Text', text: 'Full component content' },
            { id: 'content', component: 'Loading', variant: 'block' },
          ],
        },
      },
      { updateDataModel: { surfaceId: 'main', path: '/weather', value: 22 } },
      { deleteSurface: { surfaceId: 'other' } },
      { updateDataModel: { surfaceId: 'other', value: 'Hidden value' } },
    ],
  });
  const next = appendChatInteraction(message, 'delta', 50, { text: '!' });
  const done = appendChatInteraction(next, 'done', 60, {
    text: 'Hello world!',
    finishReason: 'stop',
    validation: { ok: true, messages: [], errors: [], warnings: [] },
    usage: { totalTokens: 4 },
  });
  const usage = appendChatInteraction(done, 'usage', 61, { totalTokens: 4 });

  expect(first.rawOutput?.detail).toBe('Hello ');
  expect(second.rawOutput).toMatchObject({
    detail: 'Hello world',
    count: 2,
    elapsedMs: 20,
    truncated: false,
  });
  expect(message.entries[1]?.detail).toBe(
    'createSurface · main\n'
      + 'updateComponents · main · 2 components (1 loading): Text, Loading\n'
      + 'updateDataModel · main · /weather\n'
      + 'deleteSurface · other\n'
      + '+ 1 more message',
  );
  expect(serializeChatInteraction(message)).not.toContain(
    'Full component content',
  );
  expect(serializeChatInteraction(message)).not.toContain('catalog-url');
  expect(done.entries.map((entry) => entry.event)).toEqual([
    'request',
    'message',
    'done',
  ]);
  expect(done.rawOutput).toMatchObject({
    detail: 'Hello world!',
    count: 3,
    elapsedMs: 20,
  });
  expect(JSON.parse(done.entries[done.entries.length - 1]!.detail)).toEqual({
    finishReason: 'stop',
    validation: { ok: true, messageCount: 0, errors: [], warnings: [] },
  });
  const exported = JSON.parse(serializeChatInteraction(usage)) as {
    rawOutput?: unknown;
  };
  expect(exported.rawOutput).toEqual({
    elapsedMs: 20,
    count: 3,
    truncated: false,
  });
  expect(serializeChatInteraction(usage)).not.toContain('Hello world!');
  expect(serializeChatInteraction(usage).match(/totalTokens/g)).toHaveLength(1);
});

test('bounds long streams while retaining request context and the terminal failure', () => {
  let log: ChatInteractionLog = { entries: [], omittedEntries: 0 };
  log = appendChatInteraction(log, 'start', 0);
  log = appendChatInteraction(log, 'request', 1, { model: 'test-model' });
  log = appendChatInteraction(log, 'delta', 2, { text: 'First chunk' });
  for (let index = 0; index < 100; index++) {
    log = appendChatInteraction(log, 'response', index + 2, 'x'.repeat(15_000));
  }
  log = appendChatInteraction(log, 'error', 200, 'Stream disconnected');
  expect(log.entries).toHaveLength(80);
  expect(log.omittedEntries).toBe(23);
  expect(log.entries.slice(0, 2).map((entry) => entry.event)).toEqual([
    'start',
    'request',
  ]);
  expect(log.entries[2]).toMatchObject({ truncated: true });
  expect(log.entries[2]?.detail).toHaveLength(12_000);
  expect(log.entries[log.entries.length - 1]).toMatchObject({
    event: 'error',
    detail: 'Stream disconnected',
  });
  expect(log.rawOutput).toMatchObject({
    detail: 'First chunk',
    elapsedMs: 2,
    count: 1,
  });

  log = appendChatInteraction(log, 'delta', 210, { text: 'y'.repeat(15_000) });
  log = appendChatInteraction(log, 'delta', 220, { text: 'tail' });
  expect(log.rawOutput).toMatchObject({
    count: 3,
    truncated: true,
  });
  expect(log.rawOutput?.detail).toHaveLength(12_000);
  expect(log.entries[log.entries.length - 1]?.event).toBe('error');
});

test('keeps final validation diagnostics readable without mutating the full response', () => {
  const output = 'output '.repeat(5000);
  const payload = {
    text: output,
    metadata: { modelOutput: output, xmlFragment: output },
    finishReason: 'length',
    validation: {
      ok: false,
      messages: [{ updateComponents: { surfaceId: 'main', text: output } }],
      errors: ['Incomplete output'],
      warnings: ['Missing theme'],
    },
    usage: { totalTokens: 5000 },
    cachedTokens: 4000,
  };
  const original = JSON.stringify(payload);
  const log = appendChatInteraction(
    { entries: [], omittedEntries: 0 },
    'done',
    100,
    payload,
  );
  expect(log.entries.map((entry) => entry.event)).toEqual(['message', 'done']);
  expect(log.entries[1]?.truncated).toBe(false);
  expect(JSON.parse(log.entries[1]!.detail)).toEqual({
    finishReason: 'length',
    validation: {
      ok: false,
      messageCount: 1,
      errors: ['Incomplete output'],
      warnings: ['Missing theme'],
    },
  });
  expect(log.rawOutput?.truncated).toBe(true);
  expect(JSON.stringify(payload)).toBe(original);
});

test('preserves JSON-only text and summarizes its protocol messages', () => {
  const empty = { entries: [], omittedEntries: 0 };
  const textLog = appendChatInteraction(empty, 'json', 10, {
    ok: true,
    text: '<!doctype html><html>Example</html>',
    finishReason: 'stop',
    usage: { totalTokens: 12 },
  });
  expect(textLog.entries).toHaveLength(1);
  expect(JSON.parse(textLog.entries[0]!.detail)).toEqual({
    ok: true,
    finishReason: 'stop',
  });
  expect(textLog.rawOutput?.detail).toBe('<!doctype html><html>Example</html>');

  const messages = [{ createSurface: { surfaceId: 'main' } }];
  const messageLog = appendChatInteraction(empty, 'json', 10, {
    messages,
    usage: { totalTokens: 12 },
  });
  expect(messageLog.entries.map((entry) => entry.event)).toEqual([
    'message',
    'json',
  ]);
  expect(messageLog.entries[0]?.detail).toBe('createSurface · main');
  expect(messageLog.entries[1]?.detail).toBe('');
  expect(messageLog.rawOutput).toBeUndefined();
});

test('request diagnostics select metadata without retaining credentials or raw conversation payloads', () => {
  const details = describeChatRequest({
    url: 'https://user:password@example.com/a2ui/stream?token=url-secret',
    headers: { Authorization: 'Bearer header-secret' },
    body: {
      apiKey: 'body-secret',
      baseURL: 'https://private-provider.example.com/v1',
      model: 'test-model',
      enableDesignGuidance: false,
      messages: [{ role: 'user', content: 'private prompt' }],
      conversation: {
        history: [{ role: 'assistant', content: 'private history' }],
      },
    },
  });
  expect(details).toEqual({
    method: 'POST',
    path: '/a2ui/stream',
    model: 'test-model',
    messageCount: 1,
    historyMessageCount: 1,
    designGuidance: false,
  });
});
