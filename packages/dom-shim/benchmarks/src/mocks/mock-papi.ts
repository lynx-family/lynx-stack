// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Mock Lynx Element PAPI runtime, shared by routes A and B. Records every
 * call into `calls` for inspection, and builds an in-memory element tree so
 * the harness can render a static HTML preview for visual scoring.
 *
 * This is NOT a faithful reimplementation of the Lynx engine. It implements
 * just enough PAPI surface to:
 *  - decide whether a generated snippet "rendered" (at least one Create +
 *    at least one Append + at least one Flush, no thrown errors)
 *  - dump a static HTML representation of the final tree for screenshotting
 *
 * Phase 1 mock; throw away after benchmark.
 */

/**
 * Stays a bare `string` for the union with `__CreateElement(tag: string, ...)`,
 * but here are the canonical Lynx tag spellings the mock specifically
 * recognizes when mapping to preview HTML: page, view, text, image,
 * scroll-view, list, raw-text, wrapper, none, if, for, block.
 */
export type MockTagName = string;

/**
 * Whitelist of tag names the mock PAPI accepts in `__CreateElement(tag)`.
 * Anything else throws so Route A/B see the same strictness Route C's JSON
 * schema enum enforces. Extend conservatively as the real Lynx engine grows.
 */
export const ALLOWED_LYNX_TAGS: ReadonlySet<string> = new Set([
  'page',
  'view',
  'text',
  'image',
  'scroll-view',
  'list',
  'raw-text',
  'wrapper',
  'none',
  'if',
  'for',
  'block',
  'input',
  'button',
  'svg',
]);

export interface MockElement {
  uid: number;
  tag: MockTagName;
  attrs: Record<string, unknown>;
  classes: string[];
  inlineStyle: Record<string, unknown> | string;
  id: string | null;
  rawText?: string;
  dataset: Record<string, unknown>;
  events: Array<{ type: string; name: string; handler: unknown }>;
  children: MockElement[];
  parent: MockElement | null;
}

export interface MockPAPICallRecord {
  name: string;
  args: unknown[];
}

export interface MockPAPIInstance {
  /** Element-tree root, set on first __CreatePage. */
  page: MockElement | null;
  /** Call sequence for diagnostics. */
  calls: MockPAPICallRecord[];
  /** Per-PAPI counts for the render_ok proxy. */
  counters: {
    creates: number;
    appends: number;
    flushes: number;
  };
  /** All globals to inject into a vm.runInNewContext context. */
  globals: Record<string, unknown>;
  /** Render the recorded tree to a self-contained HTML document for previewing. */
  toPreviewHTML(): string;
}

