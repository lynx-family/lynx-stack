// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { wrapPapi } from '../nodes.ts';
import type { L3bUnsafeWritableElement } from '../nodes.ts';
import { _resetSchedulerForTesting } from '../scheduler.ts';

interface MockEl extends Record<string, unknown> {
  tag: string;
  uid: number;
  attrs: Record<string, unknown>;
  parent: MockEl | undefined;
  children: MockEl[];
}

let nextUid = 19000;

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
  nextUid = 19000;
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockEl) => n.tag;
  g['__GetPageElement'] = () => undefined;
  g['__GetElementUniqueID'] = (n: MockEl) => n.uid;
  g['__GetParent'] = (n: MockEl) => n.parent;
  g['__GetChildren'] = (n: MockEl) => n.children;
  g['__FirstElement'] = (n: MockEl) =>
    n.children.length > 0 ? n.children[0] : undefined;
  g['__GetAttributes'] = (n: MockEl) => n.attrs;
  g['__GetAttributeByName'] = (n: MockEl, name: string) => n.attrs[name];
  g['__GetID'] = () => '';
  g['__GetClasses'] = () => [];
  g['__SetAttribute'] = () => undefined;
  g['__ElementIsEqual'] = (a: MockEl, b: MockEl) => a === b;
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
  g['__CreateRawText'] = (): MockEl => mk('raw-text');
  g['__AddEvent'] = () => undefined;
  g['__FlushElementTree'] = () => undefined;
}

describe('US-446 L3b textContent setter and getter', () => {
  beforeEach(() => {
    _resetSchedulerForTesting();
    installPapi();
  });

  afterEach(() => {
    _resetSchedulerForTesting();
  });

  it('setter clears existing children and stores text', () => {
    const ref = mk('view');
    const existing = mk('view');
    ref.children = [existing];
    existing.parent = ref;
    const e = wrapPapi(ref) as L3bUnsafeWritableElement;
    e.textContent = 'hello world';
    expect(ref.children).toHaveLength(1);
    expect(ref.children[0]?.tag).toBe('raw-text');
  });

  it('round-trips: set then read returns the same string', () => {
    const e = wrapPapi(mk('view')) as L3bUnsafeWritableElement;
    e.textContent = 'hello';
    expect(e.textContent).toBe('hello');
  });

  it('empty string clears without adding a raw-text node', () => {
    const ref = mk('view');
    ref.children = [mk('view'), mk('view')];
    const e = wrapPapi(ref) as L3bUnsafeWritableElement;
    e.textContent = '';
    expect(ref.children).toHaveLength(0);
    expect(e.textContent).toBe('');
  });

  it('overwrites prior text', () => {
    const e = wrapPapi(mk('view')) as L3bUnsafeWritableElement;
    e.textContent = 'first';
    e.textContent = 'second';
    expect(e.textContent).toBe('second');
  });

  it('getter walks descendant text nodes for unmodified subtree', () => {
    const root = mk('view');
    const a = wrapPapi(mk('view')) as L3bUnsafeWritableElement;
    const b = wrapPapi(mk('view')) as L3bUnsafeWritableElement;
    const rootWrap = wrapPapi(root) as L3bUnsafeWritableElement;
    rootWrap.appendChild(a);
    rootWrap.appendChild(b);
    a.textContent = 'foo';
    b.textContent = 'bar';
    expect(rootWrap.textContent).toBe('foobar');
  });

  it('getter returns empty on empty element', () => {
    const e = wrapPapi(mk('view')) as L3bUnsafeWritableElement;
    expect(e.textContent).toBe('');
  });
});
