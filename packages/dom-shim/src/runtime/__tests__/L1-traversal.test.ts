// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeAll, describe, expect, it } from 'vitest';

import {
  DOCUMENT_POSITION_CONTAINED_BY,
  DOCUMENT_POSITION_CONTAINS,
  DOCUMENT_POSITION_FOLLOWING,
  DOCUMENT_POSITION_PRECEDING,
  L1ReadOnlyElement,
  L1ReadOnlyNode,
  L1ReadOnlyText,
  NODE_TYPE_ELEMENT,
  NODE_TYPE_TEXT,
  wrapPapi,
} from '../nodes.ts';

interface MockNode extends Record<string, unknown> {
  tag: string;
  uid: number;
  parent: MockNode | undefined;
  children: MockNode[];
}

/**
 * 3-level mock tree:
 *
 *   page
 *   ├── div1 (view)
 *   │   ├── text1 (raw-text)
 *   │   └── span1 (text)
 *   └── div2 (view)
 *       └── img1 (image)
 */
function buildTree() {
  const text1: MockNode = {
    tag: 'raw-text',
    uid: 10,
    parent: undefined,
    children: [],
  };
  const span1: MockNode = {
    tag: 'text',
    uid: 11,
    parent: undefined,
    children: [],
  };
  const img1: MockNode = {
    tag: 'image',
    uid: 20,
    parent: undefined,
    children: [],
  };
  const div1: MockNode = {
    tag: 'view',
    uid: 1,
    parent: undefined,
    children: [text1, span1],
  };
  const div2: MockNode = {
    tag: 'view',
    uid: 2,
    parent: undefined,
    children: [img1],
  };
  const page: MockNode = {
    tag: 'page',
    uid: 0,
    parent: undefined,
    children: [div1, div2],
  };
  text1.parent = div1;
  span1.parent = div1;
  img1.parent = div2;
  div1.parent = page;
  div2.parent = page;
  return { page, div1, div2, text1, span1, img1 };
}

function installPapi(page: MockNode): void {
  const g = globalThis as Record<string, unknown>;
  g['__GetPageElement'] = () => page;
  g['__GetTag'] = (n: MockNode) => n.tag;
  g['__GetParent'] = (n: MockNode) => n.parent;
  g['__GetChildren'] = (n: MockNode) => n.children;
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
  g['__GetElementUniqueID'] = (n: MockNode) => n.uid;
  g['__ElementIsEqual'] = (a: MockNode, b: MockNode) => a === b;
}

