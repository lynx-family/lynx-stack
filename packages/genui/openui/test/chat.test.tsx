// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { execFileSync } from 'node:child_process';

import { BuiltinActionType, createParser } from '@openuidev/lang-core';
import { expect, rstest, test } from '@rstest/core';

import { fireEvent, render } from '@lynx-js/react/testing-library';

import { createOpenUiChatPromptLibrary } from '../src/chat/agent.js';
import { createOpenUiChatLibrary } from '../src/chat/index.js';
import { createOpenUiLibrary } from '../src/core/createLibrary.jsx';
import { OpenUiRenderer } from '../src/core/renderer.jsx';

test('Chat and agent share contracts without changing the default catalog', () => {
  const chat = createOpenUiChatLibrary();
  const agent = createOpenUiChatPromptLibrary();
  expect(chat.root).toBe('Card');
  expect(chat.toJSONSchema()).toEqual(agent.toJSONSchema());
  for (const [name, definition] of Object.entries(chat.components)) {
    expect(definition.props).toBe(agent.components[name]!.props);
    expect(definition.ref).toBe(agent.components[name]!.ref);
  }
  const legacy = createOpenUiLibrary();
  expect(legacy.root).toBe('Stack');
  const parse = (library: typeof chat, source: string) =>
    createParser(library.toJSONSchema(), library.root).parse(source);
  expect(
    parse(legacy, 'root = Stack([Card([Text("hello")], "sunk")])').meta.errors,
  ).toEqual([]);
  const result = parse(
    chat,
    'root = Card([Text("number", "$42", "+5%", "metric", "lg"), BoldText("text", "Total"), Buttons([Button("Continue")], "column")], [{title:"Guide",sourceName:"Docs",url:"https://example.com"}])',
  );
  expect(result.meta.errors).toEqual([]);
  expect(result.meta.unresolved).toEqual([]);
  expect(result.root).toMatchObject({
    props: { sources: [{ title: 'Guide' }] },
  });
});

test('the published Chat agent entry loads without UI or CSS', () => {
  const output = execFileSync(process.execPath, [
    '--input-type=module',
    '-e',
    `
    import assert from 'node:assert/strict';
    import { registerHooks } from 'node:module';
    registerHooks({ resolve(s, c, next) { assert(!s.startsWith('@lynx-js/react')); assert(!s.startsWith('@lynx-js/lynx-ui')); return next(s, c); }, load(u, c, next) { assert(!u.endsWith('.jsx')); assert(!u.endsWith('.css')); return next(u, c); } });
    const { createOpenUiChatPromptLibrary } = await import('@lynx-js/genui/openui/chat/agent');
    assert.equal(createOpenUiChatPromptLibrary().root, 'Card');
    console.log('ok');
  `,
  ], { cwd: new URL('../../', import.meta.url), encoding: 'utf8' });
  expect(output.trim()).toBe('ok');
});

test('Markdown renders rich text and citations dispatch host actions', () => {
  const onAction = rstest.fn();
  const response =
    'root = Card([TextContent("# Trip\\n\\n**Pack** light [1].\\n\\n- Passport\\n- Boots\\n\\n[Unsafe](javascript:alert(1))")], [{title:"Packing guide",sourceName:"Example",url:"https://example.com/packing"}])';
  const view = render(
    <OpenUiRenderer
      library={createOpenUiChatLibrary()}
      response={response}
      onAction={onAction}
    />,
  );
  expect(view.getByText('Trip')).toBeTruthy();
  expect(view.getByText('Passport')).toBeTruthy();
  expect(view.getByText('Pack')).toBeTruthy();
  fireEvent.tap(view.getByText('[1]'));
  expect(onAction).toHaveBeenCalledWith(
    expect.objectContaining({
      type: String(BuiltinActionType.OpenUrl),
      params: { url: 'https://example.com/packing' },
    }),
  );
  onAction.mockClear();
  fireEvent.tap(view.getByText('Unsafe'));
  expect(onAction).not.toHaveBeenCalled();
});

test('streamed incomplete Chat content renders without exceptions', () => {
  const onError = rstest.fn();
  const view = render(
    <OpenUiRenderer
      library={createOpenUiChatLibrary()}
      response={'root = Card([TextContent("**Hello'}
      isStreaming
      onError={onError}
    />,
  );
  expect(view.getByText('**Hello')).toBeTruthy();
  expect(onError).not.toHaveBeenCalled();
});
