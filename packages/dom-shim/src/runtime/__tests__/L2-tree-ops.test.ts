// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { wrapPapi } from '../nodes.ts';
import type { L2SafeWritableElement } from '../nodes.ts';
import { _resetSchedulerForTesting } from '../scheduler.ts';

interface MockEl extends Record<string, unknown> {
  tag: string;
  uid: number;
  parent: MockEl | undefined;
  children: MockEl[];
}

function mk(tag: string, uid: number): MockEl {
  return { tag, uid, parent: undefined, children: [] };
}

function installPapi(): void {
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockEl) => n.tag;
  g['__GetParent'] = (n: MockEl) => n.parent;
  g['__GetChildren'] = (n: MockEl) => n.children;
  g['__FirstElement'] = (n: MockEl) =>
    n.children.length > 0 ? n.children[0] : undefined;
  g['__LastElement'] = (n: MockEl) =>
    n.children.length > 0 ? n.children[n.children.length - 1] : undefined;
  g['__NextElement'] = (n: MockEl) => {
    if (!n.parent) return undefined;
    const i = n.parent.children.indexOf(n);
    return i >= 0 && i + 1 < n.parent.children.length
      ? n.parent.children[i + 1]
      : undefined;
  };
  g['__GetElementUniqueID'] = (n: MockEl) => n.uid;
  g['__ElementIsEqual'] = (a: MockEl, b: MockEl) => a === b;
  g['__GetPageElement'] = () => undefined;
  g['__AppendElement'] = (parent: MockEl, child: MockEl) => {
    parent.children.push(child);
    child.parent = parent;
    return child;
  };
  g['__RemoveElement'] = (parent: MockEl, child: MockEl) => {
    const i = parent.children.indexOf(child);
    if (i >= 0) parent.children.splice(i, 1);
    child.parent = undefined;
    return child;
  };
  g['__InsertElementBefore'] = (
    parent: MockEl,
    child: MockEl,
    ref?: MockEl,
  ) => {
    if (ref) {
      const i = parent.children.indexOf(ref);
      parent.children.splice(i, 0, child);
    } else {
      parent.children.push(child);
    }
    child.parent = parent;
    return child;
  };
  g['__ReplaceElement'] = (newEl: MockEl, oldEl: MockEl) => {
    const parent = oldEl.parent;
    if (!parent) return;
    const i = parent.children.indexOf(oldEl);
    parent.children[i] = newEl;
    newEl.parent = parent;
    oldEl.parent = undefined;
  };
  g['__FlushElementTree'] = () => undefined;
}

