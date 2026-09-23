// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rs, test } from '@rstest/core';

import { A2UI_CHAT_ADAPTER } from './a2ui.js';
import { HTML_CHAT_ADAPTER } from './html.js';
import { LYNX_XML_CHAT_ADAPTER } from './lynx-xml.js';
import {
  MCP_APPS_CHAT_ADAPTER,
  PRODUCT_RESOURCE_URI,
  WEATHER_RESOURCE_URI,
} from './mcp-apps.js';
import { OPENUI_CHAT_ADAPTER } from './openui.js';
import {
  CHAT_PROVIDER_SETTINGS_ADAPTER,
  CUSTOM_JEV_PROVIDER_OPTION,
  CUSTOM_PROVIDER_BASE_URL,
  CUSTOM_PROVIDER_BASE_URL_OPTIONS,
  CUSTOM_PROVIDER_ID,
  CUSTOM_PROVIDER_MODEL,
  compactProviderLabel,
  createDefaultProviderSettings,
  getModelsEndpoint,
  getProviderSettingsValidationError,
  loadProviderSettings,
  parseStoredProviderSettings,
  serializeProviderSettings,
  toProviderRequestOptions,
} from './shared.js';
import { PRODUCT_API_NAME } from '../../../lynx-src/mcp-apps/product/api.js';
import { WEATHER_API_NAME } from '../../../lynx-src/mcp-apps/weather/api.js';
import { PROTOCOLS } from '../../utils/protocol.js';

const reduceA2UIStream = A2UI_CHAT_ADAPTER.stream.reduce.bind(
  A2UI_CHAT_ADAPTER.stream,
);

test('does not accept invalid A2UI text as a successful response', () => {
  const payload = {
    text: JSON.stringify([{ version: 'v0.9', invalid: true }]),
    validation: { ok: false, errors: ['Invalid component'], messages: [] },
  };
  expect(() => A2UI_CHAT_ADAPTER.stream.fromJson(payload)).toThrow(
    'Invalid component',
  );
  expect(() =>
    reduceA2UIStream(A2UI_CHAT_ADAPTER.stream.initial(), {
      event: 'done',
      data: payload,
    })
  ).toThrow('Invalid component');
});

test('restores the exact saved A2UI action for an explicit retry', () => {
  const action = {
    surfaceId: 'main',
    action: { name: 'refresh', context: { item: 1 } },
  };
  expect(A2UI_CHAT_ADAPTER.action.parseUserText(
    A2UI_CHAT_ADAPTER.action.userText(action),
  )).toEqual(action);
  expect(A2UI_CHAT_ADAPTER.action.parseUserText('Build a counter')).toBeNull();
});

test('Lynx XML starts all options on without inheriting another record’s preferences', () => {
  const adapter = LYNX_XML_CHAT_ADAPTER.settings;
  const defaults = {
    enableDesignGuidance: true,
    enableHtmlFragment: true,
    enableScriptReuse: true,
    stylePreset: 'default',
  };
  expect(adapter.initial()).toMatchObject(defaults);
  for (
    const raw of [
      undefined,
      '',
      '{}',
      'invalid JSON',
      JSON.stringify({
        provider: 'test-model',
        enableDesignGuidance: false,
        enableHtmlFragment: false,
        enableScriptReuse: false,
        stylePreset: false,
      }),
    ]
  ) {
    expect(adapter.parseStored(raw)).toMatchObject(defaults);
  }
  expect(adapter.conversation.restore(adapter.initial(), {
    enableDesignGuidance: true,
  })).toMatchObject(defaults);
});

test.each([
  [true, true, true],
  [true, true, false],
  [true, false, true],
  [true, false, false],
  [false, true, true],
  [false, true, false],
  [false, false, true],
  [false, false, false],
])(
  'independently saves and requests Design=%s Template=%s StylePreset=%s',
  (design, template, preset) => {
    const adapter = LYNX_XML_CHAT_ADAPTER;
    let settings = adapter.settings.initial();
    for (
      const [id, enabled] of [
        ['enableDesignGuidance', design],
        ['enableHtmlFragment', template],
        ['stylePreset', preset],
      ] as const
    ) {
      settings = adapter.settings.update(settings, id, enabled ? 'on' : 'off');
      expect(
        adapter.settings.controls(settings).find(control => control.id === id),
      )
        .toMatchObject({ kind: 'checkbox', value: enabled ? 'on' : 'off' });
    }
    expect(
      adapter.settings.controls(settings).filter(control =>
        control.kind === 'checkbox'
      )
        .every(control => !('disabled' in control && control.disabled)),
    ).toBe(true);
    const saved = adapter.settings.conversation.snapshot(settings);
    expect(saved).toEqual({
      enableDesignGuidance: design,
      enableHtmlFragment: template,
      enableScriptReuse: true,
      stylePreset: preset ? 'default' : false,
    });
    expect(
      adapter.settings.conversation.restore(adapter.settings.initial(), saved),
    )
      .toMatchObject(saved);
    const stored = adapter.settings.serialize(settings);
    for (
      const key of ['enableDesignGuidance', 'enableHtmlFragment', 'stylePreset']
    ) {
      expect(stored).not.toHaveProperty(key);
    }
    const request = adapter.createRequest({
      prompt: 'Hello',
      settings,
      conversation: { history: [], dataModel: {} },
      host: {
        origin: 'http://localhost:3000',
        hostname: 'localhost',
        protocol: 'http:',
        search: '',
        baseUrl: '/',
      },
      signal: new AbortController().signal,
    });
    expect(request.body.enableDesignGuidance !== false).toBe(design);
    expect(request.body.enableHtmlFragment).toBe(template);
    expect(request.body.stylePreset).toBe(preset ? 'default' : undefined);
  },
);

test.each([undefined, false, true])(
  'ScriptReuse defaults on and preserves explicit selection %s',
  enableScriptReuse => {
    const adapter = LYNX_XML_CHAT_ADAPTER;
    const enabled = enableScriptReuse !== false;
    expect(adapter.settings.initial().enableScriptReuse).toBe(true);
    const settings = adapter.settings.update(
      {
        ...adapter.settings.initial(),
        enableScriptReuse,
      },
      'enableHtmlFragment',
      'off',
    );
    expect(
      adapter.settings.controls(settings).find(control =>
        control.id === 'enableScriptReuse'
      )?.value,
    ).toBe(enabled ? 'on' : 'off');
    const saved = adapter.settings.conversation.snapshot(settings);
    expect(saved.enableScriptReuse).toBe(enabled);
    expect(
      adapter.settings.conversation.restore(adapter.settings.initial(), saved)
        .enableScriptReuse,
    ).toBe(enabled);
    expect(adapter.settings.serialize(settings)).not.toHaveProperty(
      'enableScriptReuse',
    );
    const request = adapter.createRequest({
      prompt: 'Counter',
      settings,
      conversation: {
        history: [{
          role: 'assistant',
          content: 'assembled runtime',
          lynxXmlModelOutput: 'business callbacks',
        }],
        dataModel: {},
      },
      host: {
        origin: 'http://localhost:3000',
        hostname: 'localhost',
        protocol: 'http:',
        search: '',
        baseUrl: '/',
      },
      signal: new AbortController().signal,
    });
    expect(request.body.enableScriptReuse).toBe(enabled);
    expect(request.body.enableHtmlFragment).toBe(false);
    expect(request.body.conversation).toEqual({
      history: [{
        role: 'assistant',
        content: enabled ? 'business callbacks' : 'assembled runtime',
      }],
      dataModel: {},
    });
  },
);

