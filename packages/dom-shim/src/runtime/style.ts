// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getElementCache, invalidate } from './cache.ts';
import { invalidateGeometry } from './geometry.ts';
import type { ElementRef } from './papi-types.ts';
import { scheduleFlush } from './scheduler.ts';

/**
 * L2 inline-style declaration. See Shim_Design.md §5.2.5.
 *
 * **OQ-S.3 resolution (priority storage).** `!important` per-property
 * priority is recorded in `cache.stylePriorities` but NOT propagated to
 * PAPI — Lynx PAPI has no `!important` slot. Divergence
 * `shim:L2/no-important-propagation`.
 *
 * **Why the cache is authoritative.** Lynx PAPI's `__GetInlineStyle`
 * requires a numeric propertyId; the string→propertyId table is not
 * exposed to JS. So once the Shim writes via `__AddInlineStyle(name, v)`,
 * it CANNOT reliably read it back through engine alone. The Shim's
 * `cache.styles` map IS the source of truth for `getPropertyValue`.
 * Divergence `shim:L2/style-jsside-cache-authoritative`.
 */
export class L2CSSStyleDeclaration {
  protected readonly papi: ElementRef;

  constructor(papi: ElementRef) {
    this.papi = papi;
  }

  setProperty(name: string, value: string, priority?: string): void {
    const kebab = camelToKebab(name);
    __AddInlineStyle(this.papi, kebab, value);
    const cache = getElementCache(this.papi);
    cache.styles.set(kebab, value);
    if (priority) cache.stylePriorities.set(kebab, priority);
    else cache.stylePriorities.delete(kebab);
    invalidateGeometry(this.papi);
    scheduleFlush();
  }

  getPropertyValue(name: string): string {
    const kebab = camelToKebab(name);
    return getElementCache(this.papi).styles.get(kebab) ?? '';
  }

  getPropertyPriority(name: string): string {
    const kebab = camelToKebab(name);
    return getElementCache(this.papi).stylePriorities.get(kebab) ?? '';
  }

  removeProperty(name: string): string {
    const kebab = camelToKebab(name);
    const cache = getElementCache(this.papi);
    const prev = cache.styles.get(kebab) ?? '';
    __AddInlineStyle(this.papi, kebab, undefined);
    cache.styles.delete(kebab);
    cache.stylePriorities.delete(kebab);
    invalidateGeometry(this.papi);
    scheduleFlush();
    return prev;
  }

  get length(): number {
    return getElementCache(this.papi).styles.size;
  }

  item(index: number): string {
    if (index < 0) return '';
    const cache = getElementCache(this.papi);
    let i = 0;
    for (const k of cache.styles.keys()) {
      if (i === index) return k;
      i++;
    }
    return '';
  }

  /**
   * Joined cache as canonical `prop: value;` string. The setter parses
   * bulk declarations (US-447 — L3b path).
   */
  get cssText(): string {
    const entries: string[] = [];
    const cache = getElementCache(this.papi);
    for (const [k, v] of cache.styles.entries()) {
      entries.push(`${k}: ${v}`);
    }
    return entries.join('; ');
  }

  /**
   * Bulk replace via `'prop: value; prop2: value2;'` string. See
   * Shim_Design.md §7.3 `shim:L3b/cssText-reorder`: declarations are
   * parsed and re-applied; the order is the parser's, not the input's.
   */
  set cssText(value: string) {
    const cache = getElementCache(this.papi);
    cache.styles.clear();
    cache.stylePriorities.clear();
    const parsed: Record<string, string> = {};
    // Strip /* ... */ comments first.
    const stripped = value.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const decl of stripped.split(';')) {
      const colon = decl.indexOf(':');
      if (colon < 0) continue;
      const rawK = decl.slice(0, colon).trim();
      let v = decl.slice(colon + 1).trim();
      if (rawK === '' || v === '') continue;
      // Honor `!important` per OQ-S.3 cache-only.
      const importantMatch = /!\s*important\s*$/.exec(v);
      let priority: string | undefined;
      if (importantMatch) {
        priority = 'important';
        v = v.slice(0, importantMatch.index).trim();
      }
      const kebab = normalizeCSSKey(rawK);
      parsed[kebab] = v;
      cache.styles.set(kebab, v);
      if (priority) cache.stylePriorities.set(kebab, priority);
    }
    __SetInlineStyles(this.papi, parsed);
    invalidateGeometry(this.papi);
    scheduleFlush();
  }

  [Symbol.iterator](): IterableIterator<string> {
    return getElementCache(this.papi).styles.keys();
  }

  /** Shim-only: drop the style cache so the next read re-pulls from PAPI. */
  refresh(): void {
    invalidate(this.papi, 'styles');
  }
}

const camelRe = /([A-Z])/g;

/**
 * Convert camelCase CSS property name to kebab-case.
 * Custom properties (starting with `--`) and already-kebab strings pass
 * through unchanged.
 */
export function camelToKebab(name: string): string {
  if (name.startsWith('--')) return name;
  return name.replace(camelRe, (_, c: string) => `-${c.toLowerCase()}`);
}

/**
 * Normalize a CSS property name from either camelCase or
 * already-kebab/UPPER form into canonical lower-kebab.
 *
 * - `backgroundColor` → `background-color` (camelCase path).
 * - `BACKGROUND-COLOR` → `background-color` (uppercased kebab).
 * - `background-color` → `background-color` (already canonical).
 * - `--my-var` → `--my-var` (custom property preserved).
 */
export function normalizeCSSKey(name: string): string {
  if (name.startsWith('--')) return name;
  if (name.includes('-') || name === name.toLowerCase()) {
    return name.toLowerCase();
  }
  return camelToKebab(name);
}

/**
 * Style proxy that exposes camelCase property accessors. See Shim_Design.md
 * §5.2.5.
 *
 * `el.style.backgroundColor = 'red'` routes to `setProperty('backgroundColor',
 * 'red')` which kebab-normalizes. Reads symmetrically route to
 * `getPropertyValue`. Class methods (`setProperty`, `removeProperty`, ...)
 * are preserved by passing through to the underlying class instance.
 */
export type L2CSSStyleProxy = L2CSSStyleDeclaration & Record<string, string>;

const RESERVED_KEYS = new Set([
  'setProperty',
  'getPropertyValue',
  'getPropertyPriority',
  'removeProperty',
  'length',
  'item',
  'cssText',
  'refresh',
  'constructor',
  'papi',
]);

export function createWritableStyle(papi: ElementRef): L2CSSStyleProxy {
  const decl = new L2CSSStyleDeclaration(papi);
  return new Proxy(decl, {
    get(target, prop): unknown {
      if (
        typeof prop === 'symbol' || RESERVED_KEYS.has(prop) || prop in target
      ) {
        return Reflect.get(target, prop);
      }
      return target.getPropertyValue(prop);
    },
    set(target, prop, value): boolean {
      if (typeof prop === 'symbol' || RESERVED_KEYS.has(prop)) {
        return Reflect.set(target, prop, value);
      }
      target.setProperty(prop, String(value));
      return true;
    },
  }) as L2CSSStyleProxy;
}
