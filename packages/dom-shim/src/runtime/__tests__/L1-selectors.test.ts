// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeAll, describe, expect, it } from 'vitest';

import { wrapPapi } from '../nodes.ts';
import type { L1ReadOnlyElement } from '../nodes.ts';

interface MockNode extends Record<string, unknown> {
  tag: string;
  id?: string;
  classes?: string[];
  uid: number;
  parent: MockNode | undefined;
  children: MockNode[];
}

/**
 * 5-element tree for selector tests:
 *
 *   root (view, id=root)
 *   ├── header (view, .header)
 *   │   └── title (text, .header-title)
 *   └── main (view, id=main, .container)
 *       ├── btn1 (view, .btn .primary)
 *       └── btn2 (view, .btn)
 */
function build(): {
  root: MockNode;
  header: MockNode;
  title: MockNode;
  main: MockNode;
  btn1: MockNode;
  btn2: MockNode;
} {
  const title: MockNode = {
    tag: 'text',
    classes: ['header-title'],
    uid: 4,
    parent: undefined,
    children: [],
  };
  const header: MockNode = {
    tag: 'view',
    classes: ['header'],
    uid: 2,
    parent: undefined,
    children: [title],
  };
  const btn1: MockNode = {
    tag: 'view',
    classes: ['btn', 'primary'],
    uid: 5,
    parent: undefined,
    children: [],
  };
  const btn2: MockNode = {
    tag: 'view',
    classes: ['btn'],
    uid: 6,
    parent: undefined,
    children: [],
  };
  const main: MockNode = {
    tag: 'view',
    id: 'main',
    classes: ['container'],
    uid: 3,
    parent: undefined,
    children: [btn1, btn2],
  };
  const root: MockNode = {
    tag: 'view',
    id: 'root',
    uid: 1,
    parent: undefined,
    children: [header, main],
  };
  title.parent = header;
  header.parent = root;
  main.parent = root;
  btn1.parent = main;
  btn2.parent = main;
  return { root, header, title, main, btn1, btn2 };
}

/** Tiny CSS-subset matcher supporting #id, .class, tag, *. */
function matches(n: MockNode, sel: string): boolean {
  if (sel === '*') return true;
  if (sel.startsWith('#')) return n.id === sel.slice(1);
  if (sel.startsWith('.')) return (n.classes ?? []).includes(sel.slice(1));
  return n.tag === sel;
}

function querySelectorAllSubtree(root: MockNode, sel: string): MockNode[] {
  const out: MockNode[] = [];
  // Spec QuerySelectorAll does NOT include the root in results.
  function visit(n: MockNode): void {
    for (const c of n.children) {
      if (matches(c, sel)) out.push(c);
      visit(c);
    }
  }
  visit(root);
  return out;
}

function installPapi(): void {
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockNode) => n.tag;
  g['__GetParent'] = (n: MockNode) => n.parent;
  g['__GetChildren'] = (n: MockNode) => n.children;
  g['__ElementIsEqual'] = (a: MockNode, b: MockNode) => a === b;
  g['__GetElementUniqueID'] = (n: MockNode) => n.uid;
  g['__GetPageElement'] = () => undefined;
  g['__QuerySelectorAll'] = (root: MockNode, sel: string) =>
    querySelectorAllSubtree(root, sel);
  g['__QuerySelector'] = (root: MockNode, sel: string) =>
    querySelectorAllSubtree(root, sel)[0];
}

describe('US-408 L1 selectors', () => {
  let tree: ReturnType<typeof build>;

  beforeAll(() => {
    installPapi();
    tree = build();
  });

  describe('querySelector', () => {
    it('class selector returns first match', () => {
      const result = (wrapPapi(tree.root) as L1ReadOnlyElement).querySelector(
        '.btn',
      );
      expect(result?.isSameNode(wrapPapi(tree.btn1))).toBe(true);
    });

    it('id selector returns the unique match', () => {
      const result = (wrapPapi(tree.root) as L1ReadOnlyElement).querySelector(
        '#main',
      );
      expect(result?.isSameNode(wrapPapi(tree.main))).toBe(true);
    });

    it('returns null when nothing matches', () => {
      const result = (wrapPapi(tree.root) as L1ReadOnlyElement).querySelector(
        '.missing',
      );
      expect(result).toBeNull();
    });
  });

  describe('querySelectorAll', () => {
    it('returns all matches as a frozen array', () => {
      const result = (
        wrapPapi(tree.root) as L1ReadOnlyElement
      ).querySelectorAll('.btn');
      expect(Object.isFrozen(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]?.isSameNode(wrapPapi(tree.btn1))).toBe(true);
      expect(result[1]?.isSameNode(wrapPapi(tree.btn2))).toBe(true);
    });

    it('tag selector', () => {
      const result = (
        wrapPapi(tree.root) as L1ReadOnlyElement
      ).querySelectorAll('text');
      // Only `title` has tag 'text'.
      expect(result).toHaveLength(1);
    });
  });

  describe('matches', () => {
    it('returns true when element matches class selector', () => {
      expect((wrapPapi(tree.btn1) as L1ReadOnlyElement).matches('.btn')).toBe(
        true,
      );
    });

    it('returns true when element matches id selector', () => {
      expect((wrapPapi(tree.main) as L1ReadOnlyElement).matches('#main')).toBe(
        true,
      );
    });

    it('returns false when selector does not match', () => {
      expect((wrapPapi(tree.btn1) as L1ReadOnlyElement).matches('.header'))
        .toBe(
          false,
        );
    });

    it('returns true when element matches tag selector', () => {
      expect(
        (wrapPapi(tree.header) as L1ReadOnlyElement).matches('view'),
      ).toBe(true);
    });
  });

  describe('closest', () => {
    it('returns self when self matches', () => {
      const btn1 = wrapPapi(tree.btn1) as L1ReadOnlyElement;
      const result = btn1.closest('.btn');
      expect(result?.isSameNode(btn1)).toBe(true);
    });

    it('walks up to find a matching ancestor', () => {
      const btn1 = wrapPapi(tree.btn1) as L1ReadOnlyElement;
      const result = btn1.closest('#main');
      expect(result?.isSameNode(wrapPapi(tree.main))).toBe(true);
    });

    it('returns null when no ancestor matches', () => {
      const btn1 = wrapPapi(tree.btn1) as L1ReadOnlyElement;
      expect(btn1.closest('.missing')).toBeNull();
    });
  });
});
