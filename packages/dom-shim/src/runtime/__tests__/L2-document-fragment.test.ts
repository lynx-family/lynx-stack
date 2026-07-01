// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ShimDocumentFragment,
  createDocumentFragment,
  wrapPapi,
} from '../nodes.ts';
import type { L2SafeWritableElement } from '../nodes.ts';
import { _resetSchedulerForTesting } from '../scheduler.ts';

interface MockEl extends Record<string, unknown> {
  tag: string;
  uid: number;
  parent: MockEl | undefined;
  children: MockEl[];
}

let nextUid = 7000;
function mk(tag: string): MockEl {
  return { tag, uid: nextUid++, parent: undefined, children: [] };
}

function installPapi(): void {
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockEl) => n.tag;
  g['__GetParent'] = (n: MockEl) => n.parent;
  g['__GetChildren'] = (n: MockEl) => n.children;
  g['__FirstElement'] = (n: MockEl) =>
    n.children.length > 0 ? n.children[0] : undefined;
  g['__LastElement'] = (n: MockEl) =>
    n.children.length > 0 ? n.children[n.children.length - 1] : undefined;
  g['__NextElement'] = () => undefined;
  g['__GetElementUniqueID'] = (n: MockEl) => n.uid;
  g['__ElementIsEqual'] = (a: MockEl, b: MockEl) => a === b;
  g['__GetPageElement'] = () => undefined;
  g['__CreateWrapperElement'] = (): MockEl => mk('wrapper');
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
  g['__InsertElementBefore'] = (
    parent: MockEl,
    child: MockEl,
    ref?: MockEl,
  ) => {
    if (child.parent) {
      const i = child.parent.children.indexOf(child);
      if (i >= 0) child.parent.children.splice(i, 1);
    }
    if (ref) {
      const i = parent.children.indexOf(ref);
      parent.children.splice(i, 0, child);
    } else {
      parent.children.push(child);
    }
    child.parent = parent;
    return child;
  };
  g['__FlushElementTree'] = () => undefined;
}

describe('US-424 DocumentFragment', () => {
  beforeEach(() => {
    nextUid = 7000;
    _resetSchedulerForTesting();
    installPapi();
  });

  afterEach(() => {
    _resetSchedulerForTesting();
  });

  it('createDocumentFragment returns a ShimDocumentFragment', () => {
    const frag = createDocumentFragment();
    expect(frag).toBeInstanceOf(ShimDocumentFragment);
  });

  it('Fragment is an L2 element (supports appendChild/removeChild)', () => {
    const frag = createDocumentFragment();
    const a = wrapPapi(mk('view'));
    const b = wrapPapi(mk('view'));
    frag.appendChild(a);
    frag.appendChild(b);
    expect(frag.childNodes).toHaveLength(2);
  });

  it('appending fragment to a parent flattens children and empties fragment', () => {
    const body = mk('view');
    const bodyWrap = wrapPapi(body) as L2SafeWritableElement;
    const frag = createDocumentFragment();
    const a = wrapPapi(mk('view'));
    const b = wrapPapi(mk('view'));
    const c = wrapPapi(mk('view'));
    frag.appendChild(a);
    frag.appendChild(b);
    frag.appendChild(c);
    expect(frag.childNodes).toHaveLength(3);
    bodyWrap.appendChild(frag);
    expect(body.children).toHaveLength(3);
    expect(frag.childNodes).toHaveLength(0);
  });

  it('flatten preserves order', () => {
    const body = mk('view');
    const bodyWrap = wrapPapi(body) as L2SafeWritableElement;
    const frag = createDocumentFragment();
    const a = mk('view');
    const b = mk('view');
    const c = mk('view');
    frag.appendChild(wrapPapi(a));
    frag.appendChild(wrapPapi(b));
    frag.appendChild(wrapPapi(c));
    bodyWrap.appendChild(frag);
    expect(body.children.map((x) => x.uid)).toEqual([a.uid, b.uid, c.uid]);
  });

  it('removing a fragment child detaches normally', () => {
    const frag = createDocumentFragment();
    const a = wrapPapi(mk('view'));
    frag.appendChild(a);
    frag.removeChild(a);
    expect(frag.childNodes).toHaveLength(0);
  });
});
