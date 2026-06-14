// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { _resetDocumentForTesting, document } from '../document.ts';
import { _resetSchedulerForTesting } from '../scheduler.ts';

/**
 * M3 (L2 SafeWrite — tree) exit integration. See
 * Shim_Implementation_PRD.md §4 + §5 US-426.
 *
 * Builds the static skeleton of TodoMVC (header / input / ul.todo-list /
 * footer) via document.createElement + appendChild, then queries it. No
 * L4 throws expected. Auto-flush should fire exactly once at the
 * microtask boundary.
 *
 * Real-Lynx mock from Phase 1.5 US-153 is not yet shipped; this test
 * uses an in-test stub.
 */

interface MockEl extends Record<string, unknown> {
  tag: string;
  uid: number;
  attrs: Record<string, unknown>;
  parent: MockEl | undefined;
  children: MockEl[];
}

let nextUid = 8000;
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

function matchSelector(n: MockEl, sel: string): boolean {
  if (sel.startsWith('#')) return n.attrs['id'] === sel.slice(1);
  if (sel.startsWith('.')) {
    const classes = ((n.attrs['class'] as string | undefined) ?? '').split(
      /\s+/,
    );
    return classes.includes(sel.slice(1));
  }
  return n.tag === sel;
}

function querySelectorAllImpl(root: MockEl, sel: string): MockEl[] {
  // Support simple compound selectors of the form "ancestor descendant".
  const parts = sel.trim().split(/\s+/);
  if (parts.length > 1) {
    const [ancestorSel, ...rest] = parts;
    if (!ancestorSel) return [];
    const tail = rest.join(' ');
    const ancestors = querySelectorAllImpl(root, ancestorSel);
    const out: MockEl[] = [];
    for (const a of ancestors) {
      out.push(...querySelectorAllImpl(a, tail));
    }
    return out;
  }
  const out: MockEl[] = [];
  function visit(n: MockEl): void {
    for (const c of n.children) {
      if (matchSelector(c, sel)) out.push(c);
      visit(c);
    }
  }
  visit(root);
  return out;
}

function installPapi(): void {
  nextUid = 8000;
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
  g['__GetID'] = (n: MockEl) => {
    const v = n.attrs['id'];
    return typeof v === 'string' ? v : '';
  };
  g['__SetID'] = (n: MockEl, v: string) => {
    n.attrs['id'] = v;
  };
  g['__GetClasses'] = (n: MockEl) =>
    ((n.attrs['class'] as string | undefined) ?? '').split(/\s+/).filter(
      Boolean,
    );
  g['__SetClasses'] = (n: MockEl, v: string | undefined) => {
    if (v === undefined || v === '') delete n.attrs['class'];
    else n.attrs['class'] = v;
  };
  g['__AddClass'] = (n: MockEl, c: string) => {
    const cur = ((n.attrs['class'] as string | undefined) ?? '').split(/\s+/)
      .filter(Boolean);
    if (!cur.includes(c)) cur.push(c);
    n.attrs['class'] = cur.join(' ');
  };
  g['__GetDataset'] = (n: MockEl) => {
    const ds: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(n.attrs)) {
      if (k.startsWith('data-')) ds[k.slice(5)] = v;
    }
    return ds;
  };
  g['__GetDataByKey'] = (n: MockEl, k: string) => n.attrs[`data-${k}`];
  g['__AddDataset'] = (n: MockEl, k: string, v: unknown) => {
    n.attrs[`data-${k}`] = v;
  };
  g['__SetDataset'] = (
    n: MockEl,
    v: Record<string, unknown> | undefined,
  ) => {
    for (const k of Object.keys(n.attrs)) {
      if (k.startsWith('data-')) delete n.attrs[k];
    }
    if (v) {
      for (const [k, vv] of Object.entries(v)) n.attrs[`data-${k}`] = vv;
    }
  };
  g['__AddInlineStyle'] = () => undefined;
  g['__CreateView'] = () => mk('view');
  g['__CreateText'] = () => mk('text');
  g['__CreateImage'] = () => mk('image');
  g['__CreateScrollView'] = () => mk('scroll-view');
  g['__CreateElement'] = (tag: string) => mk(tag);
  g['__CreateRawText'] = () => mk('raw-text');
  g['__CreateWrapperElement'] = () => mk('wrapper');
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
    if (ref) {
      const i = parent.children.indexOf(ref);
      parent.children.splice(i, 0, child);
    } else {
      parent.children.push(child);
    }
    child.parent = parent;
    return child;
  };
  g['__QuerySelector'] = (root: MockEl, sel: string): MockEl | undefined =>
    querySelectorAllImpl(root, sel)[0];
  g['__QuerySelectorAll'] = (root: MockEl, sel: string): MockEl[] =>
    querySelectorAllImpl(root, sel);
  g['__FlushElementTree'] = () => undefined;
}

describe('M3 EXIT — TodoMVC static structural skeleton', () => {
  let flushed: number;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _resetSchedulerForTesting();
    _resetDocumentForTesting();
    installPapi();
    flushed = 0;
    (globalThis as Record<string, unknown>)['__FlushElementTree'] = () => {
      flushed++;
    };
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _resetSchedulerForTesting();
  });

  it('builds TodoMVC tree and queries it', async () => {
    const root = document.body;

    const header = document.createElement('header');
    header.classList.add('header');
    const h1 = document.createElement('h1');
    h1.append('todos');
    header.appendChild(h1);
    const input = document.createElement('input');
    input.setAttribute('placeholder', 'What needs to be done?');
    input.classList.add('new-todo');
    header.appendChild(input);
    root.appendChild(header);

    const main = document.createElement('section');
    main.classList.add('main');
    const list = document.createElement('ul');
    list.classList.add('todo-list');

    const items = ['Buy milk', 'Walk dog', 'Write tests'];
    for (const [i, label] of items.entries()) {
      const li = document.createElement('li');
      li.classList.add('todo-item');
      if (i === 0) li.classList.add('completed');
      li.dataset['index'] = String(i);
      const labelEl = document.createElement('label');
      labelEl.append(label);
      li.appendChild(labelEl);
      list.appendChild(li);
    }

    main.appendChild(list);
    root.appendChild(main);

    const footer = document.createElement('footer');
    footer.classList.add('footer');
    const count = document.createElement('span');
    count.classList.add('todo-count');
    count.append('3 items left');
    footer.appendChild(count);
    root.appendChild(footer);

    // Structural assertions (using class selectors since the Lynx tag map
    // turns `li` into the underlying `view` tag at PAPI level, so tag
    // selectors require the reverse lookup that real engine __QuerySelector
    // applies but this mock does not):
    const listItems = document.querySelectorAll('.todo-item');
    expect(listItems).toHaveLength(3);
    expect(listItems[0]?.classList.contains('completed')).toBe(true);
    expect(listItems[1]?.classList.contains('completed')).toBe(false);
    expect(listItems[2]?.classList.contains('completed')).toBe(false);

    expect(document.querySelector('.new-todo')).not.toBeNull();
    expect(document.querySelector('.todo-count')).not.toBeNull();
    expect(document.querySelectorAll('.header')).toHaveLength(1);
    expect(document.querySelectorAll('.todo-list')).toHaveLength(1);

    // dataset access:
    expect(listItems[2]?.dataset['index']).toBe('2');

    // No console.warn fired during the build:
    expect(warnSpy).not.toHaveBeenCalled();

    // Auto-flush coalesced all the mutations to one flush:
    await new Promise<void>((r) => {
      queueMicrotask(r);
    });
    expect(flushed).toBe(1);
  });
});
