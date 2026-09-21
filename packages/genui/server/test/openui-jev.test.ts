// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createParser } from '@openuidev/lang-core';
import type { ElementNode } from '@openuidev/lang-core';
import { afterEach, beforeEach, expect, rstest, test } from '@rstest/core';

import { createOpenUiPromptLibrary } from '@lynx-js/genui-openui/openui-prompt';

import OpenUIAgentService from '../service/openui/openui-agent.js';
import app from '../src/app.js';

const connection = {
  provider: 'typesafe',
  model: 'jev-latest',
  apiKey: 'server-jev-secret',
  baseURL: 'https://api.typesafe.ai/v1',
};
const custom = {
  model: 'jev-custom',
  apiKey: 'custom-jev-secret',
  baseURL: connection.baseURL,
};
interface Body {
  model: string;
  state: string;
  questions: Record<string, { criteria: Record<string, string> }>;
}
function mockJev(
  choose?: (id: string, fallback: string, body: Body) => string,
  key = connection.apiKey,
  model = connection.model,
) {
  return rstest.spyOn(globalThis, 'fetch').mockImplementation(
    async (url, init) => {
      expect(
        typeof url === 'string'
          ? url
          : (url instanceof URL ? url.href : url.url),
      ).toBe(`${connection.baseURL}/systemone`);
      if (key === custom.apiKey) expect(init?.redirect).toBe('error');
      expect(new Headers(init?.headers).get('Authorization')).toBe(
        `Bearer ${key}`,
      );
      const body = JSON.parse(init?.body as string) as Body;
      expect(body.model).toBe(model);
      const state = JSON.parse(body.state) as {
        ordering_groups?: { children: { id: string }[] }[];
      };
      const answers = Object.fromEntries(
        Object.entries(body.questions).map(([id, question]) => {
          let answer = Object.keys(question.criteria)[0]!;
          if (id.startsWith('add_')) answer = id === 'add_Text' ? '1' : '0';
          if (id.startsWith('parent_')) answer = 'root';
          if (id.startsWith('order_')) {
            const peers = state.ordering_groups!.find(group =>
              group.children.some(item =>
                `order_${item.id}` === id
              )
            )!.children;
            answer = String(peers.findIndex(item => `order_${item.id}` === id));
          }
          answer = choose?.(id, answer, body) ?? answer;
          expect(question.criteria).toHaveProperty(answer);
          return [id, {
            type: 'choice',
            choice: answer,
            probabilities: { [answer]: 1 },
          }];
        }),
      );
      return Response.json({
        model,
        answers,
        usage: { input_tokens: 100, output_tokens: 5 },
      });
    },
  );
}
function pick(body: Body, id: string, value: unknown) {
  const choice = Object.entries(body.questions[id]!.criteria).find((
    [, description],
  ) => description === JSON.stringify(value));
  expect(choice).toBeDefined();
  return choice![0];
}
function parse(text: string) {
  const library = createOpenUiPromptLibrary();
  const parsed = createParser(library.toJSONSchema(), library.root).parse(text);
  expect(parsed.meta.errors).toEqual([]);
  expect(parsed.meta.unresolved).toEqual([]);
  expect(parsed.meta.incomplete).toBe(false);
  expect(parsed.root).not.toBeNull();
  return parsed;
}
function children(node: ElementNode) {
  return node.props.children as ElementNode[];
}
function events(wire: string, name: string): Record<string, unknown>[] {
  return wire.split('\n\n').filter(frame =>
    frame.startsWith(`event: ${name}\n`)
  ).map(frame =>
    JSON.parse(frame.split('\ndata: ')[1]!) as Record<string, unknown>
  );
}
beforeEach(() => {
  rstest.stubEnv(
    'GENUI_MODEL_CONFIG_JSON',
    JSON.stringify({ Jev: connection }),
  );
  rstest.stubEnv('A2UI_RATE_LIMIT_PER_MIN', '1000');
});
afterEach(() => {
  rstest.restoreAllMocks();
  rstest.unstubAllEnvs();
});