test('toggling Template preserves the independent StylePreset selection', () => {
  const adapter = LYNX_XML_CHAT_ADAPTER.settings;
  const settings = adapter.update(
    adapter.initial(),
    'enableHtmlFragment',
    'off',
  );
  expect(settings.stylePreset).toBe('default');
  expect(adapter.update(settings, 'enableHtmlFragment', 'on').stylePreset).toBe(
    'default',
  );
});

test('keeps intermediate fragment source out of preview and migrates the saved switch', () => {
  const intermediate =
    '<!doctype lynx>\n<lynx engine-version="4.2"><template><view/></template><script thread="main">createFragment(page, pageId);</script></lynx>';
  for (
    const source of [
      intermediate,
      intermediate.replace(
        '<template>',
        '<style>.page { display: flex; }</style><!-- content --><template>',
      ),
    ]
  ) {
    expect(LYNX_XML_CHAT_ADAPTER.preview.source({ source }, {
      theme: 'light',
      protocol: PROTOCOLS['lynx-xml'],
      previewPayloadUrls: null,
    })).toBeUndefined();
  }
  const migrated = parseStoredProviderSettings(
    JSON.stringify({ enableHtmlFragmentTool: true }),
  );
  expect(migrated.enableHtmlFragment).toBe(true);
  expect(serializeProviderSettings(migrated)).not.toHaveProperty(
    'enableHtmlFragmentTool',
  );
});
const reduceOpenUIStream = OPENUI_CHAT_ADAPTER.stream.reduce.bind(
  OPENUI_CHAT_ADAPTER.stream,
);
const VALID_LYNX_XML = [
  '<!doctype lynx>',
  '<lynx engine-version="4.2">',
  '<style>.root { display: flex; }</style>',
  '<script thread="main">globalThis.processData = () => {};</script>',
  '</lynx>',
].join('\n');
const VALID_HTML = [
  '<!doctype html>',
  '<html lang="en">',
  '<head><meta charset="utf-8"><title>Counter</title></head>',
  '<body><button id="counter">0</button></body>',
  '</html>',
].join('\n');

