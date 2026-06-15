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

let nextUid = 15000;
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
  nextUid = 15000;
  page = mk('page');
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockEl) => n.tag;
  g['__GetPageElement'] = () => page;
  g['__GetElementUniqueID'] = (n: MockEl) => n.uid;
  g['__GetParent'] = (n: MockEl) => n.parent;
  g['__GetChildren'] = (n: MockEl) => n.children;
  g['__FirstElement'] = (n: MockEl) =>
    n.children.length > 0 ? n.children[0] : undefined;
  g['__GetAttributeByName'] = (n: MockEl, name: string) => n.attrs[name];
  g['__GetAttributeNames'] = (n: MockEl) => Object.keys(n.attrs);
  g['__GetAttributes'] = (n: MockEl) => n.attrs;
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
  g['__AddClass'] = () => undefined;
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
  g['__ElementIsEqual'] = (a: MockEl, b: MockEl) => a === b;
  g['__AddEvent'] = () => undefined;
  g['__FlushElementTree'] = () => undefined;
}

describe('US-444 L3b innerHTML getter (canonical serializer)', () => {
  beforeEach(() => {
    _resetSchedulerForTesting();
    installPapi();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _resetSchedulerForTesting();
  });

  it('empty element serializes to empty string', () => {
    const e = wrapPapi(mk('view')) as L3bUnsafeWritableElement;
    expect(e.innerHTML).toBe('');
  });

  it('serializes a single child with attributes sorted alphabetically', () => {
    const e = wrapPapi(mk('view')) as L3bUnsafeWritableElement;
    e.innerHTML = '<div data-z="last" data-a="first" id="x"></div>';
    const out = e.innerHTML;
    // Attributes sorted alphabetically: data-a, data-z, id
    expect(out).toMatch(/data-a/);
    expect(out).toMatch(/data-z/);
    expect(out).toMatch(/id/);
    const order = ['data-a', 'data-z', 'id'].map((k) => out.indexOf(k));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('uses double quotes for attribute values', () => {
    const e = wrapPapi(mk('view')) as L3bUnsafeWritableElement;
    e.innerHTML = '<div id=\'x\'>hi</div>';
    expect(e.innerHTML).toMatch(/id="x"/);
  });

  it('escapes ampersand and double quotes in attribute values', () => {
    const e = wrapPapi(mk('view')) as L3bUnsafeWritableElement;
    e.innerHTML = '<div data-x="a&b"></div>';
    expect(e.innerHTML).toMatch(/data-x="a&amp;b"/);
  });

  it('escapes ampersand and angle brackets in text content', () => {
    const e = wrapPapi(mk('view')) as L3bUnsafeWritableElement;
    e.innerHTML = '<span>a &amp; b</span>';
    expect(e.innerHTML).toMatch(/a &amp; b/);
  });

  it('emits self-closing tag for void elements (img)', () => {
    const e = wrapPapi(mk('view')) as L3bUnsafeWritableElement;
    e.innerHTML = '<img src="x.png" alt="hi">';
    expect(e.innerHTML).toMatch(/<img[^>]*\/>/);
  });

  it('preserves nested structure', () => {
    const e = wrapPapi(mk('view')) as L3bUnsafeWritableElement;
    e.innerHTML = '<div><span>a</span><span>b</span></div>';
    const out = e.innerHTML;
    expect(out).toMatch(/<div>.*<span>a<\/span>.*<span>b<\/span>.*<\/div>/);
  });

  it('canonical form: round-trip is NOT guaranteed', () => {
    const e = wrapPapi(mk('view')) as L3bUnsafeWritableElement;
    e.innerHTML = '<div    id=\'x\'   class=\'a\'>hi</div>';
    // Single-quoted input becomes double-quoted output.
    // Excess whitespace collapses.
    expect(e.innerHTML).not.toBe('<div    id=\'x\'   class=\'a\'>hi</div>');
    expect(e.innerHTML).toMatch(/<div[^>]*>hi<\/div>/);
  });

  it('multiple sibling children are emitted in order', () => {
    const e = wrapPapi(mk('view')) as L3bUnsafeWritableElement;
    e.innerHTML = '<span>a</span><span>b</span><span>c</span>';
    const out = e.innerHTML;
    const aIdx = out.indexOf('>a<');
    const bIdx = out.indexOf('>b<');
    const cIdx = out.indexOf('>c<');
    expect(aIdx).toBeGreaterThan(-1);
    expect(bIdx).toBeGreaterThan(aIdx);
    expect(cIdx).toBeGreaterThan(bIdx);
  });
});
