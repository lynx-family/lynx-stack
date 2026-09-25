// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import {
  compactA2UIMessagesToSnapshot,
  generateReactLynxA2UIWrapperSource,
  generateReactLynx3A2UIWrapperSource,
} from '../src/snapshot/index.js';
import type { ServerToClientMessage } from '../src/store/types.js';

type SnapshotResult = ReturnType<typeof compactA2UIMessagesToSnapshot>;
type SnapshotComponent = Record<string, unknown> & {
  id?: string;
  dataContextPath?: string;
};

interface ComponentUpdate {
  components: SnapshotComponent[];
}

interface DataUpdate {
  path?: string;
  value?: unknown;
}

interface DataMessage {
  updateDataModel: DataUpdate;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getComponentUpdate(
  message: ServerToClientMessage,
): ComponentUpdate | null {
  const updateComponents =
    (message as { updateComponents?: unknown }).updateComponents;
  if (!isRecord(updateComponents)) return null;

  const rawComponents = updateComponents['components'];
  if (!Array.isArray(rawComponents)) return null;

  const components: SnapshotComponent[] = [];
  for (const rawComponent of rawComponents) {
    if (isRecord(rawComponent)) components.push(rawComponent);
  }
  return { components };
}

function getDataUpdate(message: ServerToClientMessage): DataUpdate | null {
  const updateDataModel =
    (message as { updateDataModel?: unknown }).updateDataModel;
  if (!isRecord(updateDataModel)) return null;

  const path = updateDataModel['path'];
  return {
    ...(typeof path === 'string' ? { path } : {}),
    value: updateDataModel['value'],
  };
}

function componentMessages(
  result: SnapshotResult,
): ComponentUpdate[] {
  const out: ComponentUpdate[] = [];
  for (const message of result.messages) {
    const update = getComponentUpdate(message);
    if (update) out.push(update);
  }
  return out;
}

function components(result: SnapshotResult): SnapshotComponent[] {
  const out: SnapshotComponent[] = [];
  for (const update of componentMessages(result)) {
    out.push(...update.components);
  }
  return out;
}

function componentIds(
  result: SnapshotResult,
) {
  return components(result).map(component => component.id);
}

function dataMessages(
  result: SnapshotResult,
): DataMessage[] {
  const out: DataMessage[] = [];
  for (const message of result.messages) {
    const updateDataModel = getDataUpdate(message);
    if (updateDataModel) out.push({ updateDataModel });
  }
  return out;
}

function dataPaths(result: SnapshotResult): string[] {
  const out: string[] = [];
  for (const message of dataMessages(result)) {
    const { path } = message.updateDataModel;
    out.push(typeof path === 'string' ? path : '/');
  }
  return out;
}

function dataValues(result: SnapshotResult): unknown[] {
  const out: unknown[] = [];
  for (const message of dataMessages(result)) {
    out.push(message.updateDataModel.value);
  }
  return out;
}

describe('compactA2UIMessagesToSnapshot', () => {
  test('drops components removed from the final reachable tree', () => {
    const result = compactA2UIMessagesToSnapshot([
      {
        version: 'v0.9',
        createSurface: { surfaceId: 's1', catalogId: 'test' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's1',
          components: [
            {
              id: 'root',
              component: 'Column',
              children: ['keep', 'remove-me'],
            },
            { id: 'keep', component: 'Text', text: { path: '/title' } },
            {
              id: 'remove-me',
              component: 'Text',
              text: { path: '/unused' },
            },
          ],
        },
      },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: 's1',
          value: { title: 'Visible', unused: 'Gone' },
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's1',
          components: [
            { id: 'root', component: 'Column', children: ['keep'] },
          ],
        },
      },
    ] as ServerToClientMessage[]);

    expect(componentIds(result)).toEqual(['root', 'keep']);
    expect(dataPaths(result)).toEqual(['/title']);
    expect(result.metadata).toMatchObject({
      originalMessageCount: 4,
      compactedMessageCount: 3,
      activeSurfaceCount: 1,
      retainedComponentCount: 2,
      droppedComponentCount: 1,
      retainedDataPathCount: 1,
      surfaces: [
        {
          surfaceId: 's1',
          componentCount: 2,
          droppedComponentCount: 1,
          dataPathCount: 1,
          hasRoot: true,
        },
      ],
    });
  });

