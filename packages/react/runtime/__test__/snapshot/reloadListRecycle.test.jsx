/** @jsxImportSource ../../lepus */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { elementTree } from './utils/nativeMethod';
import { gRecycleMap, gSignMap, releaseReplacedTree } from '../../src/snapshot/list/list';
import { __pendingListUpdates } from '../../src/snapshot/list/pendingListUpdates';
import { hydrate } from '../../src/snapshot/renderToOpcodes/hydrate';
import { SnapshotInstance, snapshotInstanceManager } from '../../src/snapshot';

const HOLE = null;

beforeEach(() => {
  __pendingListUpdates.clearAttachedLists();
  snapshotInstanceManager.clear();
  snapshotInstanceManager.nextId = 0;
});

afterEach(() => {
  elementTree.clear();
});

/**
 * A reload hydrates the new tree against the old one, then releases the old
 * one. A list holder's children are the list's, not the tree's:
 * `componentAtIndex` is rebound to the new children, so an old child can never
 * be requested again, but one the new tree drops may still sit in `gSignMap` /
 * `gRecycleMap` and be reused as the source of elements for a later item. That
 * is the state `removeChild` leaves a list child in -- `__id` set to 0, elements
 * and structure kept for one reuse -- and `componentAtIndex` tears such an
 * item down once it has been reused.
 */