export function createMockPAPI(): MockPAPIInstance {
  let nextUid = 1;
  const calls: MockPAPICallRecord[] = [];
  const counters = { creates: 0, appends: 0, flushes: 0 };
  let page: MockElement | null = null;

  const newElement = (tag: MockTagName): MockElement => ({
    uid: nextUid++,
    tag,
    attrs: {},
    classes: [],
    inlineStyle: {},
    id: null,
    dataset: {},
    events: [],
    children: [],
    parent: null,
  });

  const record = (name: string, args: unknown[]): void => {
    calls.push({ name, args });
  };

  // Build the global PAPI surface. Each function records itself + delegates to
  // the in-memory tree operations.
  const globals: Record<string, unknown> = {
    __CreatePage(
      _componentId: string,
      _cssId: number,
      _info?: unknown,
    ): MockElement {
      record('__CreatePage', [_componentId, _cssId, _info]);
      counters.creates++;
      const p = newElement('page');
      page = p;
      return p;
    },
    __CreateView(_parentComponentUniId?: number, _info?: unknown): MockElement {
      record('__CreateView', [_parentComponentUniId, _info]);
      counters.creates++;
      return newElement('view');
    },
    __CreateText(_parentComponentUniId?: number, _info?: unknown): MockElement {
      record('__CreateText', [_parentComponentUniId, _info]);
      counters.creates++;
      return newElement('text');
    },
    __CreateImage(
      _parentComponentUniId?: number,
      _info?: unknown,
    ): MockElement {
      record('__CreateImage', [_parentComponentUniId, _info]);
      counters.creates++;
      return newElement('image');
    },
    __CreateScrollView(
      _parentComponentUniId?: number,
      _info?: unknown,
    ): MockElement {
      record('__CreateScrollView', [_parentComponentUniId, _info]);
      counters.creates++;
      return newElement('scroll-view');
    },
    __CreateList(
      _parentComponentUniId?: number,
      _cbA?: unknown,
      _cbB?: unknown,
      _info?: unknown,
      _cbC?: unknown,
    ): MockElement {
      record('__CreateList', [_parentComponentUniId, _cbA, _cbB, _info, _cbC]);
      counters.creates++;
      return newElement('list');
    },
    __CreateRawText(text: string, _info?: unknown): MockElement {
      record('__CreateRawText', [text, _info]);
      counters.creates++;
      const el = newElement('raw-text');
      el.rawText = String(text);
      return el;
    },
    __CreateWrapperElement(_parentComponentUniId?: number): MockElement {
      record('__CreateWrapperElement', [_parentComponentUniId]);
      counters.creates++;
      return newElement('wrapper');
    },
    __CreateElement(
      tag: string,
      _comParentUniID?: number,
      _info?: unknown,
    ): MockElement {
      record('__CreateElement', [tag, _comParentUniID, _info]);
      if (!ALLOWED_LYNX_TAGS.has(tag)) {
        throw new Error(`Unknown Lynx tag: ${tag}`);
      }
      counters.creates++;
      return newElement(tag);
    },

    __AppendElement(parent: MockElement, current: MockElement): MockElement {
      record('__AppendElement', [parent?.uid, current?.uid]);
      counters.appends++;
      if (parent && current) {
        parent.children.push(current);
        current.parent = parent;
      }
      return parent;
    },
    __RemoveElement(parent: MockElement, current: MockElement): MockElement {
      record('__RemoveElement', [parent?.uid, current?.uid]);
      if (parent && current) {
        const idx = parent.children.indexOf(current);
        if (idx >= 0) parent.children.splice(idx, 1);
        current.parent = null;
      }
      return parent;
    },
    __InsertElementBefore(
      parent: MockElement,
      current: MockElement,
      marker?: MockElement,
    ): MockElement {
      record('__InsertElementBefore', [parent?.uid, current?.uid, marker?.uid]);
      if (parent && current) {
        if (marker) {
          const idx = parent.children.indexOf(marker);
          parent.children.splice(
            idx >= 0 ? idx : parent.children.length,
            0,
            current,
          );
        } else {
          parent.children.push(current);
        }
        current.parent = parent;
      }
      return parent;
    },
    __ReplaceElement(
      newElementArg: MockElement,
      oldElement: MockElement,
    ): void {
      record('__ReplaceElement', [newElementArg?.uid, oldElement?.uid]);
      const parent = oldElement?.parent;
      if (parent) {
        const idx = parent.children.indexOf(oldElement);
        if (idx >= 0) parent.children.splice(idx, 1, newElementArg);
        newElementArg.parent = parent;
        oldElement.parent = null;
      }
    },

    __SetAttribute(
      current: MockElement,
      attrName: string,
      value: unknown,
    ): void {
      record('__SetAttribute', [current?.uid, attrName, value]);
      if (current) current.attrs[attrName] = value;
    },
    __AddClass(current: MockElement, className: string): void {
      record('__AddClass', [current?.uid, className]);
      if (current && className) current.classes.push(className);
    },
    __SetClasses(current: MockElement, className: string | undefined): void {
      record('__SetClasses', [current?.uid, className]);
      if (current) {
        current.classes = (className ?? '').split(/\s+/).filter(Boolean);
      }
    },
    __SetInlineStyles(node: MockElement, value: unknown): void {
      record('__SetInlineStyles', [node?.uid, value]);
      if (node) {
        node.inlineStyle = (value ?? {}) as Record<string, unknown> | string;
      }
    },
    __AddInlineStyle(
      e: MockElement,
      key: number | string,
      value: unknown,
    ): void {
      record('__AddInlineStyle', [e?.uid, key, value]);
      if (e && typeof e.inlineStyle === 'object') {
        e.inlineStyle[String(key)] = value;
      }
    },
    __SetID(node: MockElement, id: string | null): void {
      record('__SetID', [node?.uid, id]);
      if (node) node.id = id;
    },
    __AddEvent(
      node: MockElement,
      type: string,
      name: string,
      func: unknown,
    ): void {
      record('__AddEvent', [node?.uid, type, name, func]);
      if (node) node.events.push({ type, name, handler: func });
    },
    __AddDataset(node: MockElement, key: string, value: unknown): void {
      record('__AddDataset', [node?.uid, key, value]);
      if (node) node.dataset[key] = value;
    },
    __SetDataset(
      node: MockElement,
      value: Record<string, unknown> | undefined,
    ): void {
      record('__SetDataset', [node?.uid, value]);
      if (node) node.dataset = { ...(value ?? {}) };
    },

    __GetElementUniqueID(node: MockElement): number {
      return node?.uid ?? 0;
    },
    __GetTag(node: MockElement): string {
      return node?.tag ?? '';
    },
    __GetParent(current: MockElement): MockElement | null {
      return current?.parent ?? null;
    },
    __GetChildren(current: MockElement): MockElement[] {
      return current?.children ?? [];
    },
    __FirstElement(current: MockElement): MockElement | undefined {
      return current?.children[0];
    },
    __LastElement(current: MockElement): MockElement | undefined {
      return current?.children[current.children.length - 1];
    },

    __FlushElementTree(_element?: MockElement, _options?: unknown): void {
      record('__FlushElementTree', [_element?.uid, _options]);
      counters.flushes++;
    },

    // No-op stubs for any other PAPI calls the LLM may try. They record so
    // diagnostics can surface "called __X which is unsupported in mock".
    __SetEvents(): void {
      record('__SetEvents', []);
    },
    __SetCSSId(): void {
      record('__SetCSSId', []);
    },
    __SetConfig(): void {
      record('__SetConfig', []);
    },
    __AddConfig(): void {
      record('__AddConfig', []);
    },
    __UpdateComponentID(): void {
      record('__UpdateComponentID', []);
    },
    __OnLifecycleEvent(): void {
      record('__OnLifecycleEvent', []);
    },
    __ReportError(): void {
      record('__ReportError', []);
    },
  };

  const instance: MockPAPIInstance = {
    get page() {
      return page;
    },
    calls,
    counters,
    globals,
    toPreviewHTML(): string {
      return renderPreviewHTML(page);
    },
  };

  return instance;
}

