// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { wrapPapi } from '../nodes.ts';
import type { L2SafeWritableElement } from '../nodes.ts';
import { _resetSchedulerForTesting } from '../scheduler.ts';

/**
 * M2 (L2 SafeWrite) exit integration. See Shim_Implementation_PRD.md §4 +
 * §5 US-420.
 *
 * Builds a 5-element tree and exercises every L2 mutation path
 * (setAttribute, removeAttribute, classList, dataset, style, id,
 * className) checking read-after-write consistency in the same JS frame
 * and auto-flush coalescing.
 *
 * Real-Lynx mock from Phase 1.5 US-153 is not yet shipped, so this test
 * uses an in-test stub. When US-153 lands, the stub is swapped for the
 * real-Lynx mock per Shim_Implementation_PRD.md §8.4.
 */

interface MockEl extends Record<string, unknown> {
  tag: string;
  uid: number;
  id: string;
  classes: string[];
  attrs: Record<string, unknown>;
  data: Record<string, unknown>;
  styles: Record<string, unknown>;
  parent: MockEl | undefined;
  children: MockEl[];
}

function mk(tag: string, uid: number): MockEl {
  return {
    tag,
    uid,
    id: '',
    classes: [],
    attrs: {},
    data: {},
    styles: {},
    parent: undefined,
    children: [],
  };
}

/**
 *   root (view, id=root)
 *   ├── header (view)
 *   │   └── title (text)
 *   └── main (view)
 *       └── btn (view)
 */
function buildTree(): {
  root: MockEl;
  header: MockEl;
  title: MockEl;
  main: MockEl;
  btn: MockEl;
} {
  const title = mk('text', 4);
  const header = mk('view', 2);
  const btn = mk('view', 5);
  const main = mk('view', 3);
  const root = mk('view', 1);
  root.id = 'root';
  header.children = [title];
  title.parent = header;
  main.children = [btn];
  btn.parent = main;
  root.children = [header, main];
  header.parent = root;
  main.parent = root;
  return { root, header, title, main, btn };
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
  g['__AddInlineStyle'] = (n: MockEl, k: string | number, v: unknown) => {
    if (typeof k !== 'string') return;
    if (v === undefined) delete n.styles[k];
    else n.styles[k] = v;
  };
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
}

describe('M2 EXIT — L2 SafeWrite end-to-end', () => {
  let tree: ReturnType<typeof buildTree>;
  let flushed: number;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _resetSchedulerForTesting();
    installPapi();
    tree = buildTree();
    flushed = 0;
    (globalThis as Record<string, unknown>)['__FlushElementTree'] = () => {
      flushed++;
    };
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    _resetSchedulerForTesting();
    vi.restoreAllMocks();
  });

  it('exercises L2 surface on a 5-element tree with read-after-write consistency', async () => {
    const header = wrapPapi(tree.header) as L2SafeWritableElement;
    const main = wrapPapi(tree.main) as L2SafeWritableElement;
    const btn = wrapPapi(tree.btn) as L2SafeWritableElement;

    header.id = 'header';
    header.className = 'site-header';
    expect(header.id).toBe('header');
    expect(header.className).toBe('site-header');

    main.setAttribute('role', 'main');
    main.setAttribute('aria-label', 'main content');
    expect(main.getAttribute('role')).toBe('main');
    expect(main.getAttribute('aria-label')).toBe('main content');

    main.removeAttribute('aria-label');
    expect(main.getAttribute('aria-label')).toBeNull();

    btn.classList.add('btn', 'btn-primary');
    expect(btn.classList.contains('btn')).toBe(true);
    expect(btn.classList.length).toBe(2);

    btn.classList.toggle('disabled');
    expect(btn.classList.contains('disabled')).toBe(true);
    btn.classList.toggle('disabled');
    expect(btn.classList.contains('disabled')).toBe(false);

    btn.dataset['action'] = 'submit';
    btn.dataset['index'] = '0';
    expect(btn.dataset['action']).toBe('submit');
    expect(btn.dataset['index']).toBe('0');

    btn.style.setProperty('color', 'red');
    btn.style['backgroundColor'] = 'blue';
    expect(btn.style.getPropertyValue('color')).toBe('red');
    expect(btn.style['background-color']).toBe('blue');

    delete btn.dataset['index'];
    expect(btn.dataset['index']).toBeUndefined();

    // Spec read-after-write within the same frame — auto-flush has not
    // yet run, but all reads return the just-written values.
    expect(flushed).toBe(0);

    await new Promise<void>((r) => {
      queueMicrotask(r);
    });
    // Exactly one flush across all the above mutations.
    expect(flushed).toBe(1);
  });

  it('emits no console.warn besides documented L1 geometry warn (which is not exercised here)', async () => {
    const e = wrapPapi(tree.root) as L2SafeWritableElement;
    e.setAttribute('x', '1');
    e.classList.add('a');
    e.dataset['y'] = '2';
    e.style.setProperty('color', 'red');
    await new Promise<void>((r) => {
      queueMicrotask(r);
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('a second microtask after a quiet frame re-schedules', async () => {
    const e = wrapPapi(tree.root) as L2SafeWritableElement;
    e.setAttribute('a', '1');
    await new Promise<void>((r) => {
      queueMicrotask(r);
    });
    expect(flushed).toBe(1);
    e.setAttribute('b', '2');
    await new Promise<void>((r) => {
      queueMicrotask(r);
    });
    expect(flushed).toBe(2);
  });
});
