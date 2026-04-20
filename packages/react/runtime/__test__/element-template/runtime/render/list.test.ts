import { beforeEach, describe, expect, it } from 'vitest';

import { setupPage } from '../../../../src/element-template/runtime/page/page.js';
import {
  createElementTemplateListCellRef,
  createElementTemplateListWithHandle,
  ELEMENT_TEMPLATE_ATTRIBUTES_OPTION,
  ELEMENT_TEMPLATE_LIST_OPTION,
  splitListItemAttributeSlots,
} from '../../../../src/element-template/runtime/render/list.js';
import { resetTemplateId } from '../../../../src/element-template/runtime/template/handle.js';
import { ElementTemplateRegistry } from '../../../../src/element-template/runtime/template/registry.js';
import { installMockNativePapi, lastMock } from '../../test-utils/mock/mockNativePapi.js';

describe('element-template list helpers', () => {
  function createNativeListCellRef(id: number): ElementRef {
    return {
      tag: 'list-item',
      attributes: {},
      children: [],
      __mockNativeId: id,
    } as unknown as ElementRef;
  }

  beforeEach(() => {
    installMockNativePapi();
    setupPage({ type: 'page', children: [] } as unknown as FiberElement);
    ElementTemplateRegistry.clear();
    resetTemplateId();
  });

  it('splits list-item platform info from template attribute slots', () => {
    expect(splitListItemAttributeSlots('plain-value' as unknown as SerializableValue[])).toEqual({
      templateAttributeSlots: 'plain-value',
      platformInfo: null,
    });

    expect(
      splitListItemAttributeSlots([
        {
          'item-key': 'Ada',
          'estimated-height': 88,
          title: 'user-card',
        },
        {
          __spread: true,
          className: 'hero',
          recyclable: true,
        },
        'plain-text',
      ]),
    ).toEqual({
      templateAttributeSlots: [
        {
          title: 'user-card',
        },
        {
          __spread: true,
          className: 'hero',
        },
        'plain-text',
      ],
      platformInfo: {
        'item-key': 'Ada',
        'estimated-height': 88,
        recyclable: true,
      },
    });
  });

  it('applies spread-backed list attributes and lets explicit undefined clear dataset values', () => {
    const list = createElementTemplateListWithHandle(
      '_et_list_root',
      [],
      [
        undefined,
        {
          __spread: true,
          className: 'spread-class',
          'data-scene': 'spread-scene',
          title: 'user-card',
        },
      ],
      {
        [ELEMENT_TEMPLATE_LIST_OPTION]: true,
        [ELEMENT_TEMPLATE_ATTRIBUTES_OPTION]: [
          {
            kind: 'spread',
            binding: 'slot',
            attrSlotIndex: 99,
          },
          {
            kind: 'attribute',
            binding: 'slot',
            key: 'class',
            attrSlotIndex: 1,
          },
          {
            kind: 'attribute',
            binding: 'slot',
            key: 'data-scene',
            attrSlotIndex: 0,
          },
          {
            kind: 'attribute',
            binding: 'static',
            key: 'aria-label',
            value: undefined,
          },
        ],
      },
    ) as unknown as {
      attributes?: Record<string, unknown>;
    };

    expect(list.attributes).toMatchObject({
      class: 'spread-class',
      title: 'user-card',
    });
    expect(list.attributes).not.toHaveProperty('data-scene');
    expect(list.attributes).not.toHaveProperty('aria-label');
  });

  it('reuses list-item platform info from attribute slots when platformInfo is not pre-split', () => {
    const firstCell = createElementTemplateListCellRef(
      createNativeListCellRef(101),
      '_et_cell',
      [
        {
          'item-key': 'Ada',
          'sticky-top': true,
          recyclable: true,
          title: 'ignored-title',
        },
      ],
      null,
    );
    const secondCell = createElementTemplateListCellRef(
      createNativeListCellRef(102),
      '_et_cell',
      null,
      {
        'item-key': 'Linus',
      },
    );

    const list = createElementTemplateListWithHandle(
      '_et_list_root',
      [[firstCell, secondCell]],
      null,
      {
        [ELEMENT_TEMPLATE_LIST_OPTION]: true,
      },
    ) as Record<string, unknown>;

    expect(lastMock?.nativeLog).toContainEqual([
      '__SetAttribute',
      '<list />',
      'update-list-info',
      {
        insertAction: [
          {
            position: 0,
            type: '_et_cell',
            'item-key': 'Ada',
            'sticky-top': true,
            recyclable: true,
          },
          {
            position: 1,
            type: '_et_cell',
            'item-key': 'Linus',
          },
        ],
        removeAction: [],
        updateAction: [],
      },
    ]);

    const componentAtIndex = list['__componentAtIndex'] as (
      listRef: unknown,
      listId: number,
      cellIndex: number,
      operationId: number,
      enableReuseNotification: boolean,
    ) => number;
    expect(typeof componentAtIndex).toBe('function');

    const firstElementId = (__GetElementUniqueID as (node: unknown) => number)(list);
    componentAtIndex(list, firstElementId, 0, 11, false);

    expect(lastMock?.nativeLog).toContainEqual([
      '__SetAttribute',
      '<list-item />',
      'item-key',
      'Ada',
    ]);
    expect(lastMock?.nativeLog).toContainEqual([
      '__SetAttribute',
      '<list-item />',
      'sticky-top',
      true,
    ]);
    expect(lastMock?.nativeLog).not.toContainEqual([
      '__SetAttribute',
      '<list-item />',
      'recyclable',
      true,
    ]);
    expect(lastMock?.nativeLog).not.toContainEqual([
      '__SetAttribute',
      '<list-item />',
      'title',
      'ignored-title',
    ]);
  });

  it('throws when a list callback requests a cell that does not exist', () => {
    const cell = createElementTemplateListCellRef(
      createNativeListCellRef(201),
      '_et_cell',
      null,
      {
        'item-key': 'Ada',
      },
    );
    const list = createElementTemplateListWithHandle(
      '_et_list_root',
      [[cell]],
      null,
      {
        [ELEMENT_TEMPLATE_LIST_OPTION]: true,
      },
    ) as Record<string, unknown>;
    const componentAtIndex = list['__componentAtIndex'] as (
      listRef: unknown,
      listId: number,
      cellIndex: number,
      operationId: number,
      enableReuseNotification: boolean,
    ) => number;
    const listId = (__GetElementUniqueID as (node: unknown) => number)(list);

    expect(() => componentAtIndex(list, listId, 99, 7, false)).toThrow(
      'ElementTemplate list cell not found at index 99.',
    );
  });

  it('rejects list roots whose element slot does not contain wrapped cells', () => {
    expect(() =>
      createElementTemplateListWithHandle(
        '_et_list_root',
        [[createNativeListCellRef(301)]],
        null,
        {
          [ELEMENT_TEMPLATE_LIST_OPTION]: true,
        },
      )
    ).toThrow('ElementTemplate list expected a wrapped cell at index 0.');
  });

  it('uses direct spread slots for attribute reads and leaves missing spread values empty', () => {
    const list = createElementTemplateListWithHandle(
      '_et_list_root',
      [],
      [
        {
          __spread: true,
          title: 'direct-title',
        },
      ],
      {
        [ELEMENT_TEMPLATE_LIST_OPTION]: true,
        [ELEMENT_TEMPLATE_ATTRIBUTES_OPTION]: [
          {
            kind: 'attribute',
            binding: 'slot',
            key: 'title',
            attrSlotIndex: 0,
          },
          {
            kind: 'attribute',
            binding: 'slot',
            key: 'class',
            attrSlotIndex: 2,
          },
        ],
      },
    ) as unknown as {
      attributes?: Record<string, unknown>;
    };

    expect(list.attributes).toMatchObject({
      title: 'direct-title',
      class: '',
    });
  });

  it('handles malformed descriptors and stringifies class/id style values defensively', () => {
    const list = createElementTemplateListWithHandle(
      '_et_list_root',
      [],
      [
        {
          __spread: true,
          role: 'feed',
        },
        {
          color: 'red',
        },
      ],
      {
        [ELEMENT_TEMPLATE_LIST_OPTION]: true,
        [ELEMENT_TEMPLATE_ATTRIBUTES_OPTION]: [
          {
            kind: 'spread',
            binding: 'slot',
            attrSlotIndex: 0,
          },
          {
            kind: 'spread',
            binding: 'slot',
            attrSlotIndex: 9,
          },
          {
            kind: 'attribute',
            binding: 'static',
            value: 'ignored-without-key',
          },
          {
            kind: 'attribute',
            binding: 'static',
            key: 'className',
            value: true,
          },
          {
            kind: 'attribute',
            binding: 'static',
            key: 'id',
            value: {},
          },
          {
            kind: 'attribute',
            binding: 'slot',
            key: 'style',
            attrSlotIndex: 1,
          },
          {
            kind: 'attribute',
            binding: 'slot',
            key: 'id',
            attrSlotIndex: 2,
          },
        ],
      },
    ) as unknown as {
      attributes?: Record<string, unknown>;
    };

    expect(list.attributes).toMatchObject({
      role: 'feed',
      class: 'true',
      style: {
        color: 'red',
      },
    });
    expect(list.attributes).not.toHaveProperty('id');
    expect(list.attributes).not.toHaveProperty('ignored-without-key');
  });

  it('skips platform replay when a materialized cell does not carry platform info', () => {
    const cell = createElementTemplateListCellRef(
      createNativeListCellRef(401),
      '_et_cell',
      [1],
      null,
    );
    const list = createElementTemplateListWithHandle(
      '_et_list_root',
      [[cell]],
      null,
      {
        [ELEMENT_TEMPLATE_LIST_OPTION]: true,
      },
    ) as Record<string, unknown>;
    const componentAtIndex = list['__componentAtIndex'] as (
      listRef: unknown,
      listId: number,
      cellIndex: number,
      operationId: number,
      enableReuseNotification: boolean,
    ) => number;
    const listId = (__GetElementUniqueID as (node: unknown) => number)(list);
    const logLengthBefore = lastMock?.nativeLog.length ?? 0;

    componentAtIndex(list, listId, 0, 11, false);

    const attributeLogs = (lastMock?.nativeLog.slice(logLengthBefore) ?? [])
      .filter(([name]) => name === '__SetAttribute');
    expect(attributeLogs).toEqual([]);
  });

  it('ignores missing spread slots without mutating list attributes', () => {
    const list = createElementTemplateListWithHandle(
      '_et_list_root',
      undefined,
      [
        {
          color: 'blue',
        },
      ],
      {
        [ELEMENT_TEMPLATE_LIST_OPTION]: true,
        [ELEMENT_TEMPLATE_ATTRIBUTES_OPTION]: [
          {
            kind: 'spread',
            binding: 'slot',
            attrSlotIndex: 0,
          },
          {
            kind: 'attribute',
            binding: 'slot',
            key: 'id',
            attrSlotIndex: 1,
          },
        ],
      },
    ) as unknown as {
      attributes?: Record<string, unknown>;
    };

    expect(list.attributes ?? {}).toEqual({});
  });

  it('treats non-array cell attribute slots as having no platform info', () => {
    const cell = createElementTemplateListCellRef(
      createNativeListCellRef(501),
      '_et_cell',
      'bad-attribute-slots' as never,
      null,
    );
    const list = createElementTemplateListWithHandle(
      '_et_list_root',
      [[cell]],
      null,
      {
        [ELEMENT_TEMPLATE_LIST_OPTION]: true,
      },
    ) as Record<string, unknown>;
    const updateListInfoLog = (lastMock?.nativeLog ?? []).find(
      ([name, _node, key]) => name === '__SetAttribute' && key === 'update-list-info',
    );

    expect(updateListInfoLog).toEqual([
      '__SetAttribute',
      '<list />',
      'update-list-info',
      {
        insertAction: [
          {
            position: 0,
            type: '_et_cell',
          },
        ],
        removeAction: [],
        updateAction: [],
      },
    ]);
    expect(list).toBeDefined();
  });
});
