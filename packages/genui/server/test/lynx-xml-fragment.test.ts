// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, expect, rstest, test } from '@rstest/core';

import { createLLMProvider } from '../agent/common/openai-provider.js';
import { GenerationPostprocessError } from '../service/common/result.js';
import LynxXmlAgentService from '../service/lynx-xml/lynx-xml-agent.js';

rstest.mock('../agent/common/openai-provider.js', { mock: true });

const FRAGMENT =
  '\n<view id="root"><text><raw-text text="Hello &amp; 你好"/></text></view>\n';
const INTERMEDIATE =
  `<!doctype lynx>\n<lynx engine-version="4.2"><style>.page { display: flex; flex-direction: column; }</style><template>${FRAGMENT}</template><script thread="main">const page = __CreatePage("0", 0); const pageId = __GetElementUniqueID(page); const nodes = createFragment(page, pageId);</script></lynx>`;
const DIRECT =
  '<!doctype lynx>\n<lynx engine-version="4.2"><script thread="main">const page = __CreatePage("0", 0);</script></lynx>';
const USAGE = { inputTokens: 12, outputTokens: 8, totalTokens: 20 };
let calls: string[];
let override: string | undefined;
let upstreamFailure: Error | undefined;

function response(options: { prompt: unknown; tools?: { name?: string }[] }) {
  const prompt = JSON.stringify(options.prompt);
  calls.push(prompt);
  expect(
    options.tools?.some(tool =>
      tool.name === 'html_fragment_to_main_thread_script'
    ) ?? false,
  ).toBe(false);
  return override
    ?? (prompt.includes('XML fragment mode') ? INTERMEDIATE : DIRECT);
}

beforeEach(() => {
  calls = [];
  override = undefined;
  upstreamFailure = undefined;
  rstest.mocked(createLLMProvider).mockReset();
  rstest.mocked(createLLMProvider).mockReturnValue({
    model: 'fragment-test',
    provider: {} as never,
    api: 'chat',
    baseURL: 'https://example.com',
    buildModel: () => ({
      specificationVersion: 'v2',
      provider: 'test',
      modelId: 'fragment-test',
      supportedUrls: {},
      doGenerate(options) {
        return Promise.resolve({
          content: [{ type: 'text' as const, text: response(options) }],
          finishReason: 'stop' as const,
          usage: USAGE,
          warnings: [],
        });
      },
      doStream(options) {
        const text = response(options);
        return Promise.resolve({
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              if (upstreamFailure) {
                controller.enqueue({ type: 'error', error: upstreamFailure });
                controller.enqueue({
                  type: 'finish',
                  finishReason: 'error',
                  usage: USAGE,
                });
                controller.close();
                return;
              }
              controller.enqueue({ type: 'text-start', id: 'answer' });
              for (let index = 0; index < text.length; index += 31) {
                controller.enqueue({
                  type: 'text-delta',
                  id: 'answer',
                  delta: text.slice(index, index + 31),
                });
              }
              controller.enqueue({ type: 'text-end', id: 'answer' });
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: USAGE,
              });
              controller.close();
            },
          }),
        });
      },
    }),
  });
});

test.each([false, true])(
  'real Mastra streaming retains the provider failure before compilation (fragment=%s)',
  async enableHtmlFragment => {
    upstreamFailure = Object.assign(new Error('Provider rejected input'), {
      statusCode: 400,
      responseHeaders: { 'x-request-id': 'real-mastra-request' },
    });
    const service = new LynxXmlAgentService();
    const stream = await service.streamAsAsyncIterable([], {
      enableHtmlFragment,
      enableWebSearch: false,
      enableImageGeneration: false,
    });
    for await (const _chunk of stream.textStream) {
      /* drain the failed stream */
    }
    await expect(stream.finalize()).rejects.toMatchObject({
      name: 'GenerationUpstreamError',
      message: 'Provider rejected input',
      statusCode: 400,
      upstreamRequestId: 'real-mastra-request',
      result: { finishReason: 'error' },
    });
    expect(calls).toHaveLength(1);
  },
);

test.each(['generate', 'stream'] as const)(
  '%s uses one model request, converts only final output and keeps usage',
  async mode => {
    const service = new LynxXmlAgentService();
    const log = rstest.fn((
      _event: string,
      _details?: Record<string, unknown>,
    ) => undefined);
    const options = {
      enableHtmlFragment: true,
      enableWebSearch: false,
      enableImageGeneration: false,
      onPerformanceEvent: log,
    };
    let result;
    if (mode === 'generate') result = await service.generateRaw([], options);
    else {
      const stream = await service.streamAsAsyncIterable([], options);
      let streamed = '';
      for await (const chunk of stream.textStream) streamed += chunk;
      expect(streamed).toBe(INTERMEDIATE);
      result = await stream.finalize();
    }
    expect(calls).toHaveLength(1);
    expect(result.text).not.toContain('<template>');
    expect(result.text).toContain('__CreateView(pageId)');
    expect(result.metadata).toEqual({
      modelOutput: INTERMEDIATE,
      xmlFragment: FRAGMENT,
    });
    expect(result.usage).toMatchObject(USAGE);
    expect(log).toHaveBeenCalledWith(
      'agent.model.completed',
      expect.objectContaining({ stepCount: 1 }),
    );
  },
);

test('isolates cached configurations and defaults to direct output', async () => {
  const service = new LynxXmlAgentService();
  for (const enableHtmlFragment of [undefined, true, false, true]) {
    const result = await service.generateRaw([], {
      enableHtmlFragment,
      enableWebSearch: false,
      enableImageGeneration: false,
    });
    expect(result.metadata.xmlFragment).toBe(
      enableHtmlFragment ? FRAGMENT : undefined,
    );
    if (!enableHtmlFragment) expect(result.text).toBe(DIRECT);
  }
  expect(calls).toHaveLength(4);
  expect(createLLMProvider).toHaveBeenCalledTimes(2);
});

test.each(['generate', 'stream'] as const)(
  '%s conversion failures preserve model evidence and never silently request another round',
  async mode => {
    override = INTERMEDIATE.replace(FRAGMENT, '<view><text></view>');
    const service = new LynxXmlAgentService();
    const options = {
      enableHtmlFragment: true,
      enableWebSearch: false,
      enableImageGeneration: false,
    };
    const run = async () => {
      if (mode === 'generate') return service.generateRaw([], options);
      const stream = await service.streamAsAsyncIterable([], options);
      for await (
        const _chunk of stream.textStream
      ) { /* consume before finalization */ }
      return stream.finalize();
    };
    await expect(run()).rejects.toMatchObject({
      name: 'GenerationPostprocessError',
      result: { text: override, usage: USAGE, finishReason: 'stop' },
    });
    expect(calls).toHaveLength(1);
  },
);

test('keeps token-limit failures actionable', () => {
  const error = new GenerationPostprocessError(new Error('Missing template'), {
    text: '',
    usage: USAGE,
    finishReason: 'length',
  });
  expect(error.message).toContain('token limit');
  expect(error.result.usage).toEqual(USAGE);
});
