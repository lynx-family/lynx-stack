// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Parser } from 'htmlparser2';

import { createMockPAPI } from './mock-papi.ts';
import type { MockElement, MockPAPIInstance } from './mock-papi.ts';

/**
 * Minimal mock DOM Shim used by Route B. Wraps the shared mock PAPI so that
 * harness-side counter checks (creates / appends / flushes) work the same way
 * routes A and B are compared apples-to-apples.
 *
 * This is NOT the real `@lynx-js/dom-shim` runtime — it implements just
 * enough Web DOM surface that LLM-generated `document.createElement(...)`,
 * `appendChild`, `setAttribute`, `addEventListener('click', fn)`,
 * `classList.{add,remove,toggle}`, `style.X = v`, `innerHTML = '...'`,
 * `querySelector` will exercise the underlying mock PAPI runtime.
 *
 * Phase 1 mock; throw away after benchmark.
 */

export interface MockShimInstance {
  papi: MockPAPIInstance;
  /** Globals to inject into a vm.runInNewContext context. */
  globals: Record<string, unknown>;
}

interface ShimNode {
  __mock: MockElement;
  // The Web-shape properties we expose to LLM-generated code:
  tagName: string;
  classList: ShimClassList;
  style: Record<string, unknown>;
  dataset: Record<string, unknown>;
  appendChild(child: ShimNode): ShimNode;
  removeChild(child: ShimNode): ShimNode;
  insertBefore(child: ShimNode, ref: ShimNode | null): ShimNode;
  setAttribute(name: string, value: unknown): void;
  removeAttribute(name: string): void;
  getAttribute(name: string): unknown;
  addEventListener(event: string, handler: unknown): void;
  removeEventListener(event: string, handler: unknown): void;
  /** Setting innerHTML parses and replaces children. Get returns serialized HTML approximation. */
  innerHTML: string;
  textContent: string;
}

interface ShimClassList {
  add(...names: string[]): void;
  remove(...names: string[]): void;
  toggle(name: string): void;
  contains(name: string): boolean;
}

