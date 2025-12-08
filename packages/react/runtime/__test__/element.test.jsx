import { beforeEach, describe, expect, it } from 'vitest';

import { BackgroundSnapshotInstance } from '../src/backgroundSnapshot';

describe('BackgroundSnapshotInstance', () => {
  let root, child1, child2, child3;

  beforeEach(() => {
    root = new BackgroundSnapshotInstance(null);
    child1 = new BackgroundSnapshotInstance(null);
    child2 = new BackgroundSnapshotInstance(null);
    child3 = new BackgroundSnapshotInstance(null);
  });

  it('insertBefore', () => {
    root.insertBefore(child1);
    expect(root.childNodes).toEqual([child1]);
    root.insertBefore(child2, child1);
    expect(root.childNodes).toEqual([child2, child1]);
    root.insertBefore(child3, child1);
    expect(root.childNodes).toEqual([child2, child3, child1]);
    root.insertBefore(child3, child2);
    expect(root.childNodes).toEqual([child3, child2, child1]);
  });

  it('removeChild', () => {
    root.insertBefore(child1);
    root.insertBefore(child2);
    root.insertBefore(child3);
    expect(root.childNodes).toEqual([child1, child2, child3]);
    root.removeChild(child2);
    expect(child2.parentNode).toEqual(null);
    expect(root.childNodes).toEqual([child1, child3]);

    expect(() => root.removeChild(child2)).toThrowErrorMatchingInlineSnapshot(
      `[Error: The node to be removed is not a child of this node.]`,
    );
  });

  it('childNodes', () => {
    root.insertBefore(child1);
    root.insertBefore(child2);
    root.insertBefore(child3);
    expect(root.childNodes).toEqual([child1, child2, child3]);
  });
});
