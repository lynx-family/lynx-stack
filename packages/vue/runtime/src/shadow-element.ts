// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * ShadowElement: a lightweight doubly-linked tree node that lives entirely in
 * the Background Thread.  It lets Vue's renderer call parentNode() / nextSibling()
 * synchronously, while the real Lynx elements exist only on the Main Thread.
 *
 * id=1 is reserved for the page root (created via __CreatePage on Main Thread).
 * Regular elements start from id=2.
 */
export class ShadowElement {
  static nextId = 2 // 1 is reserved for the page root

  id: number
  type: string
  parent: ShadowElement | null = null
  firstChild: ShadowElement | null = null
  lastChild: ShadowElement | null = null
  prev: ShadowElement | null = null
  next: ShadowElement | null = null

  constructor(type: string, forceId?: number) {
    if (forceId !== undefined) {
      this.id = forceId
    } else {
      this.id = ShadowElement.nextId++
    }
    this.type = type
  }

  insertBefore(child: ShadowElement, anchor: ShadowElement | null): void {
    // Detach from current parent first
    if (child.parent) {
      child.parent.removeChild(child)
    }
    child.parent = this

    if (!anchor) {
      // Append at end
      if (this.lastChild) {
        this.lastChild.next = child
        child.prev = this.lastChild
      } else {
        this.firstChild = child
        child.prev = null
      }
      this.lastChild = child
      child.next = null
    } else {
      // Insert before anchor
      const prev = anchor.prev
      child.next = anchor
      child.prev = prev
      anchor.prev = child
      if (prev) {
        prev.next = child
      } else {
        this.firstChild = child
      }
    }
  }

  removeChild(child: ShadowElement): void {
    const prev = child.prev
    const next = child.next
    if (prev) {
      prev.next = next
    } else {
      this.firstChild = next
    }
    if (next) {
      next.prev = prev
    } else {
      this.lastChild = prev
    }
    child.parent = null
    child.prev = null
    child.next = null
  }
}

export const PAGE_ROOT_ID = 1

/** Create the page root shadow element with the reserved id=1. */
export function createPageRoot(): ShadowElement {
  return new ShadowElement('page', PAGE_ROOT_ID)
}
