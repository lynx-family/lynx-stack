// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Readable } from 'node:stream';

import { expect, rstest, test } from '@rstest/core';

import { BASIC_CATALOG } from '../agent/a2ui/a2ui-catalog.js';
import { validateExpressOutput } from '../agent/a2ui-express/format.js';
import route from '../app/a2ui-express/stream/route.js';
import { resolveBenchCatalog } from '../service/a2ui/a2ui-bench-catalog.js';
import { expressService } from '../service/a2ui-express/agent.js';
import { createExpressBenchAdapter } from '../service/a2ui-express/bench-adapter.js';
import TextAgentService from '../service/common/text-agent.js';

const source = `<a2ui>
$/name = "Taylor"
root = Column([Text($/name), Button(Text("Save"), action=Event("save"))])
</a2ui>`;

test('streams Express source and renders compiled Lynx catalog components', async () => {
  const mock = rstest.spyOn(expressService, 'streamAsAsyncIterable')
    .mockResolvedValue({
      textStream: Readable.from([source.slice(0, 26), source.slice(26)]),
      finalize: async () => ({ text: source, usage: {}, finishReason: 'stop' }),
    });
  try {
    const response = await route.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Create a form' }],
      }),
    });
    const events = await response.text();
    expect(events).toContain('event: message');
    const done = events.split('event: done\ndata: ')[1];
    expect(done, events).toBeDefined();
    const result = JSON.parse(done!) as {
      text: string;
      metadata: { messages: unknown[] };
    };
    expect(result.text).toBe(source);
    expect(result.metadata.messages).toMatchObject([
      { createSurface: { catalogId: BASIC_CATALOG.id } },
      { updateDataModel: { value: { name: 'Taylor' } } },
      {
        updateComponents: {
          components: [
            { id: 'root', component: 'Column' },
            { component: 'Text', text: { '@path': '/name' } },
            { component: 'Button', action: { event: { name: 'save' } } },
            { component: 'Text', text: 'Save' },
          ],
        },
      },
    ]);
  } finally {
    mock.mockRestore();
  }
});

test('honors the selected catalog and rejects invalid or empty UI', () => {
  const minimal = resolveBenchCatalog('Minimal Catalog');
  expect(validateExpressOutput(source, minimal)).toMatchObject({ ok: true });
  expect(
    validateExpressOutput(
      '<a2ui>root = Slider("Count", 0, 10, 5)</a2ui>',
      minimal,
    ).ok,
  ).toBe(false);
  expect(validateExpressOutput('[]', BASIC_CATALOG).ok).toBe(false);
  expect(
    validateExpressOutput('<a2ui>root = Unknown()</a2ui>', BASIC_CATALOG).ok,
  ).toBe(false);
});

test('maps Express validation checks to the Lynx renderer field', () => {
  const result = validateExpressOutput(
    '<a2ui>\n$/name = ""\nroot = TextField("Name", $/name, ?required)\n</a2ui>',
    BASIC_CATALOG,
  );
  expect(result.errors).toEqual([]);
  const update = result.messages.find(message => 'updateComponents' in message);
  expect(update?.updateComponents.components[0]).toMatchObject({
    '@checks': [{
      condition: { '@call': 'required', args: { value: { '@path': '/name' } } },
    }],
  });
});

test('Bench repairs Express source with the matched catalog and retains it for reporting', async () => {
  const mock = rstest.spyOn(TextAgentService.prototype, 'generateRaw')
    .mockResolvedValueOnce({
      text: '<a2ui>root = Icon("star")</a2ui>',
      usage: {},
      finishReason: 'stop',
    })
    .mockResolvedValueOnce({ text: source, usage: {}, finishReason: 'stop' });
  try {
    const adapter = createExpressBenchAdapter();
    expect(adapter.protocol).toBe('a2ui-express');
    const result = await adapter.generate({
      scenario: {
        id: 'form',
        name: 'Form',
        type: 'form',
        prompt: 'Create a form',
        complexity: 1,
      },
      runId: 'test',
      pairId: 'pair',
      repeatIndex: 1,
      maxAttempts: 2,
      provider: {},
    });
    expect(result.attempts.map(attempt => attempt.valid)).toEqual([
      false,
      true,
    ]);
    expect(mock.mock.calls[1]?.[0].at(-1)?.content).toContain('A2UI Express');
    expect(result.finalText).toBe(source);
    expect(result.judgePayload?.kind).toBe('a2ui-messages');
  } finally {
    mock.mockRestore();
  }
});
