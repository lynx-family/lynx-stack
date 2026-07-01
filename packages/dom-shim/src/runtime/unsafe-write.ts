// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { parseDocument } from 'htmlparser2';

import { getElementCache } from './cache.ts';
import type { ElementRef } from './papi-types.ts';
import { htmlToLynx, lynxToHtml as lynxToHtmlReverse } from './tag-map.ts';

/**
 * L3b innerHTML pipeline. See Shim_Design.md §7.2 + §7.3.
 *
 * Lives in a separate module from nodes.ts because htmlparser2 is a
 * runtime dependency and the parse code is large; keeping it isolated
 * helps tree-shaking and makes the L3b setter on L3bUnsafeWritableElement
 * a one-line delegation.
 */

/** Default parent-component id used when no page context is available. */
function pageComponentId(): number {
  try {
    return __GetElementUniqueID(__GetPageElement());
  } catch {
    return 0;
  }
}

function warnDivergence(code: string, message: string): void {
  console.warn(
    JSON.stringify({
      code,
      tier: 3,
      subTier: 'b',
      surface: 'Element.innerHTML',
      message,
    }),
  );
}

function createRefForTag(tag: string, compId: number): ElementRef | null {
  const outcome = htmlToLynx(tag);
  if (outcome.kind === 'skipped') {
    if (outcome.divergence) {
      warnDivergence(outcome.divergence, `<${tag}> skipped during innerHTML.`);
    }
    return null;
  }
  if (outcome.kind === 'fallback') {
    const ref = __CreateView(compId);
    __SetAttribute(ref, 'data-shim-tag', outcome.rawTag);
    return ref;
  }
  const { factory, rawTag, defaultClasses } = outcome.result;
  let ref: ElementRef;
  switch (factory) {
    case 'view':
      ref = __CreateView(compId);
      break;
    case 'text':
      ref = __CreateText(compId);
      break;
    case 'image':
      ref = __CreateImage(compId);
      break;
    case 'scrollView':
      ref = __CreateScrollView(compId);
      break;
    case 'element':
      ref = __CreateElement(rawTag ?? tag.toLowerCase(), compId);
      break;
    default:
      ref = __CreateView(compId);
  }
  if (defaultClasses && defaultClasses.length > 0) {
    __SetAttribute(ref, 'class', defaultClasses.join(' '));
  }
  return ref;
}

function applyAttributes(
  ref: ElementRef,
  attribs: Record<string, string>,
): void {
  for (const [rawKey, value] of Object.entries(attribs)) {
    const key = rawKey.toLowerCase();
    if (key.startsWith('on')) {
      warnDivergence(
        'shim:L3b/inline-event-attrs-ignored',
        `Inline event attribute "${rawKey}" ignored for security; use addEventListener.`,
      );
      continue;
    }
    if (key === 'class') {
      // Merge with default classes already applied by createRefForTag.
      const existing = __GetClasses(ref);
      const incoming = value.split(/\s+/).filter(Boolean);
      const merged = [...new Set([...existing, ...incoming])];
      __SetClasses(ref, merged.join(' '));
      continue;
    }
    if (key === 'style') {
      const cache = getElementCache(ref);
      for (const decl of value.split(';')) {
        const colon = decl.indexOf(':');
        if (colon < 0) continue;
        const k = decl.slice(0, colon).trim().toLowerCase();
        const v = decl.slice(colon + 1).trim();
        if (k === '' || v === '') continue;
        __AddInlineStyle(ref, k, v);
        cache.styles.set(k, v);
      }
      continue;
    }
    __SetAttribute(ref, key, value);
  }
}

/**
 * Minimal local type for htmlparser2 / domhandler AST nodes. We avoid a
 * direct dependency on `domhandler` types so the runtime's only declared
 * dependency stays `htmlparser2` itself.
 */
interface AstNode {
  type: string;
  data?: string;
  name?: string;
  attribs?: Record<string, string>;
  children?: AstNode[];
}