test.each([false, true])(
  'OpenUI Create uses configured/custom Jev and emits model diagnostics (custom=%s)',
  async useCustom => {
    if (useCustom) rstest.stubEnv('GENUI_MODEL_CONFIG_JSON', undefined);
    const fetch = mockJev(
      (id, choice, body) => {
        expect(JSON.parse(body.state)).not.toHaveProperty('design_guidance');
        return id.endsWith('_text') ? pick(body, id, 'Hello') : choice;
      },
      useCustom ? custom.apiKey : connection.apiKey,
      useCustom ? custom.model : connection.model,
    );
    const response = await app.request('/openui/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(useCustom ? custom : { model: 'Jev' }),
        enableDesignGuidance: false,
        messages: [{ role: 'user', content: 'Show "Hello"' }],
      }),
    });
    const wire = await response.text();
    expect(wire).not.toContain('event: error');
    const done = events(wire, 'done')[0]!;
    const result = parse(String(done.text));
    expect(children(result.root!)[0]!.props.text).toBe('Hello');
    expect(done.tokenUsage).toMatchObject({
      inputTokens: fetch.mock.calls.length * 100,
      outputTokens: fetch.mock.calls.length * 5,
    });
    const interactions = events(wire, 'model');
    expect(interactions.filter(event => event.status === 'started'))
      .toHaveLength(fetch.mock.calls.length);
    expect(JSON.stringify(interactions)).not.toMatch(
      /server-jev-secret|custom-jev-secret|typesafe.ai|Hello/,
    );
  },
);

test('offers Jev to both supported Create protocols but not the ordinary model list', async () => {
  for (const protocol of ['a2ui', 'openui']) {
    const response = await app.request(`/models?protocol=${protocol}`);
    expect(await response.json()).toMatchObject({
      defaultModel: 'Jev',
      models: [{ id: 'Jev', composition: true }],
    });
  }
  const response = await app.request('/models');
  expect(response.status).toBe(503);
});

test('composes native Card children, Button labels and positional optional arguments', async () => {
  mockJev((id, choice, body) => {
    if (id.startsWith('add_')) {
      return ['add_Card', 'add_Button', 'add_Text'].includes(id) ? '1' : '0';
    }
    if (id.endsWith('_label')) return pick(body, id, 'Continue');
    if (id.endsWith('_text')) return pick(body, id, 'Welcome');
    if (id.endsWith('_size')) {
      return Object.entries(body.questions[id]!.criteria).find(([, value]) =>
        value.includes('"large"')
      )![0];
    }
    if (id === 'parent_jev_2' || id === 'parent_jev_3') return 'jev_1';
    return choice;
  });
  const result = await new OpenUIAgentService().generateRaw([{
    role: 'user',
    content: 'A card with "Welcome" and a large "Continue" button',
  }], { model: 'Jev' });
  const card = children(parse(result.text).root!)[0]!;
  expect(card.typeName).toBe('Card');
  expect(children(card).map(node => node.typeName)).toEqual(['Text', 'Button']);
  expect(children(card)[1]!.props).toMatchObject({
    label: 'Continue',
    size: 'large',
  });
  expect(result.text).toContain('@ToAssistant("Continue")');
  expect(result.text).not.toContain('createSurface');
});

test.each(['Modal', 'Tabs', 'Buttons'])(
  'preserves native %s slot semantics',
  async kind => {
    mockJev((id, choice, body) => {
      if (id.startsWith('add_')) {
        return id === `add_${kind}`
            || id === (kind === 'Buttons' ? 'add_Button' : 'add_Text')
          ? '1'
          : '0';
      }
      if (id.startsWith('parent_')) {
        return Object.keys(body.questions[id]!.criteria).find(key =>
          key !== 'root'
        ) ?? choice;
      }
      return choice;
    });
    const result = await new OpenUIAgentService().generateRaw([{
      role: 'user',
      content: 'Show "Overview", "Details" and "Open"',
    }], { model: 'Jev' });
    const container = children(parse(result.text).root!)[0]!;
    expect(container.typeName).toBe(kind);
    if (kind === 'Buttons') {
      expect((container.props.buttons as ElementNode[])[0]!.typeName).toBe(
        'Button',
      );
    }
    if (kind === 'Modal') {
      expect(
        (container.props.trigger as ElementNode).typeName,
      ).toBe('Button');
    }
    if (kind === 'Tabs') expect(container.props.tabs).toHaveLength(2);
  },
);

test('keeps entered input state, ids, runtime queries and layout private during follow-up edits', async () => {
  const source =
    '$city = "old"\nweather = Query("weather", { city: $city }, { title: "Weather" })\nroot = Stack([heading, input, button])\nheading = Text(weather.title)\ninput = TextField("City", $city, null, null, null, "$city")\nbutton = Button("Refresh", Action([@Run(weather)]))';
  const fetch = mockJev((id, choice, body) => {
    expect(body.state).not.toContain('private-city');
    expect(JSON.stringify(body.questions)).not.toContain('private-city');
    if (id.startsWith('add_')) return '0';
    return choice;
  });
  const result = await new OpenUIAgentService().generateRaw(
    [{ role: 'user', content: 'Keep the current interface' }],
    { model: 'Jev' },
    {
      history: [{ role: 'assistant', content: source }],
      dataModel: { $city: { value: 'private-city' } },
    },
  );
  const parsed = parse(result.text);
  expect(parsed.stateDeclarations.$city).toBe('private-city');
  expect(parsed.queryStatements).toHaveLength(1);
  expect(children(parsed.root!).map(item => item.statementId)).toEqual([
    'heading',
    'input',
    'button',
  ]);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(result.text).toContain('@Run(weather)');
});

