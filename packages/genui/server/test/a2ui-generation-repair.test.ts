// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, rstest, test } from '@rstest/core';

import { createA2UIAgent } from '../agent/a2ui/a2ui-agent.js';
import type { A2UIAgent } from '../agent/a2ui/a2ui-agent.js';
import { BASIC_CATALOG } from '../agent/a2ui/a2ui-catalog.js';
import { createArkImageGenerationRunScope } from '../agent/common/ark-image-generation-tool.js';
import A2UIAgentService from '../service/a2ui/a2ui-agent.js';
import type { ChatMessage } from '../service/common/types.js';

rstest.mock('../agent/a2ui/a2ui-agent.js', { mock: true });

const validText = JSON.stringify(
  [
    {
      version: 'v0.9',
      createSurface: { surfaceId: 'main', catalogId: BASIC_CATALOG.id },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'main',
        components: [{
          id: 'root',
          component: 'Text',
          text: 'Ready',
          variant: 'body',
        }],
      },
    },
  ],
  null,
  2,
);

describe('validated A2UI generation repairs', () => {
  test('returns the first validation failure when Create disables retries', async () => {
    const generate = rstest.fn().mockResolvedValue({
      text: 'invalid artifact',
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20 },
    });
    rstest.mocked(createA2UIAgent).mockResolvedValueOnce({
      agent: { generate } as unknown as A2UIAgent,
      catalog: BASIC_CATALOG,
      model: 'test-model',
    });
    const result = await new A2UIAgentService().generateValidated(
      [{ role: 'user', content: 'Build a card' }],
      {
        catalog: BASIC_CATALOG,
        disableAgentCache: true,
        maxRepairAttempts: 0,
      },
    );
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      ok: false,
      attempts: 1,
      usage: { inputTokens: 10, outputTokens: 20 },
    });
  });

  test('preserves original conversation and tool scope while resetting failed attempts after length', async () => {
    const initialMessages: ChatMessage[] = [{
      role: 'user',
      content: 'Build a status card.',
    }];
    const conversation = {
      history: [
        { role: 'user' as const, content: 'Use a compact layout.' },
        { role: 'assistant' as const, content: 'I will keep it compact.' },
      ],
      dataModel: { locale: 'en' },
    };
    const calls: ChatMessage[][] = [];
    const controller = new AbortController();
    const scope = createArkImageGenerationRunScope();
    const outputs = [
      { text: 'invalid first artifact', finishReason: 'stop' },
      { text: '', finishReason: 'length' },
      { text: '[{"version":', finishReason: 'length' },
      { text: validText, finishReason: 'length' },
    ];
    const agent = {
      generate(
        messages: ChatMessage[],
        options: { abortSignal?: AbortSignal; requestContext: unknown },
      ) {
        expect(options.abortSignal).toBe(controller.signal);
        expect(options.requestContext).toBe(scope.requestContext);
        const output = outputs[calls.length];
        calls.push([...messages]);
        return Promise.resolve({
          ...output,
          usage: { inputTokens: 10, outputTokens: 20, cachedTokens: 4 },
        });
      },
    } as unknown as A2UIAgent;
    rstest.mocked(createA2UIAgent).mockResolvedValueOnce({
      agent,
      catalog: BASIC_CATALOG,
      model: 'test-model',
    });

    const result = await new A2UIAgentService().generateValidated(
      initialMessages,
      { catalog: BASIC_CATALOG, disableAgentCache: true, maxRepairAttempts: 3 },
      conversation,
      undefined,
      controller.signal,
      scope,
    );

    expect(result.usage).toEqual({
      inputTokens: 40,
      outputTokens: 80,
      totalTokens: 120,
      cachedTokens: 16,
    });
    expect(calls).toHaveLength(4);
    const original = calls[0]!;
    expect(original.slice(0, 2)).toEqual(conversation.history);
    expect(original[2]?.role).toBe('system');
    expect(original[2]?.content).toContain('"locale":"en"');
    expect(original[3]).toEqual(initialMessages[0]);
    expect(calls[1]).toHaveLength(original.length + 2);
    expect(calls[1]?.[original.length]).toEqual({
      role: 'assistant',
      content: 'invalid first artifact',
    });
    expect(calls[2]?.slice(0, -1)).toEqual(original);
    expect(calls[2]?.at(-1)?.role).toBe('user');
    expect(calls[2]?.at(-1)?.content).toContain(
      'Regenerate a shorter, complete artifact',
    );
    expect(calls[3]).toEqual(calls[2]);
    expect(initialMessages).toHaveLength(1);
    expect(conversation.history).toHaveLength(2);
    expect(result).toMatchObject({
      ok: true,
      text: validText,
      attempts: 4,
      errors: [],
      finishReason: 'length',
    });
  });

  test.each([false, true])(
    'honors the repair budget and cancellation (abort: %s)',
    async (abort) => {
      let calls = 0;
      const controller = new AbortController();
      const agent = {
        generate() {
          calls++;
          if (abort) controller.abort(new Error('cancelled'));
          return Promise.resolve({
            text: '',
            usage: {},
            finishReason: 'length',
          });
        },
      } as unknown as A2UIAgent;
      rstest.mocked(createA2UIAgent).mockResolvedValueOnce({
        agent,
        catalog: BASIC_CATALOG,
        model: 'test-model',
      });
      const generated = new A2UIAgentService().generateValidated(
        [{ role: 'user', content: 'Build a card.' }],
        {
          catalog: BASIC_CATALOG,
          disableAgentCache: true,
          maxRepairAttempts: 1,
        },
        undefined,
        undefined,
        controller.signal,
      );
      if (abort) {
        await expect(generated).rejects.toThrow('cancelled');
        expect(calls).toBe(1);
      } else {
        await expect(generated).resolves.toMatchObject({
          ok: false,
          messages: [],
          attempts: 2,
          finishReason: 'length',
        });
        expect(calls).toBe(2);
      }
    },
  );
});
