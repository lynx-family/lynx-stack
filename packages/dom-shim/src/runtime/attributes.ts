// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ElementRef } from './papi-types.ts';

/**
 * Minimal Attr-like node. See Shim_Design.md §4.2.3. Spec `Attr` carries
 * additional fields (specified, ownerElement); we ship the subset that
 * downstream stories actually consume.
 */
export interface ShimAttr {
  readonly name: string;
  readonly value: string;
  readonly localName: string;
  readonly namespaceURI: string | null;
  readonly prefix: string | null;
  readonly ownerElement: ElementRef | null;
}

/**
 * Coerce a PAPI attribute value to spec-shaped DOMString. PAPI's
 * `__SetAttribute` accepts `any` (boolean, number, object, ...); spec
 * `getAttribute` returns DOMString or null. We coerce primitives via
 * `String()` and JSON-serialize objects so the result is at least
 * round-trippable rather than the useless `[object Object]`.
 */
export function coerceAttributeValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
    case 'boolean':
    case 'bigint':
      return String(value);
    case 'symbol':
      return value.toString();
    default:
      // object | function — best-effort serialization.
      return JSON.stringify(value);
  }
}

function makeAttr(papi: ElementRef, name: string, value: unknown): ShimAttr {
  return Object.freeze({
    name,
    value: coerceAttributeValue(value),
    localName: name,
    namespaceURI: null,
    prefix: null,
    ownerElement: papi,
  });
}

/**
 * Snapshot NamedNodeMap. See Shim_Design.md §4.2.3.
 *
 * Read APIs (`length`, `item`, `getNamedItem`, iterator) reflect the PAPI's
 * current state on each call. Mutation APIs throw — the L2 writable surface
 * (`setAttribute` / `removeAttribute`) lives directly on the element, not on
 * NamedNodeMap.
 */
export class ReadOnlyNamedNodeMap implements Iterable<ShimAttr> {
  protected readonly papi: ElementRef;

  constructor(papi: ElementRef) {
    this.papi = papi;
  }

  protected snapshot(): ShimAttr[] {
    const obj = __GetAttributes(this.papi);
    return Object.entries(obj).map(([k, v]) => makeAttr(this.papi, k, v));
  }

  get length(): number {
    return __GetAttributeNames(this.papi).length;
  }

  item(index: number): ShimAttr | null {
    if (index < 0) return null;
    const snap = this.snapshot();
    return snap[index] ?? null;
  }

  getNamedItem(name: string): ShimAttr | null {
    const v = __GetAttributeByName(this.papi, name);
    if (v === undefined || v === null) return null;
    return makeAttr(this.papi, name, v);
  }

  [Symbol.iterator](): IterableIterator<ShimAttr> {
    return this.snapshot()[Symbol.iterator]();
  }

  // Mutation surface. US-413 wires the L2 setAttribute/removeAttribute path
  // on the Element. NamedNodeMap-level mutators stay as throws — US-474 will
  // refine these to structured DOMShimInvariantError.
  setNamedItem(_attr: ShimAttr): ShimAttr {
    throw new Error(
      'NamedNodeMap.setNamedItem is unsupported; mutate via Element.setAttribute (US-413). Future US-474 will refine to DOMShimInvariantError.',
    );
  }

  removeNamedItem(_name: string): ShimAttr {
    throw new Error(
      'NamedNodeMap.removeNamedItem is unsupported; mutate via Element.removeAttribute (US-413). Future US-474 will refine to DOMShimInvariantError.',
    );
  }
}
