// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/** @rstest-environment jsdom */
import { afterEach, beforeEach, expect, rstest, test } from '@rstest/core';
import 'fake-indexeddb/auto';
import { countTokens } from 'gpt-tokenizer/encoding/o200k_base';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import { ChatController } from './ChatController.js';
import { LYNX_XML_CHAT_ADAPTER } from './lynx-xml.js';
import { CHAT_PROVIDER_SETTINGS_STORAGE_KEY } from './shared.js';
import type { ProviderSettings } from './shared.js';
import {
  createConversation,
  getActiveConversationId,
  loadConversation,
  saveConversationMeta,
  setActiveConversationId,
} from '../../storage/conversationRepo.js';
import { getDB } from '../../storage/db.js';
import { PROTOCOLS } from '../../utils/protocol.js';

rstest.mock('../../components/PreviewViewport.js', () => ({
  PreviewViewport: () => null,
}));
rstest.mock('../../components/PreviewPanel.js', () => ({
  PreviewPanel: () => null,
}));

const DOCUMENT = '<!doctype lynx><lynx engine-version="4.2">'
  + '<script thread="main">const page = __CreatePage("0", 0);</script></lynx>';
const MODELS = {
  defaultModel: 'test-model',
  models: [{
    id: 'test-model',
    label: 'Test model',
    input_price: 2,
    cached_price: 0.5,
    output_price: 8,
  }],
};

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => payload,
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  const db = await getDB();
  for (
    const store of ['conversations', 'messages', 'snapshots', 'meta'] as const
  ) {
    await db.clear(store);
  }
  window.localStorage.clear();
  window.history.replaceState(null, '', '/#/lynx-xml/create');
  rstest.stubGlobal('React', React);
  rstest.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await React.act(async () => root.unmount());
  container.remove();
  rstest.restoreAllMocks();
  rstest.unstubAllGlobals();
  window.localStorage.clear();
});

function checkbox(label: string) {
  const element = [...container.querySelectorAll('label')].find((item) =>
    item.textContent === label
  )?.querySelector('input');
  if (!element) throw new Error(`Missing checkbox: ${label}`);
  return element;
}

function button(label: string) {
  const element = [...container.querySelectorAll('button')].find((item) =>
    item.textContent === label
  );
  if (!element) throw new Error(`Missing button: ${label}`);
  return element;
}

async function updateUI(update: () => void) {
  await React.act(async () => update());
}

async function mountPage() {
  // A fresh settings adapter also resets the controller's page-memory cache,
  // matching a browser reload while keeping the persisted database intact.
  const adapter = {
    ...LYNX_XML_CHAT_ADAPTER,
    settings: { ...LYNX_XML_CHAT_ADAPTER.settings },
  };
  await updateUI(() => {
    root.render(React.createElement(
      ChatController<
        Parameters<typeof adapter.persist>[0],
        ReturnType<typeof adapter.stream.initial>,
        ProviderSettings,
        (typeof adapter.examples.items)[number]
      >,
      { adapter, protocol: PROTOCOLS['lynx-xml'], theme: 'light' },
    ));
  });
  await rstest.waitFor(async () => {
    await React.act(async () => {
      await getActiveConversationId('lynx-xml');
    });
    expect(button('New Chat').disabled).toBe(false);
  });
}

async function reloadPage() {
  await React.act(async () => root.unmount());
  root = createRoot(container);
  await mountPage();
}

