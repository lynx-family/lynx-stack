// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rstest, test } from '@rstest/core';

import type { Catalog } from '../src/catalog/defineCatalog.js';
import { compactA2UIMessagesToSnapshot } from '../src/snapshot/index.js';
import { MessageProcessor } from '../src/store/MessageProcessor.js';
import type {
  ComponentInstance,
  ServerToClientMessage,
} from '../src/store/types.js';

const components: ComponentInstance[] = [
  { id: 'root', component: 'Column', children: ['title', 'input'] },
  { id: 'title', component: 'Text', text: 'Hello' },
  { id: 'input', component: 'TextField', value: { '@path': '/user/name' } },
];
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function snapshot(
  items = components,
  dataModel: Record<string, unknown> = { user: { name: 'Ada', stale: true } },
  surfaceId = 's',
): ServerToClientMessage[] {
  return [{
    version: '1.0',
    createSurface: {
      surfaceId,
      catalogId: 'test',
      components: items,
      dataModel,
    },
  }];
}

function setup(messages = snapshot()) {
  const processor = new MessageProcessor();
  processor.processMessages(messages);
  const updates = rstest.fn();
  const replacements = rstest.fn();
  processor.onUpdate(data => {
    if (data['type'] === 'replace') replacements(data);
    else updates(data);
  });
  const events = rstest.fn();
  processor.onEvent(({ message, resolve }) => {
    events(message);
    resolve([]);
  });
  return { processor, updates, replacements, events };
}

