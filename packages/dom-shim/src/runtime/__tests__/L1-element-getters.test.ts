// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeAll, describe, expect, it } from 'vitest';

import { ReadOnlyDOMTokenList } from '../classlist.ts';
import { wrapPapi } from '../nodes.ts';
import type { L1ReadOnlyElement } from '../nodes.ts';

interface MockEl extends Record<string, unknown> {
  tag: string;
  uid: number;
  id?: string;
  classes?: string[];
  parent: MockEl | undefined;
  children: MockEl[];
}

function el(tag: string, opts: Partial<MockEl> = {}): MockEl {
  return {
    tag,
    uid: opts.uid ?? Math.floor(Math.random() * 1e6),
    id: opts.id ?? '',
    classes: opts.classes ?? [],
    parent: undefined,
    children: [],
  };
}

function installPapi(): void {
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockEl) => n.tag;
  g['__GetID'] = (n: MockEl) => n.id ?? '';
  g['__GetClasses'] = (n: MockEl) => n.classes ?? [];
  // The traversal globals from L1-traversal.test.ts may also be needed by
  // some internal calls (e.g. parentNode); reinstall minimal stubs.
  g['__GetParent'] = (n: MockEl) => n.parent;
  g['__GetChildren'] = (n: MockEl) => n.children;
  g['__GetPageElement'] = () => undefined;
  g['__ElementIsEqual'] = (a: MockEl, b: MockEl) => a === b;
}

describe('US-404 L1ReadOnlyElement identity getters', () => {
  beforeAll(() => {
    installPapi();
  });

  describe('tagName / nodeName / localName mapping', () => {
    it('view → DIV', () => {
      const e = wrapPapi(el('view')) as L1ReadOnlyElement;
      expect(e.tagName).toBe('DIV');
      expect(e.nodeName).toBe('DIV');
      expect(e.localName).toBe('div');
    });

    it('text → SPAN', () => {
      const e = wrapPapi(el('text')) as L1ReadOnlyElement;
      expect(e.tagName).toBe('SPAN');
      expect(e.localName).toBe('span');
    });

    it('image → IMG', () => {
      const e = wrapPapi(el('image')) as L1ReadOnlyElement;
      expect(e.tagName).toBe('IMG');
    });

    it('input → INPUT', () => {
      const e = wrapPapi(el('input')) as L1ReadOnlyElement;
      expect(e.tagName).toBe('INPUT');
    });

    it('scroll-view → DIV (mapped)', () => {
      const e = wrapPapi(el('scroll-view')) as L1ReadOnlyElement;
      expect(e.tagName).toBe('DIV');
    });

    it('page → HTML', () => {
      const e = wrapPapi(el('page')) as L1ReadOnlyElement;
      expect(e.tagName).toBe('HTML');
    });

    it('unmapped Lynx tag → uppercase fallback', () => {
      const e = wrapPapi(el('some-future-tag')) as L1ReadOnlyElement;
      expect(e.tagName).toBe('SOME-FUTURE-TAG');
    });
  });

  describe('id', () => {
    it('returns empty string when no id is set', () => {
      const e = wrapPapi(el('view')) as L1ReadOnlyElement;
      expect(e.id).toBe('');
    });

    it('returns the PAPI id', () => {
      const e = wrapPapi(
        el('view', { id: 'main-content' }),
      ) as L1ReadOnlyElement;
      expect(e.id).toBe('main-content');
    });
  });

  describe('className', () => {
    it('returns empty when no classes', () => {
      const e = wrapPapi(el('view')) as L1ReadOnlyElement;
      expect(e.className).toBe('');
    });

    it('space-joins class list', () => {
      const e = wrapPapi(
        el('view', { classes: ['a', 'b', 'c'] }),
      ) as L1ReadOnlyElement;
      expect(e.className).toBe('a b c');
    });
  });

  describe('classList (ReadOnlyDOMTokenList)', () => {
    it('returns a ReadOnlyDOMTokenList', () => {
      const e = wrapPapi(el('view', { classes: ['a'] })) as L1ReadOnlyElement;
      expect(e.classList).toBeInstanceOf(ReadOnlyDOMTokenList);
    });

    it('length reports class count', () => {
      const e = wrapPapi(
        el('view', { classes: ['a', 'b', 'c'] }),
      ) as L1ReadOnlyElement;
      expect(e.classList.length).toBe(3);
    });

    it('contains returns true for present class', () => {
      const e = wrapPapi(
        el('view', { classes: ['foo', 'bar'] }),
      ) as L1ReadOnlyElement;
      expect(e.classList.contains('foo')).toBe(true);
      expect(e.classList.contains('baz')).toBe(false);
    });

    it('item returns the class at index, null OOB', () => {
      const e = wrapPapi(
        el('view', { classes: ['a', 'b'] }),
      ) as L1ReadOnlyElement;
      expect(e.classList.item(0)).toBe('a');
      expect(e.classList.item(1)).toBe('b');
      expect(e.classList.item(2)).toBeNull();
      expect(e.classList.item(-1)).toBeNull();
    });

    it('iterates with for..of', () => {
      const e = wrapPapi(
        el('view', { classes: ['x', 'y', 'z'] }),
      ) as L1ReadOnlyElement;
      const collected: string[] = [];
      for (const c of e.classList) collected.push(c);
      expect(collected).toEqual(['x', 'y', 'z']);
    });

    it('value getter joins with spaces', () => {
      const e = wrapPapi(
        el('view', { classes: ['x', 'y'] }),
      ) as L1ReadOnlyElement;
      expect(e.classList.value).toBe('x y');
    });

    it('toString matches value', () => {
      const e = wrapPapi(
        el('view', { classes: ['a', 'b'] }),
      ) as L1ReadOnlyElement;
      expect(String(e.classList)).toBe('a b');
    });
  });
});
