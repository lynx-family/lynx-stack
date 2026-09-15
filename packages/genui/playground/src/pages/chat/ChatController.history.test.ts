// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/** @rstest-environment jsdom */
import { afterEach, beforeEach, expect, rstest, test } from '@rstest/core';
import 'fake-indexeddb/auto';
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
  models: [{ id: 'test-model', label: 'Test model' }],
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

test.each([false, true])(
  'saves the request checkboxes before generation and restores them after reload (failure: %s)',
  async fail => {
    const generated = rstest.fn(async () => {
      const id = await getActiveConversationId('lynx-xml');
      const record = await loadConversation(id!);
      expect(record?.meta.generationSettings).toEqual({
        enableDesignGuidance: false,
        enableHtmlFragment: false,
      });
      return fail
        ? jsonResponse({ error: 'Generation failed' }, 500)
        : jsonResponse({ text: DOCUMENT });
    });
    rstest.stubGlobal('fetch', (url: string, init?: RequestInit) => {
      if (url.endsWith('/models')) {
        return Promise.resolve(jsonResponse(MODELS));
      }
      if (typeof init?.body !== 'string') throw new Error('Expected JSON body');
      const body = JSON.parse(init.body) as Record<string, unknown>;
      expect(body.enableDesignGuidance).toBe(false);
      expect(body.enableHtmlFragment).toBe(false);
      return generated();
    });
    await mountPage();
    await updateUI(() => {
      checkbox('Extra Design Skill').click();
      checkbox('XML fragment').click();
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
    // Simulate unrelated global preferences having changed before reload.
    window.localStorage.setItem(CHAT_PROVIDER_SETTINGS_STORAGE_KEY, '{}');
    await reloadPage();
    expect(checkbox('Extra Design Skill').checked).toBe(false);
    expect(checkbox('XML fragment').checked).toBe(false);
  },
);

test('restores each conversation independently and survives late model loading', async () => {
  const first = await createConversation('First scenario', 'lynx-xml');
  const second = await createConversation('Second scenario', 'lynx-xml');
  await saveConversationMeta({
    ...first,
    generationSettings: {
      enableDesignGuidance: false,
      enableHtmlFragment: true,
    },
  });
  await saveConversationMeta({
    ...second,
    generationSettings: {
      enableDesignGuidance: true,
      enableHtmlFragment: false,
    },
  });
  await setActiveConversationId(first.id, 'lynx-xml');
  let resolveModels!: (response: ReturnType<typeof jsonResponse>) => void;
  const loading = new Promise<ReturnType<typeof jsonResponse>>((resolve) => {
    resolveModels = resolve;
  });
  rstest.stubGlobal('fetch', () => loading);
  await mountPage();
  expect(checkbox('Extra Design Skill').checked).toBe(false);
  expect(checkbox('XML fragment').checked).toBe(true);
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
    expect(checkbox('Extra Design Skill').checked).toBe(true);
    expect(checkbox('XML fragment').checked).toBe(false);
  });
  await React.act(async () => resolveModels(jsonResponse(MODELS)));
  expect(checkbox('Extra Design Skill').checked).toBe(true);
  expect(checkbox('XML fragment').checked).toBe(false);
  const provider = container.querySelector<HTMLSelectElement>(
    '[aria-label="Provider"]',
  )!;
  expect(provider.value).toBe('test-model');
  expect(provider.disabled).toBe(false);
});
