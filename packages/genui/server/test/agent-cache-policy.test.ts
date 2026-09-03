// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, describe, expect, rstest, test } from '@rstest/core';

import { createA2UIAgent } from '../agent/a2ui-agent.js';
import type { A2UICatalog } from '../agent/a2ui-catalog.js';
import { createHtmlAgent } from '../agent/html-agent.js';
import { createLynxXmlAgent } from '../agent/lynx-xml-agent.js';
import { createMcpAppsAgent } from '../agent/mcp-apps-agent.js';
import { createOpenUIAgent } from '../agent/openui-agent.js';
import A2UIAgentService from '../service/a2ui-agent.js';
import HtmlAgentService from '../service/html-agent.js';
import LynxXmlAgentService from '../service/lynx-xml-agent.js';
import { McpAppsAgentService } from '../service/mcp-apps-agent.js';
import OpenUIAgentService from '../service/openui-agent.js';

rstest.mock('../agent/a2ui-agent.js', { mock: true });
rstest.mock('../agent/html-agent.js', { mock: true });
rstest.mock('../agent/openui-agent.js', { mock: true });
rstest.mock('../agent/lynx-xml-agent.js', { mock: true });
rstest.mock('../agent/mcp-apps-agent.js', { mock: true });

const catalog: A2UICatalog = {
  id: 'cache-policy-test',
  label: 'Cache policy test',
  components: [],
  examples: [],
};

function testAgent() {
  return {
    generate: () =>
      Promise.resolve({
        text: 'generated',
        usage: {},
        finishReason: 'stop',
      }),
    stream: () => Promise.resolve({ textStream: undefined }),
    resumeGenerate: () => Promise.resolve({}),
    resumeStream: () => Promise.resolve({}),
  };
}

beforeEach(() => {
  rstest.mocked(createA2UIAgent).mockReset();
  rstest.mocked(createHtmlAgent).mockReset();
  rstest.mocked(createOpenUIAgent).mockReset();
  rstest.mocked(createLynxXmlAgent).mockReset();
  rstest.mocked(createMcpAppsAgent).mockReset();
});

describe('request-scoped provider agent policy', () => {
  test('A2UI bypasses its cache for ephemeral credentials', async () => {
    rstest.mocked(createA2UIAgent).mockImplementation(async () => ({
      agent: testAgent(),
      catalog,
      model: 'test-model',
    }));
    const service = new A2UIAgentService();
    const options = {
      apiKey: 'request-scoped-key',
      catalog,
      disableAgentCache: true,
    };

    await service.generateRaw([], options);
    await service.generateRaw([], options);

    expect(createA2UIAgent).toHaveBeenCalledTimes(2);
  });

  test('OpenUI bypasses its cache for ephemeral credentials', async () => {
    rstest.mocked(createOpenUIAgent).mockImplementation(() => ({
      agent: testAgent(),
      model: 'test-model',
    }));
    const service = new OpenUIAgentService();
    const options = {
      apiKey: 'request-scoped-key',
      disableAgentCache: true,
    };

    const first = await service.generateRaw([], options);
    const second = await service.generateRaw([], options);

    expect(createOpenUIAgent).toHaveBeenCalledTimes(2);
    expect(first.text).toBe('generated');
    expect(second.text).toBe('generated');
  });

  test('Lynx XML bypasses its cache for ephemeral credentials', async () => {
    rstest.mocked(createLynxXmlAgent).mockImplementation(() => ({
      agent: testAgent(),
      model: 'test-model',
    }));
    const service = new LynxXmlAgentService();
    const options = {
      apiKey: 'request-scoped-key',
      disableAgentCache: true,
    };

    const first = await service.generateRaw([], options);
    const second = await service.generateRaw([], options);

    expect(createLynxXmlAgent).toHaveBeenCalledTimes(2);
    expect(first.text).toBe('generated');
    expect(second.text).toBe('generated');
  });

  test('HTML bypasses its cache for ephemeral credentials', async () => {
    rstest.mocked(createHtmlAgent).mockImplementation(() => ({
      agent: testAgent(),
      model: 'test-model',
    }));
    const service = new HtmlAgentService();
    const options = {
      apiKey: 'request-scoped-key',
      disableAgentCache: true,
    };

    const first = await service.generateRaw([], options);
    const second = await service.generateRaw([], options);

    expect(createHtmlAgent).toHaveBeenCalledTimes(2);
    expect(first.text).toBe('generated');
    expect(second.text).toBe('generated');
  });

  test('MCP Apps bypasses its cache for ephemeral credentials', async () => {
    rstest.mocked(createMcpAppsAgent).mockImplementation(() => ({
      agent: testAgent(),
      model: 'test-model',
    }));
    const service = new McpAppsAgentService();
    const options = {
      apiKey: 'request-scoped-key',
      disableAgentCache: true,
    };

    await service.generateRaw([], options);
    await service.generateRaw([], options);

    expect(createMcpAppsAgent).toHaveBeenCalledTimes(2);
  });
});
