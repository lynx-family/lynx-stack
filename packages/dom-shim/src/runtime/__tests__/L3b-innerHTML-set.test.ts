// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { L3bUnsafeWritableElement, wrapPapi } from '../nodes.ts';
import { _resetSchedulerForTesting } from '../scheduler.ts';

interface MockEl extends Record<string, unknown> {
  tag: string;
  uid: number;
  attrs: Record<string, unknown>;
  text?: string;
  parent: MockEl | undefined;
  children: MockEl[];
}

let nextUid = 13000;
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
  nextUid = 13000;
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
  g['__FlushElementTree'] = () => undefined;
  g['__AddEvent'] = () => undefined;
}

function matches(n: MockEl, sel: string): boolean {
  if (sel.startsWith('#')) return n.attrs['id'] === sel.slice(1);
  if (sel.startsWith('.')) {
    const classes = ((n.attrs['class'] as string | undefined) ?? '').split(
      /\s+/,
    );
    return classes.includes(sel.slice(1));
  }
  return n.tag === sel;
}

describe('US-443 L3b innerHTML setter (htmlparser2)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _resetSchedulerForTesting();
    installPapi();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _resetSchedulerForTesting();
  });

  it('wrapPapi returns L3b for non-text', () => {
    const e = wrapPapi(mk('view'));
    expect(e).toBeInstanceOf(L3bUnsafeWritableElement);
  });

  it('simple subtree: div > span', () => {
    const ref = mk('view');
    const e = wrapPapi(ref) as L3bUnsafeWritableElement;
    e.innerHTML = '<div class="x"><span>hi</span></div>';
    expect(ref.children).toHaveLength(1);
    expect(ref.children[0]?.tag).toBe('view');
    const innerSpan = ref.children[0]?.children[0];
    expect(innerSpan?.tag).toBe('text');
    expect(innerSpan?.children[0]?.text).toBe('hi');
  });

  it('querySelector works on the built subtree', () => {
    const ref = mk('view');
    const e = wrapPapi(ref) as L3bUnsafeWritableElement;
    e.innerHTML = '<div class="x"><span>hi</span></div>';
    const found = e.querySelector('.x');
    expect(found).not.toBeNull();
    expect(found?.tagName).toBe('DIV');
  });

  it('clears existing children before parsing', () => {
    const ref = mk('view');
    const old = mk('view');
    ref.children = [old];
    old.parent = ref;
    const e = wrapPapi(ref) as L3bUnsafeWritableElement;
    e.innerHTML = '<p>new</p>';
    expect(ref.children).toHaveLength(1);
    expect(ref.children[0]?.tag).toBe('view');
    expect(old.parent).toBeUndefined();
  });

  it('empty string clears children without adding anything', () => {
    const ref = mk('view');
    ref.children = [mk('view'), mk('view')];
    const e = wrapPapi(ref) as L3bUnsafeWritableElement;
    e.innerHTML = '';
    expect(ref.children).toHaveLength(0);
  });

  it('<script> tags are skipped and warned', () => {
    const ref = mk('view');
    const e = wrapPapi(ref) as L3bUnsafeWritableElement;
    e.innerHTML = '<div>kept</div><script>alert(1)</script>';
    expect(ref.children).toHaveLength(1);
    expect(ref.children[0]?.tag).toBe('view');
    expect(warnSpy).toHaveBeenCalled();
    const call = warnSpy.mock.calls.find((c) =>
      String(c[0]).includes('script-skipped')
    );
    expect(call).toBeDefined();
  });

  it('<style> tags are skipped and warned', () => {
    const ref = mk('view');
    const e = wrapPapi(ref) as L3bUnsafeWritableElement;
    e.innerHTML = '<style>.x{}</style><span>kept</span>';
    expect(ref.children).toHaveLength(1);
    expect(ref.children[0]?.tag).toBe('text');
    const call = warnSpy.mock.calls.find((c) =>
      String(c[0]).includes('css-style-tag-dropped')
    );
    expect(call).toBeDefined();
  });

  it('inline event attributes (on*) are ignored with warning', () => {
    const ref = mk('view');
    const e = wrapPapi(ref) as L3bUnsafeWritableElement;
    e.innerHTML = '<div onclick="alert(1)" id="x">hi</div>';
    expect(ref.children[0]?.attrs['onclick']).toBeUndefined();
    expect(ref.children[0]?.attrs['id']).toBe('x');
    const call = warnSpy.mock.calls.find((c) =>
      String(c[0]).includes('inline-event-attrs-ignored')
    );
    expect(call).toBeDefined();
  });

  it('class attribute merges with defaults', () => {
    const ref = mk('view');
    const e = wrapPapi(ref) as L3bUnsafeWritableElement;
    // h1 has defaultClasses: ['shim-h1']
    e.innerHTML = '<h1 class="custom big">hi</h1>';
    const child = ref.children[0]!;
    const classes = (child.attrs['class'] as string).split(/\s+/);
    expect(classes).toContain('shim-h1');
    expect(classes).toContain('custom');
    expect(classes).toContain('big');
  });

  it('style="..." is parsed and applied as inline style', () => {
    const ref = mk('view');
    const e = wrapPapi(ref) as L3bUnsafeWritableElement;
    e.innerHTML = '<div style="color: red; background: blue">hi</div>';
    // We can verify via cache (style writes are cache-authoritative).
    const child = wrapPapi(ref.children[0]!) as L3bUnsafeWritableElement;
    expect(child.style.getPropertyValue('color')).toBe('red');
    expect(child.style.getPropertyValue('background')).toBe('blue');
  });

  it('data-* attributes are preserved', () => {
    const ref = mk('view');
    const e = wrapPapi(ref) as L3bUnsafeWritableElement;
    e.innerHTML = '<div data-foo="bar">hi</div>';
    expect(ref.children[0]?.attrs['data-foo']).toBe('bar');
  });

  it('unmapped tag falls back to view + data-shim-tag', () => {
    const ref = mk('view');
    const e = wrapPapi(ref) as L3bUnsafeWritableElement;
    e.innerHTML = '<custom-thing>hi</custom-thing>';
    expect(ref.children[0]?.tag).toBe('view');
    expect(ref.children[0]?.attrs['data-shim-tag']).toBe('custom-thing');
  });
});
