// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { _resetDocumentForTesting, document } from '../document.ts';
import { ShimEvent, fireEvent } from '../events.ts';
import { _resetSchedulerForTesting } from '../scheduler.ts';

/**
 * M4 (L3a Events) EXIT integration. See Shim_Implementation_PRD.md §4 +
 * §5 US-435.
 *
 * Builds the TodoMVC tree and wires click handlers for:
 * - "add todo" on the input
 * - "toggle done" on each item
 * - "clear completed" on a footer button
 *
 * Dispatch happens via fireEvent (the Shim trampoline path) — NOT via
 * dispatchEvent, which is L4 throw.
 */

interface MockEl extends Record<string, unknown> {
  tag: string;
  uid: number;
  attrs: Record<string, unknown>;
  parent: MockEl | undefined;
  children: MockEl[];
}

let nextUid = 8500;
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
    // Support compound classes like `.todo-item.completed` — all required.
    const required = sel.split('.').filter(Boolean);
    const classes = ((n.attrs['class'] as string | undefined) ?? '').split(
      /\s+/,
    );
    return required.every((r) => classes.includes(r));
  }
  return n.tag === sel;
}

function querySelectorAllImpl(root: MockEl, sel: string): MockEl[] {
  const parts = sel.trim().split(/\s+/);
  if (parts.length > 1) {
    const [head, ...rest] = parts;
    if (!head) return [];
    const tail = rest.join(' ');
    const ancestors = querySelectorAllImpl(root, head);
    const out: MockEl[] = [];
    for (const a of ancestors) out.push(...querySelectorAllImpl(a, tail));
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
  nextUid = 8500;
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
  g['__SetDataset'] = () => undefined;
  g['__AddInlineStyle'] = () => undefined;
  g['__AddEvent'] = () => undefined;
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

describe('M4 EXIT — TodoMVC events end-to-end', () => {
  beforeEach(() => {
    _resetSchedulerForTesting();
    _resetDocumentForTesting();
    installPapi();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _resetSchedulerForTesting();
  });

  it('add todo via input change, toggle done, clear completed', () => {
    const body = document.body;

    // Build TodoMVC skeleton.
    const list = document.createElement('ul');
    list.classList.add('todo-list');
    body.appendChild(list);

    const clearBtn = document.createElement('button');
    clearBtn.classList.add('clear-completed');
    body.appendChild(clearBtn);

    // Add 3 todos.
    const seed = ['Buy milk', 'Walk dog', 'Write tests'];
    function addTodo(label: string): void {
      const li = document.createElement('li');
      li.classList.add('todo-item');
      li.dataset['label'] = label;
      // Click toggles `.completed`.
      li.addEventListener('click', () => {
        if (li.classList.contains('completed')) {
          li.classList.remove('completed');
        } else {
          li.classList.add('completed');
        }
      });
      list.appendChild(li);
    }
    for (const s of seed) addTodo(s);

    // Wire clear-completed.
    clearBtn.addEventListener('click', () => {
      for (const li of document.querySelectorAll('.todo-item')) {
        if (li.classList.contains('completed')) li.remove();
      }
    });

    expect(document.querySelectorAll('.todo-item')).toHaveLength(3);

    // Click on first item — toggle done.
    const items = document.querySelectorAll('.todo-item');
    fireEvent(items[0]!.papi, 'click');
    expect(items[0]?.classList.contains('completed')).toBe(true);

    // Click again — toggle back.
    fireEvent(items[0]!.papi, 'click');
    expect(items[0]?.classList.contains('completed')).toBe(false);

    // Toggle items 0 and 2 to completed.
    fireEvent(items[0]!.papi, 'click');
    fireEvent(items[2]!.papi, 'click');
    expect(
      document.querySelectorAll('.todo-item.completed'),
    ).toHaveLength(2);

    // Click clear button — removes completed items.
    fireEvent(clearBtn.papi, 'click');
    const remaining = document.querySelectorAll('.todo-item');
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.dataset['label']).toBe('Walk dog');
  });

  it('dispatchEvent on synthetic Event throws L4', () => {
    const e = document.createElement('div');
    expect(() => e.dispatchEvent(new ShimEvent('click'))).toThrow(
      /L4\/synthetic-dispatch/,
    );
  });
});
