// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rstest, test } from '@rstest/core';

import { act, render, waitFor } from '@lynx-js/react/testing-library';

import { Button } from '../src/catalog/Button/index.jsx';
import { Card } from '../src/catalog/Card/index.jsx';
import { Column } from '../src/catalog/Column/index.jsx';
import { defineFunction } from '../src/catalog/defineCatalog.js';
import type {
  CatalogComponent,
  CatalogInput,
} from '../src/catalog/defineCatalog.js';
import { Text } from '../src/catalog/Text/index.jsx';
import { A2UI } from '../src/react/A2UI.jsx';
import { createMessageStore } from '../src/store/MessageStore.js';
import type {
  ComponentInstance,
  GenericComponentProps,
  ServerToClientMessage,
} from '../src/store/types.js';

const catalogId = 'test';
const renders = rstest.fn();
function Probe(props: GenericComponentProps & { text: unknown }) {
  renders(props.id);
  return <text>{String(props.text)}</text>;
}
const catalogs: CatalogInput[] = [
  Text as CatalogComponent,
  Column as CatalogComponent,
  Card as CatalogComponent,
  Button as CatalogComponent,
  Probe as CatalogComponent,
];

function create(
  components?: ComponentInstance[],
  dataModel?: Record<string, unknown>,
): ServerToClientMessage {
  return {
    version: '1.0',
    createSurface: {
      surfaceId: 's',
      catalogId,
      ...(components ? { components } : {}),
      ...(dataModel ? { dataModel } : {}),
    },
  };
}
function components(...items: ComponentInstance[]): ServerToClientMessage {
  return {
    version: '1.0',
    updateComponents: { surfaceId: 's', components: items },
  };
}
function data(path: string, value: unknown): ServerToClientMessage {
  return { version: '1.0', updateDataModel: { surfaceId: 's', path, value } };
}
function mount(
  initialMessages: ServerToClientMessage[],
  extra: CatalogInput[] = [],
  onMessage?: (message: unknown) => void,
) {
  const store = createMessageStore({ initialMessages });
  const view = render(
    <A2UI
      messageStore={store}
      catalogs={[...catalogs, ...extra]}
      catalogId={catalogId}
      {...(onMessage ? { onMessage } : {})}
    />,
  );
  return { store, view };
}
const rendersOf = (id: string) =>
  renders.mock.calls.filter(call => call[0] === id).length;