  test('keeps the final replacement for an updated component', () => {
    const result = compactA2UIMessagesToSnapshot([
      {
        version: 'v0.9',
        createSurface: { surfaceId: 's1', catalogId: 'test' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's1',
          components: [
            { id: 'root', component: 'Text', text: 'First' },
          ],
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's1',
          components: [
            { id: 'root', component: 'Text', text: 'Final' },
          ],
        },
      },
    ] as ServerToClientMessage[]);

    expect(components(result)).toEqual([
      { id: 'root', component: 'Text', text: 'Final' },
    ]);
  });

  test('preserves createSurface metadata and omits passthrough fields', () => {
    const result = compactA2UIMessagesToSnapshot([
      {
        version: 'v0.9',
        createSurface: {
          surfaceId: 's1',
          catalogId: 'test',
          theme: { color: 'blue' },
          sendDataModel: true,
          passthrough: 'drop',
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's1',
          components: [{ id: 'root', component: 'Text', text: 'Ready' }],
        },
      },
    ] as ServerToClientMessage[]);

    expect(result.messages[0]).toEqual({
      version: 'v0.9',
      createSurface: {
        surfaceId: 's1',
        catalogId: 'test',
        theme: { color: 'blue' },
        sendDataModel: true,
      },
    });
  });

  test('omits deleted surfaces', () => {
    const result = compactA2UIMessagesToSnapshot([
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'gone', catalogId: 'test' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'gone',
          components: [{ id: 'root', component: 'Text', text: 'Gone' }],
        },
      },
      {
        version: 'v0.9',
        deleteSurface: { surfaceId: 'gone' },
      },
    ] as ServerToClientMessage[]);

