// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { beforeEach, describe, expect, it } from 'vitest';

import {
  getCompactSnapshotChildren,
  getCompactSnapshotExtraProps,
  getCompactSnapshotListItemPlatformInfo,
  getCompactSnapshotSlotIndex,
  getCompactSnapshotValues,
  isCompactSnapshotSerialization,
  parseSnapshotSerialization,
  stringifyCompactSnapshot,
  validateCompactSnapshotSerialization,
} from '../../src/snapshot/snapshot/compactSnapshot.js';
import type {
  CompactSnapshotInstance,
  CompactSnapshotSerialization,
} from '../../src/snapshot/snapshot/compactSnapshot.js';
import { DynamicPartType } from '../../src/snapshot/snapshot/dynamicPartType.js';
import { snapshotManager } from '../../src/snapshot/snapshot/definition.js';
import {
  BackgroundSnapshotInstance,
  backgroundSnapshotInstanceManager,
  hydrate,
  hydrateCompact,
} from '../../src/snapshot/snapshot/backgroundSnapshot.js';
import { SnapshotInstance, snapshotInstanceManager } from '../../src/snapshot/snapshot/snapshot.js';
import type { SerializedSnapshotInstance, SnapshotType } from '../../src/snapshot/snapshot/types.js';

const PARENT_TYPE = 'compact-test-parent';
const ROW_TYPE = 'compact-test-row';
const ALT_ROW_TYPE = 'compact-test-alt-row';

snapshotManager.values.set(PARENT_TYPE, {
  create: null,
  update: [],
  slot: [[DynamicPartType.ListSlotV2, 0]],
  isListHolder: true,
  isSlotV2: true,
});
snapshotManager.values.set(ROW_TYPE, {
  create: null,
  update: [],
  slot: [[DynamicPartType.SlotV2, 0], [DynamicPartType.SlotV2, 0]],
  isSlotV2: true,
});
snapshotManager.values.set(ALT_ROW_TYPE, {
  create: null,
  update: [],
  slot: [],
});

function decodeCompactSnapshot(
  serialization: CompactSnapshotSerialization,
): SerializedSnapshotInstance {
  const typeDictionary = serialization[1];
  const decode = (node: CompactSnapshotInstance): SerializedSnapshotInstance => {
    const result: SerializedSnapshotInstance = {
      id: node[0],
      type: typeDictionary[node[1]]!,
    };
    const values = getCompactSnapshotValues(node);
    if (values !== undefined) {
      result.values = values;
    }
    const listItemPlatformInfo = getCompactSnapshotListItemPlatformInfo(node);
    if (listItemPlatformInfo !== undefined) {
      result.__listItemPlatformInfo = listItemPlatformInfo;
    }
    const extraProps = getCompactSnapshotExtraProps(node);
    if (extraProps !== undefined) {
      result.extraProps = extraProps;
    }
    const children = getCompactSnapshotChildren(node);
    if (children.length > 0) {
      result.children = children.map(decode);
    }
    const slotIndex = getCompactSnapshotSlotIndex(node);
    if (slotIndex > 0) {
      result.slotIndex = slotIndex;
    }
    return result;
  };
  return decode(serialization[2]);
}

function nextRandom(state: { value: number }): number {
  state.value = (state.value * 1_664_525 + 1_013_904_223) >>> 0;
  return state.value;
}

function randomInt(state: { value: number }, max: number): number {
  return Math.floor(nextRandom(state) * max / 0x1_0000_0000);
}

function randomBoolean(state: { value: number }): boolean {
  return randomInt(state, 2) === 1;
}

function countPropertyTreeNodes(node: SnapshotInstance): number {
  return 1 + node.childNodes.reduce(
    (count, child) => count + countPropertyTreeNodes(child),
    0,
  );
}

function getPropertyTreeShape(node: SnapshotInstance): string {
  return `[${node.childNodes.map(getPropertyTreeShape).join('')}]`;
}

function collectPropertyTreeFieldMasks(
  node: SnapshotInstance,
  fieldMasks: Set<string>,
): void {
  for (const child of node.childNodes) {
    fieldMasks.add(
      `${Number(child.__values !== undefined)}${Number(child.__extraProps !== undefined)}${
        Number(child.__listItemPlatformInfo !== undefined)
      }`,
    );
    collectPropertyTreeFieldMasks(child, fieldMasks);
  }
}

