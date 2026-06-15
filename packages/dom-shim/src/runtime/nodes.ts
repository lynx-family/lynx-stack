// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { ReadOnlyNamedNodeMap, coerceAttributeValue } from './attributes.ts';
import { getElementCache } from './cache.ts';
import { L2DOMTokenList, ReadOnlyDOMTokenList } from './classlist.ts';
import { makeReadOnlyDataset, makeWritableDataset } from './dataset.ts';
import { addListener, removeListener } from './events.ts';
import type {
  ShimAddEventListenerOptions,
  ShimEventListener,
  ShimEventListenerOptions,
} from './events.ts';
import { getBoundingClientRect, invalidateGeometry } from './geometry.ts';
import type { DOMRectReadOnly } from './geometry.ts';
import type { ElementRef } from './papi-types.ts';
import { scheduleFlush } from './scheduler.ts';
import { createWritableStyle } from './style.ts';
import type { L2CSSStyleProxy } from './style.ts';
import { lynxToHtml } from './tag-map.ts';
import {
  _setTextValueReader,
  _setTextValueWriter,
  buildL3bInnerHTML,
  serializeL3bInnerHTML,
} from './unsafe-write.ts';

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

// Lynx → HTML reverse tag map lives in `tag-map.ts` (US-441) as the
// definitive source. `tagName` uses `lynxToHtml(__GetTag(papi))`.

/**
 * Raw text content side table. See Shim_Design.md §4.2.2 + §3.2 (PAPI gap:
 * no `__GetRawText`).
 *
 * Lynx's `__CreateRawText(text, info?)` takes text but exposes no read-back
 * primitive. We register the text in this side table at element-creation
 * time so `nodeValue` can return it later. US-425 wires
 * `document.createTextNode` to call `recordTextValue`. Until then, refs
 * coming in via `__FirstElement` traversal that were created outside the
 * Shim have an empty `nodeValue`.
 *
 * US-412's write-through cache may absorb this map.
 */
const textValues = new WeakMap<ElementRef, string>();

/**
 * Record the value of a raw-text node. Called by `document.createTextNode`
 * (US-425) and `Element.textContent = ...` (US-446).
 */
export function recordTextValue(papi: ElementRef, value: string): void {
  textValues.set(papi, value);
}

/** Read the recorded raw-text value, or empty string when unknown. */
export function getTextValue(papi: ElementRef): string {
  return textValues.get(papi) ?? '';
}