describe('US-421 L2 tree mutation (appendChild/insertBefore/removeChild/replaceChild)', () => {
  beforeEach(() => {
    _resetSchedulerForTesting();
    installPapi();
  });

  afterEach(() => {
    _resetSchedulerForTesting();
  });

  describe('appendChild', () => {
    it('attaches a fresh node to the parent', () => {
      const parent = mk('view', 1);
      const child = mk('view', 2);
      const p = wrapPapi(parent) as L2SafeWritableElement;
      const c = wrapPapi(child);
      const returned = p.appendChild(c);
      expect(returned).toBe(c);
      expect(parent.children).toContain(child);
      expect(child.parent).toBe(parent);
    });

    it('moves a node from one parent to another (spec re-parent)', () => {
      const a = mk('view', 1);
      const b = mk('view', 2);
      const c = mk('view', 3);
      a.children = [c];
      c.parent = a;
      const aWrap = wrapPapi(a) as L2SafeWritableElement;
      const bWrap = wrapPapi(b) as L2SafeWritableElement;
      const cWrap = wrapPapi(c);
      bWrap.appendChild(cWrap);
      expect(a.children).not.toContain(c);
      expect(b.children).toContain(c);
      expect(c.parent).toBe(b);
      expect(aWrap.childNodes).toHaveLength(0);
    });
  });

  describe('insertBefore', () => {
    it('inserts before the reference child', () => {
      const parent = mk('view', 1);
      const a = mk('view', 2);
      const b = mk('view', 3);
      parent.children = [a];
      a.parent = parent;
      const p = wrapPapi(parent) as L2SafeWritableElement;
      const ref = wrapPapi(a);
      const newChild = wrapPapi(b);
      p.insertBefore(newChild, ref);
      expect(parent.children).toEqual([b, a]);
    });

    it('null refNode behaves as appendChild', () => {
      const parent = mk('view', 1);
      const a = mk('view', 2);
      const b = mk('view', 3);
      parent.children = [a];
      a.parent = parent;
      const p = wrapPapi(parent) as L2SafeWritableElement;
      p.insertBefore(wrapPapi(b), null);
      expect(parent.children).toEqual([a, b]);
    });
  });

  describe('removeChild', () => {
    it('detaches and returns the child', () => {
      const parent = mk('view', 1);
      const child = mk('view', 2);
      parent.children = [child];
      child.parent = parent;
      const p = wrapPapi(parent) as L2SafeWritableElement;
      const c = wrapPapi(child);
      const ret = p.removeChild(c);
      expect(ret).toBe(c);
      expect(parent.children).not.toContain(child);
      expect(child.parent).toBeUndefined();
    });

    it('throws NotFoundError when child is not actually a child', () => {
      const a = mk('view', 1);
      const b = mk('view', 2);
      const c = mk('view', 3);
      a.children = [];
      b.children = [c];
      c.parent = b;
      const aWrap = wrapPapi(a) as L2SafeWritableElement;
      expect(() => aWrap.removeChild(wrapPapi(c))).toThrow(/NotFoundError/);
    });
  });

  describe('replaceChild', () => {
    it('swaps old for new and returns old', () => {
      const parent = mk('view', 1);
      const oldChild = mk('view', 2);
      const newChild = mk('view', 3);
      parent.children = [oldChild];
      oldChild.parent = parent;
      const p = wrapPapi(parent) as L2SafeWritableElement;
      const oldW = wrapPapi(oldChild);
      const newW = wrapPapi(newChild);
      const ret = p.replaceChild(newW, oldW);
      expect(ret).toBe(oldW);
      expect(parent.children).toContain(newChild);
      expect(parent.children).not.toContain(oldChild);
      expect(newChild.parent).toBe(parent);
    });

    it('throws when oldChild is not a child', () => {
      const a = mk('view', 1);
      const b = mk('view', 2);
      const c = mk('view', 3);
      b.children = [c];
      c.parent = b;
      const aWrap = wrapPapi(a) as L2SafeWritableElement;
      expect(() => aWrap.replaceChild(wrapPapi(mk('view', 4)), wrapPapi(c)))
        .toThrow(/NotFoundError/);
    });
  });

  it('tree-integrity invariant after multiple ops', () => {
    const parent = mk('view', 1);
    const p = wrapPapi(parent) as L2SafeWritableElement;
    const a = mk('view', 2);
    const b = mk('view', 3);
    const c = mk('view', 4);
    p.appendChild(wrapPapi(a));
    p.appendChild(wrapPapi(b));
    p.appendChild(wrapPapi(c));
    expect(p.childNodes).toHaveLength(3);
    p.removeChild(wrapPapi(b));
    expect(p.childNodes).toHaveLength(2);
    p.insertBefore(wrapPapi(b), wrapPapi(c));
    expect(parent.children).toEqual([a, b, c]);
  });

  it('mutations schedule auto-flush exactly once per microtask', async () => {
    let flushed = 0;
    (globalThis as Record<string, unknown>)['__FlushElementTree'] = () => {
      flushed++;
    };
    const parent = mk('view', 1);
    const p = wrapPapi(parent) as L2SafeWritableElement;
    p.appendChild(wrapPapi(mk('view', 2)));
    p.appendChild(wrapPapi(mk('view', 3)));
    p.appendChild(wrapPapi(mk('view', 4)));
    expect(flushed).toBe(0);
    await new Promise<void>((r) => {
      queueMicrotask(r);
    });
    expect(flushed).toBe(1);
  });
});
