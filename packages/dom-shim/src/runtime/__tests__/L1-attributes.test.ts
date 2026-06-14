// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeAll, describe, expect, it } from 'vitest';

import { ReadOnlyNamedNodeMap } from '../attributes.ts';
import { wrapPapi } from '../nodes.ts';
import type { L1ReadOnlyElement } from '../nodes.ts';

interface MockEl extends Record<string, unknown> {
  tag: string;
  attrs: Record<string, unknown>;
}

function installPapi(): void {
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockEl) => n.tag;
  g['__GetAttributeByName'] = (n: MockEl, name: string) => n.attrs[name];
  g['__GetAttributeNames'] = (n: MockEl) => Object.keys(n.attrs);
  g['__GetAttributes'] = (n: MockEl) => n.attrs;
}

function el(attrs: Record<string, unknown> = {}): MockEl {
  return { tag: 'view', attrs };
}

describe('US-405 L1 attribute read surface', () => {
  beforeAll(() => {
    installPapi();
  });

  describe('getAttribute', () => {
    it('returns the stored value as a string', () => {
      const e = wrapPapi(el({ x: '1', y: 'hello' })) as L1ReadOnlyElement;
      expect(e.getAttribute('x')).toBe('1');
      expect(e.getAttribute('y')).toBe('hello');
    });

    it('returns null for absent attribute', () => {
      const e = wrapPapi(el({ x: '1' })) as L1ReadOnlyElement;
      expect(e.getAttribute('missing')).toBeNull();
    });

    it('coerces non-string PAPI values to string', () => {
      const e = wrapPapi(
        el({ count: 42, active: true, score: 3.14 }),
      ) as L1ReadOnlyElement;
      expect(e.getAttribute('count')).toBe('42');
      expect(e.getAttribute('active')).toBe('true');
      expect(e.getAttribute('score')).toBe('3.14');
    });

    it('treats null PAPI value as absent', () => {
      const e = wrapPapi(el({ nope: null })) as L1ReadOnlyElement;
      expect(e.getAttribute('nope')).toBeNull();
    });
  });

  describe('getAttributeNames', () => {
    it('returns the list from PAPI', () => {
      const e = wrapPapi(el({ a: '1', b: '2' })) as L1ReadOnlyElement;
      expect(e.getAttributeNames()).toEqual(['a', 'b']);
    });

    it('returns empty array for no attributes', () => {
      const e = wrapPapi(el()) as L1ReadOnlyElement;
      expect(e.getAttributeNames()).toEqual([]);
    });
  });

  describe('hasAttribute / hasAttributes', () => {
    it('hasAttribute true when present', () => {
      const e = wrapPapi(el({ x: '1' })) as L1ReadOnlyElement;
      expect(e.hasAttribute('x')).toBe(true);
      expect(e.hasAttribute('y')).toBe(false);
    });

    it('hasAttributes reflects count', () => {
      expect(
        (wrapPapi(el()) as L1ReadOnlyElement).hasAttributes(),
      ).toBe(false);
      expect(
        (wrapPapi(el({ x: '1' })) as L1ReadOnlyElement).hasAttributes(),
      ).toBe(true);
    });
  });

  describe('attributes NamedNodeMap', () => {
    it('returns a ReadOnlyNamedNodeMap', () => {
      const e = wrapPapi(el({ x: '1' })) as L1ReadOnlyElement;
      expect(e.attributes).toBeInstanceOf(ReadOnlyNamedNodeMap);
    });

    it('length matches attribute count', () => {
      const e = wrapPapi(el({ a: '1', b: '2', c: '3' })) as L1ReadOnlyElement;
      expect(e.attributes.length).toBe(3);
    });

    it('getNamedItem returns Attr-shaped object', () => {
      const e = wrapPapi(el({ x: 'foo' })) as L1ReadOnlyElement;
      const attr = e.attributes.getNamedItem('x');
      expect(attr).not.toBeNull();
      expect(attr?.name).toBe('x');
      expect(attr?.value).toBe('foo');
      expect(attr?.namespaceURI).toBeNull();
    });

    it('getNamedItem returns null for absent', () => {
      const e = wrapPapi(el()) as L1ReadOnlyElement;
      expect(e.attributes.getNamedItem('missing')).toBeNull();
    });

    it('item returns the Attr at index', () => {
      const e = wrapPapi(el({ a: '1', b: '2' })) as L1ReadOnlyElement;
      expect(e.attributes.item(0)?.name).toBe('a');
      expect(e.attributes.item(1)?.name).toBe('b');
      expect(e.attributes.item(2)).toBeNull();
      expect(e.attributes.item(-1)).toBeNull();
    });

    it('iterates with for..of', () => {
      const e = wrapPapi(el({ a: '1', b: '2' })) as L1ReadOnlyElement;
      const names: string[] = [];
      for (const a of e.attributes) names.push(a.name);
      expect(names).toEqual(['a', 'b']);
    });

    it('setNamedItem throws', () => {
      const e = wrapPapi(el()) as L1ReadOnlyElement;
      expect(() =>
        e.attributes.setNamedItem({
          name: 'x',
          value: '1',
          localName: 'x',
          namespaceURI: null,
          prefix: null,
          ownerElement: null,
        })
      ).toThrow(/unsupported/);
    });

    it('removeNamedItem throws', () => {
      const e = wrapPapi(el({ x: '1' })) as L1ReadOnlyElement;
      expect(() => e.attributes.removeNamedItem('x')).toThrow(/unsupported/);
    });
  });
});