export function createMockShim(): MockShimInstance {
  const papi = createMockPAPI();
  const elToNode = new WeakMap<MockElement, ShimNode>();

  // Each registered Lynx-flavored tag maps to a specific PAPI Create*.
  // Anything not in the table falls through to __CreateElement(tag).
  const TAG_MAP: Record<string, () => MockElement> = {
    view: () =>
      (papi.globals['__CreateView'] as (n?: number) => MockElement)(0),
    text: () =>
      (papi.globals['__CreateText'] as (n?: number) => MockElement)(0),
    image: () =>
      (papi.globals['__CreateImage'] as (n?: number) => MockElement)(0),
    img: () =>
      (papi.globals['__CreateImage'] as (n?: number) => MockElement)(0),
    'scroll-view': () =>
      (papi.globals['__CreateScrollView'] as (n?: number) => MockElement)(0),
    list: () =>
      (papi.globals['__CreateList'] as (n?: number) => MockElement)(0),
    input: () =>
      (papi.globals['__CreateElement'] as (
        t: string,
        n?: number,
      ) => MockElement)(
        'input',
        0,
      ),
    button: () =>
      (papi.globals['__CreateElement'] as (
        t: string,
        n?: number,
      ) => MockElement)(
        'button',
        0,
      ),
  };

  function createMock(tag: string): MockElement {
    const lower = tag.toLowerCase();
    const factory = TAG_MAP[lower]
      ?? (() =>
        (papi.globals['__CreateElement'] as (
          t: string,
          n?: number,
        ) => MockElement)(
          lower,
          0,
        ));
    return factory();
  }

  function wrap(el: MockElement): ShimNode {
    const cached = elToNode.get(el);
    if (cached) return cached;
    const node = makeShimNode(el);
    elToNode.set(el, node);
    return node;
  }

  function makeShimNode(el: MockElement): ShimNode {
    const styleProxy = new Proxy(el.inlineStyle as Record<string, unknown>, {
      get(target, prop): unknown {
        if (typeof prop !== 'string') return undefined;
        return target[prop];
      },
      set(target, prop, value): boolean {
        if (typeof prop !== 'string') return false;
        target[prop] = value;
        // route through PAPI for counter-tracking accuracy
        (papi.globals['__AddInlineStyle'] as (
          e: MockElement,
          k: string,
          v: unknown,
        ) => void)(
          el,
          prop,
          value,
        );
        return true;
      },
    });

    const classList: ShimClassList = {
      add: (...names) => {
        for (const n of names) {
          if (!el.classes.includes(n)) {
            (papi.globals['__AddClass'] as (e: MockElement, c: string) => void)(
              el,
              n,
            );
          }
        }
      },
      remove: (...names) => {
        const next = el.classes.filter(c => !names.includes(c));
        (papi.globals['__SetClasses'] as (e: MockElement, s: string) => void)(
          el,
          next.join(' '),
        );
      },
      toggle: (name) => {
        if (el.classes.includes(name)) classList.remove(name);
        else classList.add(name);
      },
      contains: (name) => el.classes.includes(name),
    };

    const node: ShimNode = {
      __mock: el,
      get tagName(): string {
        return el.tag.toUpperCase();
      },
      classList,
      style: styleProxy,
      dataset: el.dataset,
      appendChild(child) {
        (papi.globals['__AppendElement'] as (
          p: MockElement,
          c: MockElement,
        ) => MockElement)(
          el,
          child.__mock,
        );
        return child;
      },
      removeChild(child) {
        (papi.globals['__RemoveElement'] as (
          p: MockElement,
          c: MockElement,
        ) => MockElement)(
          el,
          child.__mock,
        );
        return child;
      },
      insertBefore(child, ref) {
        (papi.globals['__InsertElementBefore'] as (
          p: MockElement,
          c: MockElement,
          r?: MockElement,
        ) => MockElement)(el, child.__mock, ref?.__mock);
        return child;
      },
      setAttribute(name, value) {
        if (name === 'class') {
          (papi.globals['__SetClasses'] as (e: MockElement, s: string) => void)(
            el,
            String(value),
          );
          return;
        }
        if (name === 'id') {
          (papi.globals['__SetID'] as (e: MockElement, s: string) => void)(
            el,
            String(value),
          );
          return;
        }
        if (name === 'style') {
          (papi.globals['__SetInlineStyles'] as (
            e: MockElement,
            v: unknown,
          ) => void)(
            el,
            String(value),
          );
          return;
        }
        (papi.globals['__SetAttribute'] as (
          e: MockElement,
          n: string,
          v: unknown,
        ) => void)(
          el,
          name,
          value,
        );
      },
      removeAttribute(name) {
        // Mock approximation: set to undefined.
        (papi.globals['__SetAttribute'] as (
          e: MockElement,
          n: string,
          v: unknown,
        ) => void)(
          el,
          name,
          undefined,
        );
      },
      getAttribute(name) {
        return el.attrs[name];
      },
      addEventListener(event, handler) {
        // Web event ↔ Lynx bindEvent + named handler. We use a generated name
        // and stash the handler reference on the element's events array.
        const name = `__handler_${el.uid}_${event}`;
        (papi.globals['__AddEvent'] as (
          e: MockElement,
          t: string,
          n: string,
          h: unknown,
        ) => void)(el, 'bindEvent', event, name);
        el.events.push({ type: 'bindEvent', name, handler });
      },
      removeEventListener(event, handler) {
        const idx = el.events.findIndex(e =>
          e.type === 'bindEvent' && e.handler === handler
          && e.name.includes(event)
        );
        if (idx >= 0) el.events.splice(idx, 1);
      },
      get innerHTML(): string {
        return el.children.map(c => serializeMockHTML(c)).join('');
      },
      set innerHTML(html: string) {
        // Clear children.
        for (const child of [...el.children]) {
          (papi.globals['__RemoveElement'] as (
            p: MockElement,
            c: MockElement,
          ) => MockElement)(
            el,
            child,
          );
        }
        // Parse and append fresh children.
        const fresh = parseHtmlToMock(html, createMock);
        for (const child of fresh) {
          (papi.globals['__AppendElement'] as (
            p: MockElement,
            c: MockElement,
          ) => MockElement)(
            el,
            child,
          );
        }
      },
      get textContent(): string {
        return collectText(el);
      },
      set textContent(t: string) {
        for (const child of [...el.children]) {
          (papi.globals['__RemoveElement'] as (
            p: MockElement,
            c: MockElement,
          ) => MockElement)(
            el,
            child,
          );
        }
        if (t) {
          const rawText =
            (papi.globals['__CreateRawText'] as (s: string) => MockElement)(t);
          (papi.globals['__AppendElement'] as (
            p: MockElement,
            c: MockElement,
          ) => MockElement)(
            el,
            rawText,
          );
        }
      },
    };
    return node;
  }

  // ---- Document facade ----
  const pageElement = (papi.globals['__CreatePage'] as (
    id: string,
    css: number,
  ) => MockElement)('mock', 0);
  const body = (papi.globals['__CreateView'] as (n?: number) => MockElement)(0);
  (papi.globals['__AppendElement'] as (
    p: MockElement,
    c: MockElement,
  ) => MockElement)(
    pageElement,
    body,
  );

  const documentFacade = {
    body: wrap(body),
    createElement(tag: string): ShimNode {
      return wrap(createMock(tag));
    },
    createTextNode(text: string): ShimNode {
      const raw =
        (papi.globals['__CreateRawText'] as (s: string) => MockElement)(text);
      return wrap(raw);
    },
    querySelector(_sel: string): ShimNode | null {
      // Very limited: only support id and class selectors at depth-1.
      return null;
    },
    querySelectorAll(_sel: string): ShimNode[] {
      return [];
    },
    addEventListener(): void {
      // accept-and-ignore for global listeners
    },
    getElementById(id: string): ShimNode | null {
      const found = findById(body, id);
      return found ? wrap(found) : null;
    },
  };

  // The harness will FlushElementTree at the end implicitly by calling our
  // `flush` shim. But the convention for Route B is the LLM may also call
  // a no-op global `__flush()` (we provide one). Either way, harness-side
  // counter requires render_ok = creates>=1 && appends>=1 && flushes>=1.
  function flush(): void {
    (papi.globals['__FlushElementTree'] as (e?: MockElement) => void)(
      pageElement,
    );
  }

  const globals: Record<string, unknown> = {
    document: documentFacade,
    window: { document: documentFacade },
    __flush__: flush,
    // For LLM convenience, expose a couple of HTMLElement-class shims so
    // `instanceof HTMLElement` doesn't blow up. We don't enforce anything.
    HTMLElement: class HTMLElementStub {},
    Element: class ElementStub {},
    Node: class NodeStub {},
  };

  return { papi, globals };
}