function buildFromAst(node: AstNode, compId: number): ElementRef | null {
  if (node.type === 'text') {
    const text = node.data ?? '';
    if (text === '') return null;
    const ref = __CreateRawText(text);
    recordTextValueLocal(ref, text);
    return ref;
  }
  if (node.type === 'tag' || node.type === 'script' || node.type === 'style') {
    const tag = (node.name ?? '').toLowerCase();
    const ref = createRefForTag(tag, compId);
    if (ref === null) return null;
    applyAttributes(ref, node.attribs ?? {});
    for (const child of node.children ?? []) {
      const childRef = buildFromAst(child, compId);
      if (childRef !== null) __AppendElement(ref, childRef);
    }
    return ref;
  }
  // comments, directives, cdata — ignored.
  return null;
}

/**
 * Clear `this.papi`'s existing children, parse `html`, build the
 * subtree, append.
 */
export function buildL3bInnerHTML(papi: ElementRef, html: string): void {
  // Clear current children.
  const existing = [...__GetChildren(papi)];
  for (const c of existing) __RemoveElement(papi, c);

  if (html === '') return;

  const doc = parseDocument(html, {
    recognizeSelfClosing: true,
    lowerCaseTags: true,
    lowerCaseAttributeNames: true,
  });
  const compId = pageComponentId();
  for (const node of doc.children as unknown as AstNode[]) {
    const ref = buildFromAst(node, compId);
    if (ref !== null) __AppendElement(papi, ref);
  }
}

/**
 * Canonical innerHTML serializer. See Shim_Design.md §7.3
 * `shim:L3b/serialization-canonical`: input ≠ output round-trip.
 */
export function serializeL3bInnerHTML(papi: ElementRef): string {
  const parts: string[] = [];
  for (const child of __GetChildren(papi)) {
    parts.push(serializeNode(child));
  }
  return parts.join('');
}

/** outerHTML serializer — wraps innerHTML in self's tag + attrs. */
export function serializeL3bOuterHTML(papi: ElementRef): string {
  return serializeNode(papi);
}

/**
 * Build refs from `html` and return them. Used by insertAdjacentHTML and
 * outerHTML setter.
 */
export function buildRefsFromHtml(html: string): ElementRef[] {
  if (html === '') return [];
  const doc = parseDocument(html, {
    recognizeSelfClosing: true,
    lowerCaseTags: true,
    lowerCaseAttributeNames: true,
  });
  const compId = pageComponentId();
  const out: ElementRef[] = [];
  for (const node of doc.children as unknown as AstNode[]) {
    const ref = buildFromAst(node, compId);
    if (ref !== null) out.push(ref);
  }
  return out;
}

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

function attrAsString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (
    typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint'
  ) {
    return String(v);
  }
  return JSON.stringify(v);
}

function serializeNode(ref: ElementRef): string {
  const tag = __GetTag(ref);
  if (tag === 'raw-text') {
    return escapeText(getRecordedTextValue(ref));
  }
  const htmlTag = lynxToHtmlReverse(tag);
  const attrs = __GetAttributes(ref) ?? {};
  const attrParts: string[] = [];
  const sortedKeys = Object.keys(attrs).sort();
  for (const k of sortedKeys) {
    const v = attrs[k];
    if (v === undefined || v === null) continue;
    attrParts.push(`${k}="${escapeAttr(attrAsString(v))}"`);
  }
  const attrStr = attrParts.length > 0 ? ` ${attrParts.join(' ')}` : '';
  if (VOID_ELEMENTS.has(htmlTag)) {
    return `<${htmlTag}${attrStr} />`;
  }
  const childParts: string[] = [];
  for (const c of __GetChildren(ref)) childParts.push(serializeNode(c));
  return `<${htmlTag}${attrStr}>${childParts.join('')}</${htmlTag}>`;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Read and write raw-text via the side table maintained by nodes.ts. We
 * forward through lazy hooks to avoid an ESLint import/no-cycle between
 * unsafe-write.ts and nodes.ts.
 */
let _getRecordedTextValue: (papi: ElementRef) => string = () => '';
let _recordTextValue: (papi: ElementRef, value: string) => void = () =>
  undefined;

export function _setTextValueReader(
  fn: (papi: ElementRef) => string,
): void {
  _getRecordedTextValue = fn;
}

export function _setTextValueWriter(
  fn: (papi: ElementRef, value: string) => void,
): void {
  _recordTextValue = fn;
}

function getRecordedTextValue(papi: ElementRef): string {
  return _getRecordedTextValue(papi);
}

function recordTextValueLocal(papi: ElementRef, value: string): void {
  _recordTextValue(papi, value);
}
