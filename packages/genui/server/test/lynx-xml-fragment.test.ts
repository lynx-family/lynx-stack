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
let budgets: (number | undefined)[];
let override: string | undefined;
let upstreamFailure: Error | undefined;
let queued: { text: string; finishReason: 'stop' | 'length' }[];

function response(options: {
  prompt: unknown;
  tools?: { name?: string }[];
  maxOutputTokens?: number;
}) {
  const prompt = JSON.stringify(options.prompt);
  calls.push(prompt);
  budgets.push(options.maxOutputTokens);
  expect(
    options.tools?.some(tool =>
      tool.name === 'html_fragment_to_main_thread_script'
    ) ?? false,
  ).toBe(false);
  return queued.shift() ?? {
    text: override
      ?? (prompt.includes('Template mode') ? INTERMEDIATE : DIRECT),
    finishReason: 'stop' as const,
  };
}

beforeEach(() => {
  calls = [];
  budgets = [];
  queued = [];
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
        const { text, finishReason } = response(options);
        return Promise.resolve({
          content: [{ type: 'text' as const, text }],
          finishReason,
          usage: USAGE,
          warnings: [],
        });
      },
      doStream(options) {
        const { text, finishReason } = response(options);
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
                finishReason,
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
  'real Mastra streaming returns truncated XML errors without continuation (fragment=%s)',
  async enableHtmlFragment => {
    const document = enableHtmlFragment ? INTERMEDIATE : DIRECT;
    const split = document.indexOf('const page') + 'const pa'.length;
    const prefix = document.slice(0, split);
    queued = [
      { text: prefix, finishReason: 'length' },
      {
        text: prefix.slice(-128) + document.slice(split),
        finishReason: 'stop',
      },
    ];
    const log = rstest.fn((
      _event: string,
      _details?: Record<string, unknown>,
    ) => undefined);
    const service = new LynxXmlAgentService();
    const stream = await service.streamAsAsyncIterable([
      { role: 'user', content: 'Make a weather card for Hangzhou.' },
    ], {
      enableHtmlFragment,
      enableWebSearch: false,
      enableImageGeneration: false,
      onPerformanceEvent: log,
    });
    let streamed = '';
    for await (const chunk of stream.textStream) streamed += chunk;
    expect(streamed).toBe(prefix);
    await expect(stream.finalize()).rejects.toMatchObject({
      result: { text: prefix, finishReason: 'length', usage: USAGE },
    });
    expect(calls).toHaveLength(1);
    expect(budgets).toEqual([32_768]);
    expect(createLLMProvider).toHaveBeenCalledTimes(1);
    expect(log.mock.calls.some(([event]) => event === 'agent.recovery.started'))
      .toBe(false);
  },
);

test.each([false, true])(
  'real Mastra streaming returns empty token-limit errors without regeneration (fragment=%s)',
  async enableHtmlFragment => {
    queued = [{ text: '', finishReason: 'length' }];
    const service = new LynxXmlAgentService();
    const stream = await service.streamAsAsyncIterable([], {
      enableHtmlFragment,
      enableWebSearch: false,
      enableImageGeneration: false,
    });
    for await (const _chunk of stream.textStream) { /* drain */ }
    await expect(stream.finalize()).rejects.toMatchObject({
      result: { text: '', finishReason: 'length', usage: USAGE },
    });
    expect(calls).toHaveLength(1);
    expect(budgets).toEqual([32_768]);
  },
);

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
  '%s applies both independent options and isolates all four agent cache variants',
  async mode => {
    const service = new LynxXmlAgentService();
    for (const enableHtmlFragment of [false, true]) {
      override = enableHtmlFragment
        ? INTERMEDIATE.replace(
          'id="root"',
          'id="root" class="flex flex-col p-4"',
        )
        : DIRECT.replace(
          '</script>',
          '__SetClasses(page, "flex flex-col p-4");</script>',
        );
      for (const stylePreset of [false, 'default', false, 'default'] as const) {
        const options = {
          enableHtmlFragment,
          stylePreset,
          enableWebSearch: false,
          enableImageGeneration: false,
        };
        let result;
        if (mode === 'generate') {
          result = await service.generateRaw([], options);
        } else {
          const stream = await service.streamAsAsyncIterable([], options);
          let raw = '';
          for await (const chunk of stream.textStream) raw += chunk;
          expect(raw).toBe(override);
          result = await stream.finalize();
        }
        expect(result.text?.includes('.p-4 { padding: 16px; }')).toBe(
          stylePreset === 'default',
        );
        expect(result.text?.match(/<style>/gu) ?? []).toHaveLength(
          enableHtmlFragment || stylePreset ? 1 : 0,
        );
        expect(result.metadata.xmlFragment !== undefined).toBe(
          enableHtmlFragment,
        );
        expect(result.text).not.toContain('<template>');
        expect(calls.at(-1)?.includes('Lynx StylePreset')).toBe(
          stylePreset === 'default',
        );
        expect(result.metadata.modelOutput).toBe(override);
        expect(result.metadata.stylePreset).toBe(stylePreset || undefined);
        expect(result.usage).toMatchObject(USAGE);
      }
    }
    expect(createLLMProvider).toHaveBeenCalledTimes(4);
    expect(calls).toHaveLength(8);
  },
);

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

test.each(['generate', 'stream'] as const)(
  '%s isolates all ScriptReuse/Template/StylePreset variants and retains raw evidence',
  async mode => {
    const service = new LynxXmlAgentService();
    for (const enableHtmlFragment of [false, true]) {
      for (const stylePreset of [false, 'default'] as const) {
        for (const enableScriptReuse of [false, true, false, true]) {
          override = enableScriptReuse
            ? `<!doctype lynx><lynx engine-version="4.2">${
              enableHtmlFragment ? `<template>${FRAGMENT}</template>` : ''
            }<script thread="main">definePage({render(ctx) { __SetClasses(ctx.page, "flex flex-col p-4"); }});</script></lynx>`
            : (enableHtmlFragment ? INTERMEDIATE : DIRECT);
          const options = {
            enableHtmlFragment,
            stylePreset,
            enableScriptReuse,
            enableWebSearch: false,
            enableImageGeneration: false,
          };
          let result;
          if (mode === 'generate') {
            result = await service.generateRaw([], options);
          } else {
            const stream = await service.streamAsAsyncIterable([], options);
            let raw = '';
            for await (const chunk of stream.textStream) raw += chunk;
            expect(raw).toBe(override);
            result = await stream.finalize();
          }
          expect(result.metadata.modelOutput).toBe(override);
          expect(result.metadata.enableScriptReuse).toBe(
            enableScriptReuse || undefined,
          );
          expect(result.text?.includes('function definePage')).toBe(
            enableScriptReuse,
          );
          expect(calls.at(-1)?.includes('ScriptReuse is enabled')).toBe(
            enableScriptReuse,
          );
          expect(result.usage).toMatchObject(USAGE);
        }
      }
    }
    expect(createLLMProvider).toHaveBeenCalledTimes(8);
    expect(calls).toHaveLength(16);
  },
);

test('ScriptReuse failure preserves usage without a hidden model retry', async () => {
  override = DIRECT;
  await expect(new LynxXmlAgentService().generateRaw([], {
    enableScriptReuse: true,
    enableWebSearch: false,
    enableImageGeneration: false,
  })).rejects.toMatchObject({
    name: 'GenerationPostprocessError',
    result: { text: DIRECT, usage: USAGE, finishReason: 'stop' },
  });
  expect(calls).toHaveLength(1);
});
