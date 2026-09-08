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
import { SEARCH_INFINITY_ENDPOINT } from '../agent/common/doubao-search-tool.js';
import { createLLMProvider } from '../agent/common/openai-provider.js';
import type { SearchAgentOptions } from '../agent/common/search-capability.js';
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

const imageUrl = 'https://images.example.com/searched.png';
const sourceUrl = 'https://news.example.com/source';
const searchCalls: string[] = [];
const environment = {
  SEARCH_INFINITY_API_KEY: 'search-test-key',
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

function searchStep(options: ModelCallOptions) {
  const enabled = options.tools?.some((tool) => tool.name === 'web_search');
  const prompt = JSON.stringify(options.prompt);
  const hasResults = prompt.includes('"role":"tool"');
  if (enabled && hasResults) {
    expect(prompt).toContain(imageUrl);
    expect(prompt).toContain(sourceUrl);
  }
  return { enabled, needsSearch: enabled && !hasResults };
}

function toolCalls() {
  return ['web_search', 'image_search'].map((toolName) => ({
    type: 'tool-call' as const,
    toolCallId: `${toolName}-call`,
    toolName,
    input: '{"query":"a current landscape"}',
  }));
}

/** Exercise real Mastra multi-step execution without any model or network I/O. */
const model = {
  specificationVersion: 'v2' as const,
  provider: 'search-test',
  modelId: 'search-test',
  supportedUrls: {},
  doGenerate: (options: ModelCallOptions) => {
    const { enabled, needsSearch } = searchStep(options);
    return Promise.resolve({
      content: needsSearch ? toolCalls() : [{
        type: 'text' as const,
        text: enabled ? 'searched output' : 'search disabled',
      }],
      finishReason: needsSearch ? 'tool-calls' as const : 'stop' as const,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      warnings: [],
    });
  },
  doStream: (options: ModelCallOptions) => {
    const { enabled, needsSearch } = searchStep(options);
    return Promise.resolve({
      stream: readableStream([
        { type: 'stream-start' as const, warnings: [] },
        ...(needsSearch
          ? toolCalls()
          : [
            { type: 'text-start' as const, id: 'answer' },
            {
              type: 'text-delta' as const,
              id: 'answer',
              delta: enabled ? 'searched output' : 'search disabled',
            },
            { type: 'text-end' as const, id: 'answer' },
          ]),
        {
          type: 'finish' as const,
          finishReason: needsSearch ? 'tool-calls' as const : 'stop' as const,
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
  searchCalls.length = 0;
  rstest.mocked(createLLMProvider).mockReturnValue({
    buildModel: () => model,
    model: 'search-test',
    provider: {} as never,
    api: 'chat',
    baseURL: 'https://provider.example.com/v1',
  });
  rstest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    expect(input).toBe(SEARCH_INFINITY_ENDPOINT);
    if (typeof init?.body !== 'string') {
      throw new Error('Expected JSON request body');
    }
    const body = JSON.parse(init.body) as { SearchType: string };
    searchCalls.push(body.SearchType);
    return Promise.resolve(
      new Response(JSON.stringify({
        Result: {
          ResultCount: 1,
          WebResults: [{
            Url: sourceUrl,
            Title: 'Current source',
            Summary: 'Current facts',
          }],
          ImageResults: [{
            Url: sourceUrl,
            Title: 'Landscape',
            Image: { Url: imageUrl },
          }],
        },
      })),
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

const factories: [string, (opts: SearchAgentOptions) => unknown][] = [
  ['A2UI', createA2UIAgent],
  ['OpenUI', createOpenUIAgent],
  ['HTML', createHtmlAgent],
  ['Lynx XML', createLynxXmlAgent],
  ['MCP Apps', createMcpAppsAgent],
];

describe('shared search capability', () => {
  test.each(factories)(
    '%s registers search conditionally and preserves its own tools',
    async (name, create) => {
      const ownTools = name === 'A2UI'
        ? ['generate_image']
        : (name === 'Lynx XML'
          ? ['html_fragment_to_main_thread_script']
          : []);
      for (const enabled of [true, false]) {
        const { agent } = await create({ enableWebSearch: enabled }) as {
          agent: Agent;
        };
        expect(Object.keys(await agent.listTools()).sort()).toEqual(
          [...ownTools, ...(enabled ? ['web_search', 'image_search'] : [])]
            .sort(),
        );
        const instructions = await agent.getInstructions();
        if (typeof instructions !== 'string') {
          throw new Error('Expected string instructions');
        }
        expect(instructions.includes('## Server-side search tools')).toBe(
          enabled,
        );
        if (enabled && name !== 'A2UI') {
          expect(instructions).not.toContain('generate_image');
        }
      }
      delete process.env.SEARCH_INFINITY_API_KEY;
      const { agent } = await create({}) as { agent: Agent };
      expect(Object.keys(await agent.listTools()).sort()).toEqual(ownTools);
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
    '%s executes both tools with a fresh budget on cached and uncached requests',
    async (_name, create) => {
      const service = create();
      const messages = [{
        role: 'user' as const,
        content: 'Search for current facts and a landscape image',
      }];
      for (const opts of [{}, {}, { disableAgentCache: true }]) {
        const result = await service.generateRaw(messages, opts);
        expect(result.text).toBe('searched output');
      }
      expect(searchCalls.filter((type) => type === 'web')).toHaveLength(3);
      expect(searchCalls.filter((type) => type === 'image')).toHaveLength(3);
      const disabled = await service.generateRaw(messages, {
        enableWebSearch: false,
      });
      expect(disabled.text).toBe('search disabled');
      expect(searchCalls).toHaveLength(6);
      const enabled = await service.generateRaw(messages);
      expect(enabled.text).toBe('searched output');
      expect(searchCalls).toHaveLength(8);
    },
  );

  const streamingServices = [
    ['A2UI', () => new A2UIAgentService()],
    ['OpenUI', () => new OpenUIAgentService()],
    ['HTML', () => new HtmlAgentService()],
    ['Lynx XML', () => new LynxXmlAgentService()],
  ] as const;

  test.each(streamingServices)(
    '%s streams the answer after consuming search results',
    async (_name, create) => {
      const result = await create().streamAsAsyncIterable([
        { role: 'user', content: 'Search for facts and an image' },
      ]);
      let text = '';
      for await (const chunk of result.textStream) text += chunk;
      expect(text).toBe('searched output');
      expect(await result.finalize()).toMatchObject({
        text: 'searched output',
        finishReason: 'stop',
      });
      expect(searchCalls.sort()).toEqual(['image', 'web']);
    },
  );
});