test('creates declared input state and uses the same custom connection for action continuation', async () => {
  rstest.stubEnv('GENUI_MODEL_CONFIG_JSON', undefined);
  const fetch = mockJev(
    (id, choice) =>
      id.startsWith('add_')
        ? (['add_TextField', 'add_Button'].includes(id) ? '1' : '0')
        : choice,
    custom.apiKey,
    custom.model,
  );
  const service = new OpenUIAgentService();
  const initial = await service.generateRaw([{
    role: 'user',
    content: 'Show "Name" and "Submit"',
  }], custom);
  const field = children(parse(initial.text).root!).find(item =>
    item.typeName === 'TextField'
  )!;
  expect(field.props.name).toMatch(/^\$jev_/);
  fetch.mockRestore();
  mockJev(
    (id, choice, body) => {
      expect(body.state).not.toContain('private-form-value');
      expect(JSON.stringify(body.questions)).not.toContain(
        'private-form-value',
      );
      if (id.startsWith('add_')) return '0';
      return choice;
    },
    custom.apiKey,
    custom.model,
  );
  const response = await app.request('/openui/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...custom,
      messages: [{
        role: 'user',
        content: `Submit\n\nOpenUI action context:\n${
          JSON.stringify({
            type: 'continue',
            formState: { [String(field.props.name)]: 'private-form-value' },
          })
        }`,
      }],
      conversation: {
        history: [{ role: 'assistant', content: initial.text }],
        dataModel: {},
      },
    }),
  });
  const wire = await response.text();
  expect(wire).not.toContain('event: error');
  expect(
    parse(String(events(wire, 'done')[0]!.text))
      .stateDeclarations[String(field.props.name)],
  ).toBe('private-form-value');
});

test('preserves a state-bound button label in its assistant action', async () => {
  mockJev((id, choice, body) => {
    if (id.startsWith('add_')) return id === 'add_Button' ? '1' : '0';
    if (id.endsWith('_label')) {
      return Object.entries(body.questions[id]!.criteria).find(
        ([, description]) => description === 'Bind to $caption (string)',
      )![0];
    }
    return choice;
  });
  const result = await new OpenUIAgentService().generateRaw(
    [{ role: 'user', content: 'Add a button bound to the caption' }],
    { model: 'Jev' },
    {
      history: [{
        role: 'assistant',
        content: '$caption = "Continue"\nroot = Stack([Text($caption)])',
      }],
      dataModel: {},
    },
  );
  parse(result.text);
  expect(result.text).toContain('@ToAssistant($caption)');
});

test('does not offer images or empty radio options without supplied sources', async () => {
  mockJev((id, choice, body) => {
    if (id === 'add_Text') {
      expect(body.questions).not.toHaveProperty('add_Image');
      expect(body.questions).not.toHaveProperty('add_RadioGroup');
    }
    return choice;
  });
  const result = await new OpenUIAgentService().generateRaw([{
    role: 'user',
    content: 'Show "Hello" and a photo',
  }], { model: 'Jev' });
  parse(result.text);
});

test('uses supplied image URLs and nonempty radio items', async () => {
  mockJev((id, choice, body) => {
    if (id.startsWith('add_')) {
      return ['add_Image', 'add_RadioGroup'].includes(id) ? '1' : '0';
    }
    if (id.endsWith('_items')) {
      expect(Object.values(body.questions[id]!.criteria)).not.toContain(
        'Catalog/default value: []',
      );
      return pick(body, id, ['Triangle', 'Square']);
    }
    return choice;
  });
  const result = await new OpenUIAgentService().generateRaw([{
    role: 'user',
    content:
      '{"url":"https://example.com/a.png","items":["Triangle","Square"]}',
  }], { model: 'Jev' });
  const items = children(parse(result.text).root!);
  expect(items.find(item => item.typeName === 'Image')?.props.url).toBe(
    'https://example.com/a.png',
  );
  expect(items.find(item => item.typeName === 'RadioGroup')?.props.items)
    .toEqual(['Triangle', 'Square']);
});