test('counts the selected Lynx XML artifact view in tokens and restores it from history', async () => {
  const original = '<template>\n  <text>杭州天气 ☀️</text>\n</template>';
  rstest.stubGlobal('fetch', (url: string) =>
    Promise.resolve(jsonResponse(
      url.endsWith('/models') ? MODELS : {
        text: DOCUMENT,
        metadata: { modelOutput: original, xmlFragment: original },
      },
    )));
  await mountPage();
  await updateUI(() => {
    const textarea = container.querySelector('textarea')!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!
      .set!.call(textarea, 'Build a weather card');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await React.act(async () => button('Send').click());
  const verifyCount = async (source: string) => {
    await rstest.waitFor(() => {
      expect(container.querySelector('.chatArtifactMeta')?.textContent).toBe(
        `.lynxml · ${countTokens(source).toLocaleString('en-US')} tokens`,
      );
    });
    expect(container.querySelector('.chatMessages')?.textContent).not.toMatch(
      /\bchars\b/,
    );
  };
  await verifyCount(original);
  await updateUI(() => button('Transformed').click());
  await verifyCount(DOCUMENT);
  await reloadPage();
  await verifyCount(original);
});

test('shows the failure and waits for an explicit retry, including after reload', async () => {
  const requests: Record<string, unknown>[] = [];
  rstest.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    if (url.endsWith('/models')) return Promise.resolve(jsonResponse(MODELS));
    const request = JSON.parse(init!.body as string) as Record<string, unknown>;
    requests.push(request);
    return Promise.resolve(
      requests.length === 1
        ? jsonResponse({
          error: 'Model output budget exhausted',
          reasoning: {
            text: 'Returned reasoning <script>text</script>',
            truncated: false,
          },
          tokenUsage: { outputTokens: 16384, reasoningTokens: 16384 },
        }, 500)
        : jsonResponse({
          text: DOCUMENT,
          tokenUsage: { outputTokens: 50, reasoningTokens: 0 },
        }),
    );
  });
  await mountPage();
  await updateUI(() => {
    const textarea = container.querySelector('textarea')!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!
      .set!.call(textarea, 'Build a counter');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await React.act(async () => button('Send').click());
  await rstest.waitFor(() => expect(button('Retry').disabled).toBe(false));
  expect(container.textContent).toContain('Model output budget exhausted');
  expect(container.textContent).toContain('Retry this request?');
  expect(requests).toHaveLength(1);
  const reasoning = container.querySelector<HTMLDetailsElement>(
    '.chatAgentReasoning',
  )!;
  expect(reasoning.open).toBe(false);
  expect(reasoning.querySelector('pre')?.textContent).toBe(
    'Returned reasoning <script>text</script>',
  );
  expect(reasoning.querySelector('script')).toBeNull();
  const beforeReload = await loadConversation(
    (await getActiveConversationId('lynx-xml'))!,
  );
  expect(JSON.stringify(beforeReload)).not.toContain('Returned reasoning');
  await reloadPage();
  expect(container.querySelector('.chatAgentReasoning')).toBeNull();
  expect(requests).toHaveLength(1);
  expect(button('Retry').disabled).toBe(false);
  await updateUI(() => {
    button('Retry').click();
    button('Retry').click();
  });
  await rstest.waitFor(() => expect(button('New Chat').disabled).toBe(false));
  expect(requests).toHaveLength(2);
  for (const request of requests) {
    expect(request).toMatchObject({
      messages: [{ role: 'user', content: 'Build a counter' }],
    });
    expect(JSON.stringify(request.conversation)).not.toContain(
      'Build a counter',
    );
  }
  expect(container.querySelector('.chatRetryPrompt')).toBeNull();
  const saved = await loadConversation(
    (await getActiveConversationId('lynx-xml'))!,
  );
  const responses = saved!.messages.filter(message =>
    message.role === 'assistant'
  );
  expect(responses).toHaveLength(2);
  expect(responses[0]?.generationError).toBe('Model output budget exhausted');
  expect(responses[0]?.generationUsage?.usage.reasoningTokens).toBe(16384);
  expect(responses[1]?.generationError).toBeUndefined();
});

test.each([false, true])(
  'saves the request checkboxes before generation and restores them after reload (failure: %s)',
  async fail => {
    const generated = rstest.fn(async () => {
      const id = await getActiveConversationId('lynx-xml');
      const record = await loadConversation(id!);
      expect(record?.meta.generationSettings).toEqual({
        provider: 'test-model',
        enableDesignGuidance: false,
        enableHtmlFragment: false,
        enableScriptReuse: false,
        stylePreset: 'default',
      });
      const payload = {
        tokenUsage: {
          inputTokens: 10000,
          cachedTokens: 6000,
          outputTokens: 2000,
          totalTokens: 12000,
          reasoningTokens: 1500,
        },
        usage: { inputTokens: 1, cachedTokens: 0, outputTokens: 1 },
        metadata: {
          generationAttempts: [
            {
              mode: 'initial',
              outputChars: 0,
              finishReason: 'length',
              usage: {
                inputTokens: 5000,
                outputTokens: 1500,
                reasoningTokens: 1500,
              },
            },
            {
              mode: 'regenerate',
              outputChars: DOCUMENT.length,
              finishReason: 'stop',
              usage: {
                inputTokens: 5000,
                outputTokens: 500,
                reasoningTokens: 0,
              },
            },
          ],
        },
      };
      return fail
        ? jsonResponse({ ...payload, error: 'Generation failed' }, 500)
        : jsonResponse({ ...payload, text: DOCUMENT });
    });
    rstest.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      if (url.endsWith('/models')) {
        return Promise.resolve(jsonResponse(MODELS));
      }
      if (typeof init?.body !== 'string') throw new Error('Expected JSON body');
      const body = JSON.parse(init.body) as Record<string, unknown>;
      expect(body.enableDesignGuidance).toBe(false);
      expect(body.enableHtmlFragment).toBe(false);
      expect(body.enableScriptReuse).toBe(false);
      expect(body.stylePreset).toBe('default');
      return generated();
    });
    await mountPage();
    await updateUI(() => {
      checkbox('Design').click();
      checkbox('Template').click();
      checkbox('ScriptReuse').click();
    });
    await updateUI(() => {
      const textarea = container.querySelector('textarea')!;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!
        .set!.call(textarea, 'Build a weather dashboard');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await React.act(async () => button('Send').click());
    await rstest.waitFor(async () => {
      await React.act(async () => {
        await getActiveConversationId('lynx-xml');
      });
      expect(generated).toHaveBeenCalledTimes(1);
      expect(button('New Chat').disabled).toBe(false);
    });
    expect(
      container.querySelector('[aria-label="Generation usage"]')?.textContent,
    ).toContain('Total 12.0k');
    expect(container.textContent).toContain('Est. cost ¥27.0000');
    const verifyUsage = () => {
      expect(container.querySelector('.chatTokenUsageBadge')?.textContent)
        .toContain('Reasoning 1.50k');
      expect(container.querySelector('.chatTokenUsageBadge')?.textContent)
        .not.toContain('Attempts');
      expect(container.querySelector('.chatGenerationAttempts')).toBeNull();
    };
    verifyUsage();
    expect(container.querySelector('.chatTokenUsageModel')?.textContent)
      .toBe('Model test-model');
    expect(
      container.querySelector('.chatTokenUsageTotal[title]')?.getAttribute(
        'title',
      ),
    ).toContain('input ¥2, cached ¥0.5, output ¥8 per 1K tokens');
    const savedId = await getActiveConversationId('lynx-xml');
    const saved = await loadConversation(savedId!);
    expect(
      saved?.messages.find(message => message.role === 'assistant')
        ?.generationUsage,
    ).toMatchObject({
      model: 'test-model',
      modelPrices: { input_price: 2, cached_price: 0.5, output_price: 8 },
      usage: {
        inputTokens: 10000,
        cachedTokens: 6000,
        outputTokens: 2000,
        reasoningTokens: 1500,
      },
      generationAttempts: [
        { mode: 'initial', outputChars: 0, usage: { reasoningTokens: 1500 } },
        { mode: 'regenerate', usage: { reasoningTokens: 0 } },
      ],
    });
    // Simulate unrelated global preferences having changed before reload.
    window.localStorage.setItem(CHAT_PROVIDER_SETTINGS_STORAGE_KEY, '{}');
    rstest.stubGlobal('fetch', () =>
      Promise.resolve(jsonResponse({
        ...MODELS,
        models: [{ ...MODELS.models[0], input_price: 200, output_price: 800 }],
      })));
    await reloadPage();
    expect(container.textContent).toContain('Est. cost ¥27.0000');
    verifyUsage();
    expect(checkbox('Design').checked).toBe(false);
    expect(checkbox('Template').checked).toBe(false);
    expect(checkbox('StylePreset').checked).toBe(true);
    expect(checkbox('ScriptReuse').checked).toBe(false);
    for (const label of ['Design', 'Template', 'StylePreset', 'ScriptReuse']) {
      expect(checkbox(label).disabled).toBe(true);
    }
    await updateUI(() => {
      for (
        const label of ['Design', 'Template', 'StylePreset', 'ScriptReuse']
      ) {
        checkbox(label).click();
      }
    });
    expect(checkbox('Design').checked).toBe(false);
    expect(checkbox('Template').checked).toBe(false);
    expect(checkbox('StylePreset').checked).toBe(true);
    const unchanged = await loadConversation(savedId!);
    expect(unchanged?.meta.generationSettings).toEqual(
      saved?.meta.generationSettings,
    );
    await updateUI(() => button('New Chat').click());
    await rstest.waitFor(async () => {
      await React.act(async () => {
        expect(await getActiveConversationId('lynx-xml')).not.toBe(savedId);
      });
      for (const label of ['Design', 'Template', 'StylePreset']) {
        expect(checkbox(label).checked).toBe(true);
        expect(checkbox(label).disabled).toBe(false);
      }
      expect(checkbox('ScriptReuse').checked).toBe(true);
      expect(checkbox('ScriptReuse').disabled).toBe(false);
    });
    await updateUI(() => {
      const item = [
        ...container.querySelectorAll<HTMLButtonElement>(
          '.conversationListItemMain',
        ),
      ]
        .find(node => node.textContent?.includes('Build a weather dashboard'))!;
      item.click();
    });
    await rstest.waitFor(async () => {
      await React.act(async () => {
        expect(await getActiveConversationId('lynx-xml')).toBe(savedId);
      });
      expect(checkbox('Design').checked).toBe(false);
      expect(checkbox('Template').checked).toBe(false);
      expect(checkbox('StylePreset').checked).toBe(true);
      expect(checkbox('ScriptReuse').checked).toBe(false);
      for (
        const label of ['Design', 'Template', 'StylePreset', 'ScriptReuse']
      ) {
        expect(checkbox(label).disabled).toBe(true);
      }
    });
  },
);

test('restores each conversation independently and survives late model loading', async () => {
  const first = await createConversation('First scenario', 'lynx-xml');
  const second = await createConversation('Second scenario', 'lynx-xml');
  await saveConversationMeta({
    ...first,
    generationSettings: {
      provider: 'test-model',
      enableDesignGuidance: false,
      enableHtmlFragment: true,
      stylePreset: false,
    },
  });
  await saveConversationMeta({
    ...second,
    generationSettings: {
      provider: 'other-model',
      enableDesignGuidance: true,
      enableHtmlFragment: false,
      stylePreset: 'default',
    },
  });
  await setActiveConversationId(first.id, 'lynx-xml');
  let resolveModels!: (response: ReturnType<typeof jsonResponse>) => void;
  const loading = new Promise<ReturnType<typeof jsonResponse>>((resolve) => {
    resolveModels = resolve;
  });
  rstest.stubGlobal('fetch', () => loading);
  await mountPage();
  expect(checkbox('Design').checked).toBe(false);
  expect(checkbox('Template').checked).toBe(true);
  expect(checkbox('StylePreset').checked).toBe(false);
  await updateUI(() => {
    const item = [...container.querySelectorAll<HTMLButtonElement>(
      '.conversationListItemMain',
    )].find((node) => node.textContent?.includes('Second scenario'))!;
    item.click();
  });
  await rstest.waitFor(async () => {
    await React.act(async () => {
      await getActiveConversationId('lynx-xml');
    });
    expect(checkbox('Design').checked).toBe(true);
    expect(checkbox('Template').checked).toBe(false);
    expect(checkbox('StylePreset').checked).toBe(true);
  });
  await React.act(async () =>
    resolveModels(jsonResponse({
      ...MODELS,
      models: [...MODELS.models, { id: 'other-model', label: 'Other model' }],
    }))
  );
  expect(checkbox('Design').checked).toBe(true);
  expect(checkbox('Template').checked).toBe(false);
  expect(checkbox('StylePreset').checked).toBe(true);
  const provider = container.querySelector<HTMLSelectElement>(
    '[aria-label="Provider"]',
  )!;
  expect(provider.value).toBe('other-model');
  expect(provider.disabled).toBe(false);
  await updateUI(() => {
    const item = [...container.querySelectorAll<HTMLButtonElement>(
      '.conversationListItemMain',
    )].find(node => node.textContent?.includes('First scenario'))!;
    item.click();
  });
  await rstest.waitFor(() => expect(provider.value).toBe('test-model'));
  expect(checkbox('StylePreset').checked).toBe(false);
});

test('saves checkbox edits before sending, reloads them, and defaults new records on', async () => {
  rstest.stubGlobal('fetch', () => Promise.resolve(jsonResponse(MODELS)));
  await mountPage();
  const labels = ['Design', 'Template', 'StylePreset', 'ScriptReuse'];
  for (const label of labels) expect(checkbox(label).checked).toBe(true);
  await updateUI(() => {
    for (const label of labels) checkbox(label).click();
  });
  const id = await getActiveConversationId('lynx-xml');
  await rstest.waitFor(async () => {
    const saved = await loadConversation(id!);
    expect(saved?.messages).toHaveLength(0);
    expect(saved?.meta.generationSettings).toEqual({
      provider: 'test-model',
      enableDesignGuidance: false,
      enableHtmlFragment: false,
      enableScriptReuse: false,
      stylePreset: false,
    });
  });
  await reloadPage();
  for (const label of labels) {
    expect(checkbox(label).checked).toBe(false);
    expect(checkbox(label).disabled).toBe(false);
  }
  await updateUI(() => button('New Chat').click());
  await rstest.waitFor(async () => {
    await React.act(async () => {
      expect(await getActiveConversationId('lynx-xml')).not.toBe(id);
    });
    for (const label of labels) expect(checkbox(label).checked).toBe(true);
  });
  const previous = await loadConversation(id!);
  expect(previous?.meta.generationSettings).toMatchObject({
    enableDesignGuidance: false,
    enableHtmlFragment: false,
    stylePreset: false,
  });
});

test('keeps each turn badge in the chat transcript with its original model price after reload', async () => {
  const models = {
    ...MODELS,
    models: [...MODELS.models, {
      id: 'other-model',
      label: 'Other model',
      input_price: 4,
      cached_price: 1,
      output_price: 16,
    }],
  };
  let calls = 0;
  rstest.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    if (url.endsWith('/models')) return Promise.resolve(jsonResponse(models));
    calls++;
    const body = JSON.parse(init!.body as string) as { model: string };
    expect(body.model).toBe(calls === 1 ? 'test-model' : 'other-model');
    return Promise.resolve(
      jsonResponse({
        text: DOCUMENT,
        tokenUsage: {
          inputTokens: 10000,
          cachedTokens: 6000,
          outputTokens: 2000,
          totalTokens: 12000,
        },
      }),
    );
  });
  await mountPage();
  for (const prompt of ['First request', 'Second request']) {
    await updateUI(() => {
      if (calls === 1) {
        const provider = container.querySelector<HTMLSelectElement>(
          '[aria-label="Provider"]',
        )!;
        provider.value = 'other-model';
        provider.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const input = container.querySelector('textarea')!;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!
        .set!.call(input, prompt);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await React.act(async () => button('Send').click());
    await rstest.waitFor(async () => {
      await React.act(async () => {
        await getActiveConversationId('lynx-xml');
      });
      expect(button('New Chat').disabled).toBe(false);
    });
  }
  const verify = () => {
    const badges = [
      ...container.querySelectorAll('.chatMessage .chatTokenUsageBadge'),
    ];
    expect(badges).toHaveLength(2);
    expect(badges[0]?.textContent).toContain('¥27.0000');
    expect(badges[1]?.textContent).toContain('¥54.0000');
    for (const badge of badges) {
      expect(badge.textContent).toContain('Reasoning Not recorded');
      expect(badge.textContent).not.toContain('Attempts');
      expect(badge.querySelector('.chatGenerationAttempts')).toBeNull();
    }
    expect(badges[0]?.querySelector('.chatTokenUsageModel')?.textContent)
      .toBe('Model test-model');
    expect(badges[1]?.querySelector('.chatTokenUsageModel')?.textContent)
      .toBe('Model other-model');
    expect(container.querySelector('.chatHeader .chatTokenUsageBadge'))
      .toBeNull();
  };
  verify();
  window.localStorage.setItem(
    CHAT_PROVIDER_SETTINGS_STORAGE_KEY,
    JSON.stringify({ provider: 'test-model' }),
  );
  await reloadPage();
  verify();
  expect(
    container.querySelector<HTMLSelectElement>('[aria-label="Provider"]')
      ?.value,
  ).toBe('other-model');
  const id = await getActiveConversationId('lynx-xml');
  const saved = await loadConversation(id!);
  expect(saved?.meta.generationSettings?.provider).toBe('other-model');
  expect(
    saved?.messages.filter(message => message.role === 'assistant').map(
      message => message.generationUsage?.model,
    ),
  ).toEqual(['test-model', 'other-model']);
  await React.act(async () => button('New Chat').click());
  await rstest.waitFor(() =>
    expect(container.querySelector('.chatTokenUsageBadge')).toBeNull()
  );
  const retained = await loadConversation(id!);
  expect(retained?.messages).toHaveLength(4);
});
