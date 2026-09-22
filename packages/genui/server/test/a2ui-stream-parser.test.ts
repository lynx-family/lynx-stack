// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core';

import { A2UIProtocolMessageStreamParser } from '../agent/a2ui/a2ui-stream-parser.js';
import type { A2UIMessage } from '../agent/a2ui/a2ui-validator.js';

const create = {
  version: 'v0.9',
  createSurface: { surfaceId: 's', catalogId: 'test' },
};
const root = { id: 'root', component: 'Column', children: ['title'] };
const title = {
  id: 'title',
  component: 'Text',
  text: 'Hello \\"世界\\" [ { } ]',
};
const update = (components: unknown[], surfaceId = 's') => ({
  version: 'v0.9',
  updateComponents: { surfaceId, components },
});

function components(messages: A2UIMessage[]) {
  return messages.flatMap((message) =>
    'updateComponents' in message ? message.updateComponents.components : []
  );
}

function latest(messages: A2UIMessage[]) {
  return Object.fromEntries(
    components(messages).map((component) => [component.id, component]),
  );
}

describe('A2UI incremental parsing', () => {
  test('renders a complete snapshot without automatic loading placeholders', () => {
    const parser = new A2UIProtocolMessageStreamParser();
    expect(parser.push(JSON.stringify([create, update([root, title])])))
      .toEqual([create, update([root, title])]);
  });

  test('waits for the entire batch before filling gaps across component and data messages', () => {
    const parser = new A2UIProtocolMessageStreamParser();
    const data = {
      version: 'v0.9',
      updateDataModel: { surfaceId: 's', value: { title: 'Hello' } },
    };
    const source = [create, update([root]), data, update([title])];
    expect(parser.push(JSON.stringify(source))).toEqual(source);
  });

  test('includes the real root in the first component update for a child-first complete batch', () => {
    const parser = new A2UIProtocolMessageStreamParser();
    expect(
      parser.push(JSON.stringify([create, update([title]), update([root])])),
    )
      .toEqual([create, update([title, root])]);
  });

  test('establishes a root placeholder before children when the real root is still missing', () => {
    const parser = new A2UIProtocolMessageStreamParser();
    expect(parser.push(JSON.stringify([create, update([title])]))).toEqual([
      create,
      update([{ id: 'root', component: 'Loading', variant: 'block' }]),
      update([title]),
    ]);
    expect(parser.push(JSON.stringify([update([root])]))).toEqual([
      update([root]),
    ]);
  });

  test('fills only remaining gaps and replaces them without resending ready components', () => {
    const parser = new A2UIProtocolMessageStreamParser();
    expect(components(parser.push(JSON.stringify([create])))).toEqual([{
      id: 'root',
      component: 'Loading',
      variant: 'block',
    }]);
    expect(parser.push(' ')).toEqual([]);
    const withMissingChild = parser.push(JSON.stringify([update([root])]));
    expect(components(withMissingChild)).toEqual([
      root,
      { id: 'title', component: 'Loading', variant: 'block' },
    ]);
    expect(parser.push(JSON.stringify([update([root])]))).toEqual([]);
    expect(parser.push(JSON.stringify([update([title])]))).toEqual([
      update([title]),
    ]);
  });

  test('does not fill a child removed by a later update in the same batch', () => {
    const parser = new A2UIProtocolMessageStreamParser();
    const source = [
      create,
      update([root]),
      update([{ ...root, children: [] }]),
    ];
    expect(parser.push(JSON.stringify(source))).toEqual(source);
  });

  test('preserves visible content when a later snapshot repeats createSurface', () => {
    const parser = new A2UIProtocolMessageStreamParser();
    parser.push(JSON.stringify([create, update([root, title])]));
    expect(parser.push(JSON.stringify([create]))).toEqual([create]);
    const changedTitle = { ...title, text: 'Updated' };
    expect(parser.push(JSON.stringify([update([root, changedTitle])]))).toEqual(
      [
        update([changedTitle]),
      ],
    );
  });

  test('does not overwrite existing children referenced by an action-only patch', () => {
    const parser = new A2UIProtocolMessageStreamParser();
    expect(parser.push(JSON.stringify([update([root])]))).toEqual([
      update([root]),
    ]);
  });

  test('retains intentional loading and unavailable-image placeholders', () => {
    const parser = new A2UIProtocolMessageStreamParser();
    const parent = { ...root, children: ['pending', 'image'] };
    const pending = { id: 'pending', component: 'Loading', variant: 'inline' };
    const image = { id: 'image', component: 'Image', url: '' };
    expect(
      parser.push(JSON.stringify([create, update([parent, pending, image])])),
    )
      .toEqual([
        create,
        update([parent, pending, {
          id: 'image',
          component: 'Loading',
          variant: 'block',
        }]),
      ]);
  });

  test('does not publish loading for a surface deleted in the same batch', () => {
    const parser = new A2UIProtocolMessageStreamParser();
    const source = [create, {
      version: 'v0.9',
      deleteSurface: { surfaceId: 's' },
    }];
    expect(parser.push(JSON.stringify(source))).toEqual(source);
  });

  test.each([1, 2, 7, 64, 8192])(
    'handles escaped strings with %i character chunks',
    (size) => {
      const parser = new A2UIProtocolMessageStreamParser();
      const source = '```json\n'
        + JSON.stringify([create, update([root, title])]) + '\n```';
      const messages: A2UIMessage[] = [];
      for (let i = 0; i < source.length; i += size) {
        messages.push(
          ...parser.push(source.slice(i, i + size)),
        );
      }
      expect(latest(messages)).toMatchObject({ root, title });
      expect(messages.filter((message) => 'createSurface' in message))
        .toHaveLength(1);
    },
  );

  test('renders a complete component before its message ends without resending its parent', () => {
    const parser = new A2UIProtocolMessageStreamParser();
    parser.push(JSON.stringify([create]));
    const first = parser.push(
      '[{"version":"v0.9","updateComponents":{"surfaceId":"s","components":['
        + JSON.stringify(root),
    );
    expect(components(first)).toEqual([root, {
      id: 'title',
      component: 'Loading',
      variant: 'block',
    }]);
    const second = parser.push(',' + JSON.stringify(title));
    expect(components(second)).toEqual([title]);
    expect(parser.push(']}}]')).toEqual([]);
  });

  test('does not parse component-shaped data or nested component props as protocol updates', () => {
    const parser = new A2UIProtocolMessageStreamParser();
    const data = {
      version: 'v0.9',
      updateDataModel: { surfaceId: 's', value: { components: [title] } },
    };
    const decorated = {
      ...root,
      metadata: { id: 'fake', component: 'Text', text: 'not UI' },
    };
    const messages = parser.push(
      JSON.stringify([create, update([decorated]), data]),
    );
    expect(
      components(messages).some((component) =>
        component.id === 'fake'
        || component.id === 'title' && component.component === 'Text'
      ),
    ).toBe(false);
    expect(messages.slice(0, 3)).toEqual([create, update([decorated]), data]);
    expect(components(messages).at(-1)).toEqual({
      id: 'title',
      component: 'Loading',
      variant: 'block',
    });
  });

  test('supports reordered keys and never uses a previous message surface id', () => {
    const parser = new A2UIProtocolMessageStreamParser();
    parser.push(
      JSON.stringify([
        update(
          [{ id: 'root', component: 'Text', text: 'previous' }],
          'previous',
        ),
      ]),
    );
    const messages = parser.push(
      JSON.stringify([{
        updateComponents: { components: [title], surfaceId: 'next' },
        version: 'v0.9',
      }]),
    );
    expect(messages).toEqual([update([title], 'next')]);
  });

  test('preserves data update order and streams independently resumed arrays', () => {
    const parser = new A2UIProtocolMessageStreamParser();
    parser.push(JSON.stringify([create, update([root, title])]));
    const data = {
      version: 'v0.9',
      updateDataModel: { surfaceId: 's', value: { title: 'New title' } },
    };
    const boundTitle = { ...title, text: { path: '/title' } };
    const result = parser.push(JSON.stringify([data, update([boundTitle])]));
    expect(result).toEqual([data, update([boundTitle])]);
    expect(parser.push(JSON.stringify([update([boundTitle])]))).toEqual([]);
  });

  test('clears component state when a surface is deleted and recreated', () => {
    const parser = new A2UIProtocolMessageStreamParser();
    parser.push(JSON.stringify([create, update([root, title])]));
    const result = parser.push(JSON.stringify([
      { version: 'v0.9', deleteSurface: { surfaceId: 's' } },
      create,
      update([root]),
    ]));
    expect(latest(result).title).toEqual({
      id: 'title',
      component: 'Loading',
      variant: 'block',
    });
    expect(components(parser.push(JSON.stringify([update([title])])))).toEqual([
      title,
    ]);
  });

  test('emits newly reachable descendants and handles cyclic references', () => {
    const parser = new A2UIProtocolMessageStreamParser();
    parser.push(JSON.stringify([create, update([{ ...root, children: [] }])]));
    expect(parser.push(JSON.stringify([update([title])]))).toEqual([]);
    expect(latest(parser.push(JSON.stringify([update([root])])))).toMatchObject(
      { root, title },
    );
    expect(() =>
      parser.push(
        JSON.stringify([update([{ ...root, children: ['root', 'title'] }])]),
      )
    ).not.toThrow();
  });
});
