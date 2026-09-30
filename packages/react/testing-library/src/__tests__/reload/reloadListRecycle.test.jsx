// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from 'vitest';

import { useInitData } from '@lynx-js/react';

import { render } from '../..';
import { reloadTemplate } from './reloadTemplate.js';
import { __root } from '../../../../runtime/lib/root.js';
import { gRecycleMap, gSignMap } from '../../../../runtime/lib/snapshot/list/list.js';

function Row({ text }) {
  return <text>{text}</text>;
}

function ListApp() {
  const { tag = 'old', keys = [0, 1, 2, 3], showList = true } = useInitData() ?? {};
  if (!showList) {
    return <view />;
  }
  return (
    <list>
      {keys.map((key) => (
        <list-item key={key} item-key={`key-${key}`}>
          <Row text={`${tag}-first-${key}`} />
          <Row text={`${tag}-second-${key}`} />
        </list-item>
      ))}
    </list>
  );
}

/**
 * The same matrix as the runtime's `reloadListRecycle.test.jsx`, driven
 * through a real app: a reload hydrates the new tree against the old one and
 * releases the old one. A list holder's children are the list's, not the
 * tree's: `componentAtIndex` is rebound to the new children, so an old child
 * can never be requested again, but one the new tree drops may still sit in
 * `gSignMap` / `gRecycleMap` and be reused as the source of elements for a
 * later item. That is the state `removeChild` leaves a list child in -- `__id`
 * set to 0, elements and structure kept for one reuse -- and `componentAtIndex`
 * tears such an item down once it has been reused.
 */
