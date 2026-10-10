// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, rstest, test } from '@rstest/core';

import route from '../app/openui/stream/route.js';
import OpenUIAgentService from '../service/openui/openui-agent.js';

const mockAgent = rstest.hoisted(() => ({ stream: rstest.fn() }));
rstest.mock('../agent/openui/openui-agent.js', () => ({
  createOpenUIAgent: () => ({ agent: mockAgent }),
}));

test('streams complete lines and flushes the final unterminated line', async () => {
  const global = globalThis as typeof globalThis & {
    __OPENUI_AGENT_SERVICE__?: OpenUIAgentService;
  };
  const previous = global.__OPENUI_AGENT_SERVICE__;
  let upstream!: ReadableStreamDefaultController<string>;
  const textStream = new ReadableStream<string>({
    start(controller) {
      upstream = controller;
    },
  });
  let complete!: () => void;
  const completion = new Promise<void>(resolve => {
    complete = resolve;
  });
  const finalText = 'root = Stack([\r\nText("实时输出")\n])';
  mockAgent.stream.mockResolvedValue({
    textStream,
    text: completion.then(() => finalText),
    usage: completion.then(() => ({ inputTokens: 8, outputTokens: 12 })),
    finishReason: completion.then(() => 'stop'),
  });
  global.__OPENUI_AGENT_SERVICE__ = new OpenUIAgentService();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await route.request('/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '203.0.113.209',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Create a card' }],
      }),
    });
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    expect(response.headers.get('X-Accel-Buffering')).toBe('no');
    reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const readEvent = async (event: string) => {
      while (true) {
        const result = await reader!.read();
        if (result.done) throw new Error(`Missing ${event}`);
        const text = decoder.decode(result.value);
        if (text.startsWith(`event: ${event}\n`)) {
          return JSON.parse(text.split('data: ')[1]!) as unknown;
        }
      }
    };
    upstream.enqueue('root = Stack([');
    upstream.enqueue('\r');
    upstream.enqueue('\nText("实时');
    expect(await readEvent('delta')).toEqual({ text: 'root = Stack([\r\n' });
    // Completion is deliberately unresolved: a buffered implementation would hang here.
    upstream.enqueue('输出")\n])');
    expect(await readEvent('delta')).toEqual({ text: 'Text("实时输出")\n' });
    upstream.close();
    // The final line is sent before the agent's result promise resolves.
    expect(await readEvent('delta')).toEqual({ text: '])' });
    complete();
    expect(await readEvent('done')).toMatchObject({
      ok: true,
      text: finalText,
      finishReason: 'stop',
      tokenUsage: { inputTokens: 8, outputTokens: 12 },
    });
  } finally {
    complete();
    await reader?.cancel();
    global.__OPENUI_AGENT_SERVICE__ = previous;
    mockAgent.stream.mockReset();
  }
});

test('withholds invented images and retains usage in the terminal error', async () => {
  const global = globalThis as typeof globalThis & {
    __OPENUI_AGENT_SERVICE__?: OpenUIAgentService;
  };
  const previous = global.__OPENUI_AGENT_SERVICE__;
  const invented = 'https://images.example.com/sf-sunny.jpg';
  const text = `root = Stack([Image("${invented}")])`;
  mockAgent.stream.mockResolvedValue({
    textStream: (async function*() {
      await Promise.resolve();
      yield 'root = Stack([I';
      yield `mage("${invented}")])\n`;
    })(),
    text,
    usage: { inputTokens: 8, outputTokens: 12 },
    finishReason: 'stop',
  });
  global.__OPENUI_AGENT_SERVICE__ = new OpenUIAgentService();
  try {
    const response = await route.request('/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '203.0.113.210',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Create a weather card' }],
      }),
    });
    const body = await response.text();
    expect(body).not.toContain(invented);
    expect(body).not.toContain('event: done');
    expect(body).toContain('event: error');
    expect(body).toContain('OpenUI image source');
    expect(body).toContain('"inputTokens":8');
    expect(body).toContain('"outputTokens":12');
  } finally {
    global.__OPENUI_AGENT_SERVICE__ = previous;
    mockAgent.stream.mockReset();
  }
});