describe('US-402 L1 traversal', () => {
  let tree: ReturnType<typeof buildTree>;

  beforeAll(() => {
    tree = buildTree();
    installPapi(tree.page);
  });

  describe('nodeType / nodeName / nodeValue', () => {
    it('L1ReadOnlyElement has nodeType=1', () => {
      const div = new L1ReadOnlyElement(tree.div1);
      expect(div.nodeType).toBe(NODE_TYPE_ELEMENT);
    });

    it('L1ReadOnlyElement.nodeName is Lynx-tag uppercased (placeholder pending US-404)', () => {
      const div = new L1ReadOnlyElement(tree.div1);
      expect(div.nodeName).toBe('VIEW');
    });

    it('L1ReadOnlyElement.nodeValue is null', () => {
      const div = new L1ReadOnlyElement(tree.div1);
      expect(div.nodeValue).toBeNull();
    });

    it('L1ReadOnlyText has nodeType=3 and nodeName=#text', () => {
      const t = new L1ReadOnlyText(tree.text1);
      expect(t.nodeType).toBe(NODE_TYPE_TEXT);
      expect(t.nodeName).toBe('#text');
    });
  });

  describe('parentNode / parentElement', () => {
    it('parentNode walks up the tree', () => {
      const div = wrapPapi(tree.div1);
      const parent = div.parentNode;
      expect(parent).not.toBeNull();
      expect(parent).toBeInstanceOf(L1ReadOnlyElement);
    });

    it('parentNode is null for page-root', () => {
      const page = wrapPapi(tree.page);
      expect(page.parentNode).toBeNull();
    });

    it('parentElement aliases parentNode (same semantic node, distinct wrapper)', () => {
      // wrapPapi mints a fresh wrapper per call (no cache in US-402); we
      // assert semantic identity via isSameNode rather than reference
      // equality. Wrapper caching is a future story (around US-412).
      const text = wrapPapi(tree.text1);
      const a = text.parentElement;
      const b = text.parentNode;
      expect(a).not.toBeNull();
      expect(b).not.toBeNull();
      expect(a?.isSameNode(b)).toBe(true);
    });
  });

  describe('firstChild / lastChild / nextSibling', () => {
    it('firstChild returns the first child', () => {
      const div1 = wrapPapi(tree.div1);
      const first = div1.firstChild;
      expect(first).not.toBeNull();
      expect(first?.isSameNode(wrapPapi(tree.text1))).toBe(true);
    });

    it('lastChild returns the last child', () => {
      const div1 = wrapPapi(tree.div1);
      const last = div1.lastChild;
      expect(last?.isSameNode(wrapPapi(tree.span1))).toBe(true);
    });

    it('nextSibling walks across siblings', () => {
      const text = wrapPapi(tree.text1);
      const next = text.nextSibling;
      expect(next?.isSameNode(wrapPapi(tree.span1))).toBe(true);
    });

    it('nextSibling returns null at last sibling', () => {
      const span = wrapPapi(tree.span1);
      expect(span.nextSibling).toBeNull();
    });

    it('firstChild on empty element returns null', () => {
      const img = wrapPapi(tree.img1);
      expect(img.firstChild).toBeNull();
    });
  });

  describe('childNodes', () => {
    it('returns a frozen snapshot of children', () => {
      const div = wrapPapi(tree.div1);
      const c = div.childNodes;
      expect(c).toHaveLength(2);
      expect(Object.isFrozen(c)).toBe(true);
    });

    it('reflects mixed text + element children', () => {
      const div = wrapPapi(tree.div1);
      const c = div.childNodes;
      expect(c[0]).toBeInstanceOf(L1ReadOnlyText);
      expect(c[1]).toBeInstanceOf(L1ReadOnlyElement);
    });
  });

  describe('hasChildNodes', () => {
    it('returns true when children present', () => {
      expect(wrapPapi(tree.div1).hasChildNodes()).toBe(true);
    });

    it('returns false when empty', () => {
      expect(wrapPapi(tree.img1).hasChildNodes()).toBe(false);
    });
  });

  describe('isConnected / getRootNode', () => {
    it('connected nodes walk up to page', () => {
      expect(wrapPapi(tree.text1).isConnected).toBe(true);
    });

    it('detached node returns false', () => {
      const detached: MockNode = {
        tag: 'view',
        uid: 999,
        parent: undefined,
        children: [],
      };
      expect(wrapPapi(detached).isConnected).toBe(false);
    });

    it('getRootNode returns page from leaf', () => {
      const root = wrapPapi(tree.text1).getRootNode();
      expect(root.isSameNode(wrapPapi(tree.page))).toBe(true);
    });
  });

  describe('contains / compareDocumentPosition', () => {
    it('contains: ancestor contains descendant', () => {
      const page = wrapPapi(tree.page);
      const text = wrapPapi(tree.text1);
      expect(page.contains(text)).toBe(true);
    });

    it('contains: returns true for self', () => {
      const div = wrapPapi(tree.div1);
      expect(div.contains(div)).toBe(true);
    });

    it('contains: false for unrelated', () => {
      const div1 = wrapPapi(tree.div1);
      const img = wrapPapi(tree.img1);
      expect(div1.contains(img)).toBe(false);
    });

    it('compareDocumentPosition: self → 0', () => {
      const div = wrapPapi(tree.div1);
      expect(div.compareDocumentPosition(div)).toBe(0);
    });

    it('compareDocumentPosition: descendant → CONTAINED_BY | FOLLOWING', () => {
      const page = wrapPapi(tree.page);
      const text = wrapPapi(tree.text1);
      expect(page.compareDocumentPosition(text)).toBe(
        DOCUMENT_POSITION_CONTAINED_BY | DOCUMENT_POSITION_FOLLOWING,
      );
    });

    it('compareDocumentPosition: ancestor → CONTAINS | PRECEDING', () => {
      const page = wrapPapi(tree.page);
      const text = wrapPapi(tree.text1);
      expect(text.compareDocumentPosition(page)).toBe(
        DOCUMENT_POSITION_CONTAINS | DOCUMENT_POSITION_PRECEDING,
      );
    });

    it('compareDocumentPosition: unrelated → ID-ordered', () => {
      const div1 = wrapPapi(tree.div1);
      const img = wrapPapi(tree.img1);
      // div1 uid=1 < img1 uid=20 → FOLLOWING.
      expect(div1.compareDocumentPosition(img)).toBe(
        DOCUMENT_POSITION_FOLLOWING,
      );
      expect(img.compareDocumentPosition(div1)).toBe(
        DOCUMENT_POSITION_PRECEDING,
      );
    });
  });

  describe('isEqualNode / isSameNode', () => {
    it('isSameNode true when wrapping same ref', () => {
      const a = wrapPapi(tree.div1);
      const b = wrapPapi(tree.div1);
      expect(a.isSameNode(b)).toBe(true);
    });

    it('isSameNode false across nodes', () => {
      const a = wrapPapi(tree.div1);
      const b = wrapPapi(tree.div2);
      expect(a.isSameNode(b)).toBe(false);
    });

    it('isEqualNode follows __ElementIsEqual', () => {
      const a = wrapPapi(tree.div1);
      expect(a.isEqualNode(wrapPapi(tree.div1))).toBe(true);
      expect(a.isEqualNode(wrapPapi(tree.div2))).toBe(false);
    });

    it('isSameNode / isEqualNode on null returns false', () => {
      const a = wrapPapi(tree.div1);
      expect(a.isSameNode(null)).toBe(false);
      expect(a.isEqualNode(null)).toBe(false);
    });
  });

  it('wrapPapi returns L1ReadOnlyNode subclasses', () => {
    expect(wrapPapi(tree.page)).toBeInstanceOf(L1ReadOnlyNode);
    expect(wrapPapi(tree.div1)).toBeInstanceOf(L1ReadOnlyElement);
    expect(wrapPapi(tree.text1)).toBeInstanceOf(L1ReadOnlyText);
  });
});

