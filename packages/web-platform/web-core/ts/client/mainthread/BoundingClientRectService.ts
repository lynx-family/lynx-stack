// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export class BoundingClientRectService {
  readonly #parentDom: HTMLElement;
  #cachedRect: DOMRect = new DOMRect(0, 0, 0, 0);
  #dirty = true;
  #invalidationScheduled = false;
  #disposed = false;

  constructor(parentDom: HTMLElement) {
    this.#parentDom = parentDom;
  }

  getLynxViewRect(): DOMRect {
    if (this.#dirty && !this.#disposed) {
      this.#cachedRect = this.#parentDom.getBoundingClientRect();
      this.#dirty = false;
    }
    this.#scheduleInvalidation();
    return this.#cachedRect;
  }

  dispose(): void {
    this.#disposed = true;
  }

  // One invalidation per rAF — caps re-measurement, catches CSS transform.
  #scheduleInvalidation(): void {
    if (this.#invalidationScheduled || this.#disposed) return;
    this.#invalidationScheduled = true;
    requestAnimationFrame(() => {
      this.#invalidationScheduled = false;
      this.#dirty = true;
    });
  }
}
