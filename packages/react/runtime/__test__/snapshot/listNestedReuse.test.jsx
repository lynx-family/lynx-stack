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

describe('a list item with a nested list, removed and then reused', () => {
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

  function build(outerKeys) {
    const page = new SnapshotInstance(sPage);
    const outer = new SnapshotInstance(sList);
    page.insertBefore(outer);
    const nested = {};
    for (const k of outerKeys) {
      const item = new SnapshotInstance(sItem);
      item.setAttribute(0, { 'item-key': `o${k}` });
      const inner = new SnapshotInstance(sList);
      item.insertBefore(inner);
      for (const j of [0, 1]) {
        const innerItem = new SnapshotInstance(sItem);
        innerItem.setAttribute(0, { 'item-key': `i${k}-${j}` });
        for (const suffix of ['a', 'b']) {
          const text = new SnapshotInstance(sChild);
          text.setAttribute(0, `${k}-${j}-${suffix}`);
          innerItem.insertBefore(text);
        }
        inner.insertBefore(innerItem);
      }
      outer.insertBefore(item);
      nested[k] = { item, inner };
    }
    return { page, outer, nested };
  }

  function renderedTexts(item) {
    return item.__element_root.children.map(child => String(child.children[0].props.text));
  }

  it('keeps the nested list serving intact items', () => {
    const { page, outer, nested } = build([0, 1]);
    page.ensureElements();
    __pendingListUpdates.flush();
    const outerRef = outer.__elements[0];

    // Outer item 0 is shown, its nested list shows item 0 and pools item 1.
    const so0 = elementTree.triggerComponentAtIndex(outerRef, 0);
    __pendingListUpdates.flush();
    const innerRef = nested[0].inner.__elements[0];
    const si00 = elementTree.triggerComponentAtIndex(innerRef, 0);
    const si01 = elementTree.triggerComponentAtIndex(innerRef, 1);
    elementTree.triggerEnqueueComponent(innerRef, si01);

    // The background removes outer item 0; native hands it back and asks for
    // the item now at index 0, which reuses it. Its nested list's children
    // are still held by that list under their old signs.
    outer.removeChild(nested[0].item);
    __pendingListUpdates.flush();
    elementTree.triggerEnqueueComponent(outerRef, so0);
    elementTree.triggerComponentAtIndex(outerRef, 0);
    expect(nested[1].inner.__elements[0]).toBe(innerRef);

    // The reused item and its nested list holder are released; the nested
    // items stay intact for the nested list to reuse.
    const { item: retired, inner: retiredInner } = nested[0];
    expect(retired.__element_root).toBeUndefined();
    expect(retired.parentNode?.type ?? null).toBeNull();
    expect(retiredInner.__elements).toBeUndefined();
    expect(retiredInner.parentNode?.type ?? null).toBeNull();
    for (const innerItem of retiredInner.childNodes) {
      expect(innerItem.__element_root).toBeDefined();
      expect(innerItem.childNodes).toHaveLength(2);
    }

    elementTree.triggerEnqueueComponent(innerRef, si00);
    elementTree.triggerComponentAtIndex(innerRef, 0);
    elementTree.triggerComponentAtIndex(innerRef, 1);
    expect(renderedTexts(nested[1].inner.childNodes[0])).toEqual(['1-0-a', '1-0-b']);
    expect(renderedTexts(nested[1].inner.childNodes[1])).toEqual(['1-1-a', '1-1-b']);
  });
});
