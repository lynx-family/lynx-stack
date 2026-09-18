// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import type { ProtocolBenchAdapterInput } from '../service/common/bench/protocol-adapter.js';
import {
  GenerationPostprocessError,
  GenerationUpstreamError,
} from '../service/common/result.js';
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
  test('keeps usage on upstream failure without treating it as an XML validation failure', async () => {
    const adapter = createLynxXmlBenchAdapter({
      generateRaw() {
        throw new GenerationUpstreamError(new Error('Invalid input'), {
          text: '',
          usage: { inputTokens: 10, outputTokens: 20 },
          finishReason: 'error',
        });
      },
    });
    const result = await adapter.generate({ ...INPUT, maxAttempts: 1 });
    expect(result.finalValid).toBe(false);
    expect(result.finalErrors).toEqual(['Invalid input']);
    expect(result.attempts[0]).toMatchObject({
      totalTokens: 30,
      usage: { inputTokens: 10, outputTokens: 20 },
      finishReason: 'error',
      outputChars: 0,
    });
    expect(result.judgePayload).toBeUndefined();
  });

  test('repairs compilation failures with original output and counts the failed generation', async () => {
    const source =
      '<!doctype lynx><lynx engine-version="4.2"><template><view></template></lynx>';
    let calls = 0;
    const adapter = createLynxXmlBenchAdapter({
      retryDelayMs: 0,
      generateRaw(messages) {
        if (++calls === 1) {
          throw new GenerationPostprocessError(
            new Error('Invalid XML fragment'),
            {
              text: source,
              usage: { inputTokens: 10, outputTokens: 5 },
              finishReason: 'stop',
            },
          );
        }
        expect(messages[1]?.content).toBe(source);
        expect(messages[2]?.content).toContain('Invalid XML fragment');
        return Promise.resolve({
          text: SOURCE,
          usage: { inputTokens: 20, outputTokens: 8 },
          finishReason: 'stop',
        });
      },
    });
    const result = await adapter.generate({
      ...INPUT,
      enableHtmlFragment: true,
    });
    expect(result.finalValid).toBe(true);
    expect(result.attempts.map(attempt => attempt.totalTokens)).toEqual([
      15,
      28,
    ]);
    expect(result.attempts[0]?.outputChars).toBe(source.length);
  });
  test.each([undefined, false, true, 'default', 'preset-only'] as const)(
    'passes fragment selection through every repair: %s',
    async (enabled) => {
      let calls = 0;
      const adapter = createLynxXmlBenchAdapter({
        generateRaw(_messages, options) {
          expect(options.enableHtmlFragment).toBe(
            enabled === true || enabled === 'default',
          );
          expect(options.stylePreset).toBe(
            enabled === 'default' || enabled === 'preset-only'
              ? 'default'
              : undefined,
          );
          return Promise.resolve({
            text: ++calls === 1 ? '<!doctype lynx>' : SOURCE,
            usage: undefined,
            finishReason: 'stop',
          });
        },
      });
      await adapter.generate({
        ...INPUT,
        ...(enabled === undefined
          ? {}
          : { enableHtmlFragment: enabled === true || enabled === 'default' }),
        ...(enabled === 'default' || enabled === 'preset-only'
          ? { stylePreset: 'default' as const }
          : {}),
      });
      expect(calls).toBe(2);
    },
  );

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
          maxRetries: 0,
          enableWebSearch: false,
          enableImageGeneration: false,
        });
        expect(options.inheritReasoningEffort).not.toBe(false);
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

  test.each([false, true])(
    'regenerates compactly after token exhaustion with fragment mode %s',
    async (enableHtmlFragment) => {
      const conversations: ChatMessage[][] = [];
      const settings: unknown[] = [];
      const truncated = enableHtmlFragment ? '' : SOURCE.slice(0, -16);
      const controller = new AbortController();
      const adapter = createLynxXmlBenchAdapter({
        generateRaw(messages, options, signal) {
          conversations.push([...messages]);
          settings.push({ ...options, resourceId: undefined });
          expect(signal).toBe(controller.signal);
          if (conversations.length === 1) {
            const result = {
              text: truncated,
              usage: { inputTokens: 10, outputTokens: 16_384 },
              finishReason: 'length',
            };
            if (enableHtmlFragment) {
              throw new GenerationPostprocessError(
                new Error(
                  'Fragment document requires a <!doctype lynx> document with a <lynx> root',
                ),
                result,
              );
            }
            return Promise.resolve(result);
          }
          return Promise.resolve({
            text: SOURCE,
            usage: { inputTokens: 20, outputTokens: 8 },
            finishReason: 'stop',
          });
        },
      });

      const result = await adapter.generate({
        ...INPUT,
        enableDesignGuidance: false,
        enableHtmlFragment,
      }, controller.signal);

      expect(conversations.map(messages => messages.length)).toEqual([1, 2]);
      expect(conversations[1]?.[0]).toEqual(conversations[0]?.[0]);
      expect(conversations[1]?.[1]?.role).toBe('user');
      expect(conversations[1]?.[1]?.content).toContain(
        'Regenerate a shorter, complete artifact',
      );
      expect(conversations[1]?.[1]?.content).toContain(
        'Preserve all required content and actions',
      );
      if (truncated) {
        expect(conversations[1]?.[0]?.content).not.toContain(truncated);
      }
      expect(settings[1]).toEqual(settings[0]);
      expect(settings[1]).toMatchObject({
        model: INPUT.provider.model,
        maxRetries: 0,
        enableDesignGuidance: false,
        enableHtmlFragment,
      });
      expect(result.attempts[0]).toMatchObject({
        valid: false,
        totalTokens: 16_394,
        usage: { inputTokens: 10, outputTokens: 16_384 },
        finishReason: 'length',
        outputChars: truncated.length,
        validationErrors: [
          expect.stringContaining('Model output reached its token limit'),
        ],
      });
      expect(result.attempts[1]).toMatchObject({
        valid: true,
        totalTokens: 28,
      });
      expect(result).toMatchObject({
        finalValid: true,
        finalText: SOURCE,
        finalErrors: [],
        judgePayload: { kind: 'lynx-xml-source', rawText: SOURCE },
      });
    },
  );

  test('accepts a complete artifact even when generation ends at its token limit', async () => {
    let calls = 0;
    const adapter = createLynxXmlBenchAdapter({
      generateRaw() {
        calls++;
        return Promise.resolve({
          text: SOURCE,
          usage: { outputTokens: 16_384 },
          finishReason: 'length',
        });
      },
    });
    const result = await adapter.generate(INPUT);
    expect(calls).toBe(1);
    expect(result).toMatchObject({
      finalValid: true,
      judgePayload: { kind: 'lynx-xml-source', rawText: SOURCE },
    });
    expect(result.attempts[0]?.finishReason).toBe('length');
  });

  test.each([1, 2])(
    'bounds compact regeneration by %s configured attempts',
    async (maxAttempts) => {
      let calls = 0;
      const adapter = createLynxXmlBenchAdapter({
        generateRaw() {
          calls++;
          return Promise.resolve({
            text: '<!doctype lynx>',
            usage: { outputTokens: 16_384 },
            finishReason: 'length',
          });
        },
      });
      const result = await adapter.generate({ ...INPUT, maxAttempts });
      expect(calls).toBe(maxAttempts);
      expect(result.attempts).toHaveLength(maxAttempts);
      expect(result.finalValid).toBe(false);
      expect(result.finalErrors).toEqual([
        expect.stringContaining('Model output reached its token limit'),
      ]);
      expect(result.judgePayload).toBeUndefined();
    },
  );

  test('bounds transport retries and never supplies invalid output to Judge', async () => {
    let calls = 0;
    const adapter = createLynxXmlBenchAdapter({
      retryDelayMs: 0,
      generateRaw() {
        calls++;
        return Promise.reject(
          Object.assign(new Error('provider unavailable'), { statusCode: 503 }),
        );
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
        return Promise.reject(
          Object.assign(new Error('provider unavailable'), { statusCode: 503 }),
        );
      },
    });
    await expect(adapter.generate(INPUT, controller.signal)).rejects
      .toMatchObject({ name: 'AbortError' });
    expect(calls).toBe(1);
  });
});
