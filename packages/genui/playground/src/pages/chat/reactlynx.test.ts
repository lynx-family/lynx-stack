// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@rstest/core';

import { REACTLYNX_CHAT_ADAPTER as adapter } from './reactlynx.js';
import type { ReactLynxStreamState } from './reactlynx.js';
import { createDefaultProviderSettings } from './shared.js';
import { parseRouteHash } from '../../utils/appRoute.js';

const reduceStream = adapter.stream.reduce.bind(adapter.stream);

const files = {
  'App.tsx': 'export default () => <text>Hello</text>;',
  'App.css': '',
};
const artifact = {
  webUrl: 'https://example.com/main.web.js',
  nativeUrl: 'https://example.com/main.lynx.js',
};

test('streams source and build status without previewing an incomplete bundle', () => {
  let state: ReactLynxStreamState = adapter.stream.initial();
  const partial = reduceStream(state, {
    event: 'delta',
    data: { text: '{"files":' },
  });
  state = partial.state;
  expect(partial.emissions.some(item => item.type === 'partial')).toBe(true);
  expect(adapter.stream.finish(state)).toBeNull();
  expect(adapter.preview.source(state.output)).toBeUndefined();
  const status = reduceStream(state, {
    event: 'build',
    data: { status: 'building' },
  });
  expect(status.emissions).toEqual([{
    type: 'progress',
    text: 'Building ReactLynx for Web and Native...',
  }]);
  const final = reduceStream(state, {
    event: 'done',
    data: {
      text: JSON.stringify({ files }),
      metadata: { artifact },
    },
  });
  expect(adapter.stream.finish(final.state)?.artifact).toEqual(artifact);
  expect(adapter.preview.source(final.state.output)).toEqual({
    kind: 'reactlynx',
    ...artifact,
  });
});

test('requires completed build metadata and rejects non-HTTP artifacts', () => {
  expect(() => adapter.stream.fromJson({ text: JSON.stringify({ files }) }))
    .toThrow();
  expect(() =>
    adapter.stream.fromJson({
      text: JSON.stringify({ files }),
      metadata: { artifact: { ...artifact, webUrl: 'javascript:alert(1)' } },
    })
  ).toThrow();
});

test('ignores legacy proxy URLs and keeps the direct TOS artifact URL', () => {
  const output = adapter.stream.fromJson({
    text: JSON.stringify({ files }),
    metadata: {
      artifact: {
        ...artifact,
        previewUrl:
          'https://server.example/reactlynx/artifacts/00000000-0000-4000-8000-000000000000/main.web.js',
      },
    },
  }).state.output;

  expect(output.artifact).toEqual(artifact);
});

test('restores source and artifacts while sending only source to the model', () => {
  const output = adapter.stream.fromJson({
    text: JSON.stringify({ files }),
    metadata: { artifact },
  }).state.output;
  const saved = adapter.persist(output);
  const history = [{
    role: 'assistant' as const,
    content: saved.assistantContent,
    previewMetrics: { artifactBuildMs: 320 },
  }];
  const restored = adapter.hydrate({
    history,
    previewMessages: [],
    previewPayloadUrls: null,
  });
  expect(restored.output).toEqual({
    source: JSON.stringify({ files }),
    files,
    artifact,
  });
  expect(restored.metrics).toEqual({ artifactBuildMs: 320 });
  const request = adapter.createRequest({
    prompt: 'Change the title',
    conversation: { history, dataModel: {} },
    settings: createDefaultProviderSettings(),
    signal: new AbortController().signal,
    host: {
      hostname: 'localhost',
      protocol: 'http:',
      origin: 'http://localhost',
      search: '',
      baseUrl: 'http://localhost/',
    },
  });
  expect(request.body.conversation.history[0]?.content).toBe(
    JSON.stringify({ files }),
  );
  expect(parseRouteHash('#/reactlynx').protocol.name).toBe('reactlynx');
});