    expect(result.messages).toEqual([]);
    expect(result.metadata.activeSurfaceCount).toBe(0);
  });

  test('serializes final dynamic children with data contexts', () => {
    const result = compactA2UIMessagesToSnapshot([
      {
        version: 'v0.9',
        createSurface: { surfaceId: 's1', catalogId: 'test' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's1',
          components: [
            {
              id: 'root',
              component: 'Column',
              children: { componentId: 'item', path: '/items' },
            },
            { id: 'item', component: 'Text', text: { path: 'name' } },
          ],
        },
      },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: 's1',
          value: { items: [{ name: 'Apple' }, { name: 'Banana' }] },
        },
      },
    ] as ServerToClientMessage[]);

    const nextComponents = components(result);
    expect(nextComponents).toEqual([
      {
        id: 'root',
        component: 'Column',
        children: ['item:0', 'item:1'],
      },
      {
        id: 'item:0',
        component: 'Text',
        text: { path: 'name' },
        dataContextPath: '/items/0',
      },
      {
        id: 'item:1',
        component: 'Text',
        text: { path: 'name' },
        dataContextPath: '/items/1',
      },
    ]);
    expect(
      nextComponents.some(component => '__template' in component),
    ).toBe(false);
    expect(dataPaths(result)).toEqual(['/items/0/name', '/items/1/name']);
  });

  test('normalizes root-bound dynamic children data contexts', () => {
    const result = compactA2UIMessagesToSnapshot([
      {
        version: 'v0.9',
        createSurface: { surfaceId: 's1', catalogId: 'test' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's1',
          components: [
            {
              id: 'root',
              component: 'Column',
              children: { componentId: 'item', path: '/' },
            },
            { id: 'item', component: 'Text', text: { path: 'name' } },
          ],
        },
      },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: 's1',
          value: [{ name: 'Alpha' }, { name: 'Beta' }],
        },
      },
    ] as ServerToClientMessage[]);

    expect(components(result)).toEqual([
      {
        id: 'root',
        component: 'Column',
        children: ['item:0', 'item:1'],
      },
      {
        id: 'item:0',
        component: 'Text',
        text: { path: 'name' },
        dataContextPath: '/0',
      },
      {
        id: 'item:1',
        component: 'Text',
        text: { path: 'name' },
        dataContextPath: '/1',
      },
    ]);
    expect(dataPaths(result)).toEqual(['/0/name', '/1/name']);
  });

  test('drops stale dynamic children when the final data is empty', () => {
    const result = compactA2UIMessagesToSnapshot([
      {
        version: 'v0.9',
        createSurface: { surfaceId: 's1', catalogId: 'test' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's1',
          components: [
            {
              id: 'root',
              component: 'Column',
              children: { componentId: 'item', path: '/items' },
            },
            { id: 'item', component: 'Text', text: { path: 'name' } },
          ],
        },
      },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: 's1',
          value: { items: [{ name: 'Apple' }, { name: 'Banana' }] },
        },
      },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: 's1',
          path: '/items',
          value: [],
        },
      },
    ] as ServerToClientMessage[]);

    expect(components(result)).toEqual([
      { id: 'root', component: 'Column', children: [] },
    ]);
    expect(componentIds(result)).not.toContain('item:0');
    expect(componentIds(result)).not.toContain('item:1');
    expect(dataPaths(result)).toEqual([]);
  });

  test('resolves dot-relative bindings against generated data contexts', () => {
    const result = compactA2UIMessagesToSnapshot([
      {
        version: 'v0.9',
        createSurface: { surfaceId: 's1', catalogId: 'test' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's1',
          components: [
            {
              id: 'root',
              component: 'Column',
              children: { componentId: 'item', path: '/items' },
            },
            { id: 'item', component: 'Text', text: { path: './name' } },
          ],
        },
      },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: 's1',
          value: { items: [{ name: 'Apple' }] },
        },
      },
    ] as ServerToClientMessage[]);

    expect(dataPaths(result)).toEqual(['/items/0/name']);
    expect(dataValues(result)).toEqual(['Apple']);
  });

  test('keeps a generated component data context when it is replaced', () => {
    const result = compactA2UIMessagesToSnapshot([
      {
        version: 'v0.9',
        createSurface: { surfaceId: 's1', catalogId: 'test' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's1',
          components: [
            {
              id: 'root',
              component: 'Column',
              children: { componentId: 'item', path: '/items' },
            },
            { id: 'item', component: 'Text', text: { path: 'name' } },
          ],
        },
      },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: 's1',
          value: { items: [{ name: 'Apple' }] },
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's1',
          components: [
            {
              id: 'item:0',
              component: 'Text',
              text: { path: 'name' },
              color: 'green',
            },
          ],
        },
      },
    ] as ServerToClientMessage[]);

    expect(components(result)).toEqual([
      {
        id: 'root',
        component: 'Column',
        children: ['item:0'],
      },
      {
        id: 'item:0',
        component: 'Text',
        text: { path: 'name' },
        color: 'green',
        dataContextPath: '/items/0',
      },
    ]);
    expect(dataPaths(result)).toEqual(['/items/0/name']);
  });

  test('retains data paths referenced by actions, checks, and function args', () => {
    const result = compactA2UIMessagesToSnapshot([
      {
        version: 'v0.9',
        createSurface: { surfaceId: 's1', catalogId: 'test' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's1',
          components: [
            { id: 'root', component: 'Column', children: ['button'] },
            {
              id: 'button',
              component: 'Button',
              child: 'label',
              action: {
                event: {
                  name: 'buy',
                  context: { productId: { path: '/product/id' } },
                },
              },
              checks: [{ condition: { path: '/product/valid' } }],
              isValid: {
                call: 'isPositive',
                args: { value: { path: '/product/count' } },
              },
            },
            { id: 'label', component: 'Text', text: 'Buy' },
            { id: 'unused', component: 'Text', text: { path: '/unused' } },
          ],
        },
      },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: 's1',
          value: {
            product: { id: 'sku-1', valid: true, count: 3 },
            unused: 'drop',
          },
        },
      },
    ] as ServerToClientMessage[]);

    expect(dataPaths(result)).toEqual([
      '/product/count',
      '/product/id',
      '/product/valid',
    ]);
    expect(componentIds(result)).not.toContain('unused');
  });

  test('retains custom child references on unknown components', () => {
    const result = compactA2UIMessagesToSnapshot([
      {
        version: 'v0.9',
        createSurface: { surfaceId: 's1', catalogId: 'test' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's1',
          components: [
            {
              id: 'root',
              component: 'CustomShell',
              slots: { main: 'custom-child' },
            },
            {
              id: 'custom-child',
              component: 'Text',
              text: { path: '/title' },
            },
            {
              id: 'orphan',
              component: 'Text',
              text: { path: '/unused' },
            },
          ],
        },
      },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: 's1',
          value: { title: 'Visible', unused: 'Gone' },
        },
      },
    ] as ServerToClientMessage[]);

    expect(componentIds(result)).toEqual(['root', 'custom-child']);
    expect(dataPaths(result)).toEqual(['/title']);
  });

  test('is stable when compacting compacted messages again', () => {
    const result = compactA2UIMessagesToSnapshot([
      {
        version: 'v0.9',
        createSurface: { surfaceId: 's1', catalogId: 'test' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's1',
          components: [
            {
              id: 'root',
              component: 'Column',
              children: ['keep', 'remove-me'],
            },
            { id: 'keep', component: 'Text', text: { path: '/title' } },
            { id: 'remove-me', component: 'Text', text: 'drop' },
          ],
        },
      },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: 's1',
          value: { title: 'Stable' },
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's1',
          components: [
            { id: 'root', component: 'Column', children: ['keep'] },
          ],
        },
      },
    ] as ServerToClientMessage[]);

    const next = compactA2UIMessagesToSnapshot(result.messages);
    expect(next.messages).toEqual(result.messages);
  });
});

