// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeAll, describe, expect, it } from 'vitest';

import {
  ensureClasses,
  getElementCache,
  invalidate,
  invalidateAll,
} from '../cache.ts';
import type { ElementRef } from '../papi-types.ts';

interface MockRef extends Record<string, unknown> {
  classes: string[];
}

function installPapi(): void {
  const g = globalThis as Record<string, unknown>;
  g['__GetClasses'] = (n: MockRef) => n.classes;
}

describe('US-412 write-through cache', () => {
  beforeAll(() => {
    installPapi();
  });

  it('getElementCache returns the same record for the same ref', () => {
    const ref: ElementRef = {};
    const a = getElementCache(ref);
    const b = getElementCache(ref);
    expect(a).toBe(b);
  });

  it('cache starts empty', () => {
    const ref: ElementRef = {};
    const c = getElementCache(ref);
    expect(c.attrs.size).toBe(0);
    expect(c.classes).toBeNull();
    expect(c.styles.size).toBe(0);
    expect(c.dataset.size).toBe(0);
    expect(c.stylePriorities.size).toBe(0);
  });

  it('writes survive subsequent reads', () => {
    const ref: ElementRef = {};
    const c = getElementCache(ref);
    c.attrs.set('x', '1');
    c.styles.set('color', 'red');
    c.dataset.set('foo', 'bar');
    const c2 = getElementCache(ref);
    expect(c2.attrs.get('x')).toBe('1');
    expect(c2.styles.get('color')).toBe('red');
    expect(c2.dataset.get('foo')).toBe('bar');
  });

  it('ensureClasses lazy-initializes from PAPI\'s __GetClasses', () => {
    const ref: MockRef = { classes: ['a', 'b', 'c'] };
    const c = getElementCache(ref);
    expect(c.classes).toBeNull();
    const result = ensureClasses(ref);
    expect(result).toEqual(['a', 'b', 'c']);
    expect(c.classes).toEqual(['a', 'b', 'c']);
  });

  it('ensureClasses is idempotent and writable after init', () => {
    const ref: MockRef = { classes: ['only-once'] };
    ensureClasses(ref);
    // Mutate the PAPI side; cache should NOT re-read.
    ref.classes = ['changed-externally'];
    expect(ensureClasses(ref)).toEqual(['only-once']);
  });

  it('invalidate(attrs) clears only attrs', () => {
    const ref: ElementRef = {};
    const c = getElementCache(ref);
    c.attrs.set('x', '1');
    c.styles.set('color', 'red');
    invalidate(ref, 'attrs');
    expect(c.attrs.size).toBe(0);
    expect(c.styles.size).toBe(1);
  });

  it('invalidate(classes) resets to null for re-init', () => {
    const ref: MockRef = { classes: ['a'] };
    ensureClasses(ref);
    invalidate(ref, 'classes');
    expect(getElementCache(ref).classes).toBeNull();
    // Next ensureClasses re-pulls from PAPI.
    ref.classes = ['b'];
    expect(ensureClasses(ref)).toEqual(['b']);
  });

  it('invalidate(styles) clears styles and stylePriorities', () => {
    const ref: ElementRef = {};
    const c = getElementCache(ref);
    c.styles.set('color', 'red');
    c.stylePriorities.set('color', 'important');
    invalidate(ref, 'styles');
    expect(c.styles.size).toBe(0);
    expect(c.stylePriorities.size).toBe(0);
  });

  it('invalidateAll drops the entire cache', () => {
    const ref: ElementRef = {};
    const c1 = getElementCache(ref);
    c1.attrs.set('x', '1');
    invalidateAll(ref);
    const c2 = getElementCache(ref);
    expect(c2.attrs.size).toBe(0);
    expect(c2).not.toBe(c1);
  });

  it('cache is per-ref (different refs do not share state)', () => {
    const a: ElementRef = {};
    const b: ElementRef = {};
    getElementCache(a).attrs.set('x', '1');
    expect(getElementCache(b).attrs.size).toBe(0);
  });
});