function serializeMockHTML(el: MockElement): string {
  if (el.tag === 'raw-text') return el.rawText ?? '';
  const attrs = [];
  if (el.classes.length > 0) attrs.push(`class="${el.classes.join(' ')}"`);
  if (el.id) attrs.push(`id="${el.id}"`);
  const inner = el.children.map(c => serializeMockHTML(c)).join('');
  const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
  return `<${el.tag}${attrStr}>${inner}</${el.tag}>`;
}

function parseHtmlToMock(
  html: string,
  createMock: (tag: string) => MockElement,
): MockElement[] {
  const root: MockElement[] = [];
  const stack: MockElement[] = [];
  const parser = new Parser(
    {
      onopentag(name, attribs) {
        const el = createMock(name);
        if (attribs['class']) {
          el.classes = attribs['class'].split(/\s+/).filter(Boolean);
        }
        if (attribs['id']) el.id = attribs['id'];
        for (const [k, v] of Object.entries(attribs)) {
          if (k === 'class' || k === 'id') continue;
          el.attrs[k] = v;
        }
        const parent = stack[stack.length - 1];
        if (parent) {
          parent.children.push(el);
          el.parent = parent;
        } else {
          root.push(el);
        }
        stack.push(el);
      },
      ontext(text) {
        const parent = stack[stack.length - 1];
        if (parent && text.trim().length > 0) {
          parent.rawText = (parent.rawText ?? '') + text;
        }
      },
      onclosetag() {
        stack.pop();
      },
    },
    { decodeEntities: true, lowerCaseTags: true },
  );
  parser.write(html);
  parser.end();
  return root;
}

function findById(root: MockElement, id: string): MockElement | undefined {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findById(child, id);
    if (found) return found;
  }
  return undefined;
}

function collectText(el: MockElement): string {
  if (el.tag === 'raw-text') return el.rawText ?? '';
  return el.children.map(c => collectText(c)).join('');
}
