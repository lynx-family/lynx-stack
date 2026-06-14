// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { ReadOnlyDOMTokenList } from './classlist.ts';
import type { ElementRef } from './papi-types.ts';

/** DOM `Node.ELEMENT_NODE`. */
export const NODE_TYPE_ELEMENT = 1;
/** DOM `Node.TEXT_NODE`. */
export const NODE_TYPE_TEXT = 3;

/** Spec bitmask for `compareDocumentPosition`. */
export const DOCUMENT_POSITION_DISCONNECTED = 0x01;
export const DOCUMENT_POSITION_PRECEDING = 0x02;
export const DOCUMENT_POSITION_FOLLOWING = 0x04;
export const DOCUMENT_POSITION_CONTAINS = 0x08;
export const DOCUMENT_POSITION_CONTAINED_BY = 0x10;

/**
 * Lynx tag produced by `__GetTag` for a raw text node. Used by `wrapPapi`
 * to dispatch into `L1ReadOnlyText` rather than `L1ReadOnlyElement`. See
 * Shim_Design.md §4.2.2.
 */
const RAW_TEXT_TAG = 'raw-text';

/**
 * Minimal Lynx → HTML reverse tag map. US-404 ships only the most common
 * tags so `tagName` returns spec-shaped strings ('DIV', 'SPAN', ...); the
 * full SPEC/TAG_MAP.json from US-473 (=US-441) will replace this constant.
 *
 * Unknown Lynx tags fall back to their own uppercase form so callers see a
 * stable, debuggable tagName instead of throwing.
 */
const LYNX_TO_HTML_MIN: Readonly<Record<string, string>> = Object.freeze({
  view: 'div',
  text: 'span',
  image: 'img',
  input: 'input',
  page: 'html',
  'scroll-view': 'div',
});

/**
 * Base node class. See Shim_Design.md §2 and §4.1.
 *
 * US-402: traversal + identity surface implemented here. US-403 adds the O(n)
 * `previousSibling`. Subclasses override `nodeType` / `nodeName` / `nodeValue`.
 *
 * Note: this file co-locates the three L1 classes and `wrapPapi` because
 * splitting them across modules creates an import cycle (`nodes.ts` ←→
 * `wrap.ts` ←→ `elements.ts`) that ESLint `import/no-cycle` rejects.
 * `elements.ts` / `wrap.ts` re-export from here to preserve the file
 * layout documented in Shim_Implementation_PRD.md §8.1.
 */
export abstract class L1ReadOnlyNode {
  protected readonly papi: ElementRef;

  constructor(papi: ElementRef) {
    this.papi = papi;
  }

  abstract readonly nodeType: number;
  abstract readonly nodeName: string;
  abstract readonly nodeValue: string | null;

  /**
   * Returns `null` if `this` is the page root (sentinel: PAPI ref equals
   * `__GetPageElement()`'s return) or if `__GetParent` returns falsy.
   * See Shim_Design.md §4.2.1.
   */
  get parentNode(): L1ReadOnlyElement | null {
    const page = __GetPageElement();
    if (__ElementIsEqual(this.papi, page)) return null;
    const parent = __GetParent(this.papi);
    if (!parent) return null;
    const wrapped = wrapPapi(parent);
    return wrapped instanceof L1ReadOnlyElement ? wrapped : null;
  }

  get parentElement(): L1ReadOnlyElement | null {
    // Lynx has no non-element parents, so `parentElement` aliases `parentNode`.
    return this.parentNode;
  }

  get firstChild(): L1ReadOnlyNode | null {
    const c = __FirstElement(this.papi);
    return c ? wrapPapi(c) : null;
  }

  get lastChild(): L1ReadOnlyNode | null {
    const c = __LastElement(this.papi);
    return c ? wrapPapi(c) : null;
  }

  get nextSibling(): L1ReadOnlyNode | null {
    const sib = __NextElement(this.papi);
    return sib ? wrapPapi(sib) : null;
  }

  /**
   * **O(n) in sibling count.** Lynx PAPI has no `__PrevElement`; the Shim
   * walks `__GetChildren(parent)` and finds self via `__ElementIsEqual`.
   * See Shim_Design.md §3.2 + §4.2.1.
   *
   * Returns `null` when this node is the first child, when it has no
   * parent, or when self cannot be located in the parent's child list.
   */
  get previousSibling(): L1ReadOnlyNode | null {
    const parent = __GetParent(this.papi);
    if (!parent) return null;
    const siblings = __GetChildren(parent);
    for (let i = 0; i < siblings.length; i++) {
      const sib = siblings[i];
      if (sib !== undefined && __ElementIsEqual(sib, this.papi)) {
        const prev = i > 0 ? siblings[i - 1] : undefined;
        return prev === undefined ? null : wrapPapi(prev);
      }
    }
    return null;
  }

  /**
   * Snapshot. Spec says `NodeList` is live, but PAPI gives us a one-shot
   * array via `__GetChildren`. The returned array is frozen so callers can
   * neither mutate it nor mistake it for live. See Shim_Design.md §4.2.1.
   */
  get childNodes(): readonly L1ReadOnlyNode[] {
    return Object.freeze(__GetChildren(this.papi).map((r) => wrapPapi(r)));
  }

  hasChildNodes(): boolean {
    return __GetChildren(this.papi).length > 0;
  }

  /**
   * Walks ancestors to the page root using `__GetParent`. Spec defines
   * `isConnected` as "is in the document tree." Since Lynx's "document"
   * is the page element, we anchor on `__GetPageElement`.
   */
  get isConnected(): boolean {
    const page = __GetPageElement();
    let cur: ElementRef | undefined = this.papi;
    while (cur !== undefined) {
      if (__ElementIsEqual(cur, page)) return true;
      cur = __GetParent(cur);
      if (!cur) break;
    }
    return false;
  }

