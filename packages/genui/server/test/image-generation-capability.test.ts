// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Agent } from '@mastra/core/agent';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  rstest,
  test,
} from '@rstest/core';

import { createA2UIAgent } from '../agent/a2ui/a2ui-agent.js';
import type { GenerationAgentOptions } from '../agent/common/agent-capabilities.js';
import { createLLMProvider } from '../agent/common/openai-provider.js';
import { createHtmlAgent } from '../agent/html/html-agent.js';
import { createLynxXmlAgent } from '../agent/lynx-xml/lynx-xml-agent.js';
import { createMcpAppsAgent } from '../agent/mcp-apps/mcp-apps-agent.js';
import { createOpenUIAgent } from '../agent/openui/openui-agent.js';
import A2UIAgentService from '../service/a2ui/a2ui-agent.js';
import HtmlAgentService from '../service/html/html-agent.js';
import LynxXmlAgentService from '../service/lynx-xml/lynx-xml-agent.js';
import { McpAppsAgentService } from '../service/mcp-apps/mcp-apps-agent.js';
import OpenUIAgentService from '../service/openui/openui-agent.js';

rstest.mock('../agent/common/openai-provider.js', { mock: true });

const imageUrl = 'https://images.example.com/generated.png';
const imageCalls: string[] = [];
const environment = {
  SEARCH_INFINITY_API_KEY: 'image-test-key',
  SEARCH_INFINITY_REQUEST_TIMEOUT_MS: '5000',
  IMG_GEN_ARK_API_KEY: 'image-test-key',
  IMG_GEN_ARK_IMAGE_MODEL: 'image-test-model',
  IMG_GEN_ARK_IMAGE_BASE_URL: 'https://ark.example.com/api/v3',
};
let previousEnvironment: Record<string, string | undefined>;

function readableStream<T>(chunks: T[]): ReadableStream<T> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

interface ModelCallOptions {
  prompt: unknown;
  tools?: { name?: string }[];
}

function imageStep(options: ModelCallOptions) {
  const enabled = options.tools?.some((tool) => tool.name === 'generate_image');
  const prompt = JSON.stringify(options.prompt);
  const hasResults = prompt.includes('"role":"tool"');
  if (enabled && hasResults) {
    expect(prompt).toContain(imageUrl);
  }
  return { enabled, needsImage: enabled && !hasResults };
}

function toolCalls() {
  return [{
    type: 'tool-call' as const,
    toolCallId: 'generate-image-call',
    toolName: 'generate_image',
    input: '{"prompt":"an original landscape"}',
  }];
}