/** Map Lynx tag to plain HTML, preserving classes / inline style / id. */
function renderPreviewHTML(root: MockElement | null): string {
  const body = root
    ? renderElement(root)
    : '<div style="padding:24px;color:#999">(empty)</div>';
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; background: #fff; color: #111; }
  view { display: block; }
  text { display: inline; }
  scroll-view { display: block; overflow: auto; }
  list { display: block; }
  image { display: inline-block; }
</style></head><body>${body}</body></html>`;
}

function renderElement(el: MockElement): string {
  const tag = mapToHtmlTag(el.tag);
  const attrs = buildAttrString(el);
  if (el.tag === 'raw-text') {
    return escapeHtml(el.rawText ?? '');
  }
  const children = el.children.map(child => renderElement(child)).join('');
  // Self-closing for image
  if (el.tag === 'image') {
    return `<${tag}${attrs}>`;
  }
  return `<${tag}${attrs}>${children}</${tag}>`;
}

function mapToHtmlTag(tag: MockTagName): string {
  switch (tag) {
    case 'page':
    case 'view':
    case 'scroll-view':
    case 'list':
    case 'wrapper':
    case 'block':
      return 'div';
    case 'text':
      return 'span';
    case 'image':
      return 'img';
    case 'raw-text':
      return 'span';
    default:
      return 'div';
  }
}

function buildAttrString(el: MockElement): string {
  const parts: string[] = [];
  if (el.id) parts.push(`id="${escapeAttr(el.id)}"`);
  if (el.classes.length > 0) {
    parts.push(`class="${escapeAttr(el.classes.join(' '))}"`);
  }
  if (typeof el.inlineStyle === 'string') {
    if (el.inlineStyle) parts.push(`style="${escapeAttr(el.inlineStyle)}"`);
  } else {
    const styleEntries = Object.entries(el.inlineStyle);
    if (styleEntries.length > 0) {
      const text = styleEntries
        .map(([k, v]) => `${camelToDash(k)}: ${String(v)}`)
        .join('; ');
      parts.push(`style="${escapeAttr(text)}"`);
    }
  }
  // Carry select attrs through. `text` is for <text text="..."/> style.
  const textAttr = el.attrs['text'];
  if (typeof textAttr === 'string') {
    parts.push(`data-text="${escapeAttr(textAttr)}"`);
  }
  const srcAttr = el.attrs['src'];
  if (typeof srcAttr === 'string') {
    parts.push(`src="${escapeAttr(srcAttr)}"`);
  }
  const placeholderAttr = el.attrs['placeholder'];
  if (typeof placeholderAttr === 'string') {
    parts.push(`data-placeholder="${escapeAttr(placeholderAttr)}"`);
  }
  return parts.length > 0 ? ' ' + parts.join(' ') : '';
}

function camelToDash(s: string): string {
  return s.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&#39;',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => HTML_ESCAPES[c] ?? c);
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
