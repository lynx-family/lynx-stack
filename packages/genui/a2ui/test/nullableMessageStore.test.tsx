// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rstest, test } from '@rstest/core';

import { act, render, waitFor } from '@lynx-js/react/testing-library';

import type { CatalogComponent } from '../src/catalog/defineCatalog.js';
import { Text } from '../src/catalog/Text/index.jsx';
import { A2UI } from '../src/react/A2UI.jsx';
import { createMessageStore } from '../src/store/MessageStore.js';
import type { MessageStore } from '../src/store/MessageStore.js';
import type { ServerToClientMessage } from '../src/store/types.js';

const catalogs = [Text as CatalogComponent];
const renderEmpty = () => <text>Waiting for messages</text>;
const message = (text: string): ServerToClientMessage => ({
  version: '1.0',
  createSurface: {
    surfaceId: 'test',
    catalogId: 'https://unpkg.com/@lynx-js/genui/a2ui/dist/catalog.json',
    components: [{ id: 'root', component: 'Text', text }],
  },
});

function element(messageStore: MessageStore | null) {
  return (
    <A2UI
      messageStore={messageStore}
      catalogs={catalogs}
      renderEmpty={renderEmpty}
    />
  );
}

describe('A2UI nullable messageStore', () => {
  test('renders nothing for null without renderEmpty', () => {
    const view = render(<A2UI messageStore={null} catalogs={catalogs} />);
    expect(view.container.textContent).toBe('');
  });

  test('does not call renderEmpty for null', () => {
    const empty = rstest.fn(renderEmpty);
    const view = render(
      <A2UI messageStore={null} catalogs={catalogs} renderEmpty={empty} />,
    );
    expect(empty).not.toHaveBeenCalled();
    expect(view.container.textContent).toBe('');
  });

  test('renders a populated store after initially rendering nothing', async () => {
    const view = render(element(null));
    expect(view.container.textContent).toBe('');
    const store = createMessageStore({
      initialMessages: [message('First response')],
    });
    view.rerender(element(store));
    await waitFor(() => expect(view.getByText('First response')).toBeTruthy());
    expect(view.queryByText('Waiting for messages')).toBeNull();
    await act(() =>
      store.push({
        version: '1.0',
        updateComponents: {
          surfaceId: 'test',
          components: [{
            id: 'root',
            component: 'Text',
            text: 'Updated response',
          }],
        },
      })
    );
    await waitFor(() =>
      expect(view.getByText('Updated response')).toBeTruthy()
    );
  });

  test('subscribes to an initially empty store supplied after null', async () => {
    const view = render(element(null));
    const store = createMessageStore();
    view.rerender(element(store));
    expect(view.getByText('Waiting for messages')).toBeTruthy();
    await act(() => store.push(message('Streamed response')));
    await waitFor(() =>
      expect(view.getByText('Streamed response')).toBeTruthy()
    );
  });

  test.each(['same', 'different'])(
    'unsubscribes on null and starts a fresh session with the %s store',
    async (mode) => {
      const original = createMessageStore({
        initialMessages: [message('Original')],
      });
      const unsubscribe = rstest.fn();
      const store: MessageStore = {
        ...original,
        subscribe(callback) {
          const off = original.subscribe(callback);
          return () => {
            unsubscribe();
            off();
          };
        },
      };
      const view = render(element(store));
      await waitFor(() => expect(view.getByText('Original')).toBeTruthy());
      view.rerender(element(null));
      await waitFor(() => expect(unsubscribe).toHaveBeenCalled());
      expect(view.queryByText('Original')).toBeNull();
      expect(view.container.textContent).toBe('');
      await act(() =>
        store.push({ version: '1.0', deleteSurface: { surfaceId: 'test' } })
      );
      expect(view.container.textContent).toBe('');
      const next = mode === 'same'
        ? store
        : createMessageStore();
      next.push(message('New session'));
      view.rerender(element(next));
      await waitFor(() => expect(view.getByText('New session')).toBeTruthy());
      expect(view.queryByText('Original')).toBeNull();
    },
  );
});
