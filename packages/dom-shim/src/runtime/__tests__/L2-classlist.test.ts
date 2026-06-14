// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { L2DOMTokenList } from '../classlist.ts';
import { wrapPapi } from '../nodes.ts';
import type { L2SafeWritableElement } from '../nodes.ts';
import { _resetSchedulerForTesting } from '../scheduler.ts';

interface MockEl extends Record<string, unknown> {
  tag: string;
  classes: string[];
}

function installPapi(): void {
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockEl) => n.tag;
  g['__GetClasses'] = (n: MockEl) => n.classes;
  g['__SetClasses'] = (n: MockEl, v: string | undefined) => {
    n.classes = (v ?? '').split(/\s+/).filter(Boolean);
  };
  g['__AddClass'] = (n: MockEl, c: string) => {
    if (!n.classes.includes(c)) n.classes.push(c);
  };
  g['__FlushElementTree'] = () => undefined;
}

function el(classes: string[] = []): MockEl {
  return { tag: 'view', classes: [...classes] };
}

describe('US-415 L2DOMTokenList', () => {
  beforeEach(() => {
    _resetSchedulerForTesting();
    installPapi();
  });

  afterEach(() => {
    _resetSchedulerForTesting();
  });

  it('classList is L2DOMTokenList on L2 element', () => {
    const e = wrapPapi(el()) as L2SafeWritableElement;
    expect(e.classList).toBeInstanceOf(L2DOMTokenList);
  });

  describe('add', () => {
    it('appends new tokens via __AddClass', () => {
      const ref = el(['a']);
      const e = wrapPapi(ref) as L2SafeWritableElement;
      e.classList.add('b', 'c');
      expect(ref.classes).toEqual(['a', 'b', 'c']);
    });

    it('is idempotent — no duplicates', () => {
      const e = wrapPapi(el(['a'])) as L2SafeWritableElement;
      e.classList.add('a');
      expect(e.classList.length).toBe(1);
    });

    it('throws on empty token', () => {
      const e = wrapPapi(el()) as L2SafeWritableElement;
      expect(() => e.classList.add('')).toThrow(/SyntaxError/);
    });

    it('throws on token with whitespace', () => {
      const e = wrapPapi(el()) as L2SafeWritableElement;
      expect(() => e.classList.add('a b')).toThrow(/InvalidCharacterError/);
    });
  });

  describe('remove', () => {
    it('drops tokens via __SetClasses rebuild', () => {
      const ref = el(['a', 'b', 'c']);
      const e = wrapPapi(ref) as L2SafeWritableElement;
      e.classList.remove('b');
      expect(ref.classes).toEqual(['a', 'c']);
    });

    it('multi-remove in one call', () => {
      const e = wrapPapi(el(['a', 'b', 'c', 'd'])) as L2SafeWritableElement;
      e.classList.remove('b', 'd');
      expect(e.className).toBe('a c');
    });

    it('no-op when token absent', () => {
      const e = wrapPapi(el(['a'])) as L2SafeWritableElement;
      e.classList.remove('missing');
      expect(e.className).toBe('a');
    });
  });

  describe('toggle', () => {
    it('adds when absent and returns true', () => {
      const e = wrapPapi(el()) as L2SafeWritableElement;
      expect(e.classList.toggle('x')).toBe(true);
      expect(e.classList.contains('x')).toBe(true);
    });

    it('removes when present and returns false', () => {
      const e = wrapPapi(el(['x'])) as L2SafeWritableElement;
      expect(e.classList.toggle('x')).toBe(false);
      expect(e.classList.contains('x')).toBe(false);
    });

    it('force=true is idempotent', () => {
      const e = wrapPapi(el(['x'])) as L2SafeWritableElement;
      expect(e.classList.toggle('x', true)).toBe(true);
      expect(e.classList.contains('x')).toBe(true);
    });

    it('force=false is idempotent', () => {
      const e = wrapPapi(el()) as L2SafeWritableElement;
      expect(e.classList.toggle('x', false)).toBe(false);
      expect(e.classList.contains('x')).toBe(false);
    });
  });

  describe('replace', () => {
    it('replaces existing token and returns true', () => {
      const e = wrapPapi(el(['a', 'b'])) as L2SafeWritableElement;
      expect(e.classList.replace('a', 'c')).toBe(true);
      expect(e.className).toBe('c b');
    });

    it('returns false when old token absent', () => {
      const e = wrapPapi(el(['a'])) as L2SafeWritableElement;
      expect(e.classList.replace('missing', 'new')).toBe(false);
      expect(e.className).toBe('a');
    });
  });

  describe('contains / length / value / item / iterator', () => {
    it('inherits readonly surface', () => {
      const e = wrapPapi(el(['a', 'b', 'c'])) as L2SafeWritableElement;
      const cl = e.classList;
      expect(cl.length).toBe(3);
      expect(cl.contains('b')).toBe(true);
      expect(cl.value).toBe('a b c');
      expect(cl.item(0)).toBe('a');
      expect([...cl]).toEqual(['a', 'b', 'c']);
    });
  });

  describe('refresh', () => {
    it('drops cache so next read re-pulls from PAPI', () => {
      const ref = el(['a', 'b']);
      const e = wrapPapi(ref) as L2SafeWritableElement;
      const cl = e.classList;
      expect(cl.length).toBe(2);
      // External mutation:
      ref.classes.push('c');
      expect(cl.length).toBe(2); // cache still says 2
      cl.refresh();
      expect(cl.length).toBe(3); // now reflects PAPI
    });
  });

  it('mutations schedule auto-flush', async () => {
    let flushed = 0;
    (globalThis as Record<string, unknown>)['__FlushElementTree'] = () => {
      flushed++;
    };
    const e = wrapPapi(el()) as L2SafeWritableElement;
    e.classList.add('a');
    e.classList.add('b');
    e.classList.remove('a');
    expect(flushed).toBe(0);
    await new Promise<void>((r) => {
      queueMicrotask(r);
    });
    expect(flushed).toBe(1);
  });
});
