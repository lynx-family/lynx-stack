// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/** @rstest-environment jsdom */

import { expect, rstest, test } from '@rstest/core';
import { act, createElement, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';

import { executeOpenUIDataTool, openUIStorageKey } from './dataHost.js';
import { createOpenUILocalDataView } from './localDataView.js';
import { OPENUI_CHAT_ADAPTER } from '../pages/chat/openui.js';
import type { ChatArtifactView } from '../pages/chat/type.js';

function storageEvent(key: string | null, storageArea = window.localStorage) {
  window.dispatchEvent(new StorageEvent('storage', { key, storageArea }));
}

function View({ view }: { view: ChatArtifactView }) {
  const text = useSyncExternalStore(
    view.liveText!.subscribe,
    view.liveText!.getSnapshot,
  );
  return createElement('pre', null, text);
}

test('shows initial Query data separately from reactive persisted Local data', async () => {
  rstest.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  window.localStorage.clear();
  const defaults = { counter: 0, enabled: false, value: null };
  const output = {
    rawText:
      'counter = Query("openui_query", { key: "counter" }, 0)\nenabled = Query("openui_query", { key: "enabled" }, false)\nvalue = Query("openui_query", { key: "value" }, null)\nroot = Text("Counter")',
    scenarioTitle: 'Counter',
  };
  const artifact = OPENUI_CHAT_ADAPTER.preview.artifact(output);
  const query = artifact.views.find(view => view.id === 'data')!;
  const local = artifact.views.find(view => view.id === 'local-data')!;
  const persisted = OPENUI_CHAT_ADAPTER.persist(output);
  const container = document.createElement('div');
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(View, { view: local })));
    expect(JSON.parse(container.textContent!)).toEqual(
      defaults,
    );
    expect(window.localStorage.length).toBe(0);
    act(() => {
      expect(executeOpenUIDataTool(
        {
          ...output,
          operation: 'mutation',
          args: {
            key: 'counter',
            value: 1,
          },
        },
        window.localStorage,
        defaults,
      )).toEqual({ ok: true, value: { ok: true } });
      // Browsers deliver this from the preview iframe to the inspector window.
      storageEvent(openUIStorageKey(output.rawText));
    });
    expect(JSON.parse(container.textContent!)).toEqual({
      ...defaults,
      counter: 1,
    });
    expect(JSON.parse(query.text)).toEqual(defaults);
    expect(local.text).toBe(container.textContent);
    expect(OPENUI_CHAT_ADAPTER.persist(output)).toEqual(persisted);
    const reopened = createOpenUILocalDataView(
      output.rawText,
      defaults,
    );
    expect(reopened.liveText!.getSnapshot()).toBe(container.textContent);
    await act(async () =>
      root.render(createElement(View, {
        view: createOpenUILocalDataView('another page', { counter: 42 }),
      }))
    );
    expect(JSON.parse(container.textContent!)).toEqual({ counter: 42 });
    await act(async () => root.render(createElement(View, { view: local })));
    act(() => {
      window.localStorage.clear();
      storageEvent(null);
    });
    expect(JSON.parse(container.textContent!)).toEqual(
      defaults,
    );
  } finally {
    await act(async () => root.unmount());
    window.localStorage.clear();
    rstest.unstubAllGlobals();
  }
});

test('filters unrelated storage changes and unsubscribes', () => {
  const view = createOpenUILocalDataView('page', {});
  const listener = rstest.fn();
  const unsubscribe = view.liveText!.subscribe(listener);
  storageEvent(openUIStorageKey('other page'));
  storageEvent(openUIStorageKey('page'), window.sessionStorage);
  expect(listener).not.toHaveBeenCalled();
  storageEvent(openUIStorageKey('page'));
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
  storageEvent(null);
  expect(listener).toHaveBeenCalledTimes(1);
});

test('surfaces corrupt or mismatched storage without overwriting it', () => {
  const key = openUIStorageKey('page');
  const view = createOpenUILocalDataView('page', {});
  try {
    for (
      const saved of [
        'invalid JSON',
        JSON.stringify({ source: 'other', data: {} }),
      ]
    ) {
      window.localStorage.setItem(key, saved);
      expect(JSON.parse(view.liveText!.getSnapshot())).toHaveProperty('error');
      expect(view.text).toBe(view.liveText!.getSnapshot());
      expect(window.localStorage.getItem(key)).toBe(saved);
    }
  } finally {
    window.localStorage.removeItem(key);
  }
});

test('keeps both data tabs available for outputs without prefetched data', () => {
  const artifact = OPENUI_CHAT_ADAPTER.preview.artifact({
    rawText: 'root = Text("Empty")',
    scenarioTitle: '',
  });
  expect(artifact.views.map(view => view.label)).toEqual([
    'Raw',
    'JSON',
    'Query data',
    'Local data',
  ]);
  expect(artifact.views.find(view => view.id === 'data')!.text).toBe('{}');
});
