// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, rstest, test } from '@rstest/core';

import { defineCatalog } from '../src/catalog/defineCatalog.js';
import { MessageProcessor } from '../src/store/MessageProcessor.js';
import type {
  ComponentInstance,
  ServerToClientMessage,
} from '../src/store/types.js';

function setup(components: ComponentInstance[], dataModel?: unknown) {
  const processor = new MessageProcessor();
  const events: Record<string, unknown>[] = [];
  processor.onEvent(({ message, resolve }) => {
    events.push(message);
    resolve([]);
  });
  processor.processMessages([{
    version: '1.0',
    createSurface: {
      surfaceId: 's',
      components,
      ...(dataModel === undefined
        ? {}
        : { dataModel: dataModel as Record<string, unknown> }),
    },
  }]);
  const updates: string[][] = [];
  processor.onUpdate(event => {
    if (event['type'] === 'surfaceUpdate') {
      updates.push(
        (event['updates'] as ComponentInstance[]).map(item => item.id),
      );
    }
  });
  const surface = processor.getSurfaces().get('s')!;
  return { processor, surface, updates, events };
}
const components = (...items: ComponentInstance[]): ServerToClientMessage => ({
  version: '1.0',
  updateComponents: { surfaceId: 's', components: items },
});
const data = (path: string, value: unknown): ServerToClientMessage => ({
  version: '1.0',
  updateDataModel: { surfaceId: 's', path, value },
});

function items(count: number): Array<{ name: string }> {
  return Array.from({ length: count }, (_, index) => ({ name: `n${index}` }));
}

describe('MessageProcessor component updates', () => {
  const tree: ComponentInstance[] = [
    { id: 'root', component: 'Column', children: ['title', 'later'] },
    { id: 'title', component: 'Text', text: 'Hello' },
  ];

  test('ignores a definition that is resent unchanged', () => {
    const { processor, surface, updates } = setup(tree);
    const title = surface.components.get('title');
    processor.processMessages([
      components({ id: 'title', component: 'Text', text: 'Hello' }),
      components(...tree),
    ]);
    expect(updates).toEqual([]);
    expect(surface.components.get('title')).toBe(title);
  });

  test('announces only what changed, as new instances', () => {
    const { processor, surface, updates } = setup(tree);
    const root = surface.components.get('root');
    const title = surface.components.get('title');
    processor.processMessages([
      components(tree[0]!, { id: 'title', component: 'Text', text: 'Bye' }),
    ]);
    expect(updates).toEqual([['title']]);
    expect(surface.components.get('root')).toBe(root);
    expect(surface.components.get('title')).not.toBe(title);
  });

  test('announces the parents of a component that arrives after them', () => {
    const { processor, updates } = setup(tree);
    processor.processMessages([
      components({ id: 'later', component: 'Text', text: 'Late' }),
    ]);
    expect(updates).toEqual([['later', 'root']]);
    processor.processMessages([
      components({ id: 'later', component: 'Text', text: 'Changed' }),
    ]);
    expect(updates[1]).toEqual(['later']);
    processor.processMessages([
      components({
        id: 'later',
        component: 'Text',
        text: 'Changed',
        weight: 2,
      }),
    ]);
    expect(updates[2]).toEqual(['later', 'root']);
  });

  test('announces components whose child slot is bound when membership changes', () => {
    const { processor, updates } = setup([
      { id: 'root', component: 'Column', children: ['card'] },
      { id: 'card', component: 'Card', child: { '@path': '/selected' } },
    ], { selected: 'leaf' });
    processor.processMessages([
      components({ id: 'leaf', component: 'Text', text: 'Leaf' }),
    ]);
    expect(updates).toEqual([['leaf', 'card']]);
  });

  test('keeps applying messages after one it cannot apply', () => {
    const errors = rstest.spyOn(console, 'warn').mockImplementation(() =>
      undefined
    );
    try {
      const { processor, surface, events } = setup(tree);
      processor.processMessages([
        { version: '1.0', updateComponents: { surfaceId: 's' } },
        { version: '1.0', createSurface: 'broken' },
        components({ id: 'title', component: 'Text', text: 'Still applied' }),
      ] as unknown as ServerToClientMessage[]);
      expect(surface.components.get('title')).toMatchObject({
        text: 'Still applied',
      });
      expect(events).toEqual([{
        version: '1.0',
        error: {
          code: 'VALIDATION_FAILED',
          surfaceId: 's',
          path: '/updateComponents/components',
          message: 'Malformed message',
        },
      }]);
    } finally {
      errors.mockRestore();
    }
  });
});

