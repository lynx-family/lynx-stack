// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ElementRef } from './papi-types.ts';

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