/**
 * US-403 — previousSibling (O(n)) and previousElementSibling on a 5-sibling
 * tree with mixed element + text children.
 *
 *   parent (uid=100, view)
 *   ├── a (uid=101, view) — element
 *   ├── b (uid=102, raw-text) — text
 *   ├── c (uid=103, view) — element
 *   ├── d (uid=104, view) — element
 *   └── e (uid=105, raw-text) — text
 */
describe('US-403 previousSibling and previousElementSibling', () => {
  let parent: MockNode;
  let a: MockNode;
  let b: MockNode;
  let c: MockNode;
  let d: MockNode;
  let e: MockNode;

  beforeAll(() => {
    a = { tag: 'view', uid: 101, parent: undefined, children: [] };
    b = { tag: 'raw-text', uid: 102, parent: undefined, children: [] };
    c = { tag: 'view', uid: 103, parent: undefined, children: [] };
    d = { tag: 'view', uid: 104, parent: undefined, children: [] };
    e = { tag: 'raw-text', uid: 105, parent: undefined, children: [] };
    parent = {
      tag: 'view',
      uid: 100,
      parent: undefined,
      children: [a, b, c, d, e],
    };
    a.parent = parent;
    b.parent = parent;
    c.parent = parent;
    d.parent = parent;
    e.parent = parent;
    // The earlier tree's __XXX globals are still installed but they look up
    // via __GetParent / __GetChildren which only depend on the MockNode
    // shape — they continue to work for this new tree without rebinding.
  });

  it('previousSibling: first child returns null', () => {
    expect(wrapPapi(a).previousSibling).toBeNull();
  });

  it('previousSibling: text after element returns the element', () => {
    expect(wrapPapi(b).previousSibling?.isSameNode(wrapPapi(a))).toBe(true);
  });

  it('previousSibling: element after text returns the text', () => {
    const prev = wrapPapi(c).previousSibling;
    expect(prev).toBeInstanceOf(L1ReadOnlyText);
    expect(prev?.isSameNode(wrapPapi(b))).toBe(true);
  });

  it('previousSibling: element after element', () => {
    expect(wrapPapi(d).previousSibling?.isSameNode(wrapPapi(c))).toBe(true);
  });

  it('previousSibling: text after element (last sibling)', () => {
    expect(wrapPapi(e).previousSibling?.isSameNode(wrapPapi(d))).toBe(true);
  });

  it('previousSibling: parentless node returns null', () => {
    const detached: MockNode = {
      tag: 'view',
      uid: 999,
      parent: undefined,
      children: [],
    };
    expect(wrapPapi(detached).previousSibling).toBeNull();
  });

  it('previousElementSibling: skips text nodes', () => {
    const cEl = wrapPapi(c);
    expect(cEl).toBeInstanceOf(L1ReadOnlyElement);
    // c's previous DOM sibling is text b; previousElementSibling skips to a.
    const prevEl = (cEl as L1ReadOnlyElement).previousElementSibling;
    expect(prevEl).not.toBeNull();
    expect(prevEl?.isSameNode(wrapPapi(a))).toBe(true);
  });

  it('previousElementSibling: returns null for first element', () => {
    const aEl = wrapPapi(a) as L1ReadOnlyElement;
    expect(aEl.previousElementSibling).toBeNull();
  });

  it('previousElementSibling: adjacent element returns it directly', () => {
    const dEl = wrapPapi(d) as L1ReadOnlyElement;
    expect(dEl.previousElementSibling?.isSameNode(wrapPapi(c))).toBe(true);
  });
});