describe('MessageProcessor templates', () => {
  const list: ComponentInstance[] = [
    {
      id: 'root',
      component: 'Column',
      children: { componentId: 'row', path: '/items' },
    },
    { id: 'row', component: 'Card', child: 'label' },
    { id: 'label', component: 'Text', text: { '@path': 'name' } },
    { id: 'other', component: 'Text', text: { '@path': '/other' } },
  ];

  test('does not rebuild instances for unrelated data or components', () => {
    const { processor, surface, updates } = setup(list, { items: items(3) });
    const instance = surface.components.get('row:1');
    processor.processMessages([
      data('/other', 'x'),
      data('/items/1/name', 'renamed'),
      components({ id: 'other', component: 'Text', text: 'static' }),
    ]);
    expect(updates).toEqual([['other']]);
    expect(surface.components.get('row:1')).toBe(instance);
  });

  test('adds instances for new items and keeps the existing ones', () => {
    const { processor, surface, updates } = setup(list, { items: items(1) });
    const first = surface.components.get('row:0');
    processor.processMessages([data('/items/1', { name: 'second' })]);
    expect(updates).toEqual([['root', 'row:1', 'label:1']]);
    expect(surface.components.get('row:0')).toBe(first);
    expect(surface.components.get('root')).toMatchObject({
      children: ['row:0', 'row:1'],
    });
  });

  test('removes the instances and resources of items that are gone', () => {
    const { processor, surface } = setup(list, { items: items(3) });
    processor.processMessages([data('/items', items(1))]);
    expect([...surface.components.keys()]).toEqual([
      'root',
      'row',
      'label',
      'other',
      'row:0',
      'label:0',
    ]);
    expect([...surface.resources.keys()].sort()).toEqual(
      [...surface.components.keys()].sort(),
    );
    processor.processMessages([
      components({ id: 'root', component: 'Column', children: ['other'] }),
    ]);
    expect([...surface.components.keys()]).toEqual([
      'root',
      'row',
      'label',
      'other',
    ]);
  });

  test('updates every instance when the template subtree changes', () => {
    const { processor, surface, updates } = setup(list, { items: items(2) });
    processor.processMessages([
      components({
        id: 'label',
        component: 'Text',
        text: { '@path': 'title' },
      }),
    ]);
    expect(updates).toEqual([['label'], ['label:0', 'label:1']]);
    expect(surface.components.get('label:1')).toMatchObject({
      text: { '@path': 'title' },
      dataContextPath: '/items/1',
    });
  });

  test('instantiates a template whose subtree arrives later', () => {
    const { processor, surface, updates } = setup([list[0]!], {
      items: items(2),
    });
    expect(surface.components.get('root')).toMatchObject({ children: [] });
    processor.processMessages([components(list[1]!)]);
    expect(surface.components.get('row:0')).toMatchObject({ child: 'label' });
    processor.processMessages([components(list[2]!)]);
    expect(surface.components.get('row:0')).toMatchObject({ child: 'label:0' });
    expect(updates[updates.length - 1]).toEqual([
      'row:0',
      'label:0',
      'row:1',
      'label:1',
    ]);
  });

  test('expands nested templates inside each item', () => {
    const { processor, surface } = setup([
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
    ], { groups: [{ items: [{}, {}] }, { items: [{}] }] });
    expect(surface.components.get('group:0')).toMatchObject({
      dataContextPath: '/groups/0',
      children: ['leaf:0:0', 'leaf:0:1'],
      __template: { componentId: 'leaf', path: '/groups/0/items' },
    });
    expect(surface.components.get('leaf:1:0')).toMatchObject({
      dataContextPath: '/groups/1/items/0',
    });
    processor.processMessages([data('/groups/1/items/1', {})]);
    expect(surface.components.get('group:1')).toMatchObject({
      children: ['leaf:1:0', 'leaf:1:1'],
    });
    processor.processMessages([data('/groups/0', null)]);
    expect([...surface.components.keys()].filter(id => id.includes(':')))
      .toEqual(['group:0', 'leaf:0:0', 'leaf:0:1']);
  });

  test('stops at a template subtree that refers back to itself', () => {
    const { surface } = setup([
      {
        id: 'root',
        component: 'Column',
        children: { componentId: 'a', path: '/items' },
      },
      { id: 'a', component: 'Card', child: 'b' },
      { id: 'b', component: 'Card', child: 'a' },
    ], { items: items(1) });
    expect(surface.components.get('a:0')).toMatchObject({ child: 'b:0' });
    expect(surface.components.get('b:0')).toMatchObject({ child: 'a:0' });
  });
});

describe('MessageProcessor catalogs and errors', () => {
  test('resolves an omitted catalog only when a default is registered', () => {
    const catalog = defineCatalog([]);
    const bare = new MessageProcessor();
    bare.registerCatalog('one', catalog);
    expect(bare.getCatalog(undefined)).toBeUndefined();
    const withDefault = new MessageProcessor();
    withDefault.registerCatalog('one', catalog, { default: true });
    expect(withDefault.getCatalog(undefined)).toBe(catalog);
    expect(withDefault.getCatalog('two')).toBeUndefined();
  });

  test('reports the same expression error once per agent update', () => {
    const { processor, events } = setup([
      { id: 'root', component: 'Text', text: 'x' },
    ]);
    const failure = () => new Error('Unknown dynamic directive: @x');
    processor.reportExpressionError(failure(), 's');
    processor.reportExpressionError(failure(), 's');
    processor.reportExpressionError(new Error('Another'), 's');
    expect(events).toHaveLength(2);
    processor.reportExpressionError(failure(), 's', 'EXECUTION_ERROR');
    expect(events).toHaveLength(3);
    processor.processMessages([data('/x', 1)]);
    processor.reportExpressionError(failure(), 's');
    expect(events).toHaveLength(4);
  });
});
