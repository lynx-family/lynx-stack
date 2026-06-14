// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { ensureClasses, invalidate } from './cache.ts';
import type { ElementRef } from './papi-types.ts';
import { scheduleFlush } from './scheduler.ts';

/**
 * Read-only subset of `DOMTokenList`. See Shim_Design.md §4.1 and §4.2.3.
 *
 * Per Shim_Design `shim:L2/classlist-jsside-cache` note, the live-ness
 * guarantees of spec `DOMTokenList` are NOT met here — every method call
 * re-reads `__GetClasses(papi)`, so external mutations between calls are
 * visible but in-iteration mutations are not.
 *
 * The L2 writable subclass (US-415) adds `add`, `remove`, `toggle`,
 * `replace`, and the cache layer that backs them.
 */
export class ReadOnlyDOMTokenList implements Iterable<string> {
  protected readonly papi: ElementRef;

  constructor(papi: ElementRef) {
    this.papi = papi;
  }

  protected snapshot(): string[] {
    return __GetClasses(this.papi);
  }

  get length(): number {
    return this.snapshot().length;
  }

  get value(): string {
    return this.snapshot().join(' ');
  }

  contains(token: string): boolean {
    return this.snapshot().includes(token);
  }

  item(index: number): string | null {
    const c = this.snapshot();
    if (index < 0 || index >= c.length) return null;
    return c[index] ?? null;
  }

  [Symbol.iterator](): IterableIterator<string> {
    return this.snapshot()[Symbol.iterator]();
  }

  toString(): string {
    return this.value;
  }
}

function validateToken(token: string): void {
  if (token === '') {
    throw new Error('SyntaxError: classList token cannot be empty');
  }
  if (/\s/.test(token)) {
    throw new Error(
      'InvalidCharacterError: classList token cannot contain whitespace',
    );
  }
}

/**
 * L2 writable DOMTokenList. See Shim_Design.md §5.2.2.
 *
 * Backed by the write-through `cache.classes` so adds and removes are
 * immediately observable. `add` uses `__AddClass` per class; `remove` and
 * `replace` rebuild via `__SetClasses(joined)` since Lynx PAPI has no
 * `__RemoveClass` primitive (`shim:L2/classlist-jsside-cache` divergence).
 *
 * `refresh()` is Shim-only — drops the cache so the next access re-reads
 * `__GetClasses`, useful when native code mutated the class attribute.
 */
export class L2DOMTokenList extends ReadOnlyDOMTokenList {
  protected override snapshot(): string[] {
    return ensureClasses(this.papi);
  }

  add(...tokens: string[]): void {
    const classes = ensureClasses(this.papi);
    for (const t of tokens) {
      validateToken(t);
      if (!classes.includes(t)) {
        classes.push(t);
        __AddClass(this.papi, t);
      }
    }
    scheduleFlush();
  }

  remove(...tokens: string[]): void {
    const classes = ensureClasses(this.papi);
    let mutated = false;
    for (const t of tokens) {
      validateToken(t);
      const i = classes.indexOf(t);
      if (i !== -1) {
        classes.splice(i, 1);
        mutated = true;
      }
    }
    if (mutated) {
      __SetClasses(this.papi, classes.join(' '));
      scheduleFlush();
    }
  }

  toggle(token: string, force?: boolean): boolean {
    validateToken(token);
    const has = this.contains(token);
    const shouldHave = force ?? !has;
    if (shouldHave && !has) this.add(token);
    else if (!shouldHave && has) this.remove(token);
    return shouldHave;
  }

  replace(oldToken: string, newToken: string): boolean {
    validateToken(oldToken);
    validateToken(newToken);
    const classes = ensureClasses(this.papi);
    const i = classes.indexOf(oldToken);
    if (i === -1) return false;
    classes[i] = newToken;
    __SetClasses(this.papi, classes.join(' '));
    scheduleFlush();
    return true;
  }

  /** Shim-only: drop the JS cache so the next read re-pulls from PAPI. */
  refresh(): void {
    invalidate(this.papi, 'classes');
  }
}