/** Exercise real Mastra multi-step execution without any model or network I/O. */
const model = {
  specificationVersion: 'v2' as const,
  provider: 'image-test',
  modelId: 'image-test',
  supportedUrls: {},
  doGenerate: (options: ModelCallOptions) => {
    const { enabled, needsImage } = imageStep(options);
    return Promise.resolve({
      content: needsImage ? toolCalls() : [{
        type: 'text' as const,
        text: enabled ? 'generated output' : 'generation disabled',
      }],
      finishReason: needsImage ? 'tool-calls' as const : 'stop' as const,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      warnings: [],
    });
  },
  doStream: (options: ModelCallOptions) => {
    const { enabled, needsImage } = imageStep(options);
    return Promise.resolve({
      stream: readableStream([
        { type: 'stream-start' as const, warnings: [] },
        ...(needsImage
          ? toolCalls()
          : [
            { type: 'text-start' as const, id: 'answer' },
            {
              type: 'text-delta' as const,
              id: 'answer',
              delta: enabled ? 'generated output' : 'generation disabled',
            },
            { type: 'text-end' as const, id: 'answer' },
          ]),
        {
          type: 'finish' as const,
          finishReason: needsImage ? 'tool-calls' as const : 'stop' as const,
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
    });
  },
};

beforeEach(() => {
  previousEnvironment = {};
  for (const [key, value] of Object.entries(environment)) {
    previousEnvironment[key] = process.env[key];
    process.env[key] = value;
  }
  imageCalls.length = 0;
  rstest.mocked(createLLMProvider).mockReturnValue({
    buildModel: () => model,
    model: 'image-test',
    provider: {} as never,
    api: 'chat',
    baseURL: 'https://provider.example.com/v1',
  });
  rstest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    expect(input).toBe('https://ark.example.com/api/v3/images/generations');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    if (typeof init?.body !== 'string') {
      throw new Error('Expected JSON request body');
    }
    imageCalls.push(init.body);
    return Promise.resolve(
      new Response(JSON.stringify({ data: [{ url: imageUrl }] })),
    );
  });
});

afterEach(() => {
  rstest.restoreAllMocks();
  for (const [key, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const factories: [string, (opts: GenerationAgentOptions) => unknown][] = [
  ['A2UI', createA2UIAgent],
  ['OpenUI', createOpenUIAgent],
  ['HTML', createHtmlAgent],
  ['Lynx XML', createLynxXmlAgent],
  ['MCP Apps', createMcpAppsAgent],
];

describe('shared image generation capability', () => {
  test.each(factories)(
    '%s registers image generation independently of search and only with valid configuration',
    async (name, create) => {
      for (const enableWebSearch of [true, false]) {
        for (const enableImageGeneration of [undefined, true, false]) {
          const { agent } = await create({
            enableWebSearch,
            enableImageGeneration,
          }) as { agent: Agent };
          const tools = Object.keys(await agent.listTools());
          expect(tools.includes('generate_image')).toBe(
            enableImageGeneration !== false,
          );
          expect(tools.includes('image_search')).toBe(enableWebSearch);
          if (name === 'Lynx XML') {
            expect(tools).toContain('html_fragment_to_main_thread_script');
          }
          const instructions = await agent.getInstructions();
          if (typeof instructions !== 'string') {
            throw new Error('Expected string instructions');
          }
          expect(
            instructions.includes('## Server-side image generation'),
          ).toBe(enableImageGeneration !== false);
          if (enableImageGeneration === false) {
            expect(instructions).not.toContain('Call generate_image');
            expect(instructions).not.toContain(
              '## Image generation tool',
            );
          }
        }
      }
      for (
        const key of [
          'IMG_GEN_ARK_API_KEY',
          'IMG_GEN_ARK_IMAGE_MODEL',
          'IMG_GEN_ARK_IMAGE_BASE_URL',
        ]
      ) {
        const original = process.env[key];
        delete process.env[key];
        const { agent } = await create({}) as { agent: Agent };
        expect(await agent.listTools()).not.toHaveProperty('generate_image');
        process.env[key] = original;
      }
      process.env.IMG_GEN_ARK_IMAGE_BASE_URL = 'http://invalid.example.com';
      const { agent } = await create({}) as { agent: Agent };
      expect(await agent.listTools()).not.toHaveProperty('generate_image');
    },
  );

  const services = [
    ['A2UI', () => new A2UIAgentService()],
    ['OpenUI', () => new OpenUIAgentService()],
    ['HTML', () => new HtmlAgentService()],
    ['Lynx XML', () => new LynxXmlAgentService()],
    ['MCP Apps', () => new McpAppsAgentService()],
  ] as const;

  test.each(services)(
    '%s executes image generation with a fresh budget on cached and uncached requests',
    async (_name, create) => {
      const service = create();
      const messages = [{
        role: 'user' as const,
        content: 'Generate an original landscape image',
      }];
      for (const opts of [{}, {}, {}, {}, {}, { disableAgentCache: true }]) {
        const result = await service.generateRaw(messages, opts);
        expect(result.text).toBe('generated output');
      }
      expect(imageCalls).toHaveLength(6);
      const disabled = await service.generateRaw(messages, {
        enableImageGeneration: false,
      });
      expect(disabled.text).toBe('generation disabled');
      expect(imageCalls).toHaveLength(6);
      const enabled = await service.generateRaw(messages);
      expect(enabled.text).toBe('generated output');
      expect(imageCalls).toHaveLength(7);
    },
  );

  const streamingServices = [
    ['A2UI', () => new A2UIAgentService()],
    ['OpenUI', () => new OpenUIAgentService()],
    ['HTML', () => new HtmlAgentService()],
    ['Lynx XML', () => new LynxXmlAgentService()],
  ] as const;

  test.each(streamingServices)(
    '%s streams the answer after consuming image results',
    async (name, create) => {
      const result = await create().streamAsAsyncIterable([
        { role: 'user', content: 'Generate an original image' },
      ]);
      let text = '';
      for await (const chunk of result.textStream) text += chunk;
      expect(text).toBe(
        name === 'A2UI' ? '\ngenerated output' : 'generated output',
      );
      expect(await result.finalize()).toMatchObject({
        text: 'generated output',
        finishReason: 'stop',
      });
      expect(imageCalls).toHaveLength(1);
    },
  );
});
