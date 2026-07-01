// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeAll, describe, expect, it } from 'vitest';

import { L1ReadOnlyElement, L1ReadOnlyText, wrapPapi } from '../nodes.ts';

interface MockNode extends Record<string, unknown> {
  tag: string;
  uid: number;
  parent: MockNode | undefined;
  children: MockNode[];
}

/**
 * Mixed text + element children:
 *
 *   container (view)
 *   ├── text-1 (raw-text)
 *   ├── e-1 (view, id=e1)
 *   ├── text-2 (raw-text)
 *   ├── e-2 (view, id=e2)
 *   └── e-3 (view, id=e3)
 */
function build(): {
  container: MockNode;
  t1: MockNode;
  e1: MockNode;
  t2: MockNode;
  e2: MockNode;
  e3: MockNode;
} {
  const mk = (tag: string, uid: number): MockNode => ({
    tag,
    uid,
    parent: undefined,
    children: [],
  });
  const t1 = mk('raw-text', 101);
  const e1 = mk('view', 102);
  const t2 = mk('raw-text', 103);
  const e2 = mk('view', 104);
  const e3 = mk('view', 105);
  const container: MockNode = {
    tag: 'view',
    uid: 100,
    parent: undefined,
    children: [t1, e1, t2, e2, e3],
  };
  for (const c of container.children) c.parent = container;
  return { container, t1, e1, t2, e2, e3 };
}

function installPapi(): void {
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockNode) => n.tag;
  g['__GetChildren'] = (n: MockNode) => n.children;
  g['__GetParent'] = (n: MockNode) => n.parent;
  g['__FirstElement'] = (n: MockNode) =>
    n.children.length > 0 ? n.children[0] : undefined;
  g['__LastElement'] = (n: MockNode) =>
    n.children.length > 0 ? n.children[n.children.length - 1] : undefined;
  g['__NextElement'] = (n: MockNode) => {
    if (!n.parent) return undefined;
    const i = n.parent.children.indexOf(n);
    return i >= 0 && i + 1 < n.parent.children.length
      ? n.parent.children[i + 1]
      : undefined;
  };
  g['__ElementIsEqual'] = (a: MockNode, b: MockNode) => a === b;
  g['__GetElementUniqueID'] = (n: MockNode) => n.uid;
  g['__GetPageElement'] = () => undefined;
}

describe('US-407 L1 element-tree traversal', () => {
  let tree: ReturnType<typeof build>;

  beforeAll(() => {
    installPapi();
    tree = build();
  });

  describe('children', () => {
    it('returns frozen array of element children only', () => {
      const c = (wrapPapi(tree.container) as L1ReadOnlyElement).children;
      expect(Object.isFrozen(c)).toBe(true);
      expect(c).toHaveLength(3);
      for (const el of c) expect(el).toBeInstanceOf(L1ReadOnlyElement);
    });
  });

  describe('firstElementChild', () => {
    it('skips leading text nodes', () => {
      // First child overall is t1 (text); firstElementChild should be e1.
      const container = wrapPapi(tree.container) as L1ReadOnlyElement;
      expect(container.firstChild).toBeInstanceOf(L1ReadOnlyText);
      const first = container.firstElementChild;
      expect(first).not.toBeNull();
      expect(first?.isSameNode(wrapPapi(tree.e1))).toBe(true);
    });

    it('returns null when no element children', () => {
      const empty = wrapPapi({
        tag: 'view',
        uid: 999,
        parent: undefined,
        children: [],
      } as MockNode) as L1ReadOnlyElement;
      expect(empty.firstElementChild).toBeNull();
    });
  });

  describe('lastElementChild', () => {
    it('returns the last element child', () => {
      const last = (wrapPapi(tree.container) as L1ReadOnlyElement)
        .lastElementChild;
      expect(last?.isSameNode(wrapPapi(tree.e3))).toBe(true);
    });
  });

  describe('nextElementSibling', () => {
    it('skips intervening text nodes', () => {
      // e1's next sibling overall is t2 (text); nextElementSibling should be e2.
      const e1Wrap = wrapPapi(tree.e1) as L1ReadOnlyElement;
      expect(e1Wrap.nextSibling).toBeInstanceOf(L1ReadOnlyText);
      const nextEl = e1Wrap.nextElementSibling;
      expect(nextEl?.isSameNode(wrapPapi(tree.e2))).toBe(true);
    });

    it('returns null at last element', () => {
      const e3Wrap = wrapPapi(tree.e3) as L1ReadOnlyElement;
      expect(e3Wrap.nextElementSibling).toBeNull();
    });
  });

  describe('childElementCount', () => {
    it('counts element children only', () => {
      const container = wrapPapi(tree.container) as L1ReadOnlyElement;
      expect(container.childElementCount).toBe(3);
    });
  });

  it('firstChild and firstElementChild diverge when first is text', () => {
    const container = wrapPapi(tree.container) as L1ReadOnlyElement;
    expect(container.firstChild).toBeInstanceOf(L1ReadOnlyText);
    expect(container.firstElementChild).toBeInstanceOf(L1ReadOnlyElement);
  });
});