describe('A2UI progressive rendering', () => {
  test('renders children that arrive in later messages', async () => {
    const { store, view } = mount([
      create([{ id: 'root', component: 'Column', children: ['card'] }]),
    ]);
    await act(() =>
      store.push(components({ id: 'card', component: 'Card', child: 'label' }))
    );
    await waitFor(() =>
      expect(view.container.querySelector('.card')).toBeTruthy()
    );
    expect(view.queryByText('Late child')).toBeNull();
    await act(() =>
      store.push(components({
        id: 'label',
        component: 'Text',
        text: 'Late child',
      }))
    );
    await waitFor(() => expect(view.getByText('Late child')).toBeTruthy());
  });

  test('replaces a button fallback once its label arrives', async () => {
    const { store, view } = mount([
      create([{
        id: 'root',
        component: 'Button',
        child: 'label',
        action: { event: { name: 'tap' } },
      }]),
    ]);
    await waitFor(() => expect(view.getByText('Button')).toBeTruthy());
    await act(() =>
      store.push(components({ id: 'label', component: 'Text', text: 'Send' }))
    );
    await waitFor(() => expect(view.getByText('Send')).toBeTruthy());
    expect(view.queryByText('Button')).toBeNull();
  });

  test('resolves a data-bound child once its definition is pushed', async () => {
    const { store, view } = mount([
      create(
        [{ id: 'root', component: 'Column', children: ['card'] }, {
          id: 'card',
          component: 'Card',
          child: { '@path': '/selected' },
        }],
        { selected: 'leaf' },
      ),
    ]);
    await act(() =>
      store.push(components({ id: 'leaf', component: 'Text', text: 'Bound' }))
    );
    await waitFor(() => expect(view.getByText('Bound')).toBeTruthy());
  });

  test('does not re-render a component whose definition is resent unchanged', async () => {
    const { store, view } = mount([
      create([
        { id: 'root', component: 'Column', children: ['a', 'b'] },
        { id: 'a', component: 'Probe', text: 'first' },
        { id: 'b', component: 'Probe', text: 'second' },
      ]),
    ]);
    await waitFor(() => expect(view.getByText('second')).toBeTruthy());
    renders.mockClear();
    for (let i = 0; i < 5; i++) {
      await act(() =>
        store.push(components({ id: 'a', component: 'Probe', text: 'first' }))
      );
    }
    expect(renders).not.toHaveBeenCalled();
    await act(() =>
      store.push(components({ id: 'a', component: 'Probe', text: 'changed' }))
    );
    await waitFor(() => expect(view.getByText('changed')).toBeTruthy());
    expect(rendersOf('a')).toBe(1);
    expect(rendersOf('b')).toBe(0);
  });

  test('re-renders a parent when a child changes a prop it is laid out by', async () => {
    const { store, view } = mount([
      create([
        { id: 'root', component: 'Column', children: ['a'] },
        { id: 'a', component: 'Text', text: 'row' },
      ]),
    ]);
    await waitFor(() => expect(view.getByText('row')).toBeTruthy());
    expect(view.container.querySelector('.column-weighted-item')).toBeNull();
    await act(() =>
      store.push(
        components({ id: 'a', component: 'Text', text: 'row', weight: 2 }),
      )
    );
    await waitFor(() =>
      expect(view.container.querySelector('.column-weighted-item-2'))
        .toBeTruthy()
    );
  });
});

describe('A2UI templates', () => {
  const list = [
    {
      id: 'root',
      component: 'Column',
      children: { componentId: 'row', path: '/items' },
    },
    { id: 'row', component: 'Probe', text: { '@path': 'name' } },
    { id: 'footer', component: 'Text', text: { '@path': '/footer' } },
  ];

  test('renders nested templates with paths relative to each item', async () => {
    const { view } = mount([
      create([
        {
          id: 'root',
          component: 'Column',
          children: { componentId: 'group', path: '/groups' },
        },
        {
          id: 'group',
          component: 'Column',
          children: { componentId: 'leaf', path: 'items' },
        },
        { id: 'leaf', component: 'Text', text: { '@path': 'name' } },
      ], {
        groups: [{ items: [{ name: 'g0i0' }, { name: 'g0i1' }] }, {
          items: [{ name: 'g1i0' }],
        }],
      }),
    ]);
    await waitFor(() =>
      expect(view.container.textContent).toBe('g0i0g0i1g1i0')
    );
  });

  test('leaves instances alone when unrelated data or components change', async () => {
    const { store, view } = mount([
      create(list, { items: [{ name: 'one' }, { name: 'two' }], footer: '-' }),
    ]);
    await waitFor(() => expect(view.getByText('two')).toBeTruthy());
    renders.mockClear();
    await act(() => store.push(data('/footer', 'changed')));
    await act(() =>
      store.push(components({ id: 'footer', component: 'Text', text: 'x' }))
    );
    expect(renders).not.toHaveBeenCalled();
    await act(() => store.push(data('/items/1/name', 'TWO')));
    await waitFor(() => expect(view.getByText('TWO')).toBeTruthy());
    expect(rendersOf('row:1')).toBe(1);
    expect(rendersOf('row:0')).toBe(0);
  });

  test('adds and removes instances with their items', async () => {
    const { store, view } = mount([
      create(list, { items: [{ name: 'one' }], footer: '' }),
    ]);
    await waitFor(() => expect(view.getByText('one')).toBeTruthy());
    renders.mockClear();
    await act(() => store.push(data('/items/1', { name: 'two' })));
    await waitFor(() => expect(view.getByText('two')).toBeTruthy());
    expect(rendersOf('row:0')).toBe(0);
    await act(() => store.push(data('/items', [{ name: 'only' }])));
    await waitFor(() => expect(view.queryByText('two')).toBeNull());
    expect(view.getByText('only')).toBeTruthy();
  });

  test('updates every instance when the template definition changes', async () => {
    const { store, view } = mount([
      create(list, { items: [{ name: 'one' }, { name: 'two' }], footer: '' }),
    ]);
    await waitFor(() => expect(view.getByText('two')).toBeTruthy());
    await act(() =>
      store.push(components({
        id: 'row',
        component: 'Probe',
        text: { '@path': 'label' },
      }))
    );
    await act(() =>
      store.push(data('/items', [{ label: 'uno' }, { label: 'dos' }]))
    );
    await waitFor(() => expect(view.getByText('dos')).toBeTruthy());
    expect(view.getByText('uno')).toBeTruthy();
  });
});