describe('MessageProcessor.replaceMessages', () => {
  test('treats differently batched equivalent histories as a no-op', () => {
    const { processor, updates, events } = setup();
    const surface = processor.getSurfaces().get('s')!;
    const root = surface.components.get('root');
    const resource = surface.resources.get('title');
    const data = surface.store.getDataModel();
    processor.replaceMessages([
      { version: '1.0', createSurface: { surfaceId: 's', catalogId: 'test' } },
      {
        version: '1.0',
        updateDataModel: {
          surfaceId: 's',
          value: { user: { stale: true, name: 'Ada' } },
        },
      },
      {
        version: '1.0',
        updateComponents: {
          surfaceId: 's',
          components: clone(components),
        },
      },
    ]);
    expect(processor.getSurfaces().get('s')).toBe(surface);
    expect(surface.components.get('root')).toBe(root);
    expect(surface.resources.get('title')).toBe(resource);
    expect(surface.store.getDataModel()).toBe(data);
    expect(updates).not.toHaveBeenCalled();
    expect(events).not.toHaveBeenCalled();
  });

  test('updates changed definitions and their parents while retaining other resources', () => {
    const { processor, updates } = setup();
    const surface = processor.getSurfaces().get('s')!;
    const resource = surface.resources.get('title');
    const input = surface.components.get('input');
    processor.replaceMessages(snapshot([
      components[0]!,
      { id: 'title', component: 'Text', text: 'Complete', weight: 2 },
      components[2]!,
    ]));
    expect(surface.resources.get('title')).toBe(resource);
    expect(surface.components.get('input')).toBe(input);
    expect(updates).toHaveBeenCalledTimes(1);
    const update = updates.mock.calls[0]![0] as {
      updates: ComponentInstance[];
    };
    expect(update.updates.map(component => component.id)).toEqual([
      'root',
      'title',
    ]);
  });

  test('removes missing components, props, data fields, and surfaces', () => {
    const { processor } = setup([
      ...snapshot(),
      ...snapshot(components, {}, 'other'),
    ]);
    processor.replaceMessages(snapshot([
      { id: 'root', component: 'Column', children: ['title'] },
      { id: 'title', component: 'Text' },
    ], { user: { name: 'Grace' } }));
    const surface = processor.getSurfaces().get('s')!;
    expect([...processor.getSurfaces().keys()]).toEqual(['s']);
    expect([...surface.components.keys()]).toEqual(['root', 'title']);
    expect(surface.resources.has('input')).toBe(false);
    expect(surface.components.get('title')).not.toHaveProperty('text');
    expect(surface.store.getSignal('/user/stale').value).toBeUndefined();
    expect(surface.store.getDataModel()).toEqual({ user: { name: 'Grace' } });
    processor.replaceMessages([]);
    expect(processor.getSurfaces().size).toBe(0);
  });

  test('keeps local input for unchanged server fields, including after component pushes', () => {
    const { processor } = setup();
    const surface = processor.getSurfaces().get('s')!;
    surface.store.update('/user/name', 'Local edit');
    processor.processMessages([{
      version: '1.0',
      updateComponents: {
        surfaceId: 's',
        components: [{ id: 'title', component: 'Text', text: 'Streaming' }],
      },
    }]);
    processor.replaceMessages(
      snapshot(components, { user: { name: 'Ada' }, status: 'done' }),
    );
    expect(surface.store.getDataModel()).toEqual({
      user: { name: 'Local edit' },
      status: 'done',
    });
    processor.replaceMessages(
      snapshot(components, {
        user: { name: 'Server correction' },
        status: 'done',
      }),
    );
    expect(surface.store.getSignal('/user/name').value).toBe(
      'Server correction',
    );
    surface.store.update('/user/name', 'Another edit');
    processor.replaceMessages(
      snapshot(components, {
        user: { name: 'Server correction' },
        status: 'done',
      }),
    );
    expect(surface.store.getSignal('/user/name').value).toBe('Another edit');
  });

  test('does not notify signals when new server data already matches local input', () => {
    const { processor, updates } = setup();
    const surface = processor.getSurfaces().get('s')!;
    surface.store.update('/user/name', 'Grace');
    const current = surface.store.getDataModel();
    processor.replaceMessages(
      snapshot(components, { user: { name: 'Grace', stale: true } }),
    );
    expect(surface.store.getDataModel()).toBe(current);
    expect(updates).not.toHaveBeenCalled();
  });

  test('expands templates against preserved local data and removes obsolete clones', () => {
    const template: ComponentInstance[] = [
      {
        id: 'root',
        component: 'Column',
        children: { componentId: 'row', path: '/items' },
      },
      { id: 'row', component: 'Text', text: { '@path': 'label' } },
    ];
    const data = { items: [{ label: 'First' }, { label: 'Second' }] };
    const { processor, updates } = setup(snapshot(template, data));
    const surface = processor.getSurfaces().get('s')!;
    surface.store.update('/items/0/label', 'Edited');
    processor.replaceMessages(snapshot(template, clone(data)));
    expect(surface.store.getSignal('/items/0/label').value).toBe('Edited');
    expect(updates).not.toHaveBeenCalled();
    processor.replaceMessages(
      snapshot(template, { items: [{ label: 'Only' }] }),
    );
    expect(surface.components.get('root')?.['children']).toEqual(['row:0']);
    expect(surface.components.has('row:1')).toBe(false);
    expect(surface.resources.has('row:1')).toBe(false);
    expect(surface.store.getSignal('/items/0/label').value).toBe('Only');
  });

  test('keeps an empty surface available for subsequent streamed components', () => {
    const { processor } = setup();
    processor.replaceMessages(snapshot([], {}));
    expect(processor.getSurfaces().get('s')?.rootComponentId).toBeNull();
    processor.processMessages([{
      version: '1.0',
      updateComponents: { surfaceId: 's', components },
    }]);
    expect(processor.getSurfaces().get('s')?.rootComponentId).toBe('root');
  });

  test('accepts compact snapshots without changing live component identities', () => {
    const history = [
      ...snapshot(),
      {
        version: '1.0',
        updateComponents: {
          surfaceId: 's',
          components: [{ id: 'title', component: 'Text', text: 'Final' }],
        },
      } satisfies ServerToClientMessage,
    ];
    const { processor, updates } = setup(history);
    const surface = processor.getSurfaces().get('s')!;
    const before = surface.components;
    processor.replaceMessages(compactA2UIMessagesToSnapshot(history).messages);
    expect(surface.components).toBe(before);
    expect(updates).not.toHaveBeenCalled();
  });

  test('ignores message IDs when updating the active surface from a full history', () => {
    const { processor, replacements } = setup([
      ...snapshot(),
      ...snapshot(components, {}, 'other'),
    ]);
    processor.replaceMessages([
      ...snapshot(components, {}, 'other'),
      ...snapshot(),
    ]);
    expect(replacements).toHaveBeenLastCalledWith({
      type: 'replace',
      surfaceId: 's',
      surfaceIds: ['other', 's'],
    });
  });

  test('rejects a versionless unscoped envelope without clearing the current state', () => {
    const { processor, updates, events } = setup();
    processor.replaceMessages([{}] as unknown as ServerToClientMessage[]);
    expect(processor.getSurfaces().has('s')).toBe(true);
    expect(updates).not.toHaveBeenCalled();
    expect(events.mock.calls[0]?.[0]).toMatchObject({
      error: { code: 'UNSUPPORTED_VERSION' },
    });
  });

  test('does not replay RPC envelopes from a full history', async () => {
    const { processor, events } = setup();
    processor.replaceMessages([
      ...snapshot(),
      {
        version: '1.0',
        callRendererFunction: {
          functionCallId: 'old',
          callFunction: { catalogId: 'test', '@call': 'missing' },
        },
      },
      {
        version: '1.0',
        agentFunctionResponse: { functionCallId: 'old-response', value: true },
      },
    ]);
    await Promise.resolve();
    expect(events).not.toHaveBeenCalled();
  });

  test('rejects invalid replacement state without partially changing live surfaces', () => {
    const { processor, events, updates } = setup();
    const before = processor.getSurfaces().get('s');
    const accepted = processor.replaceMessages([
      ...snapshot([{
        id: 'root',
        component: 'Text',
        text: 'Invalid replacement',
      }]),
      ...snapshot(),
    ]);
    expect(accepted).toBe(false);
    expect(events.mock.calls[0]?.[0]).toMatchObject({
      error: { message: 'Surface already exists' },
    });
    expect(processor.getSurfaces().get('s')).toBe(before);
    expect(before?.components.get('title')?.['text']).toBe('Hello');
    expect(updates).not.toHaveBeenCalled();
    expect(processor.replaceMessages(snapshot())).toBe(true);
  });

  test('retains other array items local input when one server item changes', () => {
    const data = { items: [{ label: 'First' }, { label: 'Second' }] };
    const { processor } = setup(snapshot(components, data));
    const surface = processor.getSurfaces().get('s')!;
    surface.store.update('/items/1/label', 'Local second');
    expect(processor.replaceMessages(snapshot(components, {
      items: [{ label: 'Server first' }, { label: 'Second' }],
    }))).toBe(true);
    expect(surface.store.getDataModel()).toEqual({
      items: [{ label: 'Server first' }, { label: 'Local second' }],
    });
    processor.replaceMessages(
      snapshot(components, { items: [{ label: 'Only' }] }),
    );
    expect(surface.store.getDataModel()).toEqual({
      items: [{ label: 'Only' }],
    });
  });

  test.each(['id', 'key'])(
    'matches array edits by unique %s across insertions and reordering',
    key => {
      const data = {
        items: [
          { [key]: 'a', label: 'A', flag: false },
          { [key]: 'b', label: 'B', flag: false },
        ],
      };
      const { processor } = setup(snapshot(components, data));
      const surface = processor.getSurfaces().get('s')!;
      surface.store.update('/items/1/label', 'Local B');
      processor.replaceMessages(snapshot(components, {
        items: [
          { [key]: 'new', label: 'New', flag: false },
          { [key]: 'b', label: 'B', flag: true },
          { [key]: 'a', label: 'Server A', flag: false },
        ],
      }));
      expect(surface.store.getSignal('/items').value).toEqual([
        { [key]: 'new', label: 'New', flag: false },
        { [key]: 'b', label: 'Local B', flag: true },
        { [key]: 'a', label: 'Server A', flag: false },
      ]);
    },
  );

  test('does not treat literal text equal to an ID as a component reference', () => {
    const descriptions: ComponentInstance[] = [
      { id: 'root', component: 'Column', children: ['label', 'title'] },
      {
        id: 'label',
        component: 'Text',
        text: 'title',
        '@metadata': { extensions: { target: 'title' } },
      },
      { id: 'title', component: 'Text', text: 'Before' },
    ];
    const { processor, updates } = setup(snapshot(descriptions));
    processor.replaceMessages(snapshot([
      descriptions[0]!,
      descriptions[1]!,
      { id: 'title', component: 'Text', text: 'After' },
    ]));
    const changes = updates.mock.calls[0]?.[0] as {
      updates: ComponentInstance[];
    };
    expect(changes.updates.map(component => component.id)).toEqual([
      'root',
      'title',
    ]);
  });

  test('recognizes schema-declared custom child references without scanning literal strings', () => {
    const descriptions: ComponentInstance[] = [
      { id: 'root', component: 'Container', slot: 'title', literal: 'title' },
      { id: 'label', component: 'Container', literal: 'title' },
      { id: 'title', component: 'Text', text: 'Before' },
    ];
    const { processor, updates } = setup();
    processor.registerCatalog(
      'test',
      {
        components: [{
          name: 'Container',
          component: () => null,
          schema: {
            type: 'object',
            properties: {
              slot: {
                anyOf: [
                  { $ref: 'common_types.json#/$defs/ComponentId' },
                  { type: 'null' },
                ],
              },
              literal: { type: 'string' },
            },
          },
        }],
        functions: [],
      } satisfies Catalog,
    );
    processor.replaceMessages(snapshot(descriptions));
    updates.mockClear();
    processor.replaceMessages(snapshot([
      descriptions[0]!,
      descriptions[1]!,
      { id: 'title', component: 'Text', text: 'After' },
    ]));
    const changes = updates.mock.calls[0]?.[0] as {
      updates: ComponentInstance[];
    };
    expect(changes.updates.map(component => component.id)).toEqual([
      'root',
      'title',
    ]);
  });
});
