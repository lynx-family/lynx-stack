// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@rstest/core';

import { REACTWEB_CHAT_ADAPTER as adapter } from './reactweb.js';
import { createDefaultProviderSettings } from './shared.js';
import { parseRouteHash } from '../../utils/appRoute.js';

const reduceStream = adapter.stream.reduce.bind(adapter.stream);
const files = {
  'App.tsx': 'export default () => <div>Hello</div>;',
  'App.css': '',
};
const artifact = { webUrl: 'https://example.com/index.html' };
const complete = () =>
  adapter.stream.fromJson({
    text: JSON.stringify({ files }),
    metadata: { artifact },
  });

test('source and build progress do not expose an unfinished preview', () => {
  const partial = reduceStream(adapter.stream.initial(), {
    event: 'delta',
    data: { text: '{"files":' },
  });
  const source = reduceStream(partial.state, {
    event: 'source',
    data: { files },
  });
  expect(adapter.stream.finish(source.state)).toBeNull();
  expect(adapter.preview.source(source.state.output)).toBeUndefined();
  expect(
    adapter.preview.artifact(source.state.output).views.map(view => view.label),
  )
    .toEqual(['App.tsx', 'App.css']);
  expect(
    reduceStream(source.state, {
      event: 'build',
      data: { status: 'publishing' },
    }).emissions,
  )
    .toEqual([{ type: 'progress', text: 'Publishing the compiled page...' }]);
  expect(adapter.preview.source(complete().state.output)).toEqual({
    kind: 'reactweb',
    ...artifact,
  });
});

test.each([undefined, { webUrl: 'javascript:alert(1)' }, {
  webUrl: 'https://user:password@example.com/',
}])(
  'rejects missing or invalid artifact metadata (case %#)',
  invalid => {
    expect(() =>
      adapter.stream.fromJson({
        text: JSON.stringify({ files }),
        metadata: { artifact: invalid },
      })
    ).toThrow('completed ReactWeb build');
  },
);

test('propagates generation failures', () => {
  expect(() =>
    reduceStream(adapter.stream.initial(), {
      event: 'error',
      data: { error: 'Compilation failed' },
    })
  ).toThrow('Compilation failed');
});

test('restores persisted source and URLs and excludes URLs from follow-up model context', () => {
  const output = complete().state.output;
  const saved = adapter.persist(output);
  const history = [
    { role: 'user' as const, content: 'Create a card' },
    {
      role: 'assistant' as const,
      content: saved.assistantContent,
      previewMetrics: { artifactBuildMs: 123 },
    },
    {
      role: 'assistant' as const,
      content: '',
      generationError: 'Later build failed',
    },
  ];
  const restored = adapter.hydrate({
    history,
    previewMessages: [],
    previewPayloadUrls: null,
  });
  expect(restored.output).toEqual(output);
  expect(restored.metrics).toEqual({ artifactBuildMs: 123 });
  expect(restored.messages[restored.messages.length - 1]).toMatchObject({
    tone: 'error',
    text: 'Later build failed',
  });
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
  expect(request.url).toContain('/reactweb/stream');
  expect(request.body.conversation.history[1]?.content).toBe(
    JSON.stringify({ files }),
  );
  expect(parseRouteHash('#/reactweb/create').protocol.name).toBe('reactweb');
});
