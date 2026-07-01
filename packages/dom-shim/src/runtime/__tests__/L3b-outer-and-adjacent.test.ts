// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { wrapPapi } from '../nodes.ts';
import type { L3bUnsafeWritableElement } from '../nodes.ts';
import { _resetSchedulerForTesting } from '../scheduler.ts';

interface MockEl extends Record<string, unknown> {
  tag: string;
  uid: number;
  attrs: Record<string, unknown>;
  text?: string;
  parent: MockEl | undefined;
  children: MockEl[];
}

let nextUid = 17000;
let page: MockEl;

function mk(tag: string): MockEl {
  return {
    tag,
    uid: nextUid++,
    attrs: {},
    parent: undefined,
    children: [],
  };
}

function installPapi(): void {
  nextUid = 17000;
  page = mk('page');
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockEl) => n.tag;
  g['__GetPageElement'] = () => page;
  g['__GetElementUniqueID'] = (n: MockEl) => n.uid;
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
  g['__ElementIsEqual'] = (a: MockEl, b: MockEl) => a === b;
  g['__GetAttributes'] = (n: MockEl) => n.attrs;
  g['__GetAttributeByName'] = (n: MockEl, name: string) => n.attrs[name];
  g['__SetAttribute'] = (n: MockEl, name: string, value: unknown) => {
    if (value === undefined) delete n.attrs[name];
    else n.attrs[name] = value;
  };
  g['__GetID'] = () => '';
  g['__GetClasses'] = (n: MockEl) =>
    ((n.attrs['class'] as string | undefined) ?? '').split(/\s+/).filter(
      Boolean,
    );
  g['__SetClasses'] = (n: MockEl, v: string | undefined) => {
    if (v === undefined || v === '') delete n.attrs['class'];
    else n.attrs['class'] = v;
  };
  g['__AddInlineStyle'] = () => undefined;
  g['__CreateView'] = () => mk('view');
  g['__CreateText'] = () => mk('text');
  g['__CreateImage'] = () => mk('image');
  g['__CreateScrollView'] = () => mk('scroll-view');
  g['__CreateElement'] = (tag: string) => mk(tag);
  g['__CreateRawText'] = (text: string): MockEl => {
    const r = mk('raw-text');
    r.text = text;
    return r;
  };
  g['__AppendElement'] = (parent: MockEl, child: MockEl) => {
    if (child.parent) {
      const i = child.parent.children.indexOf(child);
      if (i >= 0) child.parent.children.splice(i, 1);
    }
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
  g['__AddEvent'] = () => undefined;
  g['__FlushElementTree'] = () => undefined;
}

describe('US-445 L3b outerHTML + insertAdjacentHTML', () => {
  beforeEach(() => {
    _resetSchedulerForTesting();
    installPapi();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _resetSchedulerForTesting();
  });

  describe('outerHTML getter', () => {
    it('wraps innerHTML in self tag + attrs', () => {
      const root = mk('view');
      root.attrs['id'] = 'root';
      const e = wrapPapi(root) as L3bUnsafeWritableElement;
      e.innerHTML = '<span>hi</span>';
      const out = e.outerHTML;
      expect(out).toMatch(/^<div[^>]*>/);
      expect(out).toMatch(/<\/div>$/);
      expect(out).toMatch(/id="root"/);
      expect(out).toMatch(/<span>hi<\/span>/);
    });
  });

  describe('outerHTML setter', () => {
    it('replaces self in parent', () => {
      const parent = mk('view');
      const self = mk('view');
      parent.children = [self];
      self.parent = parent;
      const selfWrap = wrapPapi(self) as L3bUnsafeWritableElement;
      selfWrap.outerHTML = '<span>replaced</span>';
      expect(parent.children).toHaveLength(1);
      expect(parent.children[0]?.tag).toBe('text');
    });

    it('no-op on detached element', () => {
      const e = wrapPapi(mk('view')) as L3bUnsafeWritableElement;
      expect(() => {
        e.outerHTML = '<span>x</span>';
      }).not.toThrow();
    });
  });

  describe('insertAdjacentHTML', () => {
    it('beforebegin inserts before self in parent', () => {
      const parent = mk('view');
      const self = mk('view');
      parent.children = [self];
      self.parent = parent;
      const selfWrap = wrapPapi(self) as L3bUnsafeWritableElement;
      selfWrap.insertAdjacentHTML('beforebegin', '<span>before</span>');
      expect(parent.children).toHaveLength(2);
      expect(parent.children[0]?.tag).toBe('text');
      expect(parent.children[1]).toBe(self);
    });

    it('afterbegin inserts as first child', () => {
      const self = mk('view');
      const existing = mk('view');
      self.children = [existing];
      existing.parent = self;
      const selfWrap = wrapPapi(self) as L3bUnsafeWritableElement;
      selfWrap.insertAdjacentHTML('afterbegin', '<span>first</span>');
      expect(self.children).toHaveLength(2);
      expect(self.children[0]?.tag).toBe('text');
      expect(self.children[1]).toBe(existing);
    });

    it('beforeend inserts as last child', () => {
      const self = mk('view');
      const existing = mk('view');
      self.children = [existing];
      existing.parent = self;
      const selfWrap = wrapPapi(self) as L3bUnsafeWritableElement;
      selfWrap.insertAdjacentHTML('beforeend', '<span>last</span>');
      expect(self.children).toHaveLength(2);
      expect(self.children[0]).toBe(existing);
      expect(self.children[1]?.tag).toBe('text');
    });

    it('afterend inserts after self in parent', () => {
      const parent = mk('view');
      const self = mk('view');
      const next = mk('view');
      parent.children = [self, next];
      self.parent = parent;
      next.parent = parent;
      const selfWrap = wrapPapi(self) as L3bUnsafeWritableElement;
      selfWrap.insertAdjacentHTML('afterend', '<span>between</span>');
      expect(parent.children).toHaveLength(3);
      expect(parent.children[0]).toBe(self);
      expect(parent.children[1]?.tag).toBe('text');
      expect(parent.children[2]).toBe(next);
    });

    it('afterend at last position appends', () => {
      const parent = mk('view');
      const self = mk('view');
      parent.children = [self];
      self.parent = parent;
      const selfWrap = wrapPapi(self) as L3bUnsafeWritableElement;
      selfWrap.insertAdjacentHTML('afterend', '<span>after</span>');
      expect(parent.children).toHaveLength(2);
      expect(parent.children[1]?.tag).toBe('text');
    });
  });

  describe('insertAdjacentText', () => {
    it('inserts text via raw-text node', () => {
      const self = mk('view');
      const selfWrap = wrapPapi(self) as L3bUnsafeWritableElement;
      selfWrap.insertAdjacentText('beforeend', 'hi');
      expect(self.children).toHaveLength(1);
      expect(self.children[0]?.tag).toBe('raw-text');
    });

    it('escapes HTML special chars', () => {
      const parent = mk('view');
      const self = mk('view');
      parent.children = [self];
      self.parent = parent;
      const selfWrap = wrapPapi(self) as L3bUnsafeWritableElement;
      selfWrap.insertAdjacentText('beforebegin', '<x>');
      // Should become a single raw-text node, NOT a <x> element.
      expect(parent.children).toHaveLength(2);
      expect(parent.children[0]?.tag).toBe('raw-text');
    });
  });
});
