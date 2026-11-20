// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@rstest/core';

import { EXPRESS_CHAT_ADAPTER as adapter } from './a2ui-express.js';
import { resolveSharedConversationProtocol } from '../../storage/sharedConversation.js';
import { parseRouteHash } from '../../utils/appRoute.js';

test('keeps Express source and protocol through preview, history and follow-ups', () => {
  const protocol = parseRouteHash('#/a2ui-express').protocol;
  const source = '<a2ui>root = Text("Hello")</a2ui>';
  const messages = [{ version: '1.0', createSurface: { surfaceId: 'main' } }];
  const output = { source, messages };
  expect(protocol.name).toBe(adapter.id);
  expect(resolveSharedConversationProtocol({ protocol: adapter.id })).toBe(
    adapter.id,
  );
  expect(
    adapter.stream.fromJson({ text: source, metadata: { messages } }).emissions,
  ).toContainEqual({ type: 'final', output });
  expect(
    adapter.preview.source(output, {
      protocol,
      theme: 'light',
      previewPayloadUrls: null,
    }),
  ).toMatchObject({ protocol, kind: 'a2ui', messages });
  const turn = adapter.persist(output, {
    kind: 'create',
    current: null,
    previewPayloadUrls: null,
  });
  const history = [{
    role: 'assistant' as const,
    content: turn.assistantContent,
  }];
  expect(
    adapter.hydrate({
      history,
      previewMessages: messages,
      previewPayloadUrls: null,
    })
      .output,
  ).toEqual(output);
  const request = adapter.createRequest({
    prompt: 'Update the greeting',
    conversation: { history, dataModel: {} },
    settings: adapter.settings.initial(),
    host: {
      origin: 'https://example.org',
      hostname: 'example.org',
      protocol: 'https:',
      search: '',
      baseUrl: '/',
    },
    signal: new AbortController().signal,
  });
  expect(new URL(request.url).pathname).toBe('/a2ui-express/stream');
  expect(request.body.conversation.history).toEqual([{
    role: 'assistant',
    content: source,
  }]);
});