describe('chat protocol adapters', () => {
  test('starts with an unloaded server-backed model list', () => {
    const settings = createDefaultProviderSettings();
    expect(settings).toEqual({
      provider: '',
      apiKey: '',
      baseURL: CUSTOM_PROVIDER_BASE_URL,
      model: CUSTOM_PROVIDER_MODEL,
      models: [],
      status: 'idle',
    });
    expect(compactProviderLabel(settings)).toBe('Loading models');
    expect(toProviderRequestOptions(settings)).toEqual({});

    expect(parseStoredProviderSettings(JSON.stringify({
      preset: 'gpt-5.5',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-5.5',
    }))).toEqual(settings);

    expect(parseStoredProviderSettings(JSON.stringify({
      preset: 'custom',
      apiKey: 'legacy-api-key',
      baseURL: 'https://example.com/v1',
      model: 'custom-model',
    }))).toEqual({
      ...settings,
      provider: CUSTOM_PROVIDER_ID,
      apiKey: '',
      baseURL: CUSTOM_PROVIDER_BASE_URL,
      model: CUSTOM_PROVIDER_MODEL,
    });
  });

  test('configures reasoning effort and omits the default override', () => {
    const settings = {
      ...createDefaultProviderSettings(),
      provider: 'test-model',
      models: [{ id: 'test-model', label: 'Test model' }],
      status: 'ready' as const,
    };
    const control = CHAT_PROVIDER_SETTINGS_ADAPTER.controls(settings).find(
      ({ id }) => id === 'reasoningEffort',
    );
    expect(control).toMatchObject({
      kind: 'select',
      value: '',
      options: [
        { value: '', label: 'Default' },
        { value: 'none', label: 'None' },
        { value: 'minimal', label: 'Minimal' },
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'xhigh', label: 'Extra high' },
      ],
    });

    const explicit = CHAT_PROVIDER_SETTINGS_ADAPTER.update(
      settings,
      'reasoningEffort',
      'high',
    );
    expect(toProviderRequestOptions(explicit)).toEqual({
      model: 'test-model',
      reasoningEffort: 'high',
    });
    expect(CHAT_PROVIDER_SETTINGS_ADAPTER.conversation.snapshot(explicit))
      .toMatchObject({ reasoningEffort: 'high' });
    expect(serializeProviderSettings(explicit)).toMatchObject({
      reasoningEffort: 'high',
    });

    const inherited = CHAT_PROVIDER_SETTINGS_ADAPTER.update(
      explicit,
      'reasoningEffort',
      '',
    );
    expect(inherited).not.toHaveProperty('reasoningEffort');
    expect(toProviderRequestOptions(inherited)).toEqual({
      model: 'test-model',
    });
  });

  test('loads the model list and default model from the server', async () => {
    const host = {
      origin: 'http://localhost:3000',
      hostname: 'localhost',
      protocol: 'http:',
      search: '',
      baseUrl: 'http://localhost:3000/',
    };
    const fetchModels = rs.fn(async () => ({
      ok: true,
      json: async () => ({
        defaultModel: 'Doubao Seed',
        models: [
          { id: 'Doubao Seed', label: 'Doubao Seed' },
          { id: 'Doubao Pro', label: 'Doubao Pro' },
        ],
      }),
    }));
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { fetch: fetchModels },
    });

    try {
      const settings = await loadProviderSettings(
        createDefaultProviderSettings(),
        host,
        new AbortController().signal,
      );
      const modelsEndpoint = getModelsEndpoint(host);
      expect(modelsEndpoint).toBe('http://localhost:3060/models');
      expect(fetchModels).toHaveBeenCalledTimes(1);
      expect(fetchModels.mock.calls[0]?.[0]).toBe(modelsEndpoint);
      expect(settings).toEqual({
        provider: 'Doubao Seed',
        apiKey: '',
        baseURL: CUSTOM_PROVIDER_BASE_URL,
        model: CUSTOM_PROVIDER_MODEL,
        models: [
          { id: 'Doubao Seed', label: 'Doubao Seed' },
          { id: 'Doubao Pro', label: 'Doubao Pro' },
        ],
        status: 'ready',
      });
      expect(compactProviderLabel(settings)).toBe('Doubao Seed');
      expect(toProviderRequestOptions(settings)).toEqual({
        model: 'Doubao Seed',
      });

      let customSettings = CHAT_PROVIDER_SETTINGS_ADAPTER.update(
        settings,
        'provider',
        CUSTOM_PROVIDER_ID,
      );
      expect(
        CHAT_PROVIDER_SETTINGS_ADAPTER.controls(customSettings).map(
          (control) => control.id,
        ),
      ).toEqual([
        'provider',
        'model',
        'apiKey',
        'baseURL',
        'reasoningEffort',
        'enableDesignGuidance',
      ]);
      expect(CHAT_PROVIDER_SETTINGS_ADAPTER.controls(customSettings)[3])
        .toMatchObject({
          kind: 'select',
          options: CUSTOM_PROVIDER_BASE_URL_OPTIONS,
        });
      expect(compactProviderLabel(customSettings)).toBe(CUSTOM_PROVIDER_MODEL);
      expect(CHAT_PROVIDER_SETTINGS_ADAPTER.validate(customSettings)).toBe(
        'Enter a provider API key to use Custom API key.',
      );
      expect(() => toProviderRequestOptions(customSettings)).toThrow(
        'Enter a provider API key to use Custom API key.',
      );
      expect(getProviderSettingsValidationError({
        ...customSettings,
        apiKey: '   ',
        model: '   ',
      })).toBe(
        'Enter a provider model and API key to use Custom API key.',
      );
      expect(getProviderSettingsValidationError({
        ...customSettings,
        apiKey: 'sk-user',
        model: '   ',
      })).toBe('Enter a provider model to use Custom API key.');
      customSettings = CHAT_PROVIDER_SETTINGS_ADAPTER.update(
        customSettings,
        'apiKey',
        '  sk-user  ',
      );
      customSettings = CHAT_PROVIDER_SETTINGS_ADAPTER.update(
        customSettings,
        'model',
        '  custom-model  ',
      );
      customSettings = CHAT_PROVIDER_SETTINGS_ADAPTER.update(
        customSettings,
        'baseURL',
        'https://generativelanguage.googleapis.com/v1beta/openai',
      );
      expect(CHAT_PROVIDER_SETTINGS_ADAPTER.validate(customSettings))
        .toBeUndefined();
      expect(toProviderRequestOptions(customSettings)).toEqual({
        apiKey: 'sk-user',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: 'gemini-3.7-flash',
      });
      for (const option of CUSTOM_PROVIDER_BASE_URL_OPTIONS) {
        expect(CHAT_PROVIDER_SETTINGS_ADAPTER.update(
          { ...customSettings, model: 'manually-edited-model' },
          'baseURL',
          option.value,
        )).toMatchObject({
          baseURL: option.value,
          model: option.model,
        });
      }
      expect(CHAT_PROVIDER_SETTINGS_ADAPTER.update(
        customSettings,
        'baseURL',
        'https://example.com/v1',
      )).toBe(customSettings);
      expect(serializeProviderSettings(customSettings)).toEqual({
        provider: CUSTOM_PROVIDER_ID,
      });
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  test('surfaces a model-list HTTP error without retaining models', async () => {
    const host = {
      origin: 'http://localhost:3000',
      hostname: 'localhost',
      protocol: 'http:',
      search: '',
      baseUrl: 'http://localhost:3000/',
    };
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        fetch: rs.fn(async () => ({
          ok: false,
          json: async () => ({ error: 'Model service unavailable' }),
        })),
      },
    });

    try {
      await expect(loadProviderSettings(
        createDefaultProviderSettings(),
        host,
        new AbortController().signal,
      )).resolves.toEqual({
        provider: '',
        apiKey: '',
        baseURL: CUSTOM_PROVIDER_BASE_URL,
        model: CUSTOM_PROVIDER_MODEL,
        models: [],
        status: 'error',
        error: 'Model service unavailable',
      });
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  test('opens custom provider settings when server model config is absent', async () => {
    const host = {
      origin: 'http://localhost:3000',
      hostname: 'localhost',
      protocol: 'http:',
      search: '',
      baseUrl: 'http://localhost:3000/',
    };
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        fetch: rs.fn(async () => ({
          ok: false,
          json: async () => ({
            error: 'GENUI_MODEL_CONFIG_JSON is required',
          }),
        })),
      },
    });

    try {
      const settings = await loadProviderSettings(
        createDefaultProviderSettings(),
        host,
        new AbortController().signal,
      );
      expect(settings).toEqual({
        provider: CUSTOM_PROVIDER_ID,
        apiKey: '',
        baseURL: CUSTOM_PROVIDER_BASE_URL,
        model: CUSTOM_PROVIDER_MODEL,
        models: [],
        status: 'ready',
      });
      expect(
        CHAT_PROVIDER_SETTINGS_ADAPTER.controls(settings).map(
          (control) => control.id,
        ),
      ).toEqual([
        'provider',
        'model',
        'apiKey',
        'baseURL',
        'reasoningEffort',
        'enableDesignGuidance',
      ]);
      expect(CHAT_PROVIDER_SETTINGS_ADAPTER.controls(settings)[0])
        .toMatchObject(
          {
            disabled: false,
            options: [{
              value: CUSTOM_PROVIDER_ID,
              label: 'Custom API key',
            }],
          },
        );
      expect(CHAT_PROVIDER_SETTINGS_ADAPTER.validate(settings)).toBe(
        'Enter a provider API key to use Custom API key.',
      );
      expect(() => toProviderRequestOptions(settings)).toThrow(
        'Enter a provider API key to use Custom API key.',
      );
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  test('rejects an invalid model-list response without retaining models', async () => {
    const host = {
      origin: 'http://localhost:3000',
      hostname: 'localhost',
      protocol: 'http:',
      search: '',
      baseUrl: 'http://localhost:3000/',
    };
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        fetch: rs.fn(async () => ({
          ok: true,
          json: async () => ({
            defaultModel: 'Missing',
            models: [{ id: 'Doubao Seed', label: 'Doubao Seed' }],
          }),
        })),
      },
    });

    try {
      await expect(loadProviderSettings(
        createDefaultProviderSettings(),
        host,
        new AbortController().signal,
      )).resolves.toEqual({
        provider: '',
        apiKey: '',
        baseURL: CUSTOM_PROVIDER_BASE_URL,
        model: CUSTOM_PROVIDER_MODEL,
        models: [],
        status: 'error',
        error: 'The model list response is invalid',
      });
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  test('reduces an A2UI stream without duplicating incremental messages', () => {
    let state = A2UI_CHAT_ADAPTER.stream.initial();

    const delta = reduceA2UIStream(state, {
      event: 'delta',
      data: { text: '{"begin":' },
    });
    state = delta.state;
    expect(delta.emissions).toEqual([
      { type: 'progress', text: '{"begin":' },
    ]);

    const firstMessage = { createSurface: { surfaceId: 'main' } };
    const first = reduceA2UIStream(state, {
      event: 'message',
      data: { messages: [firstMessage] },
    });
    state = first.state;
    expect(first.emissions).toEqual([
      { type: 'partial', output: [firstMessage] },
    ]);

    const secondMessage = { updateComponents: { surfaceId: 'main' } };
    const second = reduceA2UIStream(state, {
      event: 'message',
      data: { messages: [secondMessage] },
    });
    state = second.state;
    expect(second.emissions).toEqual([
      { type: 'partial', output: [secondMessage] },
    ]);
    expect(state.messages).toEqual([firstMessage, secondMessage]);

    const finalMessages = [firstMessage, secondMessage, {
      updateDataModel: { surfaceId: 'main' },
    }];
    const done = reduceA2UIStream(state, {
      event: 'done',
      data: {
        validation: { messages: finalMessages },
        usage: {
          inputTokens: 2,
          outputTokens: 3,
          totalTokens: 5,
          cachedInputTokens: 1,
        },
        preview: {
          messagesUrl: 'https://example.com/messages.json',
          actionMocksUrl: 'https://example.com/actions.json',
        },
      },
    });

    expect(done.state.messages).toEqual(finalMessages);
    expect(done.emissions).toEqual([
      {
        type: 'usage',
        usage: {
          promptTokens: 2,
          completionTokens: 3,
          totalTokens: 5,
          cachedTokens: 1,
        },
      },
      {
        type: 'previewPayload',
        value: {
          messagesUrl: 'https://example.com/messages.json',
          actionMocksUrl: 'https://example.com/actions.json',
        },
      },
      { type: 'final', output: finalMessages },
    ]);
  });

  test('surfaces A2UI validation errors when no output is available', () => {
    expect(() =>
      reduceA2UIStream(
        A2UI_CHAT_ADAPTER.stream.initial(),
        {
          event: 'done',
          data: { validation: { errors: ['bad schema'] } },
        },
      )
    ).toThrow('bad schema');
  });

  test('reduces OpenUI create and action streams independently', () => {
    let state = OPENUI_CHAT_ADAPTER.stream.initial();
    state = reduceOpenUIStream(state, {
      event: 'delta',
      data: { text: 'root = ' },
    }).state;
    state = reduceOpenUIStream(state, {
      event: 'delta',
      data: { text: 'Stack([])' },
    }).state;

    const done = reduceOpenUIStream(state, {
      event: 'done',
      data: {
        usage: {
          prompt_tokens: 4,
          completion_tokens: 6,
          prompt_tokens_details: { cached_tokens: 2 },
        },
      },
    });
    const output = {
      rawText: 'root = Stack([])',
      scenarioTitle: 'Agent response',
    };
    expect(done.emissions).toEqual([
      { type: 'progress', text: output.rawText },
      {
        type: 'usage',
        usage: {
          promptTokens: 4,
          completionTokens: 6,
          totalTokens: 10,
          cachedTokens: 2,
        },
      },
      { type: 'final', output },
    ]);

    const action = OPENUI_CHAT_ADAPTER.action.stream.fromJson({
      text: 'root = Text({text: "Saved"})',
    });
    expect(action.emissions).toEqual([
      { type: 'progress', text: 'root = Text({text: "Saved"})' },
      {
        type: 'final',
        output: {
          rawText: 'root = Text({text: "Saved"})',
          scenarioTitle: 'Action response',
        },
      },
    ]);
  });

  test('streams a Lynx XML artifact before final preview delivery', () => {
    const reduceStream = LYNX_XML_CHAT_ADAPTER.stream.reduce.bind(
      LYNX_XML_CHAT_ADAPTER.stream,
    );
    let state = LYNX_XML_CHAT_ADAPTER.stream.initial();
    const preamble = reduceStream(state, {
      event: 'delta',
      data: { text: '```xml\n' },
    });
    state = preamble.state;
    expect(preamble.emissions).toEqual([
      { type: 'progress', text: '```xml\n' },
    ]);

    const partial = reduceStream(state, {
      event: 'delta',
      data: { text: VALID_LYNX_XML },
    });
    state = partial.state;
    expect(partial.emissions).toEqual([
      { type: 'progress', text: VALID_LYNX_XML },
      { type: 'partial', output: { source: VALID_LYNX_XML } },
    ]);

    const done = reduceStream(state, {
      event: 'done',
      data: {
        text: `Here is the artifact:\n${VALID_LYNX_XML}\n\`\`\``,
        usage: { inputTokens: 7, outputTokens: 11, totalTokens: 18 },
      },
    });
    expect(done.emissions).toEqual([
      {
        type: 'usage',
        usage: { promptTokens: 7, completionTokens: 11, totalTokens: 18 },
      },
      { type: 'final', output: { source: VALID_LYNX_XML } },
    ]);
    expect(
      LYNX_XML_CHAT_ADAPTER.preview.artifact({
        source: VALID_LYNX_XML,
      }).views[0]?.text,
    ).toBe(VALID_LYNX_XML);
  });

  test('rejects an incomplete final Lynx XML response', () => {
    expect(() =>
      LYNX_XML_CHAT_ADAPTER.stream.fromJson({
        text: '<!doctype lynx><lynx engine-version="4.2">',
      })
    ).toThrow('incomplete Lynx XML artifact');
  });

  test('streams an HTML document before final iframe delivery', () => {
    const reduceStream = HTML_CHAT_ADAPTER.stream.reduce.bind(
      HTML_CHAT_ADAPTER.stream,
    );
    let state = HTML_CHAT_ADAPTER.stream.initial();
    const preamble = reduceStream(state, {
      event: 'delta',
      data: { text: '```html\n' },
    });
    state = preamble.state;
    expect(preamble.emissions).toEqual([
      { type: 'progress', text: '```html\n' },
    ]);

    const partial = reduceStream(state, {
      event: 'delta',
      data: { text: VALID_HTML },
    });
    state = partial.state;
    expect(partial.emissions).toEqual([
      { type: 'progress', text: VALID_HTML },
      { type: 'partial', output: { source: VALID_HTML } },
    ]);

    const done = reduceStream(state, {
      event: 'done',
      data: {
        text: `Here is the document:\n${VALID_HTML}\n\`\`\``,
        usage: { inputTokens: 5, outputTokens: 9, totalTokens: 14 },
      },
    });
    expect(done.emissions).toEqual([
      {
        type: 'usage',
        usage: { promptTokens: 5, completionTokens: 9, totalTokens: 14 },
      },
      { type: 'final', output: { source: VALID_HTML } },
    ]);
    expect(
      HTML_CHAT_ADAPTER.preview.artifact({ source: VALID_HTML }).views[0]
        ?.text,
    ).toBe(VALID_HTML);
  });

  test('shows before and after conversion while preserving original generation metadata', () => {
    const xmlFragment = '\n<view>\n  <text>杭州 &amp; 天气</text>\n</view>\n';
    const modelOutput = `\n\`\`\`xml\n${VALID_LYNX_XML}\n\`\`\`\n`;
    const output = { source: VALID_LYNX_XML, xmlFragment, modelOutput };
    const done = LYNX_XML_CHAT_ADAPTER.stream.reduce(
      LYNX_XML_CHAT_ADAPTER.stream.initial(),
      {
        event: 'done',
        data: { text: VALID_LYNX_XML, metadata: { xmlFragment, modelOutput } },
      },
    );
    expect(done.emissions).toEqual([{ type: 'final', output }]);
    expect(LYNX_XML_CHAT_ADAPTER.stream.finish(done.state)).toEqual(output);
    expect(
      LYNX_XML_CHAT_ADAPTER.stream.fromJson({
        text: VALID_LYNX_XML,
        metadata: { xmlFragment, modelOutput },
      }).emissions,
    ).toEqual([{ type: 'final', output }]);
    expect(LYNX_XML_CHAT_ADAPTER.preview.artifact(output).views).toEqual([
      {
        id: 'model-output',
        label: 'Original',
        text: modelOutput,
        language: 'text',
      },
      {
        id: 'transformed',
        label: 'Transformed',
        text: VALID_LYNX_XML,
        language: 'text',
      },
    ]);
    const saved = LYNX_XML_CHAT_ADAPTER.persist(output);
    expect(saved.assistantContent).toBe(VALID_LYNX_XML);
    expect(saved.lynxXmlFragment).toBe(xmlFragment);
    expect(saved.lynxXmlModelOutput).toBe(modelOutput);
    const history = [{
      role: 'assistant' as const,
      content: saved.assistantContent,
      lynxXmlFragment: xmlFragment,
      lynxXmlModelOutput: modelOutput,
    }];
    expect(
      LYNX_XML_CHAT_ADAPTER.hydrate({
        history,
        previewMessages: [],
        previewPayloadUrls: null,
      }).output,
    ).toEqual(output);
    const request = LYNX_XML_CHAT_ADAPTER.createRequest({
      prompt: 'Change the city',
      conversation: { history, dataModel: {} },
      settings: createDefaultProviderSettings(),
      host: {
        origin: 'http://localhost:3000',
        hostname: 'localhost',
        protocol: 'http:',
        search: '',
        baseUrl: '/',
      },
      signal: new AbortController().signal,
    });
    expect(JSON.stringify(request.body)).not.toContain('lynxXmlFragment');
    expect(JSON.stringify(request.body)).not.toContain('lynxXmlModelOutput');
    expect(LYNX_XML_CHAT_ADAPTER.preview.source(output, {
      protocol: PROTOCOLS['lynx-xml'],
      theme: 'light',
      previewPayloadUrls: null,
    })).not.toHaveProperty('modelOutput');
    expect(
      JSON.stringify(
        LYNX_XML_CHAT_ADAPTER.preview.source(output, {
          protocol: PROTOCOLS['lynx-xml'],
          theme: 'light',
          previewPayloadUrls: null,
        }),
      ),
    ).not.toContain('xmlFragment');
  });

  test('shows Original and Transformed for preset-only artifacts without fragment metadata', () => {
    const source = VALID_LYNX_XML.replace(
      '</lynx>',
      '<style>.flex { display: flex; }</style></lynx>',
    );
    const result = LYNX_XML_CHAT_ADAPTER.stream.fromJson({
      text: source,
      metadata: { modelOutput: VALID_LYNX_XML, stylePreset: 'default' },
    });
    const output = LYNX_XML_CHAT_ADAPTER.stream.finish(result.state)!;
    expect(output).not.toHaveProperty('xmlFragment');
    expect(
      LYNX_XML_CHAT_ADAPTER.preview.artifact(output).views.map((
        { label, text },
      ) => ({ label, text })),
    ).toEqual([
      { label: 'Original', text: VALID_LYNX_XML },
      { label: 'Transformed', text: source },
    ]);
    expect(LYNX_XML_CHAT_ADAPTER.persist(output)).toMatchObject({
      assistantContent: source,
      lynxXmlModelOutput: VALID_LYNX_XML,
    });
  });

  test.each([undefined, {}, { xmlFragment: 42 }])(
    'keeps legacy or invalid fragment metadata out of the artifact views: %j',
    (metadata) => {
      const result = LYNX_XML_CHAT_ADAPTER.stream.fromJson({
        text: VALID_LYNX_XML,
        metadata,
      });
      const output = LYNX_XML_CHAT_ADAPTER.stream.finish(result.state)!;
      expect(output).toEqual({ source: VALID_LYNX_XML });
      expect(
        LYNX_XML_CHAT_ADAPTER.preview.artifact({
          ...output,
          modelOutput: VALID_LYNX_XML,
        }).views,
      ).toHaveLength(1);
    },
  );

  test('rejects an incomplete final HTML response', () => {
    expect(() =>
      HTML_CHAT_ADAPTER.stream.fromJson({
        text: '<!doctype html><html><head></head><body>',
      })
    ).toThrow('incomplete HTML document');
  });

  test('builds protocol-specific preview sources and merge behavior', () => {
    const a2uiOutput = [{ createSurface: { surfaceId: 'main' } }];
    expect(A2UI_CHAT_ADAPTER.preview.source(a2uiOutput, {
      protocol: PROTOCOLS.a2ui,
      theme: 'dark',
      previewPayloadUrls: {
        messagesUrl: 'https://example.com/messages.json',
        actionMocksUrl: 'https://example.com/actions.json',
      },
    })).toMatchObject({
      kind: 'a2ui',
      protocol: PROTOCOLS.a2ui,
      theme: 'dark',
      messages: a2uiOutput,
      messagesUrl: 'https://example.com/messages.json',
      actionMocksUrl: 'https://example.com/actions.json',
      liveAction: true,
    });
    expect(A2UI_CHAT_ADAPTER.preview.merge([], a2uiOutput)).toEqual(
      a2uiOutput,
    );
    expect(A2UI_CHAT_ADAPTER.persist(
      [{ updateDataModel: { surfaceId: 'main' } }],
      {
        kind: 'action',
        current: a2uiOutput,
        previewPayloadUrls: {
          messagesUrl: 'https://example.com/action-messages.json',
        },
      },
    )).toMatchObject({
      previewMessages: [
        ...a2uiOutput,
        { updateDataModel: { surfaceId: 'main' } },
      ],
      previewPayloadUrls: null,
      snapshotPreviewPayloadUrls: null,
    });
    expect(A2UI_CHAT_ADAPTER.preview.source(null, {
      protocol: PROTOCOLS.a2ui,
      theme: 'light',
      previewPayloadUrls: null,
    })).toBeUndefined();

    const openuiOutput = {
      rawText: 'root = Stack([])',
      scenarioTitle: 'Example',
    };
    expect(OPENUI_CHAT_ADAPTER.preview.source(openuiOutput, {
      protocol: PROTOCOLS.openui,
      theme: 'dark',
      previewPayloadUrls: null,
    })).toEqual({
      kind: 'openui',
      rawText: openuiOutput.rawText,
      theme: 'dark',
      liveAction: true,
    });
    expect(OPENUI_CHAT_ADAPTER.preview.merge(null, openuiOutput)).toBe(
      openuiOutput,
    );
    expect(OPENUI_CHAT_ADAPTER.preview.source(null, {
      protocol: PROTOCOLS.openui,
      theme: 'light',
      previewPayloadUrls: null,
    })).toBeUndefined();

    const lynxXmlOutput = { source: VALID_LYNX_XML };
    expect(LYNX_XML_CHAT_ADAPTER.preview.source(lynxXmlOutput, {
      protocol: PROTOCOLS['lynx-xml'],
      theme: 'dark',
      previewPayloadUrls: null,
    })).toEqual({
      kind: 'lynx-xml',
      source: VALID_LYNX_XML,
      theme: 'dark',
    });
    expect(LYNX_XML_CHAT_ADAPTER.preview.merge(null, lynxXmlOutput)).toBe(
      lynxXmlOutput,
    );

    const htmlOutput = { source: VALID_HTML };
    expect(HTML_CHAT_ADAPTER.preview.source(htmlOutput, {
      protocol: PROTOCOLS.html,
      theme: 'light',
      previewPayloadUrls: null,
    })).toEqual({
      kind: 'html',
      source: VALID_HTML,
      theme: 'light',
    });
    expect(HTML_CHAT_ADAPTER.preview.merge(null, htmlOutput)).toBe(htmlOutput);
  });

  test('parses A2UI action bridge messages', () => {
    const action = A2UI_CHAT_ADAPTER.action.parseWindowMessage({
      type: 'A2UI_USER_ACTION',
      action: { name: 'refresh', surfaceId: 'main' },
    });
    expect(action).toEqual({
      action: { name: 'refresh', surfaceId: 'main' },
      surfaceId: 'main',
    });
    expect(A2UI_CHAT_ADAPTER.action.parseWindowMessage({
      type: 'OPENUI_USER_ACTION',
      action: { name: 'refresh' },
    })).toBeNull();
    expect(A2UI_CHAT_ADAPTER.action.parseWindowMessage({
      type: 'A2UI_USER_ACTION',
    })).toBeNull();
  });

  test('parses OpenUI action bridge messages and preserves form context', () => {
    const event = {
      type: 'submit',
      params: { orderId: 42 },
      humanFriendlyMessage: 'Submit order',
      formName: 'checkout',
      formState: { size: 'large' },
    };
    const action = OPENUI_CHAT_ADAPTER.action.parseWindowMessage({
      type: 'OPENUI_USER_ACTION',
      action: event,
    });
    expect(action).toEqual(event);
    expect(OPENUI_CHAT_ADAPTER.action.parseWindowMessage({
      type: 'A2UI_USER_ACTION',
      event,
    })).toEqual(event);
    expect(OPENUI_CHAT_ADAPTER.action.parseWindowMessage({
      type: 'OPENUI_USER_ACTION',
      action: { type: 'submit', params: {} },
    })).toBeNull();

    const userText = OPENUI_CHAT_ADAPTER.action.userText(event);
    expect(userText).toContain('Submit order');
    expect(userText).toContain('"orderId": 42');
    expect(userText).toContain('"formName": "checkout"');
    expect(userText).toContain('"size": "large"');
  });

  test('loads MCP Apps metadata before registering tools', async () => {
    const host = {
      origin: 'https://example.com',
      hostname: 'example.com',
      protocol: 'https:',
      search: '',
      baseUrl: 'https://example.com/',
    };
    const fetchMetadata = rs.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ) => ({
      ok: true,
      json: async () => ({
        protocolVersion: '2025-11-25',
        appProtocolVersion: '2026-01-26',
        extensionId: 'io.modelcontextprotocol/ui',
        resourceMimeType: 'text/html;profile=mcp-app',
      }),
    }));
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { fetch: fetchMetadata },
    });
    const signal = new AbortController().signal;

    try {
      const chatRequest = await MCP_APPS_CHAT_ADAPTER.createRequest({
        prompt: 'Weather in Hangzhou',
        conversation: { history: [], dataModel: {} },
        settings: {
          ...createDefaultProviderSettings(),
          provider: 'gpt-5.5',
          models: [{ id: 'gpt-5.5', label: 'gpt5.5' }],
          status: 'ready',
        },
        host,
        signal,
      });
      expect(fetchMetadata).toHaveBeenCalledTimes(1);
      expect(fetchMetadata.mock.calls[0]?.[0]).toBe(
        'http://localhost:3060/mcp-apps/metadata',
      );
      expect(fetchMetadata.mock.calls[0]?.[1]).toMatchObject({ signal });
      expect(chatRequest).toMatchObject({
        url: 'http://localhost:3060/mcp-apps/stream',
        body: {
          model: 'gpt-5.5',
          registry: {
            protocolVersion: '2025-11-25',
            appProtocolVersion: '2026-01-26',
            capabilities: {
              extensions: {
                'io.modelcontextprotocol/ui': {
                  mimeTypes: ['text/html;profile=mcp-app'],
                },
              },
            },
            tools: [
              {
                name: WEATHER_API_NAME,
                _meta: { ui: { visibility: ['model'] } },
              },
              {
                name: PRODUCT_API_NAME,
                _meta: { ui: { visibility: ['model'] } },
              },
            ],
            resources: [
              {
                uri: WEATHER_RESOURCE_URI,
                mimeType: 'text/html;profile=mcp-app',
              },
              {
                uri: PRODUCT_RESOURCE_URI,
                mimeType: 'text/html;profile=mcp-app',
              },
            ],
          },
        },
      });

      const request = {
        jsonrpc: '2.0' as const,
        id: 'weather-1',
        method: 'tools/call' as const,
        params: {
          name: WEATHER_API_NAME,
          arguments: { city: 'Hangzhou' },
        },
      };
      const reduced = MCP_APPS_CHAT_ADAPTER.stream.reduce(
        MCP_APPS_CHAT_ADAPTER.stream.initial(),
        {
          event: 'done',
          data: {
            protocolVersion: '2026-01-26',
            toolCall: request,
            resource: { uri: WEATHER_RESOURCE_URI },
          },
        },
      );
      const final = reduced.emissions.find((item) => item.type === 'final');
      expect(final).toBeDefined();
      if (!final || final.type !== 'final') return;
      expect(final.output).toMatchObject({
        kind: 'tool',
        tool: { name: WEATHER_API_NAME },
        resource: { uri: WEATHER_RESOURCE_URI },
        toolResult: {
          structuredContent: { weather: { city: 'Hangzhou' } },
        },
      });
      expect(
        MCP_APPS_CHAT_ADAPTER.preview.artifact(final.output).title,
      ).toBe('MCP Apps Exchange');
      const transcript = MCP_APPS_CHAT_ADAPTER.transcript.success(
        final.output,
      );
      expect(transcript).toContainEqual({
        kind: 'output',
        tone: 'info',
        text: 'LLM Tool Call',
        payload: {
          type: 'tool_call',
          name: WEATHER_API_NAME,
          arguments: { city: 'Hangzhou' },
        },
        payloadLayout: 'single',
      });
      expect(transcript).toContainEqual(expect.objectContaining({
        text: 'MCP Apps Tool Result',
      }));
      expect(transcript.map((message) => message.text)).toEqual([
        'LLM Tool Call',
        `Called ${WEATHER_API_NAME} and rendered ${WEATHER_RESOURCE_URI}.`,
        'MCP Apps Tool Result',
      ]);

      const hydrated = MCP_APPS_CHAT_ADAPTER.hydrate({
        history: [{
          role: 'assistant',
          content: JSON.stringify(final.output),
        }],
        previewMessages: [],
        previewPayloadUrls: null,
      });
      expect(hydrated.messages).toContainEqual(expect.objectContaining({
        text: 'LLM Tool Call',
        payload: {
          type: 'tool_call',
          name: WEATHER_API_NAME,
          arguments: { city: 'Hangzhou' },
        },
      }));
      expect(MCP_APPS_CHAT_ADAPTER.preview.source(final.output, {
        protocol: PROTOCOLS['mcp-apps'],
        theme: 'dark',
        previewPayloadUrls: null,
      })).toMatchObject({
        kind: 'mcp-apps',
        mcpAppData: {
          renderer: 'weather',
          input: { city: 'Hangzhou' },
          result: { weather: { city: 'Hangzhou' } },
        },
        theme: 'dark',
      });

      const productRequest = {
        jsonrpc: '2.0' as const,
        id: 'product-1',
        method: 'tools/call' as const,
        params: {
          name: PRODUCT_API_NAME,
          arguments: { productId: 'sneaker' },
        },
      };
      const productStep = MCP_APPS_CHAT_ADAPTER.stream.reduce(
        MCP_APPS_CHAT_ADAPTER.stream.initial(),
        {
          event: 'done',
          data: {
            protocolVersion: '2026-01-26',
            toolCall: productRequest,
            resource: { uri: PRODUCT_RESOURCE_URI },
          },
        },
      );
      const productFinal = productStep.emissions.find((item) =>
        item.type === 'final'
      );
      expect(productFinal).toBeDefined();
      if (!productFinal || productFinal.type !== 'final') return;
      expect(productFinal.output).toMatchObject({
        kind: 'tool',
        tool: { name: PRODUCT_API_NAME },
        resource: { uri: PRODUCT_RESOURCE_URI },
        toolResult: {
          structuredContent: {
            product: { id: 'sneaker', category: 'SNEAKERS' },
          },
        },
      });
      expect(MCP_APPS_CHAT_ADAPTER.preview.source(productFinal.output, {
        protocol: PROTOCOLS['mcp-apps'],
        theme: 'light',
        previewPayloadUrls: null,
      })).toMatchObject({
        kind: 'mcp-apps',
        mcpAppData: {
          renderer: 'product',
          input: { productId: 'sneaker' },
          result: { product: { id: 'sneaker' } },
        },
        theme: 'light',
      });
      if (productFinal.output.kind !== 'tool') return;
      expect(MCP_APPS_CHAT_ADAPTER.preview.source({
        ...productFinal.output,
        toolResult: {
          content: [{ type: 'text', text: 'Stale product result' }],
          structuredContent: {},
        },
      }, {
        protocol: PROTOCOLS['mcp-apps'],
        theme: 'light',
        previewPayloadUrls: null,
      })).toMatchObject({
        kind: 'mcp-apps',
        mcpAppData: {
          renderer: 'product',
          result: { product: { id: 'sneaker' } },
        },
      });

      const messageStep = MCP_APPS_CHAT_ADAPTER.stream.reduce(
        MCP_APPS_CHAT_ADAPTER.stream.initial(),
        {
          event: 'done',
          data: {
            protocolVersion: '2026-01-26',
            message: '# Lynx\n\nLynx is a cross-platform UI framework.',
          },
        },
      );
      const messageFinal = messageStep.emissions.find((item) =>
        item.type === 'final'
      );
      expect(messageFinal).toBeDefined();
      if (!messageFinal || messageFinal.type !== 'final') return;
      expect(MCP_APPS_CHAT_ADAPTER.preview.source(messageFinal.output, {
        protocol: PROTOCOLS['mcp-apps'],
        theme: 'light',
        previewPayloadUrls: null,
      })).toEqual({
        kind: 'mcp-apps',
        mcpAppData: {
          markdown: '# Lynx\n\nLynx is a cross-platform UI framework.',
        },
        theme: 'light',
      });
      expect('action' in MCP_APPS_CHAT_ADAPTER).toBe(false);
      expect(fetchMetadata).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }
  });
});

