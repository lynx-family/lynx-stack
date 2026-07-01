// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getElementCache } from '../cache.ts';
import { wrapPapi } from '../nodes.ts';
import type { L2SafeWritableElement } from '../nodes.ts';
import { _resetSchedulerForTesting } from '../scheduler.ts';

interface MockEl extends Record<string, unknown> {
  tag: string;
  uid: number;
  classes: string[];
  attrs: Record<string, unknown>;
  parent: MockEl | undefined;
  children: MockEl[];
}

let nextUid = 5000;
function mk(tag: string): MockEl {
  return {
    tag,
    uid: nextUid++,
    classes: [],
    attrs: {},
    parent: undefined,
    children: [],
  };
}

function deepClone(n: MockEl): MockEl {
  const copy: MockEl = {
    ...n,
    uid: nextUid++,
    classes: [...n.classes],
    attrs: { ...n.attrs },
    parent: undefined,
    children: [],
  };
  for (const c of n.children) {
    const childCopy = deepClone(c);
    childCopy.parent = copy;
    copy.children.push(childCopy);
  }
  return copy;
}

function shallowClone(n: MockEl): MockEl {
  return {
    ...n,
    uid: nextUid++,
    classes: [...n.classes],
    attrs: { ...n.attrs },
    parent: undefined,
    children: [],
  };
}

function installPapi(): void {
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockEl) => n.tag;
  g['__GetID'] = () => '';
  g['__GetClasses'] = (n: MockEl) => n.classes;
  g['__GetAttributes'] = (n: MockEl) => n.attrs;
  g['__GetAttributeByName'] = (n: MockEl, name: string) => n.attrs[name];
  g['__GetParent'] = (n: MockEl) => n.parent;
  g['__GetChildren'] = (n: MockEl) => n.children;
  g['__FirstElement'] = (n: MockEl) =>
    n.children.length > 0 ? n.children[0] : undefined;
  g['__GetElementUniqueID'] = (n: MockEl) => n.uid;
  g['__ElementIsEqual'] = (a: MockEl, b: MockEl) => a === b;
  g['__GetPageElement'] = () => undefined;
  g['__SetAttribute'] = (n: MockEl, name: string, value: unknown) => {
    if (value === undefined) delete n.attrs[name];
    else n.attrs[name] = value;
  };
  g['__CloneElement'] = (
    ref: MockEl,
    opts: Record<string, unknown>,
  ): MockEl => {
    return opts['deep'] === true ? deepClone(ref) : shallowClone(ref);
  };
  g['__FlushElementTree'] = () => undefined;
}

describe('US-423 L2 cloneNode', () => {
  beforeEach(() => {
    nextUid = 5000;
    _resetSchedulerForTesting();
    installPapi();
  });

  afterEach(() => {
    _resetSchedulerForTesting();
  });

  it('shallow clone produces fresh element with no children', () => {
    const ref = mk('view');
    ref.classes = ['a', 'b'];
    ref.attrs['x'] = '1';
    ref.children = [mk('text')];
    const e = wrapPapi(ref) as L2SafeWritableElement;
    const clone = e.cloneNode(false);
    expect(clone).not.toBe(e);
    expect(clone.papi).not.toBe(ref);
    expect(clone.childNodes).toHaveLength(0);
  });

  it('deep clone copies the full subtree', () => {
    const root = mk('view');
    const child = mk('view');
    const grandchild = mk('text');
    root.children = [child];
    child.parent = root;
    child.children = [grandchild];
    grandchild.parent = child;
    const e = wrapPapi(root) as L2SafeWritableElement;
    const clone = e.cloneNode(true);
    expect(clone.childNodes).toHaveLength(1);
    expect(clone.childNodes[0]?.childNodes).toHaveLength(1);
    // Refs are distinct between original and clone.
    expect(clone.papi).not.toBe(root);
  });

  it('cloned cache is fresh — original mutations do not leak', () => {
    const ref = mk('view');
    const e = wrapPapi(ref) as L2SafeWritableElement;
    e.setAttribute('a', '1');
    const clone = e.cloneNode(false) as L2SafeWritableElement;
    // Both wrappers see the original ref's attribute value:
    e.setAttribute('a', '2');
    expect(e.getAttribute('a')).toBe('2');
    // The clone's cache is separate; clone's getAttribute reflects the
    // clone-time snapshot via PAPI fallback (no cache write yet for clone).
    expect(getElementCache(clone.papi)).not.toBe(getElementCache(e.papi));
  });

  it('default (no arg) is shallow', () => {
    const ref = mk('view');
    ref.children = [mk('text')];
    const e = wrapPapi(ref) as L2SafeWritableElement;
    const clone = e.cloneNode();
    expect(clone.childNodes).toHaveLength(0);
  });
});
