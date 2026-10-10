/** @jsxImportSource ../../lepus */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { elementTree } from './utils/nativeMethod';
import { __pendingListUpdates } from '../../src/snapshot/list/pendingListUpdates';
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
 * Native shows item 0, scrolls it away, then asks for item 1: item 1 is served
 * by reusing item 0's elements. Item 0 stays in the tree, and the background
 * keeps patching it, so it must keep its structure.
 */
describe('list reuse and a later update to the retired item', () => {
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

  function setUp() {
    const page = new SnapshotInstance(sPage);
    const list = new SnapshotInstance(sList);
    page.insertBefore(list);
    const items = [0, 1, 2].map(key => {
      const item = new SnapshotInstance(sItem);
      item.setAttribute(0, { 'item-key': key });
      for (const label of ['item', 'extra']) {
        const text = new SnapshotInstance(sChild);
        text.setAttribute(0, `${label} ${key}`);
        item.insertBefore(text);
      }
      list.insertBefore(item);
      return item;
    });
    page.ensureElements();
    __pendingListUpdates.flush();
    const listRef = list.__elements[0];

    const sign0 = elementTree.triggerComponentAtIndex(listRef, 0);
    elementTree.triggerEnqueueComponent(listRef, sign0);
    elementTree.triggerComponentAtIndex(listRef, 1);
    return { items, listRef };
  }

  function renderedTexts(item) {
    return item.__element_root.children.map(child => String(child.children[0].props.text));
  }

  it('the background still patches the retired node after native reused it', () => {
    const { items, listRef } = setUp();
    const [retired, shown] = items;
    expect(retired.__element_root).toBeUndefined();
    expect(renderedTexts(shown)).toEqual(['item 1', 'extra 1']);

    // A state change on the background removes a child of the retired node.
    retired.removeChild(retired.childNodes[1]);
    expect(renderedTexts(shown)).toEqual(['item 1', 'extra 1']);

    // Item 0 comes back on screen from its updated structure.
    elementTree.triggerComponentAtIndex(listRef, 0);
    expect(renderedTexts(retired)).toEqual(['item 0']);
  });

  it('rejects the next patch if the retired node had been torn down', () => {
    const { items } = setUp();
    const [retired] = items;
    const extra = retired.childNodes[1];

    retired.tearDown();
    expect(() => retired.removeChild(extra)).toThrow('The node to be removed is not a child of this node.');
  });
});
