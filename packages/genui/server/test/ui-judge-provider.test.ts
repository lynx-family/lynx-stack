// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, rstest, test } from '@rstest/core';

import { evaluateScreenshot } from '../agent/common/ui-judge-agent.js';
import { GENUI_MODEL_CONFIG_ENV } from '../service/common/model-config.js';

test(
  'evaluates PNGs through the real GenUI provider and Mastra structured output',
  async () => {
    const previous = process.env[GENUI_MODEL_CONFIG_ENV];
    process.env[GENUI_MODEL_CONFIG_ENV] = JSON.stringify({
      Bench: {
        model: 'bench-upstream',
        apiKey: 'bench-secret',
        baseURL: 'https://judge-provider.example/v1',
        api: 'chat',
      },
    });
    const requests: Record<string, unknown>[] = [];
    const originalFetch = globalThis.fetch;
    const fetchMock = rstest.spyOn(globalThis, 'fetch').mockImplementation(
      (input, init) => {
        const url = input instanceof Request ? input.url : input.toString();
        if (url.startsWith('data:image/png;base64,')) {
          return originalFetch(input, init);
        }
        expect(url).toBe(
          'https://judge-provider.example/v1/chat/completions',
        );
        expect(new Headers(init?.headers).get('authorization')).toBe(
          'Bearer bench-secret',
        );
        const body = JSON.parse(
          typeof init?.body === 'string' ? init.body : '',
        ) as Record<string, unknown>;
        requests.push(body);
        const content = JSON.stringify({
          score: 4,
          reason: 'The requested greeting is visible.',
          summary: 'Clear hierarchy and readable text.',
        });
        if (body.stream) {
          const chunk = {
            id: 'judge-response',
            object: 'chat.completion.chunk',
            created: 1,
            model: 'bench-upstream',
          };
          return Promise.resolve(
            new Response(
              [
                `data: ${
                  JSON.stringify({
                    ...chunk,
                    choices: [{
                      index: 0,
                      delta: { role: 'assistant', content },
                      finish_reason: null,
                    }],
                  })
                }\n\n`,
                `data: ${
                  JSON.stringify({
                    ...chunk,
                    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                    usage: {
                      prompt_tokens: 10,
                      completion_tokens: 20,
                      total_tokens: 30,
                    },
                  })
                }\n\n`,
                'data: [DONE]\n\n',
              ].join(''),
              { headers: { 'Content-Type': 'text/event-stream' } },
            ),
          );
        }
        return Promise.resolve(Response.json({
          id: 'judge-response',
          object: 'chat.completion',
          created: 1,
          model: 'bench-upstream',
          choices: [{
            index: 0,
            message: { role: 'assistant', content },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }));
      },
    );
    try {
      const screenshotDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
      const result = await evaluateScreenshot({
        model: 'Bench',
        task: 'Show a greeting',
        screenshotDataUrl,
        signal: AbortSignal.timeout(10000),
      });
      expect(result).toMatchObject({ score: 4, geqiScore: 80 });
      expect(result.dimensions).toHaveLength(4);
      expect(requests).toHaveLength(5);
      for (const body of requests) {
        expect(body.model).toBe('bench-upstream');
        expect(body.messages).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.arrayContaining([
                expect.objectContaining({
                  type: 'image_url',
                  image_url: expect.objectContaining({
                    url: screenshotDataUrl,
                  }) as unknown,
                }),
              ]) as unknown,
            }),
          ]),
        );
      }
    } finally {
      fetchMock.mockRestore();
      if (previous === undefined) delete process.env[GENUI_MODEL_CONFIG_ENV];
      else process.env[GENUI_MODEL_CONFIG_ENV] = previous;
    }
  },
  15000,
);