describe('reload releases the old tree around a list', () => {
  function items() {
    lynxTestingEnv.switchToMainThread();
    return [...__root.childNodes[0].childNodes];
  }

  function listId(list) {
    return list.$$uiSign;
  }

  function pooled(list) {
    const byType = gRecycleMap[listId(list)];
    return [...byType.values()].flatMap(signMap => [...signMap.values()]);
  }

  function onScreen(list, sign) {
    return gSignMap[listId(list)].get(sign);
  }

  function key(node) {
    return node.__listItemPlatformInfo['item-key'].replace('key-', '');
  }

  // Identities are compared through labels; the element serializer cannot
  // print a SnapshotInstance.
  function label(node, trees) {
    for (const [name, tree] of Object.entries(trees)) {
      if (tree.includes(node)) {
        return `${name}[${key(node)}]`;
      }
    }
    return '?';
  }

  function labels(nodes, trees) {
    return nodes.map(node => label(node, trees));
  }

  function shown(list, sign) {
    const item = [...list.children].find(element => element.$$uiSign === sign);
    return [...item.children].map(text => text.textContent);
  }

  // The old tree has items 0..3. Item 0 is shown and handed back (pooled), item 1
  // is shown and kept on screen, items 2 and 3 are never materialized.
  function setUp(newKeys) {
    const ui = <ListApp />;
    const { container } = render(ui, { enableMainThread: true });
    const list = container.firstChild;
    const old = items();

    const sign0 = elementTree.enterListItemAtIndex(list, 0);
    const sign1 = elementTree.enterListItemAtIndex(list, 1);
    elementTree.leaveListItem(list, sign0);

    reloadTemplate(ui, { tag: 'new', keys: newKeys });
    const next = items();

    return { ui, old, next, list, sign0, sign1 };
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
      const { old, next, list } = setUp([0, 1, 2, 3]);

      expect(labels(pooled(list), { old, next })).toEqual(['next[0]']);
      expectReleased(old[0]);
    });

    it('hands an on-screen item to the new node and releases the old one', () => {
      const { old, next, list, sign1 } = setUp([0, 1, 2, 3]);

      expect(label(onScreen(list, sign1), { old, next })).toBe('next[1]');
      expectReleased(old[1]);
    });

    it('releases an item that was never materialized', () => {
      const { old } = setUp([0, 1, 2, 3]);

      expectReleased(old[2]);
      expectReleased(old[3]);
    });

    it('serves every index from the new tree', () => {
      const { old, next, list } = setUp([0, 1, 2, 3]);

      const sign = elementTree.enterListItemAtIndex(list, 2);
      expect(label(onScreen(list, sign), { old, next })).toBe('next[2]');
      expect(shown(list, sign)).toEqual(['new-first-2', 'new-second-2']);
    });
  });

  describe('children the new tree drops', () => {
    it('keeps a pooled item for one reuse and marks it deleted', () => {
      const { old, next, list } = setUp([1, 2, 3, 4]);

      expect(labels(pooled(list), { old, next })).toEqual(['old[0]']);
      expectKeptForReuse(old[0]);
    });

    it('reuses the pooled item and tears it down afterwards', () => {
      const { old, next, list } = setUp([1, 2, 3, 4]);

      // Item 4 has no elements, so it is served out of the pool.
      const sign = elementTree.enterListItemAtIndex(list, 3);

      expect(label(onScreen(list, sign), { old, next })).toBe('next[4]');
      expect(shown(list, sign)).toEqual(['new-first-4', 'new-second-4']);
      expect(pooled(list)).toHaveLength(0);
      expectReleased(old[0]);
    });

    it('keeps an on-screen item until native hands it back, then reuses it', () => {
      const { old, next, list, sign1 } = setUp([0, 2, 3, 4]);

      // Still on screen under its old sign, so a later `enqueueComponent` has
      // to find it and put it in the pool.
      expect(label(onScreen(list, sign1), { old, next })).toBe('old[1]');
      expectKeptForReuse(old[1]);

      elementTree.leaveListItem(list, sign1);
      expect(labels(pooled(list), { old, next })).toEqual(['next[0]', 'old[1]']);

      // The pool is served in order: item 4 takes the kept item's elements,
      // item 3 takes the dropped one's.
      elementTree.enterListItemAtIndex(list, 3);
      expect(labels(pooled(list), { old, next })).toEqual(['old[1]']);
      const sign = elementTree.enterListItemAtIndex(list, 2);
      expect(label(onScreen(list, sign), { old, next })).toBe('next[3]');
      expect(shown(list, sign)).toEqual(['new-first-3', 'new-second-3']);
      expect(pooled(list)).toHaveLength(0);
      expectReleased(old[1]);
    });

    it('releases an item that was never materialized', () => {
      const { old } = setUp([0, 1, 4, 5]);

      expectReleased(old[2]);
      expectReleased(old[3]);
    });

    it('never serves an index from the old tree', () => {
      const { old, next, list } = setUp([1, 2, 3, 4]);

      for (let index = 0; index < 4; index++) {
        const sign = elementTree.enterListItemAtIndex(list, index);
        expect(label(onScreen(list, sign), { old, next })).toMatch(/^next\[/);
      }
    });
  });

  it('destroys a list the new tree drops, the way removeChild does', () => {
    const ui = <ListApp />;
    const { container } = render(ui, { enableMainThread: true });
    const list = container.firstChild;
    const id = listId(list);
    const old = items();

    const sign0 = elementTree.enterListItemAtIndex(list, 0);
    elementTree.enterListItemAtIndex(list, 1);
    elementTree.leaveListItem(list, sign0);
    expect(id in gSignMap).toBe(true);
    expect(id in gRecycleMap).toBe(true);

    // The new tree has no list at all, so the holder is a removal and the
    // ListChildren branch never runs for it.
    reloadTemplate(ui, { showList: false });
    expect(container.innerHTML).toBe('<view></view>');

    // `removeChild` would have run `snapshotDestroyList`: the recycling state
    // is dropped and the callbacks are neutralized, so nothing can bring an
    // old item back.
    expect(id in gSignMap).toBe(false);
    expect(id in gRecycleMap).toBe(false);
    expect(elementTree.enterListItemAtIndex(list, 0)).toBe(-1);

    // With the list gone, its children have nowhere to be reused: nothing
    // references them once they are unlinked.
    for (const item of old) {
      expect(item.parentNode?.type ?? null).toBeNull();
    }
  });

  it('keeps a pooled item reusable across a second reload', () => {
    const { ui, old, next, list } = setUp([1, 2, 3, 4]);
    expect(labels(pooled(list), { old, next })).toEqual(['old[0]']);

    reloadTemplate(ui, { tag: 'third', keys: [1, 2, 3, 4] });
    const third = items();

    // The pooled item belongs to neither tree of the second reload, so it is
    // left exactly as the first reload left it.
    expect(labels(pooled(list), { old, next, third })).toEqual(['old[0]']);
    expectKeptForReuse(old[0]);

    const sign = elementTree.enterListItemAtIndex(list, 3);
    expect(label(onScreen(list, sign), { old, next, third })).toBe('third[4]');
    expect(shown(list, sign)).toEqual(['third-first-4', 'third-second-4']);
    expectReleased(old[0]);
  });
});
