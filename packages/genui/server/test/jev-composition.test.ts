// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  rstest,
  test,
} from '@rstest/core';

import {
  createA2UICatalogFromManifests,
  loadBasicCatalog,
} from '../agent/a2ui/a2ui-catalog.js';
import * as actualCatalog from '../agent/a2ui/a2ui-catalog.js' with {
  rstest: 'importActual',
};
import { createA2UIImageSourcePolicy } from '../agent/a2ui/a2ui-image-source-policy.js';
import { A2UIProtocolMessageStreamParser } from '../agent/a2ui/a2ui-stream-parser.js';
import { validateA2UIOutput } from '../agent/a2ui/a2ui-validator.js';
import {
  buildJevCandidates,
  describeJevTree,
  readJevContent,
} from '../agent/a2ui/jev-candidates.js';
import {
  cleanJevSnapshot,
  omitUnhostedJevMcpApps,
} from '../agent/a2ui/jev-output.js';
import type { JevModelInteraction } from '../agent/common/jev-evaluator.js';
import { createLLMProvider } from '../agent/common/openai-provider.js';
import { pickProviderOptions } from '../app/common/provider-options.js';
import { GENUI_DESIGN_GUIDANCE } from '../design/design-guidance.js';
import {
  generateJevComposition,
  resolveJevModel,
  streamJevComposition,
} from '../service/a2ui/jev-composition.js';
import { parseModelConfig } from '../service/common/model-config.js';
import app from '../src/app.js';

rstest.mock('../agent/a2ui/a2ui-catalog.js', () => ({
  ...actualCatalog,
  loadBasicCatalog: () => Promise.resolve(actualCatalog.BASIC_CATALOG),
}));

const config = {
  Jev: {
    provider: 'typesafe',
    model: 'jev-latest',
    apiKey: 'jev-server-secret',
    baseURL: 'https://api.typesafe.ai/v1',
  },
  Chat: {
    model: 'chat-upstream',
    apiKey: 'chat-secret',
    baseURL: 'https://api.openai.com/v1',
  },
};

interface EvaluationBody {
  model: string;
  state: string;
  questions: Record<string, { criteria: Record<string, string> }>;
}

function mockDecisions(
  choose?: (id: string, defaultChoice: string, body: EvaluationBody) => string,
  connection: Pick<typeof config.Jev, 'apiKey' | 'model'> = config.Jev,
) {
  return rstest.spyOn(globalThis, 'fetch').mockImplementation(
    async (input, init) => {
      expect(
        typeof input === 'string'
          ? input
          : (input instanceof URL ? input.href : input.url),
      ).toBe('https://api.typesafe.ai/v1/systemone');
      expect(new Headers(init?.headers).get('Authorization')).toBe(
        `Bearer ${connection.apiKey}`,
      );
      const body = JSON.parse(init?.body as string) as EvaluationBody;
      expect(body.model).toBe(connection.model);
      const answers = Object.fromEntries(
        Object.entries(body.questions).map(([id, question]) => {
          let choice = Object.keys(question.criteria)[0]!;
          if (id === 'root') {
            choice = Object.hasOwn(question.criteria, 'keep')
              ? 'keep'
              : 'Column';
          }
          if (id.startsWith('add_')) choice = id === 'add_Text' ? '2' : '0';
          if (id.startsWith('keep_')) choice = 'keep';
          if (id.startsWith('parent_')) choice = 'root';
          const state = JSON.parse(body.state) as {
            copy_target?: { id: string };
            copy_targets?: { id: string; ordinal: number }[];
            assigned_copy?: { text: unknown }[];
            ordering_groups?: { children: { id: string }[] }[];
          };
          if (id.startsWith('order_')) {
            const siblings = state.ordering_groups?.find(group =>
              group.children.some(item => `order_${item.id}` === id)
            )?.children;
            choice = String(
              siblings?.findIndex(item => `order_${item.id}` === id) ?? 0,
            );
          }
          const target = state.copy_targets?.find(item =>
            id === `prop_${item.id}_text`
          );
          if (target) {
            const used = new Set(
              state.assigned_copy?.map(item => JSON.stringify(item.text)),
            );
            const candidates = Object.entries(question.criteria).filter((
              [, value],
            ) => value.startsWith('"') && !used.has(value));
            choice = candidates[
              state.copy_target
                ? 0
                : (target.ordinal - 1) % candidates.length
            ]?.[0] ?? choice;
          }
          choice = choose?.(id, choice, body) ?? choice;
          return [id, {
            type: 'choice',
            choice,
            probabilities: { [choice]: 1 },
          }];
        }),
      );
      return Response.json({
        model: connection.model,
        answers,
        usage: { input_tokens: 100, output_tokens: 0 },
      });
    },
  );
}

function modelInteractions(sse: string): JevModelInteraction[] {
  return sse.split('\n\n').filter(frame => frame.startsWith('event: model\n'))
    .map(frame =>
      JSON.parse(
        frame.slice('event: model\ndata: '.length),
      ) as JevModelInteraction
    );
}

beforeEach(() => {
  rstest.stubEnv(
    'GENUI_MODEL_CONFIG_JSON',
    JSON.stringify({ Jev: config.Jev }),
  );
  rstest.stubEnv('TOS_ACCESS_KEY', undefined);
  rstest.stubEnv('A2UI_RATE_LIMIT_PER_MIN', '1000');
});
afterEach(() => {
  rstest.restoreAllMocks();
  rstest.unstubAllEnvs();
});

describe('Jev A2UI composition', () => {
  test.each([false, true])(
    'uses custom Jev credentials for JSON, stream and actions with server config=%s',
    async configured => {
      if (!configured) rstest.stubEnv('GENUI_MODEL_CONFIG_JSON', undefined);
      const connection = {
        apiKey: 'custom-jev-secret',
        baseURL: 'https://api.typesafe.ai/v1/',
        model: 'jev-preview',
      };
      const fetch = mockDecisions((id, choice, body) => {
        expect(JSON.parse(body.state)).not.toHaveProperty('design_guidance');
        return id === 'add_Button' ? '1' : choice;
      }, connection);
      const options = { ...connection, enableDesignGuidance: false };
      const messages = [{
        role: 'user',
        content: 'Show "Details" with an "Open" button',
      }];
      const json = await app.request('/a2ui/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...options, messages }),
      });
      const initial = await json.json() as { ok: boolean; text: string };
      expect(initial.ok).toBe(true);
      const content = await validated(initial.text);
      const button = content.components.find(item =>
        item.component === 'Button'
      )!;
      const action = {
        surfaceId: 'main',
        action: { name: button.id },
        conversation: {
          history: [{ role: 'assistant', content: initial.text }],
          dataModel: content.data,
        },
      };
      for (
        const path of ['/a2ui/stream', '/a2ui/action', '/a2ui/action/stream']
      ) {
        fetch.mockClear();
        const response = await app.request(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...options,
            ...(path.includes('/action') ? action : { messages }),
          }),
        });
        const text = await response.text();
        if (path.endsWith('/stream')) {
          expect(text).toContain('event: done');
          expect(text).not.toContain('event: error');
          expect(
            modelInteractions(text).some(event => event.status === 'completed'),
          ).toBe(true);
        } else {
          expect(JSON.parse(text)).toMatchObject({ ok: true });
        }
        expect(text).not.toMatch(
          /custom-jev-secret|jev-server-secret|api.typesafe.ai/,
        );
        expect(fetch.mock.calls.length).toBeGreaterThan(0);
        for (const [, init] of fetch.mock.calls) {
          expect(init?.redirect).toBe('error');
        }
      }
    },
  );

  test('keeps partial custom credentials separate and ignores language-model options for Jev', () => {
    const partial = pickProviderOptions({
      model: 'Jev',
      baseURL: 'https://api.typesafe.ai/v1',
    });
    expect(resolveJevModel(partial)).toMatchObject({
      apiKey: 'jev-server-secret',
      model: 'jev-latest',
    });
    expect(resolveJevModel(partial)).not.toHaveProperty('requestScoped');
    const complete = {
      model: 'jev-latest',
      apiKey: 'client-secret',
      baseURL: 'https://api.typesafe.ai/v1',
    };
    expect(resolveJevModel({ ...complete, api: 'chat' })).toMatchObject({
      requestScoped: true,
      model: 'jev-latest',
    });
    expect(() => createLLMProvider(complete)).toThrow(
      'available only in A2UI Create',
    );
    expect(
      resolveJevModel({ ...complete, baseURL: 'https://api.openai.com/v1' }),
    ).toBeUndefined();
  });

  test('discovers Jev only for A2UI Create and keeps connection settings private', async () => {
    rstest.stubEnv('GENUI_MODEL_CONFIG_JSON', JSON.stringify(config));
    const generalResponse = await app.request('/models');
    const general: unknown = await generalResponse.json();
    expect(general).toMatchObject({
      defaultModel: 'Chat',
      models: [{ id: 'Chat' }],
    });
    const a2uiResponse = await app.request('/models?protocol=a2ui');
    const a2ui: unknown = await a2uiResponse.json();
    expect(a2ui).toMatchObject({
      defaultModel: 'Jev',
      models: [{ id: 'Jev', composition: true }, { id: 'Chat' }],
    });
    expect(JSON.stringify(a2ui)).not.toMatch(
      /jev-server-secret|typesafe.ai|jev-latest/,
    );
    expect(() => createLLMProvider({ model: 'Jev' })).toThrow(
      'A2UI component composition only',
    );
    expect(
      parseModelConfig(JSON.stringify({
        Jev: {
          ...config.Jev,
          api: 'chat',
          reasoningEffort: 'high',
          maxOutputTokens: 1024,
        },
      })).models.Jev,
    ).toMatchObject({ provider: 'typesafe', model: 'jev-latest' });
  });

  test.each([false, true])(
    'cancels the upstream evaluation when the SSE reader disconnects (custom=%s)',
    async custom => {
      let signal: AbortSignal | undefined;
      const fetch = rstest.spyOn(globalThis, 'fetch').mockImplementation(
        async (_input, init) => {
          signal = init?.signal ?? undefined;
          return new Promise((_resolve, reject) =>
            signal!.addEventListener(
              'abort',
              () => reject(new Error('aborted')),
              {
                once: true,
              },
            )
          );
        },
      );
      const response = await app.request('/a2ui/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'Jev',
          ...(custom
            ? {
              model: 'jev-latest',
              apiKey: 'custom-cancel-secret',
              baseURL: 'https://api.typesafe.ai/v1',
            }
            : {}),
          messages: [{ role: 'user', content: 'Make account settings' }],
        }),
      });
      await rstest.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      await response.body!.cancel();
      expect(signal?.aborted).toBe(true);
    },
  );
});