  getRootNode(): L1ReadOnlyNode {
    let cur: L1ReadOnlyNode = this;
    while (true) {
      const p: L1ReadOnlyElement | null = cur.parentNode;
      if (p === null) return cur;
      cur = p;
    }
  }

  contains(other: L1ReadOnlyNode | null): boolean {
    if (other === null) return false;
    let cur: L1ReadOnlyNode | null = other;
    while (cur !== null) {
      if (cur.isSameNode(this)) return true;
      cur = cur.parentNode;
    }
    return false;
  }

  /**
   * Returns the standard `compareDocumentPosition` bitmask. When neither
   * node contains the other, we fall back to `__GetElementUniqueID`
   * ordering — this approximates document order assuming IDs are issued
   * monotonically by the engine. Documented divergence if not.
   */
  compareDocumentPosition(other: L1ReadOnlyNode): number {
    if (this.isSameNode(other)) return 0;
    if (this.contains(other)) {
      return DOCUMENT_POSITION_CONTAINED_BY | DOCUMENT_POSITION_FOLLOWING;
    }
    if (other.contains(this)) {
      return DOCUMENT_POSITION_CONTAINS | DOCUMENT_POSITION_PRECEDING;
    }
    const a = __GetElementUniqueID(this.papi);
    const b = __GetElementUniqueID(other.papi);
    return a < b ? DOCUMENT_POSITION_FOLLOWING : DOCUMENT_POSITION_PRECEDING;
  }

  isEqualNode(other: L1ReadOnlyNode | null): boolean {
    if (other === null) return false;
    return __ElementIsEqual(this.papi, other.papi);
  }

  isSameNode(other: L1ReadOnlyNode | null): boolean {
    if (other === null) return false;
    return __ElementIsEqual(this.papi, other.papi);
  }
}

/**
 * Raw-text node emulation. See Shim_Design.md §4.2.2 and §4.1.
 *
 * Distinct from `L1ReadOnlyElement` — text nodes have no element surface and
 * appear only as children of Lynx `<text>` elements.
 *
 * US-402 ships `nodeType` / `nodeName`. `nodeValue` lands in US-410 (depends
 * on the write-through cache from US-412).
 */
export class L1ReadOnlyText extends L1ReadOnlyNode {
  readonly nodeType: number = NODE_TYPE_TEXT;
  readonly nodeName: string = '#text';
  // TODO US-410: cache-aware read of the raw text payload. Placeholder for
  // US-402 so the getter signature is stable.
  readonly nodeValue: string | null = '';
}

/**
 * Element-tier readonly surface. See Shim_Design.md §4.1.
 *
 * US-402 ships `nodeType` / `nodeName` / `nodeValue`. Full element surface
 * (id, classList, attributes, dataset, selectors, geometry) lands in
 * US-404..US-409.
 */
export class L1ReadOnlyElement extends L1ReadOnlyNode {
  readonly nodeType: number = NODE_TYPE_ELEMENT;
  readonly nodeValue: string | null = null;

  get nodeName(): string {
    return this.tagName;
  }

  /**
   * Spec: uppercase tag name. We map Lynx tags through the minimal table
   * above and fall back to the Lynx tag's own uppercase. US-473 swaps in
   * the full SPEC/TAG_MAP.json.
   */
  get tagName(): string {
    const lynxTag = __GetTag(this.papi);
    return (LYNX_TO_HTML_MIN[lynxTag] ?? lynxTag).toUpperCase();
  }

  get localName(): string {
    return this.tagName.toLowerCase();
  }

  get id(): string {
    // Spec: returns empty string when no id is set. PAPI also returns ''
    // in that case based on the .d.ts; cope with undefined defensively.
    return __GetID(this.papi) ?? '';
  }

  get className(): string {
    return __GetClasses(this.papi).join(' ');
  }

  get classList(): ReadOnlyDOMTokenList {
    return new ReadOnlyDOMTokenList(this.papi);
  }

  /**
   * **O(n) in sibling count** — walks parent's children to find self and
   * the preceding element, skipping non-element siblings (raw text nodes).
   * See Shim_Design.md §4.2.2 + §4.2.1.
   */
  get previousElementSibling(): L1ReadOnlyElement | null {
    const parent = __GetParent(this.papi);
    if (!parent) return null;
    const siblings = __GetChildren(parent);
    let selfIdx = -1;
    for (let i = 0; i < siblings.length; i++) {
      const sib = siblings[i];
      if (sib !== undefined && __ElementIsEqual(sib, this.papi)) {
        selfIdx = i;
        break;
      }
    }
    if (selfIdx <= 0) return null;
    for (let j = selfIdx - 1; j >= 0; j--) {
      const candidate = siblings[j];
      if (candidate === undefined) continue;
      const wrapped = wrapPapi(candidate);
      if (wrapped instanceof L1ReadOnlyElement) return wrapped;
    }
    return null;
  }

  // TODO US-404..US-409: id, classList, attributes, dataset, selectors,
  // getBoundingClientRect.
}

/**
 * Wrap an existing PAPI ref into the highest-tier Shim instance currently
 * shipped. See Shim_Design.md §2 "Tier selection at construction".
 *
 * US-401 ships dispatch over `raw-text` only. As higher tiers ship, this
 * factory will return the highest available tier per element (default = L3b
 * once that class lands; see US-475 for opt-in narrowing).
 */
export function wrapPapi(ref: ElementRef): L1ReadOnlyNode {
  if (__GetTag(ref) === RAW_TEXT_TAG) return new L1ReadOnlyText(ref);
  return new L1ReadOnlyElement(ref);
}
