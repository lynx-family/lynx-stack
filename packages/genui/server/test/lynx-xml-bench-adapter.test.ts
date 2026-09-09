// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import type { ProtocolBenchAdapterInput } from '../service/common/bench/protocol-adapter.js';
import type { ChatMessage } from '../service/common/types.js';
import { createLynxXmlBenchAdapter } from '../service/lynx-xml/lynx-xml-bench-adapter.js';

const SOURCE =
  '<!doctype lynx>\n<lynx engine-version="4.2"><script thread="main">const page = __CreatePage("0", 0);</script></lynx>';
const INPUT: ProtocolBenchAdapterInput = {
  runId: 'xml-run',
  pairId: 'pair-1',
  scenario: {
    id: 'greeting',
    name: 'Greeting',
    type: 'Information',
    complexity: 1,
    prompt: 'Show Hello',
    action: 'Refresh',
  },
  repeatIndex: 1,
  maxAttempts: 2,
  provider: { model: 'test-model' },
};

describe('Lynx XML Bench adapter', () => {
  test('repairs the document contract and preserves token usage and source', async () => {
    const conversations: ChatMessage[][] = [];
    const controller = new AbortController();
    const adapter = createLynxXmlBenchAdapter({
      generateRaw(messages, options, signal) {
        conversations.push([...messages]);
        expect(signal).toBe(controller.signal);
        expect(options).toMatchObject({
          model: 'test-model',
          disableAgentCache: true,
          enableWebSearch: false,
          enableImageGeneration: false,
          inheritReasoningEffort: false,
        });
        return Promise.resolve({
          text: conversations.length === 1
            ? '<!doctype lynx>'
            : `\`\`\`xml\n${SOURCE}\n\`\`\``,
          usage: {
            inputTokens: { total: 12, cacheRead: 5, cacheWrite: 0 },
            outputTokens: { total: 8, reasoning: 2 },
          },
          finishReason: 'stop',
        });
      },
    });
    const artifact = await adapter.generate(INPUT, controller.signal);
    expect(artifact.attempts[0]?.usage).toMatchObject({
      inputTokens: { total: 12, cacheRead: 5, cacheWrite: 0 },
    });
    expect(conversations.map((messages) => messages.length)).toEqual([1, 3]);
    expect(conversations[0]?.[0]?.content).toContain(
      'Required action: Refresh',
    );
    expect(conversations[1]?.[2]?.content).toContain('closing </lynx>');
    expect(
      artifact.attempts.map((attempt) => [attempt.valid, attempt.totalTokens]),
    ).toEqual([[false, 20], [true, 20]]);
    expect(artifact).toMatchObject({
      finalValid: true,
      finalText: SOURCE,
      finalErrors: [],
      judgePayload: { kind: 'lynx-xml-source', rawText: SOURCE },
    });
  });

  test('bounds transport retries and never supplies invalid output to Judge', async () => {
    let calls = 0;
    const adapter = createLynxXmlBenchAdapter({
      retryDelayMs: 0,
      generateRaw() {
        calls++;
        return Promise.reject(new Error('provider unavailable'));
      },
    });
    const artifact = await adapter.generate({ ...INPUT, maxAttempts: 99 });
    expect(calls).toBe(4);
    expect(artifact.finalValid).toBe(false);
    expect(artifact.finalErrors).toEqual(['provider unavailable']);
    expect(artifact.judgePayload).toBeUndefined();
  });

  test('cancels transport backoff before another request', async () => {
    const controller = new AbortController();
    let calls = 0;
    const adapter = createLynxXmlBenchAdapter({
      generateRaw() {
        calls++;
        setTimeout(() => controller.abort(), 0);
        return Promise.reject(new Error('provider unavailable'));
      },
    });
    await expect(adapter.generate(INPUT, controller.signal)).rejects
      .toMatchObject({ name: 'AbortError' });
    expect(calls).toBe(1);
  });
});