test('honors the selected library and shared design guidance', async () => {
  mockJev((id, choice, body) => {
    expect(JSON.parse(body.state)).toHaveProperty('design_guidance');
    if (id === 'add_Text') {
      expect(body.questions).not.toHaveProperty('add_Button');
      expect(body.questions).not.toHaveProperty('add_Image');
    }
    return choice;
  });
  const result = await new OpenUIAgentService().generateRaw([{
    role: 'user',
    content: 'Show "Hello"',
  }], {
    model: 'Jev',
    promptRoot: 'Column',
    promptComponentNames: ['Column', 'Text'],
  });
  expect(parse(result.text).root!.typeName).toBe('Column');
});

test.each([false, true])(
  'edits or expands an existing leaf root (expand=%s)',
  async expand => {
    mockJev((id, choice, body) => {
      if (id.startsWith('add_')) return expand && id === 'add_Text' ? '1' : '0';
      if (id === 'keep_root') return 'keep_layout';
      if (id.endsWith('_text')) {
        return pick(
          body,
          id,
          id === 'prop_jev_2_text' ? 'Additional' : 'Updated',
        );
      }
      return choice;
    });
    const result = await new OpenUIAgentService().generateRaw(
      [{ role: 'user', content: 'Show "Updated" and "Additional"' }],
      { model: 'Jev' },
      {
        history: [{ role: 'assistant', content: 'root = Text("Original")' }],
        dataModel: {},
      },
    );
    const root = parse(result.text).root!;
    if (expand) {
      expect(root.typeName).toBe('Stack');
      expect(children(root).map(node => node.props.text)).toEqual([
        'Updated',
        'Additional',
      ]);
    } else expect(root.props.text).toBe('Updated');
  },
);

test('preserves explicit null input state rather than restoring its old default', async () => {
  mockJev((id, choice) => id.startsWith('add_') ? '0' : choice);
  const result = await new OpenUIAgentService().generateRaw(
    [{ role: 'user', content: 'Keep this form' }],
    { model: 'Jev' },
    {
      history: [{
        role: 'assistant',
        content:
          '$name = "Old"\nroot = Stack([TextField("Name", $name, null, null, null, "$name")])',
      }],
      dataModel: { $name: null },
    },
  );
  expect(parse(result.text).stateDeclarations.$name).toBeNull();
});

test('direct stream API retains the final text and usage after consumption', async () => {
  const fetch = mockJev();
  const stream = await new OpenUIAgentService().stream([{
    role: 'user',
    content: 'Show "Hello"',
  }], { model: 'Jev' });
  let text = '';
  for await (const chunk of stream.textStream!) text += chunk;
  expect(stream.text).toBe(text);
  expect(stream.usage).toMatchObject({
    inputTokens: fetch.mock.calls.length * 100,
  });
  parse(text);
});

test('keeps usage and emits no provisional DSL when later evaluation fails', async () => {
  const fetch = mockJev();
  const original = fetch.getMockImplementation()!;
  let calls = 0;
  fetch.mockImplementation((url, init) =>
    ++calls === 2
      ? Promise.resolve(
        Response.json({ error: 'server-jev-secret private-upstream-body' }, {
          status: 400,
        }),
      )
      : original(url, init)
  );
  const response = await app.request('/openui/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'Jev',
      messages: [{ role: 'user', content: 'Show "Hello"' }],
    }),
  });
  const wire = await response.text();
  expect(wire).not.toContain('event: delta');
  expect(wire).not.toContain('event: done');
  expect(wire).not.toMatch(/server-jev-secret|private-upstream-body/);
  expect(events(wire, 'error')[0]).toMatchObject({
    tokenUsage: { inputTokens: 100, outputTokens: 5 },
  });
  expect(fetch).toHaveBeenCalledTimes(2);
});

test('cancels custom upstream requests when the SSE reader disconnects', async () => {
  rstest.stubEnv('GENUI_MODEL_CONFIG_JSON', undefined);
  let signal: AbortSignal | undefined;
  rstest.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
    signal = init?.signal ?? undefined;
    return new Promise((_resolve, reject) =>
      signal!.addEventListener(
        'abort',
        () => reject(new Error('Cancelled', { cause: signal!.reason })),
        { once: true },
      )
    );
  });
  const response = await app.request('/openui/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...custom,
      messages: [{ role: 'user', content: 'Hello' }],
    }),
  });
  await rstest.waitFor(() => expect(signal).toBeDefined());
  await response.body!.cancel();
  await rstest.waitFor(() => expect(signal!.aborted).toBe(true));
});
