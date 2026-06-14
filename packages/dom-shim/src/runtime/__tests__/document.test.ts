// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { _resetDocumentForTesting, document, setBody } from '../document.ts';
import {
  L1ReadOnlyElement,
  L1ReadOnlyText,
  ShimDocumentFragment,
} from '../nodes.ts';

interface MockEl extends Record<string, unknown> {
  tag: string;
  uid: number;
  attrs: Record<string, unknown>;
  parent: MockEl | undefined;
  children: MockEl[];
}

let nextUid = 9000;
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
  page = mk('page');
  page.uid = 1;
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockEl) => n.tag;
  g['__GetPageElement'] = () => page;
  g['__GetElementUniqueID'] = (n: MockEl) => n.uid;
  g['__GetParent'] = (n: MockEl) => n.parent;
  g['__GetChildren'] = (n: MockEl) => n.children;
  g['__FirstElement'] = (n: MockEl) =>
    n.children.length > 0 ? n.children[0] : undefined;
  g['__GetAttributes'] = (n: MockEl) => n.attrs;
  g['__GetAttributeByName'] = (n: MockEl, name: string) => n.attrs[name];
  g['__SetAttribute'] = (n: MockEl, name: string, value: unknown) => {
    if (value === undefined) delete n.attrs[name];
    else n.attrs[name] = value;
  };
  g['__ElementIsEqual'] = (a: MockEl, b: MockEl) => a === b;
  g['__CreateView'] = () => mk('view');
  g['__CreateText'] = () => mk('text');
  g['__CreateImage'] = () => mk('image');
  g['__CreateScrollView'] = () => mk('scroll-view');
  g['__CreateElement'] = (tag: string) => mk(tag);
  g['__CreateRawText'] = (text: string): MockEl => {
    const r = mk('raw-text');
    (r as MockEl & { text?: string }).text = text;
    return r;
  };
  g['__CreateWrapperElement'] = () => mk('wrapper');
  g['__QuerySelector'] = (root: MockEl, sel: string): MockEl | undefined => {
    function visit(n: MockEl): MockEl | undefined {
      for (const c of n.children) {
        if (matches(c, sel)) return c;
        const r = visit(c);
        if (r) return r;
      }
      return undefined;
    }
    return visit(root);
  };
  g['__QuerySelectorAll'] = (root: MockEl, sel: string): MockEl[] => {
    const out: MockEl[] = [];
    function visit(n: MockEl): void {
      for (const c of n.children) {
        if (matches(c, sel)) out.push(c);
        visit(c);
      }
    }
    visit(root);
    return out;
  };
}

function matches(n: MockEl, sel: string): boolean {
  if (sel.startsWith('#')) return n.attrs['id'] === sel.slice(1);
  if (sel.startsWith('.')) {
    const classes = (n.attrs['class'] as string | undefined)?.split(/\s+/)
      ?? [];
    return classes.includes(sel.slice(1));
  }
  return n.tag === sel;
}

describe('US-425 document API', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    nextUid = 9000;
    installPapi();
    _resetDocumentForTesting();
    setBody(null);
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createElement', () => {
    it('div → __CreateView', () => {
      const e = document.createElement('div');
      expect(e).toBeInstanceOf(L1ReadOnlyElement);
      expect(e.tagName).toBe('DIV');
    });

    it('span → __CreateText', () => {
      const e = document.createElement('span');
      expect(e.tagName).toBe('SPAN');
    });

    it('img → __CreateImage', () => {
      const e = document.createElement('img');
      expect(e.tagName).toBe('IMG');
    });

    it('input → __CreateElement(input)', () => {
      const e = document.createElement('input');
      expect(e.tagName).toBe('INPUT');
    });

    it('scroll-view → __CreateScrollView', () => {
      const e = document.createElement('scroll-view');
      // Underlying Lynx tag is 'scroll-view'; the reverse map sends it
      // back to DIV for spec-shaped tagName output.
      expect((e.papi as { tag: string }).tag).toBe('scroll-view');
      expect(e.tagName).toBe('DIV');
    });

    it('h1..h6 → __CreateText', () => {
      for (const h of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
        const e = document.createElement(h);
        expect(e.tagName).toBe('SPAN'); // text maps back to SPAN via reverse map
      }
    });

    it('unmapped tag → view + data-shim-tag', () => {
      const e = document.createElement('custom-thing');
      // Reverse Lynx→HTML mapping for the underlying 'view' is DIV.
      expect(e.tagName).toBe('DIV');
      expect(e.getAttribute('data-shim-tag')).toBe('custom-thing');
    });

    it('is case-insensitive', () => {
      const e = document.createElement('DIV');
      expect(e.tagName).toBe('DIV');
    });
  });

  describe('createTextNode', () => {
    it('returns L1ReadOnlyText with nodeValue set', () => {
      const t = document.createTextNode('hello');
      expect(t).toBeInstanceOf(L1ReadOnlyText);
      expect(t.nodeValue).toBe('hello');
    });
  });

  describe('createDocumentFragment', () => {
    it('returns ShimDocumentFragment', () => {
      const frag = document.createDocumentFragment();
      expect(frag).toBeInstanceOf(ShimDocumentFragment);
    });
  });

  describe('body / documentElement', () => {
    it('documentElement returns the page element wrapped', () => {
      const root = document.documentElement;
      expect(root).toBeInstanceOf(L1ReadOnlyElement);
    });

    it('body defaults to first page child when present', () => {
      const child = mk('view');
      child.parent = page;
      page.children = [child];
      const body = document.body;
      expect(body.papi).toBe(child);
    });

    it('body falls back to page itself when childless', () => {
      const body = document.body;
      expect(body.papi).toBe(page);
    });

    it('body logs choice via console.info once', () => {
      const a = document.body;
      const b = document.body;
      const c = document.body;
      expect(a.isSameNode(b)).toBe(true);
      expect(b.isSameNode(c)).toBe(true);
      expect(infoSpy).toHaveBeenCalledTimes(1);
    });

    it('setBody override pins the body', () => {
      const override = mk('view');
      setBody(override);
      expect(document.body.papi).toBe(override);
    });
  });

  describe('querySelector / querySelectorAll', () => {
    it('finds elements rooted at the page', () => {
      const child = mk('view');
      child.attrs['id'] = 'main';
      page.children = [child];
      child.parent = page;
      const found = document.querySelector('#main');
      expect(found?.papi).toBe(child);
    });

    it('returns null when nothing matches', () => {
      expect(document.querySelector('#missing')).toBeNull();
    });

    it('getElementById delegates to querySelector', () => {
      const child = mk('view');
      child.attrs['id'] = 'x';
      page.children = [child];
      child.parent = page;
      expect(document.getElementById('x')?.papi).toBe(child);
    });

    it('getElementsByClassName uses .class selector', () => {
      const a = mk('view');
      a.attrs['class'] = 'card';
      page.children = [a];
      a.parent = page;
      const found = document.getElementsByClassName('card');
      expect(found).toHaveLength(1);
    });

    it('getElementsByTagName uses tag selector', () => {
      const a = mk('view');
      page.children = [a];
      a.parent = page;
      const found = document.getElementsByTagName('VIEW');
      expect(found).toHaveLength(1);
    });
  });
});
