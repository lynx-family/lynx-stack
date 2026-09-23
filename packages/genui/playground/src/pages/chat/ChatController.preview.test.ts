// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/** @rstest-environment jsdom */
/* eslint-disable n/no-unsupported-features/node-builtins -- Tests use browser streaming APIs in jsdom. */
import { afterEach, beforeEach, expect, rstest, test } from '@rstest/core';
import 'fake-indexeddb/auto';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import { A2UI_CHAT_ADAPTER } from './a2ui.js';
import type { A2UIAction, A2UIOutput, A2UIStreamState } from './a2ui.js';
import { ChatController } from './ChatController.js';
import type { ProviderSettings } from './shared.js';
import {
  getActiveConversationId,
  loadConversation,
} from '../../storage/conversationRepo.js';
import { getDB } from '../../storage/db.js';
import type { PreviewPerformanceMetrics } from '../../storage/types.js';
import { PROTOCOLS } from '../../utils/protocol.js';

rstest.mock('../../components/QrCode.js', () => ({ QrCode: () => null }));

const create = {
  version: 'v0.9',
  createSurface: { surfaceId: 'main', catalogId: 'catalog' },
};
const update = (text: string) => ({
  version: 'v0.9',
  updateComponents: {
    surfaceId: 'main',
    components: [{ id: 'root', component: 'Text', text }],
  },
});
const loading = {
  version: 'v0.9',
  updateComponents: {
    surfaceId: 'main',
    components: [{ id: 'root', component: 'Loading' }],
  },
};

let container: HTMLDivElement;
let root: Root;
let controllerElement: React.ReactElement;
let stream: ReadableStreamDefaultController<Uint8Array> | undefined;
let nextBlob = 0;

beforeEach(async () => {
  const db = await getDB();
  for (
    const store of ['conversations', 'messages', 'snapshots', 'meta'] as const
  ) await db.clear(store);
  window.localStorage.clear();
  stream = undefined;
  window.history.replaceState(null, '', '/#/a2ui/create');
  rstest.stubGlobal('React', React);
  rstest.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  rstest.stubGlobal('__A2UI_PLAYGROUND_CLIENT_PAYLOAD_STORE__', false);
  Object.defineProperty(window.URL, 'createObjectURL', {
    configurable: true,
    value: () => `blob:${window.location.origin}/preview-${++nextBlob}`,
  });
  Object.defineProperty(window.URL, 'revokeObjectURL', {
    configurable: true,
    value: () => undefined,
  });
  rstest.stubGlobal('fetch', (url: string) => {
    if (url.includes('/models')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          defaultModel: 'test',
          models: [{ id: 'test', label: 'Test' }],
        }),
      });
    }
    if (url === '/__rspeedy_url') return Promise.resolve({ ok: false });
    if (!url.endsWith('/a2ui/stream') && !url.endsWith('/a2ui/action/stream')) {
      throw new Error(`Unexpected request: ${url}`);
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'text/event-stream' }),
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          stream = controller;
        },
      }),
    });
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const adapter = {
    ...A2UI_CHAT_ADAPTER,
    settings: { ...A2UI_CHAT_ADAPTER.settings },
  };
  controllerElement = React.createElement(
    ChatController<
      A2UIOutput,
      A2UIStreamState,
      ProviderSettings,
      (typeof adapter.examples.items)[number],
      A2UIAction,
      A2UIStreamState
    >,
    {
      adapter,
      protocol: PROTOCOLS.a2ui,
      theme: 'light',
    },
  );
  await React.act(async () => root.render(controllerElement));
  await rstest.waitFor(async () => {
    await React.act(async () => {
      await getActiveConversationId('a2ui');
    });
    expect(button('New Chat').disabled).toBe(false);
    expect(container.querySelector('textarea')!.disabled).toBe(false);
  });
});

afterEach(async () => {
  await React.act(async () => root.unmount());
  container.remove();
  rstest.restoreAllMocks();
  rstest.unstubAllGlobals();
  window.localStorage.clear();
});

function button(text: string) {
  const node = [...container.querySelectorAll('button')].find(item =>
    item.textContent === text
  );
  if (!node) throw new Error(`Missing ${text}`);
  return node;
}

async function send() {
  const previousStream = stream;
  await React.act(async () => {
    const input = container.querySelector('textarea')!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!
      .set!.call(input, 'Shanghai weather');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
  });
  expect(button('Send').disabled).toBe(false);
  await React.act(async () => button('Send').click());
  await waitForStream(previousStream);
  expect(container.querySelector('iframe')?.src).toContain('render.html');
  return container.querySelector('iframe')!;
}