describe('generateReactLynxA2UIWrapperSource', () => {
  const messages = [
    {
      version: 'v0.9',
      createSurface: { surfaceId: 'main', catalogId: 'test' },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'main',
        components: [
          {
            id: 'root',
            component: 'Column',
            children: ['title', 'stale'],
          },
          { id: 'title', component: 'Text', text: 'Generated final' },
          { id: 'stale', component: 'Text', text: 'Stale copy' },
        ],
      },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'main',
        components: [
          {
            id: 'root',
            component: 'Column',
            children: ['title'],
          },
        ],
      },
    },
  ] as ServerToClientMessage[];

  test('generates a ReactLynx TSX wrapper around compacted messages', () => {
    const source = generateReactLynxA2UIWrapperSource(messages, {
      componentName: 'GeneratedApp',
    });

    expect(source).toContain(
      'import { useMemo } from \'@lynx-js/react\';',
    );
    expect(source).toContain(
      'from "@lynx-js/genui/a2ui";',
    );
    expect(source).toContain('export function GeneratedApp(');
    expect(source).toContain('createMessageStore({');
    expect(source).toContain('initialMessages: generatedA2UIMessages');
    expect(source).toContain('<A2UI');
    expect(source).toContain('withManifest(Text as CatalogComponent');
    expect(source).toContain('Generated final');
    expect(source).not.toContain('Stale copy');
  });

  test('can preserve the raw stream and omit the theme import', () => {
    const source = generateReactLynxA2UIWrapperSource(messages, {
      compact: false,
      includeThemeImport: false,
      rootClassName: 'custom-root',
      surfaceClassName: 'custom-surface',
      surfaceWrapperClassName: 'custom-shell',
    });

    expect(source).toContain('Stale copy');
    expect(source).not.toContain('/styles/theme.css');
    expect(source).toContain('<view className="custom-root">');
    expect(source).toContain('className="custom-surface"');
    expect(source).toContain('<view className="custom-shell">');
  });

  test('rejects invalid generated component names', () => {
    expect(() =>
      generateReactLynxA2UIWrapperSource(messages, {
        componentName: 'bad-name',
      })
    ).toThrowError(/Invalid ReactLynx component name/u);
  });

  test('exposes a ReactLynx3 alias', () => {
    expect(generateReactLynx3A2UIWrapperSource).toBe(
      generateReactLynxA2UIWrapperSource,
    );
  });
});