describe('A2UI expression evaluation', () => {
  test('settles when a function returns a new non-JSON object on every call', async () => {
    const stamp = rstest.fn(() => new Date(0));
    const { view } = mount(
      [create([{
        id: 'root',
        component: 'Probe',
        text: { '@call': 'stamp', args: {} },
      }])],
      [defineFunction(Object.assign(stamp, { displayName: 'stamp' }))],
    );
    await waitFor(() =>
      expect(view.getByText(String(new Date(0)))).toBeTruthy()
    );
    await act(() => new Promise(resolve => setTimeout(resolve, 20)));
    expect(stamp.mock.calls.length).toBeLessThan(5);
    expect(rendersOf('root')).toBeLessThan(5);
  });

  test('reports a failing expression once until the agent changes the surface', async () => {
    const errors: string[] = [];
    const { store, view } = mount(
      [create([
        { id: 'root', component: 'Column', children: ['bad', 'ok'] },
        { id: 'bad', component: 'Probe', text: { '@path': '/x', extra: 1 } },
        { id: 'ok', component: 'Probe', text: { '@path': '/y' } },
      ])],
      [],
      message => {
        const error = (message as { error?: { message: string } }).error;
        if (error) errors.push(error.message);
      },
    );
    await waitFor(() => expect(view.getByText('undefined')).toBeTruthy());
    expect(errors).toEqual(['Invalid data binding shape']);
    await act(() => store.push(data('/y', 'ready')));
    await waitFor(() => expect(view.getByText('ready')).toBeTruthy());
    expect(errors).toEqual(['Invalid data binding shape']);
  });
});

function surface(catalog?: string): ServerToClientMessage {
  return {
    version: '1.0',
    createSurface: {
      surfaceId: 's',
      ...(catalog ? { catalogId: catalog } : {}),
      components: [{ id: 'root', component: 'Text', text: 'Hello' }],
    },
  };
}

describe('A2UI catalog resolution', () => {
  test('uses its own catalog for a surface that names none', async () => {
    const store = createMessageStore({ initialMessages: [surface()] });
    const view = render(
      <A2UI messageStore={store} catalogs={catalogs} catalogId={catalogId} />,
    );
    await waitFor(() => expect(view.getByText('Hello')).toBeTruthy());
  });

  test('reports a surface whose catalog is not registered', async () => {
    const warning = rstest.spyOn(console, 'warn').mockImplementation(() =>
      undefined
    );
    const onMessage = rstest.fn();
    const store = createMessageStore({ initialMessages: [surface('other')] });
    try {
      const view = render(
        <A2UI
          messageStore={store}
          catalogs={catalogs}
          catalogId={catalogId}
          onMessage={onMessage}
        />,
      );
      await waitFor(() =>
        expect(view.container.textContent).toContain(
          'Unsupported component in root',
        )
      );
      expect(onMessage.mock.calls.map((call): unknown => call[0])).toEqual([{
        version: '1.0',
        error: {
          code: 'VALIDATION_FAILED',
          surfaceId: 's',
          path: '/createSurface/catalogId',
          message: 'Unknown catalog "other"',
        },
      }]);
    } finally {
      warning.mockRestore();
    }
  });
});