function createPropertyTree(seed: number): SnapshotInstance {
  const random = { value: seed };
  nextRandom(random);
  nextRandom(random);
  const root = new SnapshotInstance('root');
  const pending: Array<[SnapshotInstance, number]> = [[root, 0]];
  let nodeCount = 1;

  while (pending.length > 0 && nodeCount < 80) {
    const [parent, depth] = pending.shift()!;
    if (depth === 4) {
      continue;
    }
    const childCount = randomInt(random, 4);
    for (let index = 0; index < childCount && nodeCount < 80; index++, nodeCount++) {
      const typeChoices: SnapshotType[] = ['view', 'text', 'list-item', null];
      const child = new SnapshotInstance(
        typeChoices[randomInt(random, typeChoices.length)] as string,
      );
      child.__slotIndex = randomInt(random, 3);
      if (randomBoolean(random)) {
        child.__values = [
          randomInt(random, 10),
          `event:${child.__id}:1`,
          { ref: `react-ref-${child.__id}-2` },
          undefined,
          [true, null, { nested: randomInt(random, 7) }],
        ];
      }
      if (randomBoolean(random)) {
        child.__extraProps = {
          id: `node-${child.__id}`,
          listener: `event:${child.__id}:extra`,
          optional: undefined,
        };
      }
      if (randomBoolean(random)) {
        child.__listItemPlatformInfo = {
          'item-key': `key-${randomInt(random, 8)}`,
          'full-span': randomBoolean(random),
        };
      }
      parent.__insertBefore(child);
      pending.push([child, depth + 1]);
    }
  }

  return root;
}

function createMainHydrationTree(): SnapshotInstance {
  const root = new SnapshotInstance('root');
  const parent = new SnapshotInstance(PARENT_TYPE);
  parent.__values = [{ ref: 'react-ref-parent' }, 'main-listener'];
  parent.__extraProps = { 'data-source': 'main', nullable: null };
  root.__insertBefore(parent);

  const first = new SnapshotInstance(ROW_TYPE);
  first.__values = ['first', { ref: 'react-ref-first' }, 'first:listener'];
  first.__listItemPlatformInfo = { 'item-key': 'first', 'full-span': true };
  first.__extraProps = { role: 'first-row' };
  parent.__insertBefore(first);

  const firstText = new SnapshotInstance(null as unknown as string);
  firstText.__slotIndex = 1;
  firstText.__values = ['First'];
  first.__insertBefore(firstText);

  const second = new SnapshotInstance(ALT_ROW_TYPE);
  second.__values = ['second'];
  second.__listItemPlatformInfo = 'second' as never;
  parent.__insertBefore(second);

  return root;
}

function createBackgroundHydrationTree(): BackgroundSnapshotInstance {
  const root = new BackgroundSnapshotInstance('root');
  const parent = new BackgroundSnapshotInstance(PARENT_TYPE);
  parent.__values = [{ ref: 'react-ref-parent' }, () => undefined];
  parent.__extraProps = { 'data-source': 'background', nullable: null };
  root.insertBefore(parent);

  const first = new BackgroundSnapshotInstance(ROW_TYPE);
  first.__values = ['updated', { __ref: true }, () => undefined];
  first.__listItemPlatformInfo = { 'item-key': 'first', 'full-span': true };
  first.__extraProps = { role: 'updated-row' };
  parent.insertBefore(first);

  const firstText = new BackgroundSnapshotInstance(null as unknown as string);
  firstText.__slotIndex = 1;
  firstText.__values = ['Updated'];
  first.insertBefore(firstText);

  const inserted = new BackgroundSnapshotInstance(ROW_TYPE);
  inserted.__values = ['inserted'];
  inserted.__listItemPlatformInfo = { 'item-key': 'inserted' };
  parent.insertBefore(inserted);

  return root;
}

beforeEach(() => {
  backgroundSnapshotInstanceManager.clear();
  backgroundSnapshotInstanceManager.nextId = 0;
  snapshotInstanceManager.clear();
  snapshotInstanceManager.nextId = 0;
});