test('A2UI can boot an empty live preview before any model output', () => {
  const output = A2UI_CHAT_ADAPTER.preview.initialOutput();
  expect(A2UI_CHAT_ADAPTER.preview.source(output, {
    protocol: PROTOCOLS.a2ui,
    theme: 'light',
    previewPayloadUrls: null,
  })).toMatchObject({ kind: 'a2ui', messages: [], liveAction: true });
});

test('A2UI final preview comparison ignores streaming placeholders but keeps real corrections', () => {
  const create = {
    version: 'v0.9',
    createSurface: { surfaceId: 'main', catalogId: 'catalog' },
  };
  const data = {
    version: 'v0.9',
    updateDataModel: { surfaceId: 'main', value: { private: 'kept' } },
  };
  const update = (components: unknown[]) => ({
    version: 'v0.9',
    updateComponents: { surfaceId: create.createSurface.surfaceId, components },
  });
  const root = { id: 'root', component: 'Column', children: ['title'] };
  const title = { id: 'title', component: 'Text', text: 'Shanghai' };
  const streamed = [
    create,
    update([{ id: 'root', component: 'Loading' }]),
    data,
    update([root, { id: 'title', component: 'Loading' }]),
    update([title]),
  ];
  const final = [create, data, update([root, title])];
  const equal = A2UI_CHAT_ADAPTER.preview.isEquivalent;
  expect(equal(streamed, final)).toBe(true);
  expect(
    equal(streamed, [
      create,
      data,
      update([root, { ...title, text: 'Beijing' }]),
    ]),
  ).toBe(false);
  expect(
    equal(streamed, [create, {
      ...data,
      updateDataModel: { surfaceId: 'main', value: { private: 'changed' } },
    }, update([root, title])]),
  ).toBe(false);
  expect(equal(streamed, [])).toBe(false);
  expect(equal([], final)).toBe(false);
});

