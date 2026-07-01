// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { L1ReadOnlyElement, wrapPapi } from '../nodes.ts';
import type { L2SafeWritableElement } from '../nodes.ts';
import { _resetSchedulerForTesting } from '../scheduler.ts';

interface MockEl extends Record<string, unknown> {
  tag: string;
  id: string;
  classes: string[];
  attrs: Record<string, unknown>;
  data: Record<string, unknown>;
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
  g['__AddClass'] = (n: MockEl, c: string) => {
    if (!n.classes.includes(c)) n.classes.push(c);
  };
  g['__GetAttributeByName'] = (n: MockEl, name: string) => n.attrs[name];
  g['__GetAttributeNames'] = (n: MockEl) => Object.keys(n.attrs);
  g['__GetAttributes'] = (n: MockEl) => n.attrs;
  g['__SetAttribute'] = (n: MockEl, name: string, value: unknown) => {
    if (value === undefined) delete n.attrs[name];
    else n.attrs[name] = value;
  };
  g['__GetDataset'] = (n: MockEl) => n.data;
  g['__GetDataByKey'] = (n: MockEl, k: string) => n.data[k];
  g['__AddDataset'] = (n: MockEl, k: string, v: unknown) => {
    n.data[k] = v;
  };
  g['__SetDataset'] = (n: MockEl, v: Record<string, unknown> | undefined) => {
    n.data = { ...(v ?? {}) };
  };
  g['__AddInlineStyle'] = () => undefined;
  g['__FlushElementTree'] = () => undefined;
}

function el(): MockEl {
  return { tag: 'view', id: '', classes: [], attrs: {}, data: {} };
}

describe('US-419 cache invariant across tier-narrowed views', () => {
  beforeEach(() => {
    _resetSchedulerForTesting();
    installPapi();
  });

  afterEach(() => {
    _resetSchedulerForTesting();
  });

  it('L1 narrowed view sees setAttribute via L2 wrapper', () => {
    const ref = el();
    const wide = wrapPapi(ref) as L2SafeWritableElement;
    const narrow = new L1ReadOnlyElement(ref);
    wide.setAttribute('x', '1');
    expect(narrow.getAttribute('x')).toBe('1');
  });

  it('L1 narrowed view sees removeAttribute via L2 wrapper', () => {
    const ref = el();
    ref.attrs['x'] = '1';
    const wide = wrapPapi(ref) as L2SafeWritableElement;
    const narrow = new L1ReadOnlyElement(ref);
    wide.removeAttribute('x');
    expect(narrow.getAttribute('x')).toBeNull();
  });

  it('L1 narrowed view sees className via L2 wrapper', () => {
    const ref = el();
    const wide = wrapPapi(ref) as L2SafeWritableElement;
    const narrow = new L1ReadOnlyElement(ref);
    wide.className = 'a b';
    expect(narrow.className).toBe('a b');
  });

  it('L1 narrowed view sees classList.add via L2 wrapper', () => {
    const ref = el();
    const wide = wrapPapi(ref) as L2SafeWritableElement;
    const narrow = new L1ReadOnlyElement(ref);
    wide.classList.add('x');
    expect(narrow.classList.contains('x')).toBe(true);
    expect(narrow.classList.length).toBe(1);
  });

  it('L1 narrowed view sees classList.remove via L2 wrapper', () => {
    const ref = el();
    ref.classes = ['a', 'b'];
    const wide = wrapPapi(ref) as L2SafeWritableElement;
    const narrow = new L1ReadOnlyElement(ref);
    wide.classList.remove('a');
    expect(narrow.classList.contains('a')).toBe(false);
    expect(narrow.classList.length).toBe(1);
  });

  it('L1 narrowed view sees dataset assignment via L2 wrapper', () => {
    const ref = el();
    const wide = wrapPapi(ref) as L2SafeWritableElement;
    const narrow = new L1ReadOnlyElement(ref);
    wide.dataset['foo'] = 'bar';
    expect(narrow.dataset['foo']).toBe('bar');
  });

  it('mutations via wide view + reads via narrow view stay in lockstep', () => {
    const ref = el();
    const wide = wrapPapi(ref) as L2SafeWritableElement;
    const narrow = new L1ReadOnlyElement(ref);
    wide.id = 'main';
    wide.className = 'container';
    wide.setAttribute('role', 'main');
    wide.dataset['userId'] = '42';
    expect(narrow.id).toBe('main');
    expect(narrow.className).toBe('container');
    expect(narrow.getAttribute('role')).toBe('main');
    expect(narrow.dataset['userId']).toBe('42');
  });
});