// Wire the text-value reader/writer so the L3b serializer + innerHTML
// pipeline can use the side table without an ESLint import/no-cycle
// violation.
_setTextValueReader(getTextValue);
_setTextValueWriter(recordTextValue);

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
  /**
   * Underlying PAPI ref. Public so Shim-internal helpers
   * (`detachFromParent`, `invalidateGeometrySubtree`, etc.) can reach it.
   * Callers outside the Shim should not depend on this — use the spec
   * surface (`appendChild`, `removeChild`, etc.) instead.
   */
  readonly papi: ElementRef;

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

  /**
   * Reads from the raw-text side table. Returns empty string when the ref
   * came from a context that did not register the value (e.g. traversal
   * lands on an engine-created text node). See Shim_Design.md §4.2.2.
   */
  get nodeValue(): string | null {
    return getTextValue(this.papi);
  }
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
   * Spec: uppercase tag name. Lynx tag → HTML tag via `lynxToHtml`
   * (US-441 / SPEC/TAG_MAP.json), then uppercased.
   */
  get tagName(): string {
    return lynxToHtml(__GetTag(this.papi)).toUpperCase();
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
    // Cache-aware so L2 className setter (US-414) and classList mutators
    // (US-415) are immediately observable here.
    const cache = getElementCache(this.papi);
    if (cache.classes !== null) return cache.classes.join(' ');
    return __GetClasses(this.papi).join(' ');
  }

  get classList(): ReadOnlyDOMTokenList {
    return new ReadOnlyDOMTokenList(this.papi);
  }

  /**
   * Spec: returns string or null. PAPI returns `unknown` (any) per the
   * Lynx type-element-api d.ts; coerce undefined/null to null and any
   * other value to its string form. See Shim_Design.md §4.2.3.
   */
  getAttribute(name: string): string | null {
    // Cache-aware: L2 setAttribute / removeAttribute are write-through, so
    // their state is authoritative over PAPI read-back. See Shim_Design.md
    // §5.2.3 and `shim:L2/attribute-removal-jsside-only`.
    const cache = getElementCache(this.papi);
    if (cache.removedAttrs.has(name)) return null;
    const cached = cache.attrs.get(name);
    if (cached !== undefined) return cached;
    const v = __GetAttributeByName(this.papi, name);
    return v === undefined || v === null ? null : coerceAttributeValue(v);
  }

  getAttributeNames(): string[] {
    return __GetAttributeNames(this.papi);
  }

  hasAttribute(name: string): boolean {
    return this.getAttribute(name) !== null;
  }

  hasAttributes(): boolean {
    return __GetAttributeNames(this.papi).length > 0;
  }

  get attributes(): ReadOnlyNamedNodeMap {
    return new ReadOnlyNamedNodeMap(this.papi);
  }

  /**
   * Spec DOMStringMap exposed as a Proxy that reads via `__GetDataByKey` on
   * each access. Writes throw. See Shim_Design.md §4.2.3. The L2 writable
   * variant lands in US-416.
   */
  get dataset(): Readonly<Record<string, string>> {
    return makeReadOnlyDataset(this.papi);
  }

  /**
   * Selector engine bridges. See Shim_Design.md §4.2.4. Delegates to PAPI's
   * `__QuerySelector` / `__QuerySelectorAll`. Default `onlyCurrentComponent`
   * is false so the engine searches the whole subtree.
   */
  querySelector(selector: string): L1ReadOnlyElement | null {
    const r = __QuerySelector(this.papi, selector, {
      onlyCurrentComponent: false,
    });
    if (r === undefined || r === null) return null;
    const w = wrapPapi(r);
    return w instanceof L1ReadOnlyElement ? w : null;
  }

  querySelectorAll(selector: string): readonly L1ReadOnlyElement[] {
    const refs = __QuerySelectorAll(this.papi, selector, {
      onlyCurrentComponent: false,
    });
    const out: L1ReadOnlyElement[] = [];
    for (const r of refs) {
      const w = wrapPapi(r);
      if (w instanceof L1ReadOnlyElement) out.push(w);
    }
    return Object.freeze(out);
  }

  /**
   * **O(n) in tree size** — Lynx PAPI has no native `matches` primitive, so
   * we query the parent's subtree for the selector and check whether `this`
   * is in the result set. See Shim_Design.md §4.2.4.
   *
   * Divergence: for fully detached elements (no parent, not the page root)
   * the result is engine-dependent — most selector engines do not include
   * the root they're queried from. Caller should treat detached `matches`
   * as best-effort.
   */
  matches(selector: string): boolean {
    const parent = __GetParent(this.papi);
    const root = parent ?? this.papi;
    const all = __QuerySelectorAll(root, selector, {
      onlyCurrentComponent: false,
    });
    return all.some((r) => __ElementIsEqual(r, this.papi));
  }

  /**
   * **O(depth × subtree)** — walks parents calling `matches`. Spec returns
   * `this` if `this` itself matches, then walks up.
   */
  closest(selector: string): L1ReadOnlyElement | null {
    let cur: L1ReadOnlyElement | null = this;
    while (cur !== null) {
      if (cur.matches(selector)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  /**
   * Geometry. See Shim_Design.md §4.2.5 + geometry.ts header for the OQ-S.4
   * resolution (async-cached, zero-rect on first miss, console.warn once).
   */
  getBoundingClientRect(): DOMRectReadOnly {
    return getBoundingClientRect(this.papi);
  }

  /**
   * Element children only — filters out raw-text siblings. Returns a frozen
   * snapshot. See Shim_Design.md §4.2.2.
   */
  get children(): readonly L1ReadOnlyElement[] {
    const out: L1ReadOnlyElement[] = [];
    for (const ref of __GetChildren(this.papi)) {
      const w = wrapPapi(ref);
      if (w instanceof L1ReadOnlyElement) out.push(w);
    }
    return Object.freeze(out);
  }

  get firstElementChild(): L1ReadOnlyElement | null {
    for (const ref of __GetChildren(this.papi)) {
      const w = wrapPapi(ref);
      if (w instanceof L1ReadOnlyElement) return w;
    }
    return null;
  }

  get lastElementChild(): L1ReadOnlyElement | null {
    const c = __GetChildren(this.papi);
    for (let i = c.length - 1; i >= 0; i--) {
      const ref = c[i];
      if (ref === undefined) continue;
      const w = wrapPapi(ref);
      if (w instanceof L1ReadOnlyElement) return w;
    }
    return null;
  }

  /**
   * Walk forward via `__NextElement`, skipping raw-text siblings until an
   * element is found. See Shim_Design.md §4.2.2.
   */
  get nextElementSibling(): L1ReadOnlyElement | null {
    let cur: ElementRef | undefined = __NextElement(this.papi);
    while (cur !== undefined) {
      const w = wrapPapi(cur);
      if (w instanceof L1ReadOnlyElement) return w;
      cur = __NextElement(cur);
    }
    return null;
  }

  get childElementCount(): number {
    let count = 0;
    for (const ref of __GetChildren(this.papi)) {
      if (wrapPapi(ref) instanceof L1ReadOnlyElement) count++;
    }
    return count;
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
/**
 * L2 writable element. See Shim_Design.md §5.1.
 *
 * Inherits L1's read surface. Adds atomic mutations whose immediate
 * read-back via inherited L1 getters is consistent within the same JS
 * frame. Every mutation calls `scheduleFlush()`.
 *
 * US-413 ships attribute mutation. US-414..US-426 fill the rest.
 *
 * Located here (rather than in safe-write.ts) so `wrapPapi` can dispatch
 * to it without an ESLint-rejected import cycle.
 */
export class L2SafeWritableElement extends L1ReadOnlyElement {
  /**
   * Spec id setter. See Shim_Design.md §5.2.1. PAPI exposes __SetID with a
   * direct read-back via __GetID; no JS-side cache needed here.
   */
  override set id(value: string) {
    __SetID(this.papi, value);
    scheduleFlush();
  }

  override get id(): string {
    // Re-state the L1 getter so TypeScript accepts the setter pair on the
    // subclass without ambiguity.
    return __GetID(this.papi) ?? '';
  }

  /**
   * Spec className setter. Splits on whitespace, stores in cache so the
   * L1 className/classList getters observe the just-written value within
   * the same JS frame. See Shim_Design.md §5.2.1.
   */
  override set className(value: string) {
    const tokens = value.split(/\s+/).filter(Boolean);
    __SetClasses(this.papi, value);
    const cache = getElementCache(this.papi);
    cache.classes = tokens;
    scheduleFlush();
  }

  override get className(): string {
    const cache = getElementCache(this.papi);
    if (cache.classes !== null) return cache.classes.join(' ');
    return __GetClasses(this.papi).join(' ');
  }

  /** Spec classList with add/remove/toggle/replace. See Shim_Design.md §5.2.2. */
  override get classList(): L2DOMTokenList {
    return new L2DOMTokenList(this.papi);
  }

  /** Spec DOMStringMap with writable assignment + delete. See Shim_Design.md §5.2.4. */
  override get dataset(): Record<string, string> {
    return makeWritableDataset(this.papi);
  }

  /**
   * Spec CSSStyleDeclaration — setProperty/getPropertyValue/removeProperty,
   * cssText getter, AND camelCase property accessors (`el.style.color =
   * 'red'`). cssText setter is L3b in US-447. See Shim_Design.md §5.2.5.
   */
  get style(): L2CSSStyleProxy {
    return createWritableStyle(this.papi);
  }

  /** Spec coercion + write-through cache. See Shim_Design.md §5.2.3. */
  setAttribute(name: string, value: string): void {
    const coerced = coerceAttributeValue(value);
    __SetAttribute(this.papi, name, coerced);
    const cache = getElementCache(this.papi);
    cache.attrs.set(name, coerced);
    cache.removedAttrs.delete(name);
    invalidateGeometry(this.papi);
    scheduleFlush();
  }

  /**
   * Spec: attribute appears absent. Lynx PAPI has no __RemoveAttribute; we
   * sentinel via `__SetAttribute(name, undefined)` + cache `removedAttrs`.
   * See `shim:L2/attribute-removal-jsside-only`.
   */
  removeAttribute(name: string): void {
    __SetAttribute(this.papi, name, undefined);
    const cache = getElementCache(this.papi);
    cache.attrs.delete(name);
    cache.removedAttrs.add(name);
    invalidateGeometry(this.papi);
    scheduleFlush();
  }

  /**
   * Spec appendChild — removes the child from its current parent first.
   * Returns the appended child. See Shim_Design.md §5.2.6.
   *
   * When `child` is a `ShimDocumentFragment` (US-424 / OQ-S.5), the
   * fragment is flattened: all its children move to `this` and the
   * fragment becomes empty, matching DOM spec semantics. JS-side flatten
   * runs unconditionally regardless of whether Lynx's wrapper element
   * auto-flattens, so the contract is portable.
   */
  appendChild<T extends L1ReadOnlyNode>(child: T): T {
    if (child instanceof ShimDocumentFragment) {
      const fragChildren = [...__GetChildren(child.papi)];
      for (const c of fragChildren) {
        __RemoveElement(child.papi, c);
        __AppendElement(this.papi, c);
      }
      invalidateGeometrySubtree(this.papi);
      scheduleFlush();
      return child;
    }
    detachFromParent(child);
    __AppendElement(this.papi, child.papi);
    invalidateGeometrySubtree(this.papi);
    invalidateGeometrySubtree(child.papi);
    scheduleFlush();
    return child;
  }

  /** Spec insertBefore — refNode === null behaves as appendChild. */
  insertBefore<T extends L1ReadOnlyNode>(
    newNode: T,
    refNode: L1ReadOnlyNode | null,
  ): T {
    if (refNode === null) return this.appendChild(newNode);
    detachFromParent(newNode);
    __InsertElementBefore(this.papi, newNode.papi, refNode.papi);
    invalidateGeometrySubtree(this.papi);
    invalidateGeometrySubtree(newNode.papi);
    scheduleFlush();
    return newNode;
  }

  /**
   * Spec removeChild — throws NotFoundError when child.parentNode !== this.
   * US-474 will refine the error to DOMShimInvariantError.
   */
  removeChild<T extends L1ReadOnlyNode>(child: T): T {
    const parent = child.parentNode;
    if (parent === null || !__ElementIsEqual(parent.papi, this.papi)) {
      throw new Error(
        'NotFoundError: removeChild target is not a child of this node.',
      );
    }
    __RemoveElement(this.papi, child.papi);
    invalidateGeometrySubtree(this.papi);
    invalidateGeometrySubtree(child.papi);
    scheduleFlush();
    return child;
  }

  /**
   * Spec ParentNode.append — accepts string OR node; strings become raw-text
   * nodes via `__CreateRawText`. See Shim_Design.md §5.1.
   */
  append(...nodes: (L1ReadOnlyNode | string)[]): void {
    for (const n of nodes) {
      const ref = nodeOrStringToRef(n);
      __AppendElement(this.papi, ref);
    }
    invalidateGeometrySubtree(this.papi);
    scheduleFlush();
  }

  /** Spec ParentNode.prepend — inserts before existing children, in order. */
  prepend(...nodes: (L1ReadOnlyNode | string)[]): void {
    const first = __FirstElement(this.papi);
    for (const n of nodes) {
      const ref = nodeOrStringToRef(n);
      if (first) {
        __InsertElementBefore(this.papi, ref, first);
      } else {
        __AppendElement(this.papi, ref);
      }
    }
    invalidateGeometrySubtree(this.papi);
    scheduleFlush();
  }

  /** Spec ChildNode.before — inserts in parent before `this`. */
  before(...nodes: (L1ReadOnlyNode | string)[]): void {
    const parent = this.parentNode;
    if (parent === null) return;
    for (const n of nodes) {
      const ref = nodeOrStringToRef(n);
      __InsertElementBefore(parent.papi, ref, this.papi);
    }
    invalidateGeometrySubtree(parent.papi);
    scheduleFlush();
  }

  /** Spec ChildNode.after — inserts in parent after `this`. */
  after(...nodes: (L1ReadOnlyNode | string)[]): void {
    const parent = this.parentNode;
    if (parent === null) return;
    const next = __NextElement(this.papi);
    for (const n of nodes) {
      const ref = nodeOrStringToRef(n);
      if (next) {
        __InsertElementBefore(parent.papi, ref, next);
      } else {
        __AppendElement(parent.papi, ref);
      }
    }
    invalidateGeometrySubtree(parent.papi);
    scheduleFlush();
  }

  /** Spec ChildNode.replaceWith — inserts replacements before self then removes self. */
  replaceWith(...nodes: (L1ReadOnlyNode | string)[]): void {
    const parent = this.parentNode;
    if (parent === null) return;
    for (const n of nodes) {
      const ref = nodeOrStringToRef(n);
      __InsertElementBefore(parent.papi, ref, this.papi);
    }
    __RemoveElement(parent.papi, this.papi);
    invalidateGeometrySubtree(parent.papi);
    invalidateGeometrySubtree(this.papi);
    scheduleFlush();
  }

  /**
   * Spec cloneNode — `deep=true` clones descendants. PAPI exposes
   * `__CloneElement(papi, { deep })`. The returned ref is fresh, so its
   * write-through cache (per US-412) starts empty. See Shim_Design.md
   * §5.2.7.
   */
  cloneNode(deep?: boolean): L1ReadOnlyNode {
    const cloned = __CloneElement(this.papi, { deep: deep ?? false });
    return wrapPapi(cloned);
  }

  /** Spec ChildNode.remove — no-op if detached. */
  remove(): void {
    const parent = this.parentNode;
    if (parent === null) return;
    __RemoveElement(parent.papi, this.papi);
    invalidateGeometrySubtree(parent.papi);
    invalidateGeometrySubtree(this.papi);
    scheduleFlush();
  }

  /** Spec replaceChild — throws NotFoundError when oldChild.parentNode !== this. */
  replaceChild<O extends L1ReadOnlyNode, N extends L1ReadOnlyNode>(
    newChild: N,
    oldChild: O,
  ): O {
    const parent = oldChild.parentNode;
    if (parent === null || !__ElementIsEqual(parent.papi, this.papi)) {
      throw new Error(
        'NotFoundError: replaceChild target is not a child of this node.',
      );
    }
    detachFromParent(newChild);
    __ReplaceElement(newChild.papi, oldChild.papi);
    invalidateGeometrySubtree(this.papi);
    invalidateGeometrySubtree(newChild.papi);
    invalidateGeometrySubtree(oldChild.papi);
    scheduleFlush();
    return oldChild;
  }

  /** Spec toggleAttribute with optional force. Returns post-state. */
  toggleAttribute(name: string, force?: boolean): boolean {
    const present = this.getAttribute(name) !== null;
    const shouldHave = force ?? !present;
    if (shouldHave && !present) {
      this.setAttribute(name, '');
      return true;
    }
    if (!shouldHave && present) {
      this.removeAttribute(name);
      return false;
    }
    return shouldHave;
  }
}

/**
 * If `node` has a current parent, detach it via `__RemoveElement` so a
 * subsequent append/insert moves rather than aliases the child. Implements
 * the spec rule that any tree-mutation method first removes the node from
 * its current location.
 */
function detachFromParent(node: L1ReadOnlyNode): void {
  const parent = node.parentNode;
  if (parent === null) return;
  __RemoveElement(parent.papi, node.papi);
}

/**
 * Resolve an `(L1ReadOnlyNode | string)` argument to a PAPI ElementRef.
 * Strings become fresh raw-text nodes via `__CreateRawText`; the text value
 * is registered with the side table so `L1ReadOnlyText.nodeValue` reads it.
 */
function nodeOrStringToRef(arg: L1ReadOnlyNode | string): ElementRef {
  if (typeof arg === 'string') {
    const ref = __CreateRawText(arg);
    recordTextValue(ref, arg);
    return ref;
  }
  detachFromParent(arg);
  return arg.papi;
}

/**
 * Recursively drop the cached `getBoundingClientRect` rect for `papi` and
 * all its descendants. Called by tree-mutation methods so a moved subtree
 * re-measures on next access.
 */
function invalidateGeometrySubtree(papi: ElementRef): void {
  invalidateGeometry(papi);
  try {
    for (const c of __GetChildren(papi)) {
      invalidateGeometrySubtree(c);
    }
  } catch {
    // PAPI may not expose __GetChildren in some contexts; ignore.
  }
}

/**
 * L3a EventfulElement. See Shim_Design.md §6.
 *
 * Inherits all L2 surface and adds `addEventListener` /
 * `removeEventListener` via the multiplex trampoline in events.ts.
 * `dispatchEvent` throws L4 (US-435).
 *
 * Lives in nodes.ts (rather than a dedicated module) because wrapPapi
 * dispatches to it and the import cycle that would arise from
 * splitting the file is rejected by ESLint import/no-cycle.
 */
export class L3aEventfulElement extends L2SafeWritableElement {
  addEventListener(
    type: string,
    listener: ShimEventListener,
    options: ShimAddEventListenerOptions | boolean = {},
  ): void {
    addListener(this.papi, type, listener, options);
  }

  removeEventListener(
    type: string,
    listener: ShimEventListener,
    options: ShimEventListenerOptions | boolean = {},
  ): void {
    removeListener(this.papi, type, listener, options);
  }

  /** US-435 L4 throw. Spec dispatchEvent on synthetic events. */
  dispatchEvent(_event: unknown): boolean {
    throw new Error(
      'L4/synthetic-dispatch: dispatchEvent on synthetic events is unsupported. Trigger the event via the engine or use the Shim trampoline directly.',
    );
  }
}

/**
 * L3b UnsafeWritableElement. See Shim_Design.md §7.
 *
 * Inherits L3a's event surface and adds the lossy bulk-write APIs:
 * innerHTML setter / getter, etc. Each carries documented divergences
 * (shim:L3b/*); see SPEC/DIAGNOSTICS.md (US-449) for the catalog.
 */
export class L3bUnsafeWritableElement extends L3aEventfulElement {
  /**
   * Parse `html` via htmlparser2, walk the AST, build a Shim-mediated
   * PAPI subtree under `this`. Existing children are cleared first.
   * See Shim_Design.md §7.2.
   *
   * Divergences:
   * - shim:L3b/script-skipped — <script> tags are not executed.
   * - shim:L3b/css-style-tag-dropped — <style> tag content discarded.
   * - shim:L3b/inline-event-attrs-ignored — on* attrs are silently dropped.
   */
  set innerHTML(html: string) {
    buildL3bInnerHTML(this.papi, html);
    invalidateGeometrySubtree(this.papi);
    scheduleFlush();
  }

  /** Canonical serialization. See Shim_Design.md §7.3. */
  get innerHTML(): string {
    return serializeL3bInnerHTML(this.papi);
  }
}

/**
 * Spec DocumentFragment. See Shim_Design.md §9.1 + OQ-S.5.
 *
 * Maps to `__CreateWrapperElement(parentComponentUniId)`. Treated as a
 * regular L2 container for child-management methods; the spec "flatten
 * on append" semantic is enforced by the receiving parent's appendChild
 * (above), which detects ShimDocumentFragment and moves its children
 * one-by-one.
 */
export class ShimDocumentFragment extends L2SafeWritableElement {
  // The class body is intentionally empty — all behavior is inherited.
  // The instanceof brand alone differentiates fragments from regular
  // elements at the appendChild dispatch site.
}

/**
 * Build a fresh DocumentFragment. `parentComponentUniId` defaults to 0
 * because most usages don't carry component context (e.g. tests, ad-hoc
 * builders). Real callers from `document.createDocumentFragment` (US-425)
 * will pass the page's component id.
 */
export function createDocumentFragment(
  parentComponentUniId = 0,
): ShimDocumentFragment {
  const ref = __CreateWrapperElement(parentComponentUniId);
  return new ShimDocumentFragment(ref);
}

export function wrapPapi(ref: ElementRef): L1ReadOnlyNode {
  if (__GetTag(ref) === RAW_TEXT_TAG) return new L1ReadOnlyText(ref);
  // L3b is the highest tier. See Shim_Design.md §2.
  return new L3bUnsafeWritableElement(ref);
}
