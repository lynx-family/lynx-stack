// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, rstest, test } from '@rstest/core';

import { createA2UIAgent } from '../agent/a2ui-agent.js';
import type { A2UIAgent } from '../agent/a2ui-agent.js';
import type { A2UICatalog } from '../agent/a2ui-catalog.js';
import {
  createArkImageGenerationRunScope,
  createArkImageGenerationTool,
  generatedArkImageURLs,
} from '../agent/ark-image-generation-tool.js';
import A2UIAgentService from '../service/a2ui-agent.js';

rstest.mock('../agent/a2ui-agent.js', { mock: true });

const catalog: A2UICatalog = {
  id: 'async-image-agent-test',
  label: 'Async image agent test',
  components: [],
  examples: [],
};

const config = {
  apiKey: 'ark-secret',
  baseURL: 'https://ark.example.com/api/v3',
  model: 'seedream-test-model',
  requestTimeoutMs: 5_000,
};

const initialText = JSON.stringify([
  {
    version: 'v0.9',
    createSurface: {
      surfaceId: 'main',
      catalogId: catalog.id,
      theme: { mode: 'light' },
    },
  },
  {
    version: 'v0.9',
    updateComponents: {
      surfaceId: 'main',
      components: [{ id: 'root', component: 'Loading', variant: 'block' }],
    },
  },
]);

const patchText = JSON.stringify([
  {
    version: 'v0.9',
    updateComponents: {
      surfaceId: 'main',
      components: [{
        id: 'root',
        component: 'Image',
        url: 'https://images.example.com/generated.jpeg',
      }],
    },
  },
]);

function streamResult(
  text: string,
  finishReason: string,
  extra: Record<string, unknown> = {},
) {
  return {
    text,
    textStream: (async function*() {
      yield await Promise.resolve(text);
    })(),
    usage: {},
    finishReason,
    ...extra,
  };
}

describe('A2UI asynchronous image continuation', () => {
  test('streams the initial surface, resumes the agent, then streams its patch', async () => {
    const scope = createArkImageGenerationRunScope();
    const imageTool = createArkImageGenerationTool(
      config,
      () =>
        Promise.resolve(
          new Response(JSON.stringify({
            data: [{ url: 'https://images.example.com/generated.jpeg' }],
          })),
        ),
    );
    if (!imageTool.execute) {
      throw new Error('generate_image execute is missing');
    }
    const executeImageTool = imageTool.execute;
    let suspendPayload: unknown;
    await executeImageTool(
      { prompt: 'A generated hero image' },
      {
        requestContext: scope.requestContext,
        agent: {
          suspend: (payload: unknown) => {
            suspendPayload = payload;
            return Promise.resolve();
          },
        },
      } as never,
    );

    const resumeStream = rstest.fn(async (resumeData: unknown) => {
      await executeImageTool(
        { prompt: 'A generated hero image' },
        {
          requestContext: scope.requestContext,
          agent: { resumeData },
        } as never,
      );
      return streamResult(patchText, 'stop');
    });
    const agent = {
      stream: () =>
        streamResult(initialText, 'suspended', {
          runId: 'image-run-1',
          suspendPayload,
        }),
      resumeStream,
    } as unknown as A2UIAgent;
    rstest.mocked(createA2UIAgent).mockResolvedValue({
      agent,
      catalog,
      model: 'test-model',
    });

    const service = new A2UIAgentService();
    const streamed = await service.streamAsAsyncIterable(
      [],
      { catalog, disableAgentCache: true },
      undefined,
      undefined,
      scope,
    );
    const chunks: string[] = [];
    for await (const chunk of streamed.textStream) chunks.push(chunk);
    const completed = await streamed.finalize();

    expect(chunks).toEqual([initialText, '\n', patchText]);
    expect(resumeStream).toHaveBeenCalledTimes(1);
    if (!completed.text) throw new Error('completed text is missing');
    expect(JSON.parse(completed.text)).toHaveLength(3);
    expect(generatedArkImageURLs(scope)).toEqual([
      'https://images.example.com/generated.jpeg',
    ]);
  });
});
