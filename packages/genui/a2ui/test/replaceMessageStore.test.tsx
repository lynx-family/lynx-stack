// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rstest, test } from '@rstest/core';

import { useEffect, useState } from '@lynx-js/react';
import { act, render, waitFor } from '@lynx-js/react/testing-library';

import { Card } from '../src/catalog/Card/index.jsx';
import { Column } from '../src/catalog/Column/index.jsx';
import type {
  CatalogComponent,
  CatalogFunctionEntry,
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
const catalogs = [Text as CatalogComponent, Column as CatalogComponent];
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
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

describe('A2UI message replacement', () => {
  test.each(['replace', 'clear'] as const)(
    'blocks rejected replacement tails until recovery with %s',
    async recovery => {
      const store = createMessageStore({
        initialMessages: snapshot('Original'),
      });
      const onMessage = rstest.fn();
      const warning = rstest.spyOn(console, 'warn').mockImplementation(() =>
        undefined
      );
      const view = render(
        <A2UI
          messageStore={store}
          catalogs={catalogs}
          catalogId={catalogId}
          onMessage={onMessage}
        />,
      );
      await waitFor(() => expect(view.getByText('Original')).toBeTruthy());
      const invalid = [...snapshot('Rejected'), ...snapshot('Duplicate')];
      try {
        await act(() => {
          store.replace(invalid);
          store.push(update('Must not apply'));
        });
        await waitFor(() => expect(onMessage).toHaveBeenCalledTimes(1));
        expect(view.getByText('Original')).toBeTruthy();
        expect(view.queryByText('Must not apply')).toBeNull();
        expect(warning).toHaveBeenCalledWith(
          '[a2ui] Replacement rejected; keeping the previous rendering state. Correct the full snapshot with replace().',
        );
        await act(() => store.push(update('Must not apply')));
        await waitFor(() => expect(onMessage).toHaveBeenCalledTimes(2));
        expect(view.getByText('Original')).toBeTruthy();
        expect(view.queryByText('Must not apply')).toBeNull();
        await act(() => {
          if (recovery === 'replace') store.replace(snapshot('Corrected'));
          else {
            store.clear();
            store.push(update('Corrected'));
          }
        });
        await waitFor(() => expect(view.getByText('Corrected')).toBeTruthy());
        await act(() => store.push(update('Follow-up')));
        await waitFor(() => expect(view.getByText('Follow-up')).toBeTruthy());
      } finally {
        warning.mockRestore();
      }
    },
  );

  test.each(['same', 'shorter', 'longer'] as const)(
    'consumes a %s clear-and-push batch without clearing rendered state first',
    async length => {
      const store = createMessageStore({
        initialMessages: [...snapshot('Initial'), update('Current')],
      });
      const view = render(
        <A2UI messageStore={store} catalogs={catalogs} catalogId={catalogId} />,
      );
      await waitFor(() => expect(view.getByText('Current')).toBeTruthy());
      const updates = length === 'same'
        ? [update('First'), update('Final')]
        : (length === 'shorter'
          ? [update('Final')]
          : [update('First'), update('Second'), update('Final')]);
      await act(() => {
        store.clear();
        store.push(updates);
      });
      await waitFor(() => expect(view.getByText('Final')).toBeTruthy());
      await act(() => store.push(update('Next')));
      await waitFor(() => expect(view.getByText('Next')).toBeTruthy());
    },
  );

  test('clear discards an unseen replacement but consumes its new appended tail', async () => {
    const store = createMessageStore({ initialMessages: snapshot('Initial') });
    const view = render(
      <A2UI messageStore={store} catalogs={catalogs} catalogId={catalogId} />,
    );
    await waitFor(() => expect(view.getByText('Initial')).toBeTruthy());
    await act(() => {
      store.replace(snapshot('Discarded'));
      store.clear();
      store.push(update('After clear'));
    });
    await waitFor(() => expect(view.getByText('After clear')).toBeTruthy());
    await act(() => {
      store.clear();
      store.push(update('Discarded tail'));
      store.replace(snapshot('Replacement'));
      store.push(update('Final'));
    });
    await waitFor(() => expect(view.getByText('Final')).toBeTruthy());
  });

  test('consumes same-length replacements and later appended messages', async () => {
    const store = createMessageStore({
      initialMessages: snapshot('Streaming'),
    });
    const view = render(
      <A2UI messageStore={store} catalogs={catalogs} catalogId={catalogId} />,
    );
    await waitFor(() => expect(view.getByText('Streaming')).toBeTruthy());
    await act(() => store.replace(snapshot('Final')));
    await waitFor(() => expect(view.getByText('Final')).toBeTruthy());
    expect(view.queryByText('Streaming')).toBeNull();
    await act(() => store.push(update('Follow-up')));
    await waitFor(() => expect(view.getByText('Follow-up')).toBeTruthy());
  });

  test('handles shorter replacements and coalesced replace followed by push', async () => {
    const store = createMessageStore({
      initialMessages: [...snapshot('One'), update('Two'), update('Three')],
    });
    const view = render(
      <A2UI messageStore={store} catalogs={catalogs} catalogId={catalogId} />,
    );
    await waitFor(() => expect(view.getByText('Three')).toBeTruthy());
    await act(() => {
      store.replace(snapshot('Replaced'));
      store.push(update('Appended'));
    });
    await waitFor(() => expect(view.getByText('Appended')).toBeTruthy());
    await act(() => {
      store.replace(snapshot('Discarded'));
      store.push(update('Also discarded'));
      store.replace(snapshot('Latest'));
    });
    await waitFor(() => expect(view.getByText('Latest')).toBeTruthy());
  });

  test('keeps historical push deletion and surface-switch behavior', async () => {
    const lifecycle: string[] = [];
    function Probe(props: GenericComponentProps & { label: string }) {
      const [initial] = useState(props.label);
      useEffect(() => {
        lifecycle.push(`mount:${initial}`);
        return () => {
          lifecycle.push(`unmount:${initial}`);
        };
      }, []);
      return <text>{`${props.label}/${initial}`}</text>;
    }
    const probeCatalogs = [Probe as CatalogComponent];
    const store = createMessageStore({
      initialMessages: snapshot('First', 'first').map(message => {
        if ('createSurface' in message) {
          message.createSurface.components = [{
            id: 'root',
            component: 'Probe',
            label: 'First',
          }];
        }
        return message;
      }),
    });
    const view = render(
      <A2UI
        messageStore={store}
        catalogs={probeCatalogs}
        catalogId={catalogId}
        renderEmpty={() => <text>Empty</text>}
      />,
    );
    await waitFor(() => expect(view.getByText('First/First')).toBeTruthy());
    await waitFor(() => expect(lifecycle).toEqual(['mount:First']));
    await act(() =>
      store.push({
        version: '1.0',
        createSurface: {
          surfaceId: 'second',
          catalogId,
          components: [{
            id: 'root',
            component: 'Probe',
            label: 'Second',
          }],
        },
      })
    );
    await waitFor(() => expect(view.getByText('Second/First')).toBeTruthy());
    expect(lifecycle).toEqual(['mount:First']);
    await act(() =>
      store.push({
        version: '1.0',
        deleteSurface: { surfaceId: 'second' },
      })
    );
    await waitFor(() => expect(view.container.textContent).toBe(''));
    expect(view.queryByText('First/First')).toBeNull();
    expect(view.queryByText('Empty')).toBeNull();
  });

  test('push deletion of the only surface leaves blank without calling renderEmpty', async () => {
    const empty = rstest.fn(() => <text>Empty</text>);
    const store = createMessageStore({
      initialMessages: snapshot('Only'),
    });
    const view = render(
      <A2UI
        messageStore={store}
        catalogs={catalogs}
        catalogId={catalogId}
        renderEmpty={empty}
      />,
    );
    await waitFor(() => expect(view.getByText('Only')).toBeTruthy());
    empty.mockClear();
    await act(() =>
      store.push({ version: '1.0', deleteSurface: { surfaceId: 's' } })
    );
    await waitFor(() => expect(view.container.textContent).toBe(''));
    expect(empty).not.toHaveBeenCalled();
  });

  test('replacement can reveal a retained surface after a push deletion', async () => {
    const store = createMessageStore({
      initialMessages: [
        ...snapshot('First', 'first'),
        ...snapshot('Second', 'second'),
      ],
    });
    const view = render(
      <A2UI
        messageStore={store}
        catalogs={catalogs}
        catalogId={catalogId}
      />,
    );
    await waitFor(() => expect(view.getByText('Second')).toBeTruthy());
    await act(() =>
      store.push({
        version: '1.0',
        deleteSurface: { surfaceId: 'second' },
      })
    );
    await waitFor(() => expect(view.container.textContent).toBe(''));
    await act(() => store.replace(snapshot('First', 'first')));
    await waitFor(() => expect(view.getByText('First')).toBeTruthy());
  });

  test('replacement preserves the active instance with shared message IDs', async () => {
    function Probe(props: GenericComponentProps & { label: string }) {
      const [initial] = useState(props.label);
      return <text>{`${props.label}/${initial}`}</text>;
    }
    const probeCatalogs = [Probe as CatalogComponent];
    function messages(
      surfaceId: string,
      label: string,
    ): ServerToClientMessage[] {
      return [{
        version: '1.0',
        messageId: 'shared',
        createSurface: {
          surfaceId,
          catalogId,
          components: [{ id: 'root', component: 'Probe', label }],
        },
      }];
    }
    const first = messages('first', 'First');
    const second = messages('second', 'Second');
    const store = createMessageStore({ initialMessages: first });
    const view = render(
      <A2UI
        messageStore={store}
        catalogs={probeCatalogs}
        catalogId={catalogId}
      />,
    );
    await waitFor(() => expect(view.getByText('First/First')).toBeTruthy());
    await act(() => store.push(second));
    await waitFor(() => expect(view.getByText('Second/First')).toBeTruthy());
    await act(() => store.replace([...first, ...second]));
    expect(view.getByText('Second/First')).toBeTruthy();
    await act(() => store.replace(first));
    await waitFor(() => expect(view.getByText('First/First')).toBeTruthy());
  });

  test('keeps historical push deletion after a replacement', async () => {
    const store = createMessageStore({
      initialMessages: snapshot('First', 'first'),
    });
    const view = render(
      <A2UI
        messageStore={store}
        catalogs={catalogs}
        catalogId={catalogId}
        renderEmpty={() => <text>Empty</text>}
      />,
    );
    await act(() =>
      store.replace([
        ...snapshot('First', 'first'),
        ...snapshot('Second', 'second'),
      ])
    );
    await waitFor(() => expect(view.getByText('Second')).toBeTruthy());
    await act(() =>
      store.push({
        version: '1.0',
        deleteSurface: { surfaceId: 'second' },
      })
    );
    await waitFor(() => expect(view.container.textContent).toBe(''));
    expect(view.queryByText('First')).toBeNull();
    expect(view.queryByText('Empty')).toBeNull();
  });

  test('push switches keep reusing the tree after replacement changes its surface', async () => {
    const lifecycle: string[] = [];
    function Probe(props: GenericComponentProps & { label: string }) {
      const [initial] = useState(props.label);
      useEffect(() => {
        lifecycle.push(`mount:${initial}`);
        return () => {
          lifecycle.push(`unmount:${initial}`);
        };
      }, []);
      return <text>{`${props.label}/${initial}`}</text>;
    }
    const probeCatalogs = [Probe as CatalogComponent];
    function create(label: string): ServerToClientMessage {
      return {
        version: '1.0',
        createSurface: {
          surfaceId: label,
          catalogId,
          components: [{ id: 'root', component: 'Probe', label }],
        },
      };
    }
    const store = createMessageStore({ initialMessages: [create('A')] });
    const view = render(
      <A2UI
        messageStore={store}
        catalogs={probeCatalogs}
        catalogId={catalogId}
      />,
    );
    await waitFor(() => expect(view.getByText('A/A')).toBeTruthy());
    await act(() => store.replace([create('B')]));
    await waitFor(() => expect(view.getByText('B/B')).toBeTruthy());
    await waitFor(() =>
      expect(lifecycle).toEqual(['mount:A', 'unmount:A', 'mount:B'])
    );
    await act(() => store.push(create('C')));
    await waitFor(() => expect(view.getByText('C/B')).toBeTruthy());
    expect(lifecycle).toEqual(['mount:A', 'unmount:A', 'mount:B']);
    await act(() => store.clear());
    expect(view.getByText('C/B')).toBeTruthy();
    expect(lifecycle).toEqual(['mount:A', 'unmount:A', 'mount:B']);
  });

  test('preserves component state and local input without rerendering an equal tail', async () => {
    const mounted = rstest.fn();
    const unmounted = rstest.fn();
    const rendered = rstest.fn();
    let edit: (value: string) => void;
    let increment: () => void;
    function Input(props: GenericComponentProps & { value: string }) {
      const [count, setCount] = useState(0);
      edit = value => props.setValue?.('value', value);
      increment = () => setCount(previous => previous + 1);
      useEffect(() => {
        mounted();
        return () => {
          unmounted();
        };
      }, []);
      rendered();
      return <text>{`${props.value}:${count}`}</text>;
    }
    const inputCatalogs = [Input as CatalogComponent];
    const full: ServerToClientMessage[] = [{
      version: '1.0',
      createSurface: {
        surfaceId: 's',
        catalogId,
        components: [{
          id: 'root',
          component: 'Input',
          value: { '@path': '/name' },
        }],
        dataModel: { name: 'Ada' },
      },
    }];
    const store = createMessageStore({ initialMessages: full });
    const view = render(
      <A2UI
        messageStore={store}
        catalogs={inputCatalogs}
        catalogId={catalogId}
      />,
    );
    await waitFor(() => expect(view.getByText('Ada:0')).toBeTruthy());
    await act(() => {
      edit('Local');
      increment();
    });
    await waitFor(() => expect(view.getByText('Local:1')).toBeTruthy());
    rendered.mockClear();
    await act(() => store.replace(clone(full)));
    expect(view.getByText('Local:1')).toBeTruthy();
    expect(rendered).not.toHaveBeenCalled();
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();
    const corrected = clone(full);
    if ('createSurface' in corrected[0]!) {
      corrected[0].createSurface.dataModel = { name: 'Grace' };
    }
    await act(() => store.replace(corrected));
    await waitFor(() => expect(view.getByText('Grace:1')).toBeTruthy());
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();
  });

  test('adds, removes, reorders, and changes the type of component nodes', async () => {
    function tree(
      children: string[],
      items: ComponentInstance[],
    ): ServerToClientMessage[] {
      return [{
        version: '1.0',
        createSurface: {
          surfaceId: 's',
          catalogId,
          components: [{ id: 'root', component: 'Column', children }, ...items],
        },
      }];
    }
    const first = { id: 'a', component: 'Text', text: 'A' };
    const second = { id: 'b', component: 'Text', text: 'B' };
    const store = createMessageStore({
      initialMessages: tree(['a', 'b'], [first, second]),
    });
    const view = render(
      <A2UI messageStore={store} catalogs={catalogs} catalogId={catalogId} />,
    );
    await waitFor(() => expect(view.container.textContent).toBe('AB'));
    await act(() => store.replace(tree(['b', 'a'], [first, second])));
    await waitFor(() => expect(view.container.textContent).toBe('BA'));
    await act(() =>
      store.replace(tree(['c'], [{ id: 'c', component: 'Text', text: 'C' }]))
    );
    await waitFor(() => expect(view.container.textContent).toBe('C'));
    await act(() => store.replace(snapshot('New root type')));
    await waitFor(() =>
      expect(view.container.textContent).toBe('New root type')
    );
  });

  test('selects the last renderable surface after replacement and switches back on deletion', async () => {
    const store = createMessageStore({
      initialMessages: [
        ...snapshot('First', 'first'),
        ...snapshot('Second', 'second'),
      ],
    });
    const view = render(
      <A2UI messageStore={store} catalogs={catalogs} catalogId={catalogId} />,
    );
    await waitFor(() => expect(view.getByText('Second')).toBeTruthy());
    await act(() =>
      store.replace([
        ...snapshot('Second', 'second'),
        ...snapshot('First', 'first'),
      ])
    );
    await waitFor(() => expect(view.getByText('First')).toBeTruthy());
    await act(() => store.replace(snapshot('Second', 'second')));
    await waitFor(() => expect(view.getByText('Second')).toBeTruthy());
  });

  test('refreshes dynamic child references when definitions appear or disappear', async () => {
    const dynamicCatalogs = [...catalogs, Card as CatalogComponent];
    const full: ServerToClientMessage[] = [{
      version: '1.0',
      createSurface: {
        surfaceId: 's',
        catalogId,
        components: [
          { id: 'root', component: 'Card', child: { '@path': '/selected' } },
          { id: 'leaf', component: 'Text', text: 'Dynamic child' },
        ],
        dataModel: { selected: 'leaf' },
      },
    }];
    const empty = clone(full);
    if ('createSurface' in empty[0]!) {
      empty[0].createSurface.components = [
        empty[0].createSurface.components![0]!,
      ];
    }
    const store = createMessageStore({ initialMessages: empty });
    const view = render(
      <A2UI
        messageStore={store}
        catalogs={dynamicCatalogs}
        catalogId={catalogId}
      />,
    );
    await act(() => store.replace(full));
    await waitFor(() => expect(view.getByText('Dynamic child')).toBeTruthy());
    await act(() => store.replace(empty));
    await waitFor(() => expect(view.queryByText('Dynamic child')).toBeNull());
  });

  test('starts a fresh component instance when a surface is deleted and recreated with the same ID', async () => {
    const mounts = rstest.fn(() => 'Initial');
    function Counter() {
      const [value] = useState(() => mounts());
      return <text>{String(value)}</text>;
    }
    mounts.mockReturnValueOnce('First instance').mockReturnValueOnce(
      'New instance',
    );
    const counterCatalogs = [Counter as CatalogComponent];
    const messages: ServerToClientMessage[] = [{
      version: '1.0',
      createSurface: {
        surfaceId: 's',
        catalogId,
        components: [{ id: 'root', component: 'Counter' }],
      },
    }];
    const store = createMessageStore({ initialMessages: messages });
    const view = render(
      <A2UI
        messageStore={store}
        catalogs={counterCatalogs}
        catalogId={catalogId}
      />,
    );
    await waitFor(() => expect(view.getByText('First instance')).toBeTruthy());
    await act(() => {
      store.replace([]);
      store.push(messages);
    });
    await waitFor(() => expect(view.getByText('New instance')).toBeTruthy());
    expect(mounts).toHaveBeenCalledTimes(2);
  });

  test(
    'clears rendered surfaces with an empty replacement and accepts a new stream',
    async () => {
      const store = createMessageStore({
        initialMessages: snapshot('Visible'),
      });
      const view = render(
        <A2UI
          messageStore={store}
          catalogs={catalogs}
          catalogId={catalogId}
          renderEmpty={() => <text>Empty</text>}
        />,
      );
      await waitFor(() => expect(view.getByText('Visible')).toBeTruthy());
      await act(() => store.clear());
      expect(store.getSnapshot()).toEqual([]);
      expect(view.getByText('Visible')).toBeTruthy();
      await act(() => store.replace([]));
      await waitFor(() => expect(view.getByText('Empty')).toBeTruthy());
      expect(view.queryByText('Visible')).toBeNull();
      await act(() => store.push(snapshot('New stream')));
      await waitFor(() => expect(view.getByText('New stream')).toBeTruthy());
    },
  );

  test('does not replay snapshot RPCs but executes calls pushed after replacement', async () => {
    const invoke = rstest.fn(() => true);
    const fn: CatalogFunctionEntry = {
      kind: 'function',
      name: 'ready',
      impl: invoke,
      definition: {
        name: 'ready',
        parameters: {},
        returnType: 'boolean',
        allowedCallers: 'rendererOrAgent',
      },
    };
    const store = createMessageStore();
    const call = (functionCallId: string): ServerToClientMessage => ({
      version: '1.0',
      callRendererFunction: {
        functionCallId,
        callFunction: { catalogId, '@call': 'ready' },
      },
    });
    store.replace([...snapshot('Before mount'), call('history')]);
    const view = render(
      <A2UI
        messageStore={store}
        catalogs={[...catalogs, fn]}
        catalogId={catalogId}
      />,
    );
    await waitFor(() => expect(view.getByText('Before mount')).toBeTruthy());
    expect(invoke).not.toHaveBeenCalled();
    await act(() => {
      store.replace([...snapshot('Final'), call('history')]);
      store.push(call('new'));
    });
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect(view.getByText('Final')).toBeTruthy();
  });
});