async function waitForStream(previous: typeof stream) {
  await rstest.waitFor(async () => {
    await React.act(async () => {
      await getActiveConversationId('a2ui');
    });
    expect(stream).toBeDefined();
    expect(stream).not.toBe(previous);
  });
}

async function ready(frame: HTMLIFrameElement) {
  const post = rstest.spyOn(frame.contentWindow!, 'postMessage')
    .mockImplementation(() => undefined);
  await React.act(async () =>
    window.dispatchEvent(
      new MessageEvent('message', {
        source: frame.contentWindow,
        origin: new URL(frame.src).origin,
        data: {
          type: 'A2UI_RENDER_READY',
          runtimeReady: true,
          frameUrl: frame.src,
          navigationToken: new URL(frame.src).searchParams.get(
            'previewNavigationToken',
          ),
        },
      }),
    )
  );
  return post;
}

async function emit(event: string, data: unknown, close = false) {
  await React.act(async () => {
    stream!.enqueue(
      new TextEncoder().encode(
        `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
      ),
    );
    if (close) stream!.close();
    await Promise.resolve();
  });
}

async function done(
  messages: unknown[],
  metrics: PreviewPerformanceMetrics | null = { generationMs: 125 },
) {
  await emit('done', {
    ...(metrics ? { metrics } : {}),
    validation: { ok: true, messages },
    text: JSON.stringify(messages),
    preview: { messagesUrl: 'https://cdn.example.com/final.json' },
  }, true);
  await rstest.waitFor(async () => {
    await React.act(async () => {
      await getActiveConversationId('a2ui');
    });
    expect(container.querySelector('textarea')!.disabled).toBe(false);
  });
}

test('keeps the rendered iframe and avoids replay when the final surface matches streamed content', async () => {
  const frame = await send();
  const src = frame.src;
  const post = await ready(frame);
  await emit('message', { messages: [create, loading] });
  await emit('message', { messages: [update('Shanghai')] });
  const generationMetric = container.querySelector(
    '[aria-label^="Generation:"]',
  )!;
  expect(generationMetric.querySelector('.previewMetricValuePending')).not
    .toBeNull();
  const delivered = post.mock.calls.length;
  await emit('metrics', { metrics: { generationMs: 125 } });
  expect(generationMetric.querySelector('.previewMetricValue')?.textContent)
    .toBe('125ms');
  expect(container.querySelector('textarea')!.disabled).toBe(true);
  expect(container.querySelector('iframe')).toBe(frame);
  expect(post.mock.calls).toHaveLength(delivered);
  await done([create, update('Shanghai')]);
  expect(generationMetric.querySelector('.previewMetricValue')?.textContent)
    .toBe('125ms');
  expect(generationMetric.querySelector('.previewMetricValuePending'))
    .toBeNull();
  expect(container.querySelectorAll('iframe')).toHaveLength(1);
  expect(container.querySelector('iframe')).toBe(frame);
  expect(frame.src).toBe(src);
  expect(post.mock.calls).toHaveLength(delivered);
  expect(src).toContain('blob');
  // A subsequent turn explicitly boots a fresh session, even with the same bootstrap URL.
  const nextFrame = await send();
  expect(nextFrame).not.toBe(frame);
  expect(nextFrame.src).not.toBe(src);
  const nextPost = await ready(nextFrame);
  await emit('message', { messages: [create, update('Next turn')] });
  expect(nextPost).toHaveBeenCalledWith({
    type: 'A2UI_LIVE_MESSAGES',
    messages: [create, update('Next turn')],
  }, new URL(nextFrame.src).origin);
});

test('applies a corrected final result without navigating to its published payload', async () => {
  const frame = await send();
  const src = frame.src;
  const post = await ready(frame);
  await emit('message', { messages: [create, update('Incomplete')] });
  await done([create, update('Corrected')]);
  expect(frame.src).toBe(src);
  expect(container.querySelector('iframe')).toBe(frame);
  expect(post).toHaveBeenLastCalledWith({
    type: 'A2UI_REPLAY_MESSAGES',
    messages: [create, update('Corrected')],
  }, new URL(src).origin);
});

test('delivers the authoritative final snapshot when the runtime becomes ready after completion', async () => {
  const frame = await send();
  await emit('message', { messages: [create, loading] });
  await emit('message', { messages: [update('Shanghai')] });
  await done([create, update('Shanghai')]);
  const post = await ready(frame);
  expect(post).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenCalledWith({
    type: 'A2UI_REPLAY_MESSAGES',
    messages: [create, update('Shanghai')],
  }, new URL(frame.src).origin);
});

test('does not replay a streamed action response at completion', async () => {
  const frame = await send();
  const src = frame.src;
  const post = await ready(frame);
  await emit('message', { messages: [create, update('Shanghai')] });
  await done([create, update('Shanghai')]);
  const previousStream = stream;
  await React.act(async () =>
    window.dispatchEvent(
      new MessageEvent('message', {
        source: frame.contentWindow,
        origin: new URL(src).origin,
        data: {
          type: 'A2UI_USER_ACTION',
          surfaceId: 'main',
          action: { name: 'refresh' },
        },
      }),
    )
  );
  await waitForStream(previousStream);
  const generationMetric = container.querySelector(
    '[aria-label^="Generation:"]',
  )!;
  expect(generationMetric.querySelector('.previewMetricValuePending')).not
    .toBeNull();
  await emit('metrics', { metrics: { generationMs: 35 } });
  await emit('message', { messages: [update('Updated')] });
  const delivered = post.mock.calls.length;
  await done([update('Updated')], { generationMs: 35 });
  expect(generationMetric.querySelector('.previewMetricValue')?.textContent)
    .toBe('35ms');
  expect(container.querySelector('iframe')).toBe(frame);
  expect(frame.src).toBe(src);
  expect(post.mock.calls).toHaveLength(delivered);
  expect(post).toHaveBeenLastCalledWith({
    type: 'A2UI_ACTION_RESPONSE',
    messages: [update('Updated')],
  }, new URL(src).origin);
});

async function reloadController() {
  await React.act(async () => root.unmount());
  root = createRoot(container);
  await React.act(async () => root.render(controllerElement));
  await rstest.waitFor(async () => {
    await React.act(async () => {
      await getActiveConversationId('a2ui');
    });
    expect(button('New Chat').disabled).toBe(false);
    expect(container.querySelector('textarea')!.disabled).toBe(false);
  });
}

test('persists and restores server generation time without relabeling legacy Agent timing', async () => {
  await send();
  await done([create, update('Shanghai')], {
    generationMs: 125,
    firstReasoningTokenMs: 30,
    firstTextTokenMs: 70,
    modelMs: 100,
    searchMs: 45,
    imageGenerationMs: 80,
  });
  const id = (await getActiveConversationId('a2ui'))!;
  const record = (await loadConversation(id))!;
  const assistant = record.messages.find(message =>
    message.role === 'assistant'
  )!;
  expect(assistant.previewMetrics).toMatchObject({
    generationMs: 125,
    firstReasoningTokenMs: 30,
    firstTextTokenMs: 70,
    modelMs: 100,
    searchMs: 45,
    imageGenerationMs: 80,
  });
  expect(assistant.previewMetrics?.agentOutputMs).toBeUndefined();
  await reloadController();
  for (
    const [label, value] of [
      ['Generation', '125ms'],
      ['1st Reasoning', '30ms'],
      ['1st Text', '70ms'],
      ['Model', '100ms'],
      ['Search', '45ms'],
      ['Image Gen', '80ms'],
    ]
  ) {
    expect(
      container.querySelector(`[aria-label^="${label}:"] .previewMetricValue`)
        ?.textContent,
    ).toBe(value);
  }

  const db = await getDB();
  await db.put('messages', {
    ...assistant,
    previewMetrics: { agentOutputMs: 9_000 },
  });
  await reloadController();
  expect(container.querySelector('[aria-label^="Generation:"]')).toBeNull();
  expect(container.querySelector('[aria-label^="Agent:"]')).toBeNull();
});

test('does not substitute client elapsed time when the server supplies no generation timing', async () => {
  await send();
  await emit('metrics', { metrics: { generationMs: -1 } });
  await done([create, update('Shanghai')], null);
  expect(container.querySelector('[aria-label^="Generation:"]')).toBeNull();
  const id = (await getActiveConversationId('a2ui'))!;
  const record = (await loadConversation(id))!;
  expect(
    record.messages.find(message => message.role === 'assistant')
      ?.previewMetrics?.generationMs,
  ).toBeUndefined();
});

test('retains server generation time on failure', async () => {
  await send();
  await emit('error', {
    message: 'No artifact',
    metrics: { generationMs: 580 },
  }, true);
  await rstest.waitFor(async () => {
    await React.act(async () => {
      await getActiveConversationId('a2ui');
    });
    expect(container.querySelector('textarea')!.disabled).toBe(false);
  });
  expect(
    container.querySelector('[aria-label^="Generation:"] .previewMetricValue')
      ?.textContent,
  ).toBe('580ms');
  const id = (await getActiveConversationId('a2ui'))!;
  const record = (await loadConversation(id))!;
  expect(
    record.messages.find(message => message.role === 'assistant')
      ?.previewMetrics?.generationMs,
  ).toBe(580);
});
