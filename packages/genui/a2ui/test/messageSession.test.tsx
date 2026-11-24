// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rstest, test } from '@rstest/core';

import { useEffect, useState } from '@lynx-js/react';
import { act, render, waitFor } from '@lynx-js/react/testing-library';

import type { CatalogComponent } from '../src/catalog/defineCatalog.js';
import { Text } from '../src/catalog/Text/index.jsx';
import { A2UI } from '../src/react/A2UI.jsx';
import { createMessageStore } from '../src/store/MessageStore.js';
import type {
  GenericComponentProps,
  RendererToAgentMessage,
  ServerToClientMessage,
} from '../src/store/types.js';

const catalogId = 'test';
const catalogs = [Text as CatalogComponent];
function snapshot(text: string, surfaceId = 's'): ServerToClientMessage[] {
  return [{
    version: '1.0',
    createSurface: {
      surfaceId,
      catalogId,
      components: [{ id: 'root', component: 'Text', text }],
    },
  }];
}
function update(text: string): ServerToClientMessage {
  return {
    version: '1.0',
    updateComponents: {
      surfaceId: 's',
      components: [{ id: 'root', component: 'Text', text }],
    },
  };
}

function probe(label: string): ServerToClientMessage[] {
  return [{
    version: '1.0',
    createSurface: {
      surfaceId: 's',
      catalogId,
      components: [{ id: 'root', component: 'Probe', label }],
    },
  }];
}

describe('A2UI message consumption', () => {
  test('does not re-evaluate a rejected replacement while its tail streams', async () => {
    const store = createMessageStore({ initialMessages: snapshot('Original') });
    const onMessage = rstest.fn();
    const warning = rstest.spyOn(console, 'warn').mockImplementation(() =>
      undefined
    );
    try {
      const view = render(
        <A2UI
          messageStore={store}
          catalogs={catalogs}
          catalogId={catalogId}
          onMessage={onMessage}
        />,
      );
      await waitFor(() => expect(view.getByText('Original')).toBeTruthy());
      await act(() =>
        store.replace([...snapshot('History'), ...snapshot('Duplicate')])
      );
      for (let i = 0; i < 50; i++) {
        await act(() => store.push(update(`token ${i}`)));
      }
      expect(onMessage).toHaveBeenCalledTimes(1);
      expect(warning).toHaveBeenCalledTimes(1);
      expect(view.getByText('Original')).toBeTruthy();
    } finally {
      warning.mockRestore();
    }
  });

  test('applies messages a host pushes from inside onMessage', async () => {
    const store = createMessageStore({ initialMessages: snapshot('Original') });
    const onMessage = rstest.fn((message: RendererToAgentMessage) => {
      // A host that answers a protocol error by correcting the stream.
      if ('error' in message) store.push(update('Corrected'));
    });
    const view = render(
      <A2UI
        messageStore={store}
        catalogs={catalogs}
        catalogId={catalogId}
        onMessage={onMessage}
      />,
    );
    await waitFor(() => expect(view.getByText('Original')).toBeTruthy());
    await act(() => store.push(snapshot('Duplicate create')));
    await waitFor(() => expect(view.getByText('Corrected')).toBeTruthy());
    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  test('skips a malformed message without losing the ones after it', async () => {
    const store = createMessageStore({ initialMessages: snapshot('Original') });
    const onMessage = rstest.fn();
    const view = render(
      <A2UI
        messageStore={store}
        catalogs={catalogs}
        catalogId={catalogId}
        onMessage={onMessage}
      />,
    );
    await waitFor(() => expect(view.getByText('Original')).toBeTruthy());
    await act(() =>
      store.push([
        { version: '1.0', updateComponents: { surfaceId: 's' } },
        { version: '1.0', updateDataModel: null },
        update('After malformed'),
      ] as unknown as ServerToClientMessage[])
    );
    await waitFor(() => expect(view.getByText('After malformed')).toBeTruthy());
    expect(onMessage.mock.calls.map((call): unknown => call[0])).toEqual([{
      version: '1.0',
      error: {
        code: 'VALIDATION_FAILED',
        surfaceId: 's',
        path: '/updateComponents/components',
        message: 'Malformed message',
      },
    }]);
  });

  test('does not re-render the host shell for pushes that keep the surface', async () => {
    const store = createMessageStore({ initialMessages: snapshot('Original') });
    const wraps = rstest.fn((children: unknown) => children);
    const view = render(
      <A2UI
        messageStore={store}
        catalogs={catalogs}
        catalogId={catalogId}
        wrapSurface={wraps as never}
      />,
    );
    await waitFor(() => expect(view.getByText('Original')).toBeTruthy());
    wraps.mockClear();
    for (let i = 0; i < 20; i++) {
      await act(() => store.push(update(`token ${i}`)));
    }
    await waitFor(() => expect(view.getByText('token 19')).toBeTruthy());
    expect(wraps).not.toHaveBeenCalled();
  });

  test('reconciles to a different store without remounting unchanged components', async () => {
    const lifecycle: string[] = [];
    function Probe(props: GenericComponentProps & { label: string }) {
      const [initial] = useState(props.label);
      useEffect(() => {
        lifecycle.push(`mount:${initial}`);
        return () => {
          lifecycle.push(`unmount:${initial}`);
        };
      }, []);
      return <text>{props.label}</text>;
    }
    const first = createMessageStore({ initialMessages: probe('First') });
    const second = createMessageStore({
      initialMessages: [...probe('Second'), {
        version: '1.0',
        updateComponents: {
          surfaceId: 's',
          components: [{
            id: 'root',
            component: 'Probe',
            label: 'Second tail',
          }],
        },
      }],
    });
    const element = (store: typeof first) => (
      <A2UI
        messageStore={store}
        catalogs={[Probe as CatalogComponent]}
        catalogId={catalogId}
      />
    );
    const view = render(element(first));
    await waitFor(() => expect(view.getByText('First')).toBeTruthy());
    view.rerender(element(second));
    await waitFor(() => expect(view.getByText('Second tail')).toBeTruthy());
    expect(lifecycle).toEqual(['mount:First']);
    await act(() => first.push(probe('Stale store')));
    expect(view.getByText('Second tail')).toBeTruthy();
    await act(() =>
      second.push({
        version: '1.0',
        updateComponents: {
          surfaceId: 's',
          components: [{ id: 'root', component: 'Probe', label: 'Live' }],
        },
      })
    );
    await waitFor(() => expect(view.getByText('Live')).toBeTruthy());
  });

  test('two renderers follow one store independently', async () => {
    const store = createMessageStore({ initialMessages: snapshot('Shared') });
    const view = render(
      <view>
        <A2UI messageStore={store} catalogs={catalogs} catalogId={catalogId} />
        <A2UI messageStore={store} catalogs={catalogs} catalogId={catalogId} />
      </view>,
    );
    await waitFor(() => expect(view.getAllByText('Shared')).toHaveLength(2));
    await act(() => {
      store.replace(snapshot('Replaced'));
      store.push(update('Tail'));
    });
    await waitFor(() => expect(view.getAllByText('Tail')).toHaveLength(2));
  });
});