function pick(body: EvaluationBody, id: string, value: string): string {
  const entry = Object.entries(body.questions[id]!.criteria).find((
    [, description],
  ) =>
    description === JSON.stringify(value)
    || description === `Catalog/default value: ${JSON.stringify(value)}`
  );
  if (!entry) throw new Error(`Missing choice ${value} for ${id}`);
  return entry[0];
}

async function validated(text: string) {
  const result = validateA2UIOutput(text, await loadBasicCatalog());
  expect(result.errors).toEqual([]);
  expect(result.ok).toBe(true);
  return readJevContent(result.messages);
}

describe('Catalog-driven, single-model Jev', () => {
  test('keeps a quiz question and all answer buttons inside its card across streamed snapshots', async () => {
    const labels = ['Triangle', 'Square', 'Circle', 'Hexagon'];
    const title = 'Which shape has three sides?';
    mockDecisions((id, choice, body) => {
      if (id === 'root') {
        expect(body.questions).not.toHaveProperty('add_RadioGroup');
      }
      if (id.startsWith('add_')) {
        return id === 'add_Button'
          ? '4'
          : (['add_Card', 'add_Text'].includes(id)
            ? '1'
            : '0');
      }
      const state = JSON.parse(body.state) as {
        selected_elements: {
          id: string;
          description?: string;
          fixed_children?: string[];
        }[];
        copy_targets?: { id: string; owner?: { component: string } }[];
      };
      if (/^prop_.*_text$/.test(id)) {
        const buttons = state.copy_targets!.filter(target =>
          target.owner?.component === 'Button'
        );
        const index = buttons.findIndex(target =>
          id === `prop_${target.id}_text`
        );
        return pick(body, id, index >= 0 ? labels[index]! : title);
      }
      const card = state.selected_elements?.find(item =>
        item.description === 'Card'
      );
      if (id.startsWith('parent_') && id !== `parent_${card?.id}`) {
        return card!.fixed_children![0]!;
      }
      if (id.startsWith('order_')) {
        const buttons = state.selected_elements.filter(item =>
          item.description === 'Button'
        );
        const index = buttons.findIndex(item => id === `order_${item.id}`);
        return index >= 0 ? String(index + 1) : '0';
      }
      return choice;
    });
    const stream = await streamJevComposition([{
      role: 'user',
      content:
        `Create a trivia quiz card. Show a question "${title}" with 4 answer buttons: ${
          labels.join(', ')
        }. When the user taps an answer, show whether it is correct with a brief explanation.`,
    }], { model: 'Jev' });
    const parser = new A2UIProtocolMessageStreamParser();
    const updates = [];
    for await (const chunk of stream.textStream) {
      updates.push(...parser.push(chunk));
    }
    const result = await stream.finalize();
    const final = await validated(result.text);
    const replay = readJevContent(updates);
    expect(new Map(replay.components.map(item => [item.id, item])))
      .toEqual(new Map(final.components.map(item => [item.id, item])));
    const card = final.components.find(item => item.component === 'Card')!;
    const slot = final.components.find(item => item.id === card.child)!;
    expect(slot.children).toHaveLength(5);
    const content = (slot.children as string[]).map(id =>
      final.components.find(item => item.id === id)!
    );
    expect(content[0]).toMatchObject({ component: 'Text', text: title });
    expect(
      content.slice(1).map(item =>
        final.components.find(child => child.id === item.child)?.text
      ),
    )
      .toEqual(labels);
    expect(final.components.find(item => item.id === 'root')?.children).toEqual(
      [card.id],
    );
    expect(final.components.filter(item => item.text === title)).toHaveLength(
      1,
    );
  });

  test('edits required content in a preserved nested layout without any layout provider calls', async () => {
    const catalog = await loadBasicCatalog();
    const previous = [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'main', catalogId: catalog.id },
      },
      { version: 'v0.9', updateDataModel: { surfaceId: 'main', value: {} } },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'main',
          components: [
            { id: 'root', component: 'Column', children: ['outer'] },
            { id: 'body', component: 'Text', text: 'Body' },
            { id: 'inner', component: 'Column', children: ['body'] },
            { id: 'heading', component: 'Text', text: 'Title', variant: 'h1' },
            {
              id: 'outer',
              component: 'Column',
              children: ['heading', 'inner'],
            },
          ],
        },
      },
    ];
    const events: JevModelInteraction[] = [];
    const fetch = mockDecisions((id, choice, body) => {
      expect(
        Object.keys(body.questions).some(key =>
          /^(?:layer|parent|order)_/.test(key)
        ),
      ).toBe(false);
      if (id.startsWith('add_')) return '0';
      if (id === 'root') return 'preserve';
      if (id.startsWith('keep_')) {
        const state = JSON.parse(body.state) as {
          existing_elements: { id: string; existing_position?: number }[];
        };
        expect(
          state.existing_elements.find(item => item.id === 'heading')
            ?.existing_position,
        ).toBe(0);
        expect(
          state.existing_elements.find(item => item.id === 'inner')
            ?.existing_position,
        ).toBe(1);
        return 'preserve_layout';
      }
      if (id === 'prop_heading_text') return pick(body, id, 'New title');
      return choice;
    });
    const result = await generateJevComposition([{
      role: 'user',
      content:
        'Change the title to "New title" and keep the layout and styling.',
    }], {
      model: 'Jev',
      onModelInteraction: event => events.push(event),
    }, {
      history: [{ role: 'assistant', content: JSON.stringify(previous) }],
      dataModel: {},
    });
    const content = await validated(result.text);
    expect(content.components.find(item => item.id === 'heading'))
      .toMatchObject({ text: 'New title', variant: 'h1' });
    expect(content.components.find(item => item.id === 'outer')?.children)
      .toEqual(['heading', 'inner']);
    expect(content.components.find(item => item.id === 'inner')?.children)
      .toEqual(['body']);
    expect(
      events.filter(event => event.status === 'started').map(event =>
        event.phase
      ),
    ).toEqual(['components', 'properties']);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('reorders only the requested sibling while preserving its parent and optional style', async () => {
    const catalog = await loadBasicCatalog();
    const previous = [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'main', catalogId: catalog.id },
      },
      { version: 'v0.9', updateDataModel: { surfaceId: 'main', value: {} } },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'main',
          components: [
            { id: 'root', component: 'Column', children: ['first', 'last'] },
            { id: 'first', component: 'Text', text: 'First' },
            { id: 'last', component: 'Text', text: 'Last', emphasis: 'strong' },
          ],
        },
      },
    ];
    const fetch = mockDecisions((id, choice, body) => {
      if (id.startsWith('add_')) return '0';
      if (id === 'root') return 'preserve';
      if (id === 'keep_first') return 'keep_layout';
      if (id === 'keep_last') return 'reorder_preserve';
      expect(body.questions).not.toHaveProperty('prop_last_emphasis');
      if (id.startsWith('order_')) {
        expect(Object.keys(body.questions)).toEqual(['order_last']);
        expect(Object.keys(body.questions[id]!.criteria)).toEqual(['0', '1']);
        return '0';
      }
      expect(id).not.toMatch(/^(?:layer|parent)_/);
      return choice;
    });
    const result = await generateJevComposition(
      [{
        role: 'user',
        content:
          'Move Last before First, keeping both in this container and retaining their styles.',
      }],
      { model: 'Jev' },
      {
        history: [{ role: 'assistant', content: JSON.stringify(previous) }],
        dataModel: {},
      },
    );
    const content = await validated(result.text);
    expect(content.components.find(item => item.id === 'root')?.children)
      .toEqual(['last', 'first']);
    expect(content.components.find(item => item.id === 'last')?.emphasis).toBe(
      'strong',
    );
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test('inserts replacement content without reusing removed ids or reordering retained siblings', async () => {
    const catalog = await loadBasicCatalog();
    const previous = [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'main', catalogId: catalog.id },
      },
      { version: 'v0.9', updateDataModel: { surfaceId: 'main', value: {} } },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'main',
          components: [
            { id: 'root', component: 'Column', children: ['jev-1', 'jev-2'] },
            { id: 'jev-1', component: 'Text', text: 'Remove' },
            { id: 'jev-2', component: 'Text', text: 'Keep' },
          ],
        },
      },
    ];
    mockDecisions((id, choice, body) => {
      if (id.startsWith('add_')) return id === 'add_Text' ? '1' : '0';
      if (id === 'keep_jev-1') return 'omit';
      if (id === 'keep_jev-2') return 'preserve_layout';
      expect(body.questions).not.toHaveProperty('order_jev-2');
      expect(body.questions).not.toHaveProperty('parent_jev-2');
      if (id === 'prop_jev-3_text') return pick(body, id, 'New');
      if (id === 'order_jev-3') return '0';
      return choice;
    });
    const result = await generateJevComposition(
      [{
        role: 'user',
        content: 'Remove the first text and insert "New" before Keep.',
      }],
      { model: 'Jev' },
      {
        history: [{ role: 'assistant', content: JSON.stringify(previous) }],
        dataModel: {},
      },
    );
    const content = await validated(result.text);
    expect(content.components.find(item => item.id === 'root')?.children)
      .toEqual(['jev-3', 'jev-2']);
    expect(content.components.find(item => item.id === 'jev-3')?.text).toBe(
      'New',
    );
    expect(content.components.some(item => item.id === 'jev-1')).toBe(false);
  });

  test('resolves equivalent retained and Catalog values without a property request', async () => {
    const catalog = createA2UICatalogFromManifests({
      catalogId: 'https://example.com/constant-catalog.json',
      componentManifests: [{
        Column: {
          properties: {
            children: { type: 'array', items: { type: 'string' } },
          },
          required: ['children'],
        },
      }, {
        Badge: {
          properties: {
            tone: { type: 'string', const: 'calm' },
            settings: { const: { a: 1, b: 2 } },
          },
          required: ['tone', 'settings'],
        },
      }],
    });
    const previous = [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'main', catalogId: catalog.id },
      },
      { version: 'v0.9', updateDataModel: { surfaceId: 'main', value: {} } },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'main',
          components: [
            { id: 'root', component: 'Column', children: ['badge'] },
            {
              id: 'badge',
              component: 'Badge',
              tone: 'calm',
              settings: { b: 2, a: 1 },
            },
          ],
        },
      },
    ];
    const fetch = mockDecisions((id, choice, body) => {
      expect(body.questions).not.toHaveProperty('prop_badge_tone');
      expect(body.questions).not.toHaveProperty('prop_badge_settings');
      return id.startsWith('add_') ? '0' : choice;
    });
    const result = await generateJevComposition(
      [{ role: 'user', content: 'Keep this interface.' }],
      { model: 'Jev', catalog },
      {
        history: [{ role: 'assistant', content: JSON.stringify(previous) }],
        dataModel: {},
      },
    );
    expect(validateA2UIOutput(result.text, catalog).errors).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('omits optional placeholder-only questions while retaining visual controls and required content', async () => {
    const fetch = mockDecisions((id, choice, body) => {
      if (id.startsWith('add_')) return id === 'add_Button' ? '1' : '0';
      expect(body.questions).not.toHaveProperty('prop_jev-1_checks');
      if (id === 'prop_jev-1_variant') return pick(body, id, 'borderless');
      if (id === 'prop_jev-2_text') return pick(body, id, 'Continue');
      return choice;
    });
    const result = await generateJevComposition([{
      role: 'user',
      content: 'Show a borderless button labeled "Continue".',
    }], { model: 'Jev' });
    const content = await validated(result.text);
    expect(content.components.find(item => item.component === 'Button'))
      .toMatchObject({ variant: 'borderless' });
    expect(content.components.find(item => item.component === 'Button')).not
      .toHaveProperty('checks');
    expect(content.components.find(item => item.component === 'Text')?.text)
      .toBe('Continue');
    const bodies = fetch.mock.calls.map(([, init]) =>
      JSON.parse(init?.body as string) as EvaluationBody
    );
    expect(
      bodies.some(body => Object.hasOwn(body.questions, 'prop_jev-1_variant')),
    ).toBe(true);
  });

  test('retains explicitly supplied optional values instead of treating them as placeholders', async () => {
    const fetch = mockDecisions((id, choice) => {
      if (id.startsWith('add_')) return id === 'add_Button' ? '1' : '0';
      return choice;
    });
    await generateJevComposition([{
      role: 'user',
      content:
        'Show "Continue" with this configuration: {"checks":[]}\n```json\n{"checks":[]}\n```',
    }], { model: 'Jev' });
    const bodies = fetch.mock.calls.map(([, init]) =>
      JSON.parse(init?.body as string) as EvaluationBody
    );
    expect(
      bodies.some(body => Object.hasOwn(body.questions, 'prop_jev-1_checks')),
    ).toBe(true);
  });

  test('reuses confirmed optional properties across fixed slots but still evaluates required text and independent edits', async () => {
    const catalog = await loadBasicCatalog();
    const previous = [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'main', catalogId: catalog.id },
      },
      { version: 'v0.9', updateDataModel: { surfaceId: 'main', value: {} } },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'main',
          components: [
            {
              id: 'root',
              component: 'Column',
              children: ['button', 'note'],
              align: 'center',
            },
            {
              id: 'button',
              component: 'Button',
              child: 'label',
              variant: 'borderless',
              action: { event: { name: 'go' } },
            },
            {
              id: 'label',
              component: 'Text',
              text: 'Continue',
              emphasis: 'strong',
            },
            { id: 'note', component: 'Text', text: 'Details', variant: 'body' },
          ],
        },
      },
    ];
    const fetch = mockDecisions((id, choice, body) => {
      if (id.startsWith('add_')) return '0';
      if (id === 'root' || id === 'keep_button') return 'preserve';
      for (
        const key of [
          'prop_root_align',
          'prop_root_justify',
          'prop_button_variant',
          'prop_button_checks',
          'prop_label_emphasis',
          'prop_label_variant',
        ]
      ) {
        expect(body.questions).not.toHaveProperty(key);
      }
      if (id === 'prop_label_text') return pick(body, id, 'Proceed');
      if (id === 'prop_note_variant') return pick(body, id, 'h2');
      return choice;
    });
    const result = await generateJevComposition(
      [{
        role: 'user',
        content:
          'Change the button label to "Proceed", retaining its styling; make Details an h2 heading.',
      }],
      { model: 'Jev' },
      {
        history: [{ role: 'assistant', content: JSON.stringify(previous) }],
        dataModel: {},
      },
    );
    const content = await validated(result.text);
    expect(content.components.find(item => item.id === 'label')).toMatchObject({
      text: 'Proceed',
      emphasis: 'strong',
    });
    expect(content.components.find(item => item.id === 'button')).toMatchObject(
      { variant: 'borderless' },
    );
    expect(content.components.find(item => item.id === 'note')).toMatchObject({
      variant: 'h2',
    });
    const bodies = fetch.mock.calls.map(([, init]) =>
      JSON.parse(init?.body as string) as EvaluationBody
    );
    expect(
      bodies.some(body => Object.hasOwn(body.questions, 'prop_label_text')),
    ).toBe(true);
    expect(
      bodies.some(body => Object.hasOwn(body.questions, 'prop_note_variant')),
    ).toBe(true);
  });

  test('batches new copy with distinct slot roles and the complete target plan', async () => {
    const seen: string[] = [];
    const fetch = mockDecisions((id, choice, body) => {
      if (id === 'add_Button') return '1';
      if (!id.endsWith('_text')) return choice;
      const state = JSON.parse(body.state) as {
        copy_targets: {
          id: string;
          role: string;
          owner: { component: string };
          ordinal: number;
        }[];
        assigned_copy: { text: string }[];
      };
      expect(Object.keys(body.questions).filter(key => key.endsWith('_text')))
        .toHaveLength(3);
      expect(state.assigned_copy).toEqual([]);
      const target = state.copy_targets.find(item =>
        id === `prop_${item.id}_text`
      )!;
      expect(target.ordinal).toBe(seen.length + 1);
      const text = ['Buy Now', 'Limited Edition', '$189'][target.ordinal - 1]!;
      expect(target.role).toBe(
        seen.length === 0 ? 'action_label' : 'display_content',
      );
      expect(target.owner.component).toBe(
        seen.length === 0 ? 'Button' : 'Column',
      );
      seen.push(text);
      return pick(body, id, text);
    });
    const result = await generateJevComposition([{
      role: 'user',
      content: 'Show "Limited Edition", "$189", and a "Buy Now" button.',
    }], { model: 'Jev' });
    const content = await validated(result.text);
    expect(
      content.components.filter(item => item.component === 'Text').map(item =>
        item.text
      ),
    ).toEqual(seen);
    expect(seen).toHaveLength(3);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test('coalesces repeated product copy and removes new empty panels without deleting action labels', async () => {
    mockDecisions((id, choice, body) => {
      if (id.startsWith('add_')) {
        if (id === 'add_Text') return '5';
        if (id === 'add_Button') return '2';
        return id === 'add_Card' || id === 'add_Modal' ? '1' : '0';
      }
      if (id.endsWith('_text')) {
        if (
          (JSON.parse(body.state) as { copy_conflict?: boolean }).copy_conflict
        ) return 'omit';
        return pick(
          body,
          id,
          id === 'prop_jev-2_text' ? 'Buy Now' : 'Confirm Purchase',
        );
      }
      return choice;
    });
    const result = await generateJevComposition([{
      role: 'user',
      content:
        'Create a product card with "Buy Now" and a later "Confirm Purchase" step.',
    }], { model: 'Jev' });
    const content = await validated(result.text);
    const tree = describeJevTree(content);
    expect(
      tree.filter(item => item.movable && item.component.component === 'Text'),
    ).toHaveLength(1);
    expect(content.components.filter(item => item.component === 'Button'))
      .toHaveLength(2);
    expect(
      content.components.some(item =>
        item.component === 'Card' || item.component === 'Modal'
      ),
    ).toBe(false);
    const labels = content.components.filter(item =>
      item.component === 'Button'
    ).map(button =>
      content.components.find(item => item.id === button.child)?.text
    );
    expect(labels).toEqual(['Buy Now', 'Confirm Purchase']);
  });

  test('allocates only conflicting new copy from unused, deduplicated choices after the shared batch', async () => {
    const corrections: string[] = [];
    const fetch = mockDecisions((id, choice, body) => {
      if (id === 'add_Text') return '3';
      if (!id.endsWith('_text')) return choice;
      const state = JSON.parse(body.state) as {
        copy_conflict?: boolean;
        assigned_copy: { text: string }[];
      };
      if (!state.copy_conflict) return pick(body, id, 'Alpha');
      expect(Object.keys(body.questions)).toEqual([id]);
      expect(id).not.toBe('prop_jev-1_text');
      expect(Object.values(body.questions[id]!.criteria)).not.toContain(
        '"Alpha"',
      );
      if (corrections.length > 0) {
        expect(Object.values(body.questions[id]!.criteria)).not.toContain(
          '"Beta"',
        );
        expect(state.assigned_copy.some(item => item.text === 'Beta')).toBe(
          true,
        );
      }
      corrections.push(id);
      return pick(body, id, corrections.length === 1 ? 'Beta' : 'Gamma');
    });
    const output = await generateJevComposition([{
      role: 'user',
      content:
        'Show "Alpha", "Beta" and "Gamma".\n```json\n[{"call":"concat","args":{}},{"args":{},"call":"concat"}]\n```',
    }], { model: 'Jev' });
    const content = await validated(output.text);
    expect(
      content.components.filter(item => item.component === 'Text').map(item =>
        item.text
      ),
    )
      .toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(corrections).toEqual(['prop_jev-2_text', 'prop_jev-3_text']);
    expect(fetch).toHaveBeenCalledTimes(5);
    expect(output.usage).toMatchObject({ inputTokens: 500 });
  });

  test('batches eight distinct copy slots without eight sequential evaluations', async () => {
    const fetch = mockDecisions((id, choice) =>
      id === 'add_Text' ? '8' : choice
    );
    const output = await generateJevComposition([{
      role: 'user',
      content:
        'Show "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta".',
    }], { model: 'Jev' });
    const content = await validated(output.text);
    expect(content.components.filter(item => item.component === 'Text'))
      .toHaveLength(8);
    const bodies = fetch.mock.calls.map(([, init]) =>
      JSON.parse(init?.body as string) as EvaluationBody
    );
    const copyBatches = bodies.filter(body =>
      Object.keys(body.questions).some(id => id.endsWith('_text'))
    );
    expect(copyBatches.length).toBeLessThan(8);
    expect(
      copyBatches.flatMap(body =>
        Object.keys(body.questions).filter(id => id.endsWith('_text'))
      ),
    ).toHaveLength(8);
    for (const body of copyBatches) {
      const state = JSON.parse(body.state) as {
        copy_targets: unknown[];
        copy_conflict?: boolean;
      };
      expect(state.copy_targets).toHaveLength(8);
      expect(state.copy_conflict).toBeUndefined();
      expect(Object.keys(body.questions).length).toBeLessThanOrEqual(32);
    }
  });

  test('keeps equal copy with different styles out of conflict allocation', async () => {
    mockDecisions((id, choice, body) => {
      expect(JSON.parse(body.state)).not.toHaveProperty('copy_conflict');
      if (id.endsWith('_text')) return pick(body, id, 'Alpha');
      if (id.endsWith('_variant') && id.includes('jev-2')) {
        return pick(body, id, 'h2');
      }
      return choice;
    });
    const output = await generateJevComposition([{
      role: 'user',
      content: 'Show "Alpha" in two styles.',
    }], { model: 'Jev' });
    const content = await validated(output.text);
    expect(content.components.filter(item => item.component === 'Text'))
      .toHaveLength(2);
  });

  test('keeps equal new copy that layout places in separate containers', async () => {
    mockDecisions((id, choice, body) => {
      expect(JSON.parse(body.state)).not.toHaveProperty('copy_conflict');
      if (id === 'add_Column') return '2';
      if (id.endsWith('_text')) return pick(body, id, 'Alpha');
      if (id === 'parent_jev-3') return 'jev-1';
      if (id === 'parent_jev-4') return 'jev-2';
      return choice;
    });
    const output = await generateJevComposition([{
      role: 'user',
      content: 'Show "Alpha" in two separate sections.',
    }], { model: 'Jev' });
    const content = await validated(output.text);
    expect(content.components.filter(item => item.component === 'Text'))
      .toHaveLength(2);
    expect(content.components.find(item => item.id === 'jev-1')?.children)
      .toEqual(['jev-3']);
    expect(content.components.find(item => item.id === 'jev-2')?.children)
      .toEqual(['jev-4']);
  });

  test('preserves repeated copy across containers, styles, bindings, fixed slots and existing nodes', async () => {
    const catalog = await loadBasicCatalog();
    const content = {
      surface: {
        version: 'v0.9' as const,
        createSurface: { surfaceId: 'main', catalogId: catalog.id },
      },
      data: { title: 'Same' },
      components: [
        {
          id: 'root',
          component: 'Column',
          children: ['a', 'b', 'bound1', 'bound2', 'old1', 'old2', 'button'],
        },
        { id: 'a', component: 'Column', children: ['a1', 'a2', 'a3'] },
        { id: 'a1', component: 'Text', text: 'Same', variant: 'body' },
        { id: 'a2', component: 'Text', text: 'Same', variant: 'body' },
        { id: 'a3', component: 'Text', text: 'Same', variant: 'h2' },
        { id: 'b', component: 'Column', children: ['b1'] },
        { id: 'b1', component: 'Text', text: 'Same', variant: 'body' },
        { id: 'bound1', component: 'Text', text: { path: '/title' } },
        { id: 'bound2', component: 'Text', text: { path: '/title' } },
        { id: 'old1', component: 'Text', text: 'Same' },
        { id: 'old2', component: 'Text', text: 'Same' },
        {
          id: 'button',
          component: 'Button',
          child: 'label',
          action: { event: { name: 'test' } },
        },
        { id: 'label', component: 'Text', text: 'Same' },
      ],
    };
    const cleaned = cleanJevSnapshot(content, new Set(['old1', 'old2']), true);
    expect(cleaned.map(item => item.id)).toEqual(
      content.components.map(item => item.id).filter(id => id !== 'a2'),
    );
    expect(cleaned.find(item => item.id === 'a')?.children).toEqual([
      'a1',
      'a3',
    ]);
    expect(describeJevTree({ ...content, components: cleaned })).toHaveLength(
      cleaned.length,
    );
  });

  test('renders the weather demo without offering an Image when no source is supplied', async () => {
    const fetch = mockDecisions((_id, choice, body) => {
      expect(body.questions).not.toHaveProperty('add_Image');
      return choice;
    });
    const response = await app.request('/a2ui/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'Jev',
        enableDesignGuidance: false,
        messages: [{
          role: 'user',
          content:
            'Create a weather card for San Francisco showing sunny, a photo, 22°C, humidity 60%, and a "Refresh" button. When the user taps Refresh, update the card with slightly different weather data to simulate a live fetch.',
        }],
      }),
    });
    const sse = await response.text();
    expect(sse).toContain('event: message');
    expect(sse).toContain('event: done');
    expect(sse).not.toContain('event: error');
    expect(sse).not.toContain('"component":"Image"');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test.each([
    'https://images.example.com/weather.jpg',
    `https://images.example.com/weather.jpg?signature=${'a'.repeat(200)}`,
  ])(
    'offers only valid supplied image URLs, including long URLs: %s',
    async url => {
      mockDecisions((id, choice, body) => {
        if (id.startsWith('add_')) return id === 'add_Image' ? '1' : '0';
        if (id.endsWith('_url')) {
          expect(Object.values(body.questions[id]!.criteria)).toEqual([
            JSON.stringify(url),
          ]);
          return pick(body, id, url);
        }
        return choice;
      });
      const result = await generateJevComposition([{
        role: 'user',
        content: `Show a photo using "${url}".`,
      }], { model: 'Jev' });
      const content = await validated(result.text);
      expect(
        content.components.find(component => component.component === 'Image')
          ?.url,
      ).toBe(url);
    },
  );

  test('validates image binding values without exposing them to Jev', async () => {
    const url = 'https://images.example.com/weather.jpg';
    const fetch = mockDecisions((id, choice, body) => {
      expect(JSON.stringify(body)).not.toContain(url);
      expect(JSON.stringify(body)).not.toContain('private-input-value');
      if (id.startsWith('add_')) return id === 'add_Image' ? '1' : '0';
      if (id.endsWith('_url')) {
        expect(Object.values(body.questions[id]!.criteria)).toEqual([
          'Bind to /photo/url (string)',
        ]);
      }
      return choice;
    });
    const result = await generateJevComposition(
      [{ role: 'user', content: 'Show a photo' }],
      { model: 'Jev' },
      {
        history: [],
        dataModel: {
          photo: { url },
          description: 'a photo',
          input: 'private-input-value',
        },
      },
    );
    const content = await validated(result.text);
    expect(
      content.components.find(component => component.component === 'Image')
        ?.url,
    ).toEqual({ path: '/photo/url' });
    // The only possible parent/order are resolved locally without a layout call.
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('does not offer image literals or bindings denied by the shared source policy', async () => {
    const catalog = await loadBasicCatalog();
    const url = 'https://images.example.com/not-allowed.jpg';
    const source = buildJevCandidates(
      catalog,
      [`Show a photo using "${url}"`],
      { image: url },
      createA2UIImageSourcePolicy([]),
    );
    expect(source.specs.some(spec => spec.name === 'Image')).toBe(false);
  });

  test('preserves an existing image when no new image source is supplied', async () => {
    const catalog = await loadBasicCatalog();
    const url = 'https://images.example.com/existing.jpg';
    const messages = [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'main', catalogId: catalog.id },
      },
      { version: 'v0.9', updateDataModel: { surfaceId: 'main', value: {} } },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'main',
          components: [
            { id: 'root', component: 'Column', children: ['photo'] },
            { id: 'photo', component: 'Image', url },
          ],
        },
      },
    ];
    mockDecisions((id, choice, body) => {
      expect(body.questions).not.toHaveProperty('add_Image');
      return id.startsWith('add_') ? '0' : choice;
    });
    const result = await generateJevComposition(
      [{ role: 'user', content: 'Keep the existing photo' }],
      { model: 'Jev' },
      {
        history: [{ role: 'assistant', content: JSON.stringify(messages) }],
        dataModel: {},
      },
    );
    const content = await validated(result.text);
    expect(content.components.find(component => component.id === 'photo')?.url)
      .toBe(url);
  });

  test.each([undefined, false])(
    'uses only Jev with shared Design Guidance = %s',
    async enableDesignGuidance => {
      const fetch = mockDecisions();
      const result = await generateJevComposition([{
        role: 'user',
        content: 'Shanghai weather dashboard',
      }], { model: 'Jev', enableDesignGuidance });
      await validated(result.text);
      expect(fetch).toHaveBeenCalledTimes(3);
      expect(result.usage).toMatchObject({ inputTokens: 300 });
      for (const [, init] of fetch.mock.calls) {
        const body = JSON.parse(init?.body as string) as EvaluationBody;
        expect(body.model).toBe('jev-latest');
        expect(Object.keys(body.questions).length).toBeLessThanOrEqual(32);
        for (const question of Object.values(body.questions)) {
          expect(Object.keys(question.criteria).length).toBeGreaterThan(1);
        }
        expect(JSON.parse(body.state)).toHaveProperty('user_requests');
        expect(
          (JSON.parse(body.state) as { design_guidance?: string })
            .design_guidance,
        )
          .toBe(
            enableDesignGuidance === false ? undefined : GENUI_DESIGN_GUIDANCE,
          );
        expect(JSON.stringify(body)).not.toMatch(
          /field_email|profile_name|sales_metric|jev_demo/,
        );
      }
    },
  );

  test('offers unquoted multilingual headings and request data outside the old business domains', async () => {
    mockDecisions((id, choice, body) => {
      if (
        (JSON.parse(body.state) as { copy_conflict?: boolean }).copy_conflict
      ) {
        return 'omit';
      }
      if (id.endsWith('_text')) return pick(body, id, '上海天气');
      return choice;
    });
    const result = await generateJevComposition([{
      role: 'user',
      content: '做一个天气面板，标题改为上海天气。',
    }], { model: 'Jev' });
    const content = await validated(result.text);
    expect(
      content.components.filter(item => item.component === 'Text').map(item =>
        item.text
      ),
    ).toEqual(['上海天气']);
  });

  test('supports a new Catalog component without a business-specific candidate implementation', async () => {
    const catalog = createA2UICatalogFromManifests({
      catalogId: 'https://example.com/custom-catalog.json',
      componentManifests: [
        {
          Column: {
            properties: {
              children: { type: 'array', items: { type: 'string' } },
            },
            required: ['children'],
          },
        },
        {
          Thermometer: {
            properties: {
              celsius: { type: 'number' },
              unit: { type: 'string', enum: ['C', 'F'] },
            },
            required: ['celsius', 'unit'],
          },
        },
      ],
    });
    const fetch = mockDecisions((id, choice, body) => {
      if (id === 'add_Thermometer') return '1';
      if (id.endsWith('_celsius')) {
        return Object.entries(body.questions[id]!.criteria).find(([, value]) =>
          value === '26'
        )![0];
      }
      return choice;
    });
    const result = await generateJevComposition([{
      role: 'user',
      content: 'Temperature 26 C',
    }], { model: 'Jev', catalog });
    const parsed = validateA2UIOutput(result.text, catalog);
    expect(parsed.errors).toEqual([]);
    expect(readJevContent(parsed.messages).components).toContainEqual({
      id: 'jev-1',
      component: 'Thermometer',
      celsius: 26,
      unit: 'C',
    });
    // The only possible parent/order are resolved locally without a layout call.
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('uses supplied chart records rather than fixed sales datasets', async () => {
    mockDecisions((id, choice) =>
      id.startsWith('add_') ? (id === 'add_LineChart' ? '1' : '0') : choice
    );
    const result = await generateJevComposition([{
      role: 'user',
      content:
        'Weather trend:\n```json\n{"labels":["Mon","Tue"],"series":[{"name":"Temperature","values":[26,28]}]}\n```',
    }], { model: 'Jev' });
    const content = await validated(result.text);
    expect(content.components.find(item => item.component === 'LineChart'))
      .toMatchObject({
        labels: ['Mon', 'Tue'],
        series: [{ name: 'Temperature', values: [26, 28] }],
      });
  });

  test('publishes only the completed layout with aggregated usage', async () => {
    const fetch = mockDecisions((id, choice) =>
      id === 'order_jev-1' ? '1' : (id === 'order_jev-2' ? '0' : choice)
    );
    const stream = await streamJevComposition([{
      role: 'user',
      content: 'Weather panel',
    }], { model: 'Jev' });
    const iterator = stream.textStream[Symbol.asyncIterator]();
    const first = await iterator.next();
    expect(first.done).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(3);
    if (first.done) throw new Error('Expected a snapshot.');
    let wire: string = first.value;
    for (;;) {
      const next = await iterator.next();
      if (next.done) break;
      wire += next.value;
    }
    expect(JSON.parse(wire)).toHaveLength(3);
    const result = await stream.finalize();
    const content = await validated(result.text);
    expect(content.components.find(item => item.id === 'root')?.children)
      .toEqual(['jev-2', 'jev-1']);
    expect(JSON.parse(wire)).toEqual(JSON.parse(result.text));
    expect(result.usage).toMatchObject({ inputTokens: 300 });
  });

  test('skips the layout request when one text has only one parent and position', async () => {
    const fetch = mockDecisions((id, choice) =>
      id === 'add_Text' ? '1' : choice
    );
    const result = await generateJevComposition([{
      role: 'user',
      content: 'Show one heading',
    }], { model: 'Jev' });
    const content = await validated(result.text);
    expect(content.components).toHaveLength(2);
    expect(content.components.find(item => item.id === 'root')?.children)
      .toEqual(['jev-1']);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.usage).toMatchObject({ inputTokens: 200 });
  });

  test('preserves ids and entered values on follow-up removal without exposing state values', async () => {
    const initialFetch = mockDecisions((id, choice) =>
      id === 'add_TextField' ? '1' : choice
    );
    const initial = await generateJevComposition([{
      role: 'user',
      content: 'Search field and weather headings',
    }], { model: 'Jev' });
    const initialContent = await validated(initial.text);
    const input = initialContent.components.find(item =>
      item.component === 'TextField'
    )!;
    const binding = input.value as { path: string };
    initialFetch.mockRestore();
    const fetch = mockDecisions((id, choice, body) => {
      expect(body.state).not.toContain('private-input-value');
      expect(JSON.stringify(body.questions)).not.toContain(
        'private-input-value',
      );
      if (id.startsWith('add_')) return '0';
      if (id === 'keep_jev-1') return 'omit';
      return choice;
    });
    const edited = await generateJevComposition(
      [{ role: 'user', content: 'Remove the first heading' }],
      { model: 'Jev' },
      {
        history: [{ role: 'assistant', content: initial.text }],
        dataModel: {
          ...initialContent.data,
          [binding.path.slice(1)]: 'private-input-value',
        },
      },
    );
    const content = await validated(edited.text);
    expect(content.components.some(item => item.id === 'jev-1')).toBe(false);
    expect(content.components.find(item => item.id === input.id)?.value)
      .toEqual(binding);
    expect(content.data[binding.path.slice(1)]).toBe('private-input-value');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test('retains named slots and repeating template scopes during edits', async () => {
    const catalog = await loadBasicCatalog();
    const messages = [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'main', catalogId: catalog.id },
      },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: 'main',
          value: { items: [{ title: 'Alpha' }] },
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'main',
          components: [
            { id: 'root', component: 'Column', children: ['tabs', 'modal'] },
            {
              id: 'tabs',
              component: 'Tabs',
              tabs: [{ title: 'Items', child: 'list' }],
            },
            {
              id: 'list',
              component: 'Column',
              children: { componentId: 'item', path: '/items' },
            },
            { id: 'item', component: 'Text', text: { path: 'title' } },
            {
              id: 'modal',
              component: 'Modal',
              trigger: 'trigger',
              content: 'body',
            },
            { id: 'trigger', component: 'Text', text: 'Open' },
            { id: 'body', component: 'Text', text: 'Details' },
          ],
        },
      },
    ];
    mockDecisions((id, choice, body) => {
      if (id.startsWith('add_')) return '0';
      if (id.startsWith('keep_')) return 'keep_layout';
      expect(body.questions).not.toHaveProperty('parent_item');
      expect(body.questions).not.toHaveProperty('parent_list');
      expect(
        Object.keys(body.questions).some(key =>
          /^(?:layer|parent|order)_/.test(key)
        ),
      ).toBe(false);
      return choice;
    });
    const result = await generateJevComposition(
      [{ role: 'user', content: 'Keep this interface' }],
      { model: 'Jev' },
      {
        history: [{ role: 'assistant', content: JSON.stringify(messages) }],
        dataModel: { items: [{ title: 'Beta' }] },
      },
    );
    const content = await validated(result.text);
    expect(content.components.find(item => item.id === 'list')?.children)
      .toEqual({ componentId: 'item', path: '/items' });
    expect(content.components.find(item => item.id === 'modal')).toMatchObject({
      trigger: 'trigger',
      content: 'body',
    });
    expect(content.components.find(item => item.id === 'item')?.text).toEqual({
      path: 'title',
    });
  });

  test('creates compound controls and handles their UI events using Jev only', async () => {
    const placed = new Set<string>();
    const fetch = mockDecisions((id, choice, body) => {
      if (['add_Button', 'add_Card', 'add_Tabs', 'add_Modal'].includes(id)) {
        return '1';
      }
      if (id === 'add_Text') return '3';
      if (id.startsWith('parent_')) {
        const state = JSON.parse(body.state) as {
          selected_elements: { id: string; description: string }[];
        };
        if (
          state.selected_elements.find(item => item.id === id.slice(7))
            ?.description.startsWith('Text')
        ) {
          for (const kind of ['Card', 'Modal', 'Tabs']) {
            if (placed.has(kind)) continue;
            const parent = Object.entries(body.questions[id]!.criteria).find((
              [, value],
            ) => value.includes(`inside ${kind}`));
            if (parent) {
              placed.add(kind);
              return parent[0];
            }
          }
        }
      }
      return choice;
    });
    const initial = await generateJevComposition([{
      role: 'user',
      content: 'Library: Books, Favorites, Details, Open',
    }], { model: 'Jev' });
    const content = await validated(initial.text);
    const button = content.components.find(item =>
      item.component === 'Button'
    )!;
    expect(button).toMatchObject({
      action: { event: { name: button.id } },
      child: expect.any(String) as string,
    });
    expect(content.components.find(item => item.component === 'Tabs')?.tabs)
      .toHaveLength(2);
    expect(content.components.find(item => item.component === 'Modal'))
      .toMatchObject({
        trigger: expect.any(String) as string,
        content: expect.any(String) as string,
      });
    fetch.mockRestore();
    const actionFetch = mockDecisions((id, choice, body) => {
      expect(JSON.stringify(body)).not.toContain('private-action-value');
      if (id.startsWith('add_')) return '0';
      return choice;
    });
    const result = await generateJevComposition(
      [{
        role: 'user',
        content: `A2UI_USER_ACTION: ${
          JSON.stringify({
            surfaceId: 'main',
            action: {
              name: button.id,
              context: { value: 'private-action-value' },
            },
          })
        }`,
      }],
      { model: 'Jev' },
      {
        history: [{ role: 'assistant', content: initial.text }],
        dataModel: content.data,
      },
    );
    await validated(result.text);
    expect(actionFetch).toHaveBeenCalled();
    expect(result.text).not.toMatch(
      /jev_demo|Demo complete|saved successfully/i,
    );
  });

  test('rejects invalid choices with usage and no retry or other model', async () => {
    const fetch = mockDecisions(id => id === 'root' ? 'invented' : '0');
    await expect(
      generateJevComposition([{ role: 'user', content: 'Weather' }], {
        model: 'Jev',
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('unoffered') as string,
      result: { usage: { inputTokens: 100 } },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test.each([2, 3])(
    'plans %s nested containers in one parent batch',
    async count => {
      const fetch = mockDecisions((id, choice, body) => {
        if (id === 'add_Column') return String(count);
        if (id.startsWith('parent_jev-')) {
          const index = Number(id.slice('parent_jev-'.length));
          if (index < count) return `jev-${index + 1}`;
          // All containers can express nesting in one batch; only self/unit edges are excluded.
          expect(body.questions[id]!.criteria).not.toHaveProperty(
            `jev-${index}`,
          );
          if (index > count) return 'jev-1';
        }
        return choice;
      });
      const result = await generateJevComposition([{
        role: 'user',
        content: 'Nested sections',
      }], { model: 'Jev' });
      const content = await validated(result.text);
      expect(describeJevTree(content)).toHaveLength(count + 3);
      expect(content.components.find(item => item.id === 'root')?.children)
        .toContain(`jev-${count}`);
      for (let index = 1; index < count; index++) {
        expect(
          content.components.find(item => item.id === `jev-${index + 1}`)
            ?.children,
        ).toContain(`jev-${index}`);
      }
      expect(fetch).toHaveBeenCalledTimes(5);
      expect(result.usage).toMatchObject({ inputTokens: 500 });
      const parentBatches = fetch.mock.calls.map(([, init]) =>
        JSON.parse(init?.body as string) as EvaluationBody
      );
      expect(
        parentBatches.find(body => body.questions['parent_jev-1'])!.questions,
      )
        .toHaveProperty('parent_jev-2');
      expect(
        parentBatches.every(body =>
          !Object.keys(body.questions).some(id => id.startsWith('layer_'))
        ),
      ).toBe(true);
    },
  );

  test.each(['Card', 'Modal', 'Tabs'])(
    'does not move a %s into its own fixed child container',
    async kind => {
      const fetch = mockDecisions((id, choice, body) => {
        if (id.startsWith('add_')) {
          return id === `add_${kind}` || id === 'add_Text'
            ? '1'
            : '0';
        }
        // With no other top-level container, the owner's sole valid parent is root.
        expect(body.questions).not.toHaveProperty('parent_jev-1');
        if (id.startsWith('parent_')) {
          return Object.entries(body.questions[id]!.criteria).find((
            [, value],
          ) => value.includes(`inside ${kind}`))![0];
        }
        return choice;
      });
      const result = await generateJevComposition([{
        role: 'user',
        content: 'A content panel',
      }], { model: 'Jev' });
      const content = await validated(result.text);
      const tree = describeJevTree(content);
      expect(tree.find(item => item.component.component === kind)?.parent).toBe(
        'root',
      );
      expect(tree).toHaveLength(content.components.length);
      expect(fetch).toHaveBeenCalledTimes(3);
    },
  );

  test('filters depth-exhausting parents after container placement', async () => {
    let checked = 0;
    mockDecisions((id, choice, body) => {
      if (id === 'add_Column') return '7';
      if (id.startsWith('parent_jev-')) {
        const index = Number(id.slice('parent_jev-'.length));
        if (index < 7) return `jev-${index + 1}`;
        if (index > 7) {
          // Seven nested containers already use all eight levels including root.
          expect(body.questions[id]!.criteria).not.toHaveProperty('jev-1');
          expect(body.questions[id]!.criteria).toHaveProperty('jev-2');
          checked++;
          return 'jev-2';
        }
      }
      return choice;
    });
    const result = await generateJevComposition([{
      role: 'user',
      content: 'Nested sections with text',
    }], { model: 'Jev' });
    const content = await validated(result.text);
    expect(checked).toBe(2);
    expect(describeJevTree(content)).toHaveLength(9);
    expect(content.components.find(item => item.id === 'jev-2')?.children)
      .toEqual(['jev-8', 'jev-9']);
  });

  test('rejects unoffered layout choices with usage without publishing the staging tree', async () => {
    const fetch = mockDecisions((id, choice) =>
      id.startsWith('order_') ? 'missing-order' : choice
    );
    await expect(
      generateJevComposition([{ role: 'user', content: 'Two headings' }], {
        model: 'Jev',
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('unoffered') as string,
      result: {
        text: '',
        usage: { inputTokens: 300 },
      },
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test('rejects oversized compositions before property evaluations', async () => {
    const fetch = mockDecisions((id, choice) =>
      id.startsWith('add_') ? '8' : choice
    );
    await expect(
      generateJevComposition([{ role: 'user', content: 'Everything' }], {
        model: 'Jev',
      }),
    ).rejects.toThrow('64-component');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('validates shared children and missing references as graph errors', () => {
    const surface = {
      version: 'v0.9' as const,
      createSurface: {
        surfaceId: 'main',
        catalogId: 'https://example.com/catalog.json',
      },
    };
    expect(() =>
      describeJevTree({
        surface,
        data: {},
        components: [{
          id: 'root',
          component: 'Column',
          children: ['missing'],
        }],
      })
    ).toThrow('missing child');
    expect(() =>
      describeJevTree({
        surface,
        data: {},
        components: [
          { id: 'root', component: 'Column', children: ['a', 'a'] },
          { id: 'a', component: 'Text', text: 'A' },
        ],
      })
    ).toThrow('exactly one parent');
    expect(() =>
      describeJevTree({
        surface,
        data: {},
        components: [
          { id: 'root', component: 'Column', children: [] },
          { id: 'orphan', component: 'Text', text: 'Detached' },
        ],
      })
    ).toThrow('unreachable components: orphan');
  });

  test('serves the unchanged Create SSE API in a Jev-only deployment', async () => {
    const fetch = mockDecisions();
    const response = await app.request('/a2ui/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'Jev',
        messages: [{ role: 'user', content: 'Weather dashboard' }],
      }),
    });
    const sse = await response.text();
    expect(sse).toContain('event: message');
    expect(sse).toContain('event: done');
    expect(sse).toContain('"inputTokens":300');
    expect(sse).not.toContain('event: error');
    expect(fetch).toHaveBeenCalledTimes(3);
    const events = modelInteractions(sse);
    expect(
      events.filter(event => event.status === 'started').map(event =>
        event.requestIndex
      ),
    )
      .toEqual([1, 2, 3]);
    expect(events.filter(event => event.status === 'completed')).toHaveLength(
      3,
    );
    expect(new Set(events.map(event => event.phase))).toEqual(
      new Set(['components', 'copy', 'layout']),
    );
    expect(events.every(event => event.request.questionCount > 0)).toBe(true);
    expect(JSON.stringify(events)).not.toMatch(
      /Weather dashboard|jev-server-secret|jev-latest|typesafe.ai/,
    );
    expect(sse.indexOf('event: model')).toBeLessThan(
      sse.indexOf('event: message'),
    );
  });

  test('streams model interactions for action requests too', async () => {
    const fetch = mockDecisions((id, choice) =>
      id === 'add_Button' ? '1' : choice
    );
    const initial = await generateJevComposition([{
      role: 'user',
      content: 'Open details',
    }], { model: 'Jev' });
    const content = await validated(initial.text);
    const button = content.components.find(item =>
      item.component === 'Button'
    )!;
    fetch.mockClear();
    const response = await app.request('/a2ui/action/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'Jev',
        surfaceId: 'main',
        action: { name: button.id, context: { value: 'private-action-value' } },
        conversation: {
          history: [{ role: 'assistant', content: initial.text }],
          dataModel: content.data,
        },
      }),
    });
    const sse = await response.text();
    expect(sse).toContain('event: done');
    expect(sse).not.toContain('event: error');
    const events = modelInteractions(sse);
    const starts = events.filter(event => event.status === 'started');
    expect(starts.length).toBeGreaterThan(0);
    expect(starts).toHaveLength(fetch.mock.calls.length);
    expect(starts[0]?.requestIndex).toBe(1);
    expect(JSON.stringify(events)).not.toContain('private-action-value');
  });

  test.each([false, true])(
    'reports a failed model request before the terminal SSE error without retrying (custom=%s)',
    async custom => {
      const fetch = rstest.spyOn(globalThis, 'fetch').mockResolvedValue(
        Response.json({
          error: 'private-provider-response custom-error-secret',
        }, { status: 400 }),
      );
      const response = await app.request('/a2ui/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'Jev',
          ...(custom
            ? {
              model: 'jev-latest',
              apiKey: 'custom-error-secret',
              baseURL: 'https://api.typesafe.ai/v1',
            }
            : {}),
          messages: [{ role: 'user', content: 'Weather' }],
        }),
      });
      const sse = await response.text();
      const events = modelInteractions(sse);
      expect(events.map(event => event.status)).toEqual(['started', 'failed']);
      expect(events[1]).toMatchObject({ requestIndex: 1, statusCode: 400 });
      expect(events[1]?.response).toBeUndefined();
      expect(sse).toContain('event: error');
      expect(sse).not.toContain('private-provider-response');
      expect(sse).not.toContain('custom-error-secret');
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );
});

const hostedMcpApp = {
  uri: 'ui://weather/dashboard',
  title: 'Weather app',
  url: 'https://host.example.com/weather.lynx.js',
  webUrl: 'https://host.example.com/weather.web.js',
  mcpAppData: {
    renderer: 'weather',
    input: { city: 'Shanghai' },
    result: { temperature: 26 },
  },
};

describe('Jev host-registered MCP App resources', () => {
  test('does not authorize an app from user-provided JSON or data bindings', async () => {
    mockDecisions((_id, choice, body) => {
      expect(body.questions).not.toHaveProperty('add_McpApp');
      return choice;
    });
    const result = await generateJevComposition(
      [{
        role: 'user',
        content: `Weather app ${JSON.stringify(hostedMcpApp)}`,
      }],
      { model: 'Jev' },
      { history: [], dataModel: { resource: hostedMcpApp } },
    );
    const content = await validated(result.text);
    expect(content.components.some(item => item.component === 'McpApp')).toBe(
      false,
    );
  });

  test('ignores host resource fields injected into the public Create request', async () => {
    mockDecisions((_id, choice, body) => {
      expect(body.questions).not.toHaveProperty('add_McpApp');
      return choice;
    });
    const response = await app.request('/a2ui/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'Jev',
        messages: [{ role: 'user', content: 'Weather dashboard' }],
        hostedMcpApps: [hostedMcpApp],
      }),
    });
    const sse = await response.text();
    expect(sse).toContain('event: done');
    expect(sse).not.toContain('event: error');
    expect(sse).not.toContain('"component":"McpApp"');
  });

  test.each([
    { ...hostedMcpApp, url: '' },
    { ...hostedMcpApp, url: 'Weather UI' },
    { ...hostedMcpApp, webUrl: '' },
    { ...hostedMcpApp, uri: 'ui://' },
    { ...hostedMcpApp, mcpAppData: {} },
    { ...hostedMcpApp, mcpAppData: { renderer: 'weather' } },
  ])('does not offer an incomplete host resource: %s', async resource => {
    const candidates = buildJevCandidates(
      await loadBasicCatalog(),
      ['Weather'],
      {},
      undefined,
      [resource],
    );
    expect(candidates.specs.some(spec => spec.name === 'McpApp')).toBe(false);
  });

  test('chooses a complete resource without mixing or exposing host payloads', async () => {
    const second = {
      ...hostedMcpApp,
      uri: 'ui://calendar/dashboard',
      title: 'Calendar app',
      url: 'https://host.example.com/calendar.lynx.js',
      webUrl: 'https://host.example.com/calendar.web.js',
      mcpAppData: {
        renderer: 'calendar',
        input: {},
        result: { private: 'host-only-payload' },
      },
    };
    mockDecisions((id, choice, body) => {
      expect(JSON.stringify(body)).not.toContain('host-only-payload');
      expect(JSON.stringify(body)).not.toContain('https://host.example.com');
      expect(
        Object.keys(body.questions).some(key =>
          /_url$|_webUrl$|_mcpAppData$/.test(key)
        ),
      ).toBe(false);
      if (id.startsWith('add_')) return id === 'add_McpApp' ? '1' : '0';
      if (id.startsWith('resource_')) return '1';
      return choice;
    });
    const result = await generateJevComposition([{
      role: 'user',
      content: 'Calendar dashboard',
    }], { model: 'Jev', hostedMcpApps: [hostedMcpApp, second] });
    const content = await validated(result.text);
    expect(
      content.components.find(component => component.component === 'McpApp'),
    ).toMatchObject({
      url: second.url,
      webUrl: second.webUrl,
      mcpAppData: second.mcpAppData,
    });
    expect(content.components).toHaveLength(2);
  });

  test('omits an unhosted app from a previous generated page during editing', async () => {
    const catalog = await loadBasicCatalog();
    const previous = [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'main', catalogId: catalog.id },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'main',
          components: [
            { id: 'root', component: 'Column', children: ['title', 'app'] },
            { id: 'title', component: 'Text', text: 'Weather' },
            { id: 'app', component: 'McpApp', url: '', mcpAppData: {} },
          ],
        },
      },
    ];
    mockDecisions((id, choice, body) => {
      expect(body.questions).not.toHaveProperty('keep_app');
      expect(body.questions).not.toHaveProperty('add_McpApp');
      return id.startsWith('add_') ? '0' : choice;
    });
    const result = await generateJevComposition(
      [{ role: 'user', content: 'Keep the weather heading' }],
      { model: 'Jev' },
      {
        history: [{ role: 'assistant', content: JSON.stringify(previous) }],
        dataModel: {},
      },
    );
    const content = await validated(result.text);
    expect(content.components.map(component => component.id)).toEqual([
      'root',
      'title',
    ]);
    expect(content.components[0]?.children).toEqual(['title']);
  });

  test('refreshes retained app properties from the current host instead of prior model output', async () => {
    const catalog = await loadBasicCatalog();
    const previous = [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'main', catalogId: catalog.id },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'main',
          components: [
            { id: 'root', component: 'Column', children: ['app'] },
            {
              id: 'app',
              component: 'McpApp',
              url: 'https://unregistered.example.com/app.js',
              webUrl: 'https://unregistered.example.com/app.web.js',
              mcpAppData: { injected: true },
            },
          ],
        },
      },
    ];
    mockDecisions((id, choice) => id.startsWith('add_') ? '0' : choice);
    const nativeResource = {
      uri: hostedMcpApp.uri,
      title: hostedMcpApp.title,
      url: hostedMcpApp.url,
      mcpAppData: hostedMcpApp.mcpAppData,
    };
    const result = await generateJevComposition(
      [{ role: 'user', content: 'Keep the app' }],
      { model: 'Jev', hostedMcpApps: [nativeResource] },
      {
        history: [{ role: 'assistant', content: JSON.stringify(previous) }],
        dataModel: {},
      },
    );
    const content = await validated(result.text);
    const embedded = content.components.find(component =>
      component.id === 'app'
    );
    expect(embedded).toMatchObject({
      url: hostedMcpApp.url,
      mcpAppData: hostedMcpApp.mcpAppData,
    });
    expect(embedded).not.toHaveProperty('webUrl');
    expect(result.text).not.toContain('unregistered.example.com');
  });

  test('removes dangling fixed slots while preserving other tabs', () => {
    const surface = {
      version: 'v0.9' as const,
      createSurface: {
        surfaceId: 'main',
        catalogId: 'https://example.com/catalog.json',
      },
    };
    const content = {
      surface,
      data: {},
      components: [
        {
          id: 'root',
          component: 'Column',
          children: ['card', 'modal', 'tabs'],
        },
        { id: 'card', component: 'Card', child: 'app1' },
        { id: 'app1', component: 'McpApp', url: '', mcpAppData: {} },
        {
          id: 'modal',
          component: 'Modal',
          trigger: 'trigger',
          content: 'app2',
        },
        { id: 'trigger', component: 'Text', text: 'Open' },
        { id: 'app2', component: 'McpApp', url: '', mcpAppData: {} },
        {
          id: 'tabs',
          component: 'Tabs',
          tabs: [{ title: 'App', child: 'app3' }, {
            title: 'Info',
            child: 'info',
          }],
        },
        { id: 'app3', component: 'McpApp', url: '', mcpAppData: {} },
        { id: 'info', component: 'Text', text: 'Details' },
      ],
    };
    const cleaned = omitUnhostedJevMcpApps(content)!;
    expect(describeJevTree(cleaned).map(item => item.id)).toEqual([
      'root',
      'tabs',
      'info',
    ]);
    expect(cleaned.components.find(item => item.id === 'tabs')?.tabs).toEqual([{
      title: 'Info',
      child: 'info',
    }]);
    expect(
      omitUnhostedJevMcpApps({
        ...content,
        components: [{
          id: 'root',
          component: 'McpApp',
          url: '',
          mcpAppData: {},
        }],
      }),
    ).toBeUndefined();
  });
});