test.each([
  A2UI_CHAT_ADAPTER,
  OPENUI_CHAT_ADAPTER,
  LYNX_XML_CHAT_ADAPTER,
  HTML_CHAT_ADAPTER,
  MCP_APPS_CHAT_ADAPTER,
])(
  'restores usage for failed turns without creating an artifact (%s)',
  (adapter) => {
    const generationUsage = {
      model: 'saved-model',
      modelPrices: { input_price: 2, cached_price: 0.5, output_price: 8 },
      usage: { inputTokens: 10, cachedTokens: 0, outputTokens: 2 },
    };
    const hydrated = adapter.hydrate({
      history: [{ role: 'user', content: 'Build a card' }, {
        role: 'assistant',
        content: '',
        generationError: 'Generation failed',
        generationUsage,
      }],
      previewMessages: [],
      previewPayloadUrls: null,
    });
    expect(hydrated.messages.filter(message => message.generationUsage))
      .toEqual([{
        kind: 'status',
        tone: 'error',
        text: 'Generation failed',
        generationUsage,
      }]);
    expect(
      hydrated.output === null
        || (Array.isArray(hydrated.output) && hydrated.output.length === 0),
    ).toBe(true);
  },
);
test.each(['a2ui', 'openui'] as const)(
  '%s Create loads composition models without changing demo prompts',
  async protocol => {
    const adapter = protocol === 'a2ui'
      ? A2UI_CHAT_ADAPTER
      : OPENUI_CHAT_ADAPTER;
    const suggestions = adapter.suggestions;
    const originalWindow = globalThis.window;
    const fetch = rs.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({
        defaultModel: 'Jev',
        models: [{ id: 'Jev', label: 'Jev', composition: true }],
      }),
    }));
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { fetch },
    });
    try {
      const settings = await adapter.settings!.load!(
        createDefaultProviderSettings(),
        {
          origin: 'http://localhost:3000',
          hostname: 'localhost',
          protocol: 'http:',
          search: '',
          baseUrl: 'http://localhost:3000/',
        },
        new AbortController().signal,
      );
      expect(fetch.mock.calls[0]?.[0]).toBe(
        `http://localhost:3060/models?protocol=${protocol}`,
      );
      expect(settings.provider).toBe('Jev');
      expect(adapter.settings!.controls(settings)).toEqual(
        CHAT_PROVIDER_SETTINGS_ADAPTER.controls(settings),
      );
      expect(adapter.suggestions).toBe(suggestions);
      expect(toProviderRequestOptions(settings)).toEqual({ model: 'Jev' });
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }
  },
);

