// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { wrapPapi } from '../nodes.ts';
import type { L2SafeWritableElement } from '../nodes.ts';
import { _resetSchedulerForTesting } from '../scheduler.ts';

interface MockEl extends Record<string, unknown> {
  tag: string;
  id: string;
  classes: string[];
}

function installPapi(): void {
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockEl) => n.tag;
  g['__GetID'] = (n: MockEl) => n.id;
  g['__SetID'] = (n: MockEl, v: string) => {
    n.id = v;
  };
  g['__GetClasses'] = (n: MockEl) => n.classes;
  g['__SetClasses'] = (n: MockEl, v: string | undefined) => {
    n.classes = (v ?? '').split(/\s+/).filter(Boolean);
  };
  g['__FlushElementTree'] = () => undefined;
}

function el(id = '', classes: string[] = []): MockEl {
  return { tag: 'view', id, classes };
}

describe('US-414 L2 id and className setters', () => {
  beforeEach(() => {
    _resetSchedulerForTesting();
    installPapi();
  });

  afterEach(() => {
    _resetSchedulerForTesting();
  });

  describe('id setter', () => {
    it('writes to PAPI', () => {
      const ref = el();
      const e = wrapPapi(ref) as L2SafeWritableElement;
      e.id = 'main';
      expect(ref.id).toBe('main');
    });

    it('round-trips synchronously', () => {
      const e = wrapPapi(el()) as L2SafeWritableElement;
      e.id = 'main';
      expect(e.id).toBe('main');
    });

    it('overwrites prior id', () => {
      const e = wrapPapi(el('first')) as L2SafeWritableElement;
      e.id = 'second';
      expect(e.id).toBe('second');
    });
  });

  describe('className setter', () => {
    it('writes string to PAPI via __SetClasses', () => {
      const ref = el();
      const e = wrapPapi(ref) as L2SafeWritableElement;
      e.className = 'a b c';
      expect(ref.classes).toEqual(['a', 'b', 'c']);
    });

    it('round-trips synchronously', () => {
      const e = wrapPapi(el()) as L2SafeWritableElement;
      e.className = 'foo bar';
      expect(e.className).toBe('foo bar');
    });

    it('classList.length reflects new className', () => {
      const e = wrapPapi(el()) as L2SafeWritableElement;
      e.className = 'a b c';
      expect(e.classList.length).toBe(3);
    });

    it('whitespace and empty tokens are filtered', () => {
      const e = wrapPapi(el()) as L2SafeWritableElement;
      e.className = '   a   b  c   ';
      expect(e.className).toBe('a b c');
    });

    it('overwriting className replaces all classes', () => {
      const e = wrapPapi(el('', ['old1', 'old2'])) as L2SafeWritableElement;
      e.className = 'new';
      expect(e.className).toBe('new');
      expect(e.classList.contains('old1')).toBe(false);
    });

    it('empty string clears classes', () => {
      const e = wrapPapi(el('', ['a', 'b'])) as L2SafeWritableElement;
      e.className = '';
      expect(e.className).toBe('');
      expect(e.classList.length).toBe(0);
    });
  });

  it('id setter schedules auto-flush', async () => {
    let flushed = 0;
    (globalThis as Record<string, unknown>)['__FlushElementTree'] = () => {
      flushed++;
    };
    const e = wrapPapi(el()) as L2SafeWritableElement;
    e.id = 'x';
    e.className = 'y';
    expect(flushed).toBe(0);
    await new Promise<void>((r) => {
      queueMicrotask(r);
    });
    expect(flushed).toBe(1);
  });
});
