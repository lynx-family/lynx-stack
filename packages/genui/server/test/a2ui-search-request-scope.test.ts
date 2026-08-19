// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, rstest, test } from '@rstest/core';

import { createA2UIAgent } from '../agent/a2ui-agent.js';
import type { A2UIAgent } from '../agent/a2ui-agent.js';
import type { A2UICatalog } from '../agent/a2ui-catalog.js';
import { createArkImageGenerationRunScope } from '../agent/ark-image-generation-tool.js';
import { searchDoubaoForRun } from '../agent/doubao-search-tool.js';
import A2UIAgentService from '../service/a2ui-agent.js';

rstest.mock('../agent/a2ui-agent.js', { mock: true });

const catalog: A2UICatalog = {
  id: 'search-request-scope-test',
  label: 'Search request scope test',
  components: [],
  examples: [],
};

const searchConfig = {
  apiKey: 'search-secret',
  requestTimeoutMs: 5_000,
};

interface TestRunOptions {
  requestContext: unknown;
  abortSignal?: AbortSignal;
}

function searchResponse(): Response {
  return new Response(JSON.stringify({
    Result: {
      TotalDocCount: 0,
      ErrorCode: 0,
      Documents: [],
    },
  }));
}

describe('A2UI search request scope', () => {
  test('shares the three-call budget across streaming and repair attempts', async () => {
    let fetchCalls = 0;
    const fetchImpl: typeof fetch = () => {
      fetchCalls += 1;
      return Promise.resolve(searchResponse());
    };
    const agent = {
      stream(_messages: unknown, options: TestRunOptions) {
        return {
          textStream: (async function*() {
            await searchDoubaoForRun(
              { requestContext: options.requestContext },
              searchConfig,
              'streaming generation',
              fetchImpl,
              options.abortSignal,
            );
            yield 'invalid';
          })(),
        };
      },
      async generate(_messages: unknown, options: TestRunOptions) {
        await searchDoubaoForRun(
          { requestContext: options.requestContext },
          searchConfig,
          'repair generation',
          fetchImpl,
          options.abortSignal,
        );
        return {
          text: 'invalid',
          usage: {},
          finishReason: 'stop',
        };
      },
    } as unknown as A2UIAgent;
    rstest.mocked(createA2UIAgent).mockResolvedValue({
      agent,
      catalog,
      model: 'test-model',
    });

    const service = new A2UIAgentService();
    const requestScope = createArkImageGenerationRunScope();
    const options = {
      catalog,
      disableAgentCache: true,
      maxRepairAttempts: 2,
    };
    const initial = await service.streamAsAsyncIterable(
      [],
      options,
      undefined,
      undefined,
      requestScope,
    );
    for await (const _chunk of initial.textStream) {
      // Consume the stream so its tool call completes.
    }

    await expect(service.generateValidated(
      [],
      options,
      undefined,
      undefined,
      undefined,
      requestScope,
    )).rejects.toThrow('call limit reached (3 per request)');
    expect(fetchCalls).toBe(3);
  });
});
