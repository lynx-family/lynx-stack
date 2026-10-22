// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, rstest, test } from '@rstest/core';

import { searchDoubaoImagesForRun } from '../agent/common/doubao-search-tool.js';
import { createLLMProvider } from '../agent/common/openai-provider.js';
import { createOpenUIAgent } from '../agent/openui/openui-agent.js';
import { buildCapabilityRunOptions } from '../service/common/agent-capabilities.js';
import { createOpenUIImageGuard } from '../service/openui/image-sources.js';

rstest.mock('../agent/common/openai-provider.js', { mock: true });

test('allows image search results only in the request that obtained them', async () => {
  const scope = buildCapabilityRunOptions({}, undefined, 'openui');
  const guard = createOpenUIImageGuard([], scope, {});
  const url = 'https://images.example.com/searched.jpg';
  const text = `root = Stack([Image("${url}")])`;
  expect(guard(text)).toBe(false);
  await searchDoubaoImagesForRun(
    scope,
    { apiKey: 'test-key', requestTimeoutMs: 1000 },
    'sunny weather',
    async () =>
      new Response(JSON.stringify({
        Result: { ImageResults: [{ Title: 'Sunshine', Image: { Url: url } }] },
      })),
  );
  expect(guard(text)).toBe(true);
  expect(
    createOpenUIImageGuard(
      [],
      buildCapabilityRunOptions({}, undefined, 'openui'),
      {},
    )(text),
  ).toBe(false);
});

test('checks literal, state and Query-default image URLs against supplied values', () => {
  const url = 'https://images.example.com/sf-sunny.jpg';
  const allowed = createOpenUIImageGuard(
    [{ role: 'user', content: `Use ${url}` }],
    buildCapabilityRunOptions({}, undefined, 'openui'),
    {},
  );
  const blocked = createOpenUIImageGuard(
    [],
    buildCapabilityRunOptions({}, undefined, 'openui'),
    {},
  );
  const programs = [
    `root = Stack([Image("${url}")])`,
    `$photo = "${url}"\nroot = Stack([Image($photo)])`,
    `weather = Query("weather", {}, { photo: "${url}" })\nroot = Stack([Image(weather.photo)])`,
  ];
  for (const text of programs) {
    expect(allowed(text)).toBe(true);
    expect(blocked(text)).toBe(false);
  }
  expect(blocked('root = Stack([Text("Sunny"), Icon("star")])')).toBe(true);
  expect(allowed(`root = Stack([Image("${url.slice(0, -4)}`)).toBe(false);
  expect(allowed(`photo = Image("${url}")`)).toBe(true);
  expect(blocked(`photo = Image("${url}")`)).toBe(false);
  expect(allowed(`photo = Image("${url}")\nroot = Stack([photo])`)).toBe(true);
});

test('keeps media provenance guidance when both image capabilities are disabled', async () => {
  rstest.mocked(createLLMProvider).mockReturnValue({
    buildModel: () => ({
      specificationVersion: 'v2',
      provider: 'test',
      modelId: 'test',
      supportedUrls: {},
      doGenerate: () => {
        throw new Error('No model call expected');
      },
      doStream: () => {
        throw new Error('No model call expected');
      },
    }),
    model: 'test',
    provider: {} as never,
    api: 'chat',
    baseURL: 'https://provider.example.com',
  });
  const { agent } = createOpenUIAgent({
    enableWebSearch: false,
    enableImageGeneration: false,
  });
  const instructions =
    await (agent as unknown as { getInstructions(): Promise<string> })
      .getInstructions();
  expect(instructions).toContain('Never invent image URLs');
  expect(instructions).not.toContain('https://example.com/map.png');
  expect(instructions).not.toContain('https://example.com/briefing.mp3');
});
