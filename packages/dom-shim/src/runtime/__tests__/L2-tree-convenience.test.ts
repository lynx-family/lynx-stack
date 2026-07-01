// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { wrapPapi } from '../nodes.ts';
import type { L2SafeWritableElement } from '../nodes.ts';
import { _resetSchedulerForTesting } from '../scheduler.ts';

interface MockEl extends Record<string, unknown> {
  tag: string;
  uid: number;
  text?: string;
  parent: MockEl | undefined;
  children: MockEl[];
}

let nextUid = 1000;
function mk(tag: string, uid?: number): MockEl {
  return {
    tag,
    uid: uid ?? nextUid++,
    parent: undefined,
    children: [],
  };
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
  g['__NextElement'] = (n: MockEl) => {
    if (!n.parent) return undefined;
    const i = n.parent.children.indexOf(n);
    return i >= 0 && i + 1 < n.parent.children.length
      ? n.parent.children[i + 1]
      : undefined;
  };
  g['__GetElementUniqueID'] = (n: MockEl) => n.uid;
  g['__ElementIsEqual'] = (a: MockEl, b: MockEl) => a === b;
  g['__GetPageElement'] = () => undefined;
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
  g['__CreateRawText'] = (text: string): MockEl => {
    return {
      tag: 'raw-text',
      uid: nextUid++,
      text,
      parent: undefined,
      children: [],
    };
  };
  g['__FlushElementTree'] = () => undefined;
}

describe('US-422 L2 tree convenience methods', () => {
  beforeEach(() => {
    nextUid = 1000;
    _resetSchedulerForTesting();
    installPapi();
  });

  afterEach(() => {
    _resetSchedulerForTesting();
  });

  describe('append', () => {
    it('appends element nodes in order', () => {
      const parent = mk('view');
      const p = wrapPapi(parent) as L2SafeWritableElement;
      const a = wrapPapi(mk('view'));
      const b = wrapPapi(mk('view'));
      p.append(a, b);
      expect(parent.children.map((c) => c.uid)).toEqual([
        a.papi['uid'],
        b.papi['uid'],
      ]);
    });

    it('strings become raw-text children', () => {
      const parent = mk('view');
      const p = wrapPapi(parent) as L2SafeWritableElement;
      p.append('hello');
      expect(parent.children).toHaveLength(1);
      expect(parent.children[0]?.tag).toBe('raw-text');
    });

    it('mixed string + node arg', () => {
      const parent = mk('view');
      const p = wrapPapi(parent) as L2SafeWritableElement;
      const node = wrapPapi(mk('view'));
      p.append('a', node, 'b');
      expect(parent.children).toHaveLength(3);
      expect(parent.children[0]?.tag).toBe('raw-text');
      expect(parent.children[2]?.tag).toBe('raw-text');
    });
  });

  describe('prepend', () => {
    it('inserts before existing children, in order', () => {
      const parent = mk('view');
      const existing = mk('view');
      parent.children = [existing];
      existing.parent = parent;
      const p = wrapPapi(parent) as L2SafeWritableElement;
      const a = wrapPapi(mk('view'));
      const b = wrapPapi(mk('view'));
      p.prepend(a, b);
      expect(parent.children.map((c) => c.uid)).toEqual([
        a.papi['uid'],
        b.papi['uid'],
        existing.uid,
      ]);
    });

    it('works when parent is empty', () => {
      const parent = mk('view');
      const p = wrapPapi(parent) as L2SafeWritableElement;
      p.prepend(wrapPapi(mk('view')));
      expect(parent.children).toHaveLength(1);
    });
  });

  describe('before / after', () => {
    it('before inserts in parent before this', () => {
      const parent = mk('view');
      const self = mk('view');
      const other = mk('view');
      parent.children = [self, other];
      self.parent = parent;
      other.parent = parent;
      const selfWrap = wrapPapi(self) as L2SafeWritableElement;
      const newOne = wrapPapi(mk('view'));
      selfWrap.before(newOne);
      expect(parent.children.map((c) => c.uid)).toEqual([
        newOne.papi['uid'],
        self.uid,
        other.uid,
      ]);
    });

    it('after inserts in parent after this', () => {
      const parent = mk('view');
      const self = mk('view');
      const other = mk('view');
      parent.children = [self, other];
      self.parent = parent;
      other.parent = parent;
      const selfWrap = wrapPapi(self) as L2SafeWritableElement;
      const newOne = wrapPapi(mk('view'));
      selfWrap.after(newOne);
      expect(parent.children.map((c) => c.uid)).toEqual([
        self.uid,
        newOne.papi['uid'],
        other.uid,
      ]);
    });

    it('after at the end falls back to appendElement', () => {
      const parent = mk('view');
      const self = mk('view');
      parent.children = [self];
      self.parent = parent;
      const selfWrap = wrapPapi(self) as L2SafeWritableElement;
      const newOne = wrapPapi(mk('view'));
      selfWrap.after(newOne);
      expect(parent.children.map((c) => c.uid)).toEqual([
        self.uid,
        newOne.papi['uid'],
      ]);
    });
  });

  describe('replaceWith', () => {
    it('inserts replacements and removes self', () => {
      const parent = mk('view');
      const self = mk('view');
      parent.children = [self];
      self.parent = parent;
      const selfWrap = wrapPapi(self) as L2SafeWritableElement;
      const a = wrapPapi(mk('view'));
      const b = wrapPapi(mk('view'));
      selfWrap.replaceWith(a, b);
      expect(parent.children.map((c) => c.uid)).toEqual([
        a.papi['uid'],
        b.papi['uid'],
      ]);
      expect(parent.children).not.toContain(self);
    });

    it('with string replacement', () => {
      const parent = mk('view');
      const self = mk('view');
      parent.children = [self];
      self.parent = parent;
      const selfWrap = wrapPapi(self) as L2SafeWritableElement;
      selfWrap.replaceWith('replaced');
      expect(parent.children).toHaveLength(1);
      expect(parent.children[0]?.tag).toBe('raw-text');
    });
  });

  describe('remove', () => {
    it('detaches self from parent', () => {
      const parent = mk('view');
      const self = mk('view');
      parent.children = [self];
      self.parent = parent;
      const selfWrap = wrapPapi(self) as L2SafeWritableElement;
      selfWrap.remove();
      expect(parent.children).toHaveLength(0);
      expect(self.parent).toBeUndefined();
    });

    it('no-op when already detached', () => {
      const selfWrap = wrapPapi(mk('view')) as L2SafeWritableElement;
      expect(() => selfWrap.remove()).not.toThrow();
    });
  });
});