describe('compact first-screen snapshot', () => {
  it('encodes a deterministic dictionary and sparse tuple schema', () => {
    const root = createMainHydrationTree();
    const first = stringifyCompactSnapshot(root);
    const second = stringifyCompactSnapshot(root);

    expect(first).toBe(second);
    expect(JSON.parse(first)).toMatchInlineSnapshot(`
      [
        1,
        [
          "root",
          "compact-test-parent",
          "compact-test-row",
          null,
          "compact-test-alt-row",
        ],
        [
          -1,
          0,
          8,
          [
            [
              -2,
              1,
              13,
              [
                {
                  "ref": "react-ref-parent",
                },
                "main-listener",
              ],
              {
                "data-source": "main",
                "nullable": null,
              },
              [
                [
                  -3,
                  2,
                  15,
                  [
                    "first",
                    {
                      "ref": "react-ref-first",
                    },
                    "first:listener",
                  ],
                  {
                    "full-span": true,
                    "item-key": "first",
                  },
                  {
                    "role": "first-row",
                  },
                  [
                    [
                      -4,
                      3,
                      17,
                      [
                        "First",
                      ],
                      1,
                    ],
                  ],
                ],
                [
                  -5,
                  4,
                  3,
                  [
                    "second",
                  ],
                  "second",
                ],
              ],
            ],
          ],
        ],
      ]
    `);
  });

  it('walks sibling links without materializing childNodes arrays', () => {
    const root = createMainHydrationTree();
    for (
      const node of [
        root,
        root.childNodes[0]!,
        ...root.childNodes[0]!.childNodes,
      ]
    ) {
      Object.defineProperty(node, 'childNodes', {
        get() {
          throw new Error('childNodes getter should not be used');
        },
      });
    }

    expect(() => stringifyCompactSnapshot(root)).not.toThrow();
  });

  it('round-trips property-style trees without losing serialized fields', () => {
    const nodeCounts: number[] = [];
    const treeShapes = new Set<string>();
    const fieldMasks = new Set<string>();

    for (let seed = 1; seed <= 64; seed++) {
      const root = createPropertyTree(seed);
      nodeCounts.push(countPropertyTreeNodes(root));
      treeShapes.add(getPropertyTreeShape(root));
      collectPropertyTreeFieldMasks(root, fieldMasks);
      const compact = parseSnapshotSerialization(stringifyCompactSnapshot(root));
      expect(isCompactSnapshotSerialization(compact)).toBe(true);
      expect(decodeCompactSnapshot(compact as CompactSnapshotSerialization))
        .toEqual(JSON.parse(JSON.stringify(root)));
      snapshotInstanceManager.clear();
      snapshotInstanceManager.nextId = 0;
    }

    const distribution = {
      distinctNodeCounts: new Set(nodeCounts).size,
      distinctShapes: treeShapes.size,
      distinctFieldMasks: fieldMasks.size,
      rootOnlyTrees: nodeCounts.filter(nodeCount => nodeCount === 1).length,
      smallTrees: nodeCounts.filter(nodeCount => nodeCount >= 2 && nodeCount <= 10).length,
      midTrees: nodeCounts.filter(nodeCount => nodeCount >= 11 && nodeCount <= 30).length,
      largeTrees: nodeCounts.filter(nodeCount => nodeCount >= 31 && nodeCount < 80).length,
      cappedTrees: nodeCounts.filter(nodeCount => nodeCount === 80).length,
    };
    expect(distribution.distinctShapes).toBeGreaterThanOrEqual(40);
    expect(distribution.distinctNodeCounts).toBeGreaterThanOrEqual(24);
    expect(distribution.distinctFieldMasks).toBe(8);
    expect(distribution.rootOnlyTrees).toBeLessThanOrEqual(20);
    expect(distribution.smallTrees).toBeGreaterThanOrEqual(12);
    expect(distribution.midTrees).toBeGreaterThanOrEqual(16);
    expect(distribution.largeTrees).toBeGreaterThanOrEqual(8);
    expect(distribution.cappedTrees).toBeLessThanOrEqual(8);
  });

  it.each([
    ['truthy primitive', 'primitive-key', 'primitive-key'],
    ['truthy number', 42, 42],
    ['zero', 0, undefined],
    ['false', false, undefined],
    ['null', null, undefined],
  ])('preserves legacy list-item platform-info semantics for %s', (_, value, expected) => {
    const root = new SnapshotInstance('root');
    const child = new SnapshotInstance('list-item');
    child.__listItemPlatformInfo = value as never;
    root.__insertBefore(child);

    const compact = parseSnapshotSerialization(stringifyCompactSnapshot(root));
    expect(isCompactSnapshotSerialization(compact)).toBe(true);
    expect(decodeCompactSnapshot(compact as CompactSnapshotSerialization).__listItemPlatformInfo)
      .toBeUndefined();
    expect(
      decodeCompactSnapshot(compact as CompactSnapshotSerialization).children?.[0]
        ?.__listItemPlatformInfo,
    ).toEqual(expected);
    expect(JSON.parse(JSON.stringify(root)).children?.[0]?.__listItemPlatformInfo)
      .toEqual(expected);
  });

  it('accepts legacy roots and rejects malformed or unsupported compact roots', () => {
    expect(parseSnapshotSerialization('{"id":-1,"type":"root"}')).toEqual({
      id: -1,
      type: 'root',
    });
    expect(() => parseSnapshotSerialization('{}'))
      .toThrow('Invalid legacy first-screen snapshot root.');
    expect(() => parseSnapshotSerialization('{"id":-1,"type":false}'))
      .toThrow('Invalid legacy first-screen snapshot root.');
    expect(() => parseSnapshotSerialization('[2,["root"],[-1,0,0]]'))
      .toThrow('Unsupported compact first-screen snapshot version: 2.');
    expect(() => parseSnapshotSerialization('[1,["root"]]'))
      .toThrow('Invalid compact first-screen snapshot envelope.');
    expect(() => parseSnapshotSerialization('[1,{},[-1,0,0]]'))
      .toThrow('Invalid compact first-screen snapshot type dictionary.');
    expect(() => parseSnapshotSerialization('[1,[false],[-1,0,0]]'))
      .toThrow('Invalid compact first-screen snapshot type dictionary.');
    expect(() => parseSnapshotSerialization('[1,["root"],{}]'))
      .toThrow('Invalid compact first-screen snapshot root.');
    expect(() => validateCompactSnapshotSerialization([1, ['root'], [] as never]))
      .toThrow('Invalid compact first-screen snapshot node.');
    expect(() => validateCompactSnapshotSerialization([1, ['root'], ['bad', 0, 0] as never]))
      .toThrow('Invalid compact first-screen snapshot id.');
    expect(() => parseSnapshotSerialization('[1,["root"],[-1,1,0]]'))
      .toThrow('Invalid compact first-screen snapshot type index.');
    expect(() => parseSnapshotSerialization('[1,["root"],[-1,0,32]]'))
      .toThrow('Invalid compact first-screen snapshot field mask.');
    expect(() => parseSnapshotSerialization('[1,["root"],[-1,0,8,[[-2,0,1,"bad"]]]]'))
      .toThrow('Invalid compact first-screen snapshot values.');
    expect(() => validateCompactSnapshotSerialization([1, ['root'], [-1, 0, 4, false]]))
      .toThrow('Invalid compact first-screen snapshot extra props.');
    expect(() => validateCompactSnapshotSerialization([1, ['root'], [-1, 0, 8, false]]))
      .toThrow('Invalid compact first-screen snapshot children.');
    expect(() => validateCompactSnapshotSerialization([1, ['root'], [-1, 0, 16, 0]]))
      .toThrow('Invalid compact first-screen snapshot slot index.');
    expect(() => validateCompactSnapshotSerialization([1, ['root'], [-1, 0, 0, 'extra']]))
      .toThrow('Invalid compact first-screen snapshot field count.');
  });

  it('hydrates compact tuples directly with legacy-equivalent patches', () => {
    const mainRoot = createMainHydrationTree();
    const legacy = JSON.parse(JSON.stringify(mainRoot)) as SerializedSnapshotInstance;
    const compact = parseSnapshotSerialization(stringifyCompactSnapshot(mainRoot));
    expect(isCompactSnapshotSerialization(compact)).toBe(true);

    const legacyPatch = hydrate(legacy, createBackgroundHydrationTree());

    backgroundSnapshotInstanceManager.clear();
    backgroundSnapshotInstanceManager.nextId = 0;
    const compactPatch = hydrateCompact(
      compact as CompactSnapshotSerialization,
      createBackgroundHydrationTree(),
    );

    expect(compactPatch).toEqual(legacyPatch);
    expect([...backgroundSnapshotInstanceManager.values.keys()].sort((a, b) => a - b))
      .toEqual([-4, -3, -2, -1, 5]);
  });
});