describe('reload releases the old tree around a list', () => {
  const sPage = __SNAPSHOT__(
    <view>
      {HOLE}
    </view>,
  );
  const sList = __SNAPSHOT__(
    <list>
      {HOLE}
    </list>,
  );
  const sItem = __SNAPSHOT__(
    <list-item item-key={HOLE}>
      {HOLE}
    </list-item>,
  );
  const sChild = __SNAPSHOT__(
    <text>
      <raw-text text={HOLE} />
    </text>,
  );

  // Two children per item, so a truncated sibling chain shows in the output.
  function build(tag, keys) {
    const page = new SnapshotInstance(sPage);
    const list = new SnapshotInstance(sList);
    page.insertBefore(list);
    const items = {};
    for (const key of keys) {
      const item = new SnapshotInstance(sItem);
      item.setAttribute(0, { 'item-key': `key-${key}` });
      const first = new SnapshotInstance(sChild);
      first.setAttribute(0, `${tag}-first-${key}`);
      const second = new SnapshotInstance(sChild);
      second.setAttribute(0, `${tag}-second-${key}`);
      item.insertBefore(first);
      item.insertBefore(second);
      list.insertBefore(item);
      items[key] = item;
    }
    return { page, list, items };
  }

  function listId(listRef) {
    return __GetElementUniqueID(listRef);
  }

  function pooled(listRef) {
    const byType = gRecycleMap[listId(listRef)];
    return [...byType.values()].flatMap(signMap => [...signMap.values()]);
  }

  function onScreen(listRef, sign) {
    return gSignMap[listId(listRef)].get(sign);
  }

  // Pretty-printing a SnapshotInstance crashes the snapshot serializer, so
  // identities are compared through labels.
  function label(node, trees) {
    for (const [name, tree] of Object.entries(trees)) {
      for (const [key, item] of Object.entries(tree.items)) {
        if (item === node) {
          return `${name}[${key}]`;
        }
      }
    }
    return '?';
  }

  function labels(nodes, trees) {
    return nodes.map(node => label(node, trees));
  }

  function renderedTexts(item) {
    return item.__element_root.children.map(child => String(child.children[0].props.text));
  }

  // The old tree has items 0..3. Item 0 is shown and handed back (pooled), item 1
  // is shown and kept on screen, items 2 and 3 are never materialized.
  function setUp(newKeys) {
    const old = build('old', [0, 1, 2, 3]);
    old.page.ensureElements();
    __pendingListUpdates.flush();
    const listRef = old.list.__elements[0];

    // Both are shown first; item 0 is then handed back, so the pool holds it
    // while item 1 stays on screen.
    const sign0 = elementTree.triggerComponentAtIndex(listRef, 0);
    const sign1 = elementTree.triggerComponentAtIndex(listRef, 1);
    elementTree.triggerEnqueueComponent(listRef, sign0);

    const next = build('new', newKeys);
    hydrate(old.page, next.page, { skipUnRef: true });
    releaseReplacedTree(old.page, next.page);
    __pendingListUpdates.flush();

    return { old, next, listRef, sign0, sign1 };
  }

  function expectReleased(node) {
    expect(node.__element_root).toBeUndefined();
    expect(node.__elements).toBeUndefined();
    expect(node.parentNode?.type ?? null).toBeNull();
  }

  function expectKeptForReuse(node) {
    expect(node.__id).toBe(0);
    expect(node.__element_root).toBeDefined();
    expect(node.childNodes).toHaveLength(2);
  }

  describe('children the new tree keeps', () => {
    it('hands a pooled item to the new node and releases the old one', () => {
      const { old, next, listRef } = setUp([0, 1, 2, 3]);

      expect(labels(pooled(listRef), { old, next })).toEqual(['next[0]']);
      expectReleased(old.items[0]);
    });

    it('hands an on-screen item to the new node and releases the old one', () => {
      const { old, next, listRef, sign1 } = setUp([0, 1, 2, 3]);

      expect(label(onScreen(listRef, sign1), { old, next })).toBe('next[1]');
      expectReleased(old.items[1]);
    });

    it('releases an item that was never materialized', () => {
      const { old } = setUp([0, 1, 2, 3]);

      expectReleased(old.items[2]);
      expectReleased(old.items[3]);
    });

    it('serves every index from the new tree', () => {
      const { old, next, listRef } = setUp([0, 1, 2, 3]);

      const sign = elementTree.triggerComponentAtIndex(listRef, 2);
      expect(label(onScreen(listRef, sign), { old, next })).toBe('next[2]');
      expect(renderedTexts(next.items[2])).toEqual(['new-first-2', 'new-second-2']);
    });
  });

  describe('children the new tree drops', () => {
    it('keeps a pooled item for one reuse and marks it deleted', () => {
      const { old, next, listRef } = setUp([1, 2, 3, 4]);

      expect(labels(pooled(listRef), { old, next })).toEqual(['old[0]']);
      expectKeptForReuse(old.items[0]);
    });

    it('reuses the pooled item and tears it down afterwards', () => {
      const { old, next, listRef } = setUp([1, 2, 3, 4]);

      // Item 4 has no elements, so it is served out of the pool.
      const sign = elementTree.triggerComponentAtIndex(listRef, 3);

      expect(label(onScreen(listRef, sign), { old, next })).toBe('next[4]');
      expect(renderedTexts(next.items[4])).toEqual(['new-first-4', 'new-second-4']);
      expect(pooled(listRef)).toHaveLength(0);
      expectReleased(old.items[0]);
    });

    it('keeps an on-screen item until native hands it back, then reuses it', () => {
      const { old, next, listRef, sign1 } = setUp([0, 2, 3, 4]);

      // Still on screen under its old sign, so a later `enqueueComponent` has
      // to find it and put it in the pool.
      expect(label(onScreen(listRef, sign1), { old, next })).toBe('old[1]');
      expectKeptForReuse(old.items[1]);

      elementTree.triggerEnqueueComponent(listRef, sign1);
      expect(labels(pooled(listRef), { old, next })).toEqual(['next[0]', 'old[1]']);

      // The pool is served in order: item 4 takes the kept item's elements,
      // item 3 takes the dropped one's.
      elementTree.triggerComponentAtIndex(listRef, 3);
      expect(labels(pooled(listRef), { old, next })).toEqual(['old[1]']);
      const sign = elementTree.triggerComponentAtIndex(listRef, 2);
      expect(label(onScreen(listRef, sign), { old, next })).toBe('next[3]');
      expect(renderedTexts(next.items[3])).toEqual(['new-first-3', 'new-second-3']);
      expect(pooled(listRef)).toHaveLength(0);
      expectReleased(old.items[1]);
    });

    it('releases an item that was never materialized', () => {
      const { old } = setUp([0, 1, 4, 5]);

      expectReleased(old.items[2]);
      expectReleased(old.items[3]);
    });

    it('never serves an index from the old tree', () => {
      const { old, next, listRef } = setUp([1, 2, 3, 4]);

      for (let index = 0; index < 4; index++) {
        const sign = elementTree.triggerComponentAtIndex(listRef, index);
        expect(label(onScreen(listRef, sign), { old, next })).toMatch(/^next\[/);
      }
    });
  });

  it('destroys a list the new tree drops, the way removeChild does', () => {
    const old = build('old', [0, 1, 2]);
    old.page.ensureElements();
    __pendingListUpdates.flush();
    const listRef = old.list.__elements[0];
    const id = listId(listRef);

    const sign0 = elementTree.triggerComponentAtIndex(listRef, 0);
    elementTree.triggerComponentAtIndex(listRef, 1);
    elementTree.triggerEnqueueComponent(listRef, sign0);
    expect(id in gSignMap).toBe(true);
    expect(id in gRecycleMap).toBe(true);

    // The new tree has no list at all, so the holder is a removal and the
    // ListChildren branch never runs for it.
    const next = new SnapshotInstance(sPage);
    hydrate(old.page, next, { skipUnRef: true });
    releaseReplacedTree(old.page, next);
    __pendingListUpdates.flush();

    // `removeChild` would have run `snapshotDestroyList`: the recycling state
    // is dropped and the callbacks are neutralized, so nothing can bring an
    // old item back.
    expect(id in gSignMap).toBe(false);
    expect(id in gRecycleMap).toBe(false);
    expect(listRef.componentAtIndex(listRef, id, 0, 0, false)).toBe(-1);

    // With the list gone, its children have nowhere to be reused: nothing
    // references them once they are unlinked.
    for (const item of Object.values(old.items)) {
      expect(item.parentNode?.type ?? null).toBeNull();
    }
  });

  it('keeps a pooled item reusable across a second reload', () => {
    const { old, next, listRef } = setUp([1, 2, 3, 4]);
    expect(labels(pooled(listRef), { old, next })).toEqual(['old[0]']);

    const third = build('third', [1, 2, 3, 4]);
    hydrate(next.page, third.page, { skipUnRef: true });
    releaseReplacedTree(next.page, third.page);
    __pendingListUpdates.flush();

    // The pooled item belongs to neither tree of the second reload, so it is
    // left exactly as the first reload left it.
    expect(labels(pooled(listRef), { old, next, third })).toEqual(['old[0]']);
    expectKeptForReuse(old.items[0]);

    const sign = elementTree.triggerComponentAtIndex(listRef, 3);
    expect(label(onScreen(listRef, sign), { old, next, third })).toBe('third[4]');
    expect(renderedTexts(third.items[4])).toEqual(['third-first-4', 'third-second-4']);
    expectReleased(old.items[0]);
  });
});