test('offers custom Jev in A2UI and OpenUI and forwards its connection without persisting it', () => {
  const adapter = A2UI_CHAT_ADAPTER.settings;
  let settings = adapter.update(
    createDefaultProviderSettings(),
    'provider',
    CUSTOM_PROVIDER_ID,
  );
  settings = adapter.update(
    settings,
    'baseURL',
    CUSTOM_JEV_PROVIDER_OPTION.value,
  );
  expect(settings).toMatchObject({
    baseURL: CUSTOM_JEV_PROVIDER_OPTION.value,
    model: 'jev-latest',
  });
  expect(adapter.validate(settings)).toContain('API key');
  settings = adapter.update(settings, 'apiKey', '  jev-user-secret  ');
  settings = adapter.update(settings, 'model', '  jev-preview  ');
  settings = adapter.update(settings, 'enableDesignGuidance', 'off');
  expect(adapter.validate(settings)).toBeUndefined();
  expect(adapter.controls(settings).find(control => control.id === 'baseURL'))
    .toMatchObject({
      options: [
        ...CUSTOM_PROVIDER_BASE_URL_OPTIONS,
        CUSTOM_JEV_PROVIDER_OPTION,
      ],
    });
  expect(adapter.controls(settings).find(control => control.id === 'apiKey'))
    .toMatchObject({ kind: 'password' });
  const host = {
    origin: 'http://localhost:3000',
    hostname: 'localhost',
    protocol: 'http:',
    search: '',
    baseUrl: 'http://localhost:3000/',
  };
  const conversation = { history: [], dataModel: {} };
  const connection = {
    apiKey: 'jev-user-secret',
    baseURL: CUSTOM_JEV_PROVIDER_OPTION.value,
    model: 'jev-preview',
    enableDesignGuidance: false,
  };
  expect(toProviderRequestOptions(settings, 'a2ui')).toEqual(connection);
  expect(
    A2UI_CHAT_ADAPTER.createRequest({
      prompt: 'Show a card',
      conversation,
      settings,
      host,
    }).body,
  )
    .toMatchObject(connection);
  expect(
    A2UI_CHAT_ADAPTER.action.request({
      action: { surfaceId: 'main', action: { name: 'open' } },
      conversation,
      settings,
      host,
    }).body,
  )
    .toMatchObject(connection);
  expect(OPENUI_CHAT_ADAPTER.settings.validate(settings)).toBeUndefined();
  expect(
    OPENUI_CHAT_ADAPTER.settings.controls(settings).find(control =>
      control.id === 'baseURL'
    )?.options,
  ).toContainEqual(CUSTOM_JEV_PROVIDER_OPTION);
  expect(
    OPENUI_CHAT_ADAPTER.createRequest({
      prompt: 'Show a card',
      conversation,
      settings,
      host,
    }).body,
  ).toMatchObject(connection);
  expect(
    OPENUI_CHAT_ADAPTER.action.request({
      action: {
        type: 'continue',
        params: {},
        humanFriendlyMessage: 'Continue',
      },
      conversation,
      settings,
      host,
    }).body,
  ).toMatchObject(connection);
  expect(OPENUI_CHAT_ADAPTER.settings.serialize(settings)).toEqual({
    provider: CUSTOM_PROVIDER_ID,
    enableDesignGuidance: false,
  });
  expect(adapter.serialize(settings)).toEqual({
    provider: CUSTOM_PROVIDER_ID,
    enableDesignGuidance: false,
  });
  expect(adapter.conversation.snapshot(settings)).toEqual({
    provider: CUSTOM_PROVIDER_ID,
    enableDesignGuidance: false,
  });
  expect(adapter.parseStored(JSON.stringify(settings))).toMatchObject({
    apiKey: '',
    baseURL: CUSTOM_PROVIDER_BASE_URL,
    model: CUSTOM_PROVIDER_MODEL,
  });
  for (
    const other of [
      HTML_CHAT_ADAPTER,
      MCP_APPS_CHAT_ADAPTER,
      LYNX_XML_CHAT_ADAPTER,
    ]
  ) {
    expect(
      other.settings.controls({
        ...settings,
        baseURL: CUSTOM_PROVIDER_BASE_URL,
      })
        .find(control => control.id === 'baseURL')?.options,
    ).not.toContainEqual(CUSTOM_JEV_PROVIDER_OPTION);
    expect(other.settings.validate(settings)).toContain('only in A2UI');
  }
  expect(() => toProviderRequestOptions(settings)).toThrow('only in A2UI');
  expect(adapter.update(settings, 'baseURL', CUSTOM_PROVIDER_BASE_URL))
    .toMatchObject({
      baseURL: CUSTOM_PROVIDER_BASE_URL,
      model: CUSTOM_PROVIDER_MODEL,
    });
});
