// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Shared PAPI mock for WPT tests. See Shim_Implementation_PRD.md §8.4 —
 * this stand-in will be replaced by the real-Lynx mock when Phase 1.5
 * US-153 ships.
 *
 * Each test calls `resetPapi()` to install a fresh page + mocked PAPI
 * globals. The mock tracks tree mutations, attributes, classes, events,
 * and inline styles in plain JS objects so tests can introspect.
 */

export interface MockEl extends Record<string, unknown> {
  tag: string;
  uid: number;
  attrs: Record<string, unknown>;
  text?: string;
  events: Array<{ type: string; name: string; func: unknown }>;
  parent: MockEl | undefined;
  children: MockEl[];
}

let nextUid = 30_000;
export let page: MockEl;

export function mk(tag: string): MockEl {
  return {
    tag,
    uid: nextUid++,
    attrs: {},
    events: [],
    parent: undefined,
    children: [],
  };
}

function matchSelector(n: MockEl, sel: string): boolean {
  if (sel === '*') return n.tag !== 'raw-text';
  if (sel.startsWith('#')) return n.attrs['id'] === sel.slice(1);
  if (sel.startsWith('.')) {
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

export function resetPapi(): void {
  nextUid = 30_000;
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
  g['__SetInlineStyles'] = () => undefined;
  g['__AddEvent'] = (
    n: MockEl,
    type: string,
    name: string,
    func: unknown,
  ) => {
    n.events.push({ type, name, func });
  };
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
  g['__ReplaceElement'] = (newEl: MockEl, oldEl: MockEl) => {
    if (!oldEl.parent) return;
    const i = oldEl.parent.children.indexOf(oldEl);
    oldEl.parent.children[i] = newEl;
    newEl.parent = oldEl.parent;
    oldEl.parent = undefined;
  };
  g['__CloneElement'] = (ref: MockEl, opts: Record<string, unknown>) => {
    const deep = opts['deep'] === true;
    const copy: MockEl = {
      ...ref,
      uid: nextUid++,
      attrs: { ...ref.attrs },
      events: [],
      parent: undefined,
      children: [],
    };
    if (deep) {
      for (const c of ref.children) {
        const childCopy = (g['__CloneElement'] as typeof __CloneElement)(
          c,
          { deep: true },
        );
        (childCopy as MockEl).parent = copy;
        copy.children.push(childCopy as MockEl);
      }
    }
    return copy;
  };
  g['__QuerySelector'] = (root: MockEl, sel: string): MockEl | undefined =>
    querySelectorAllImpl(root, sel)[0];
  g['__QuerySelectorAll'] = (root: MockEl, sel: string): MockEl[] =>
    querySelectorAllImpl(root, sel);
  g['__InvokeUIMethod'] = (
    _ref: MockEl,
    _method: string,
    _params: unknown,
    cb: (res: { code: number; data: unknown }) => void,
  ) => {
    cb({ code: 1, data: null });
    return [];
  };
  g['__FlushElementTree'] = () => undefined;
}
