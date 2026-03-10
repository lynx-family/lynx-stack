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
import type {
  AnimationV2,
  NodesRef,
  SelectorQuery,
  uiMethodOptions,
} from '@lynx-js/types';

export class ShadowElement {
  static nextId = 2; // 1 is reserved for the page root

  id: number;
  type: string;
  parent: ShadowElement | null = null;
  firstChild: ShadowElement | null = null;
  lastChild: ShadowElement | null = null;
  prev: ShadowElement | null = null;
  next: ShadowElement | null = null;

  // Cached style object (last value passed to patchProp 'style').
  // Used by vShow to merge display:none without losing the original styles.
  _style: Record<string, unknown> = {};
  // Set to true by vShow when the element should be hidden.
  _vShowHidden = false;

  constructor(type: string, forceId?: number) {
    if (forceId === undefined) {
      this.id = ShadowElement.nextId++;
    } else {
      this.id = forceId;
    }
    this.type = type;
  }

  // ---------------------------------------------------------------------------
  // NodesRef — delegates to the real NodesRef returned by
  // lynx.createSelectorQuery().select(), using types from @lynx-js/types.
  // Each method targets this element via its unique `vue-ref-{id}` attribute
  // (set on the MT side during element creation).
  // ---------------------------------------------------------------------------

  /** CSS attribute selector that uniquely identifies this element on MT. */
  get _selector(): string {
    return `[vue-ref-${this.id}]`;
  }

  private _select(): NodesRef {
    return lynx.createSelectorQuery().select(this._selector);
  }

  invoke(options: uiMethodOptions): SelectorQuery {
    return this._select().invoke(options);
  }

  setNativeProps(
    nativeProps: Record<string, unknown>,
  ): SelectorQuery {
    return this._select().setNativeProps(nativeProps);
  }

  fields(
    fieldsParam: Record<string, boolean>,
    callback: (
      data: Record<string, unknown> | null,
      status: { data: string; code: number },
    ) => void,
  ): SelectorQuery {
    return this._select().fields(fieldsParam, callback);
  }

  path(
    callback: (
      data: unknown,
      status: { data: string; code: number },
    ) => void,
  ): SelectorQuery {
    return this._select().path(callback);
  }

  animate(animations: AnimationV2[] | AnimationV2): SelectorQuery {
    return this._select().animate(animations);
  }

  playAnimation(ids: string[] | string): SelectorQuery {
    return this._select().playAnimation(ids);
  }

  pauseAnimation(ids: string[] | string): SelectorQuery {
    return this._select().pauseAnimation(ids);
  }

  cancelAnimation(ids: string[] | string): SelectorQuery {
    return this._select().cancelAnimation(ids);
  }

  insertBefore(child: ShadowElement, anchor: ShadowElement | null): void {
    // Detach from current parent first
    if (child.parent) {
      child.parent.removeChild(child);
    }
    child.parent = this;

    if (anchor) {
      // Insert before anchor
      const prev = anchor.prev;
      child.next = anchor;
      child.prev = prev;
      anchor.prev = child;
      if (prev) {
        prev.next = child;
      } else {
        this.firstChild = child;
      }
    } else {
      // Append at end
      if (this.lastChild) {
        this.lastChild.next = child;
        child.prev = this.lastChild;
      } else {
        this.firstChild = child;
        child.prev = null;
      }
      this.lastChild = child;
      child.next = null;
    }
  }

  removeChild(child: ShadowElement): void {
    const prev = child.prev;
    const next = child.next;
    if (prev) {
      prev.next = next;
    } else {
      this.firstChild = next;
    }
    if (next) {
      next.prev = prev;
    } else {
      this.lastChild = prev;
    }
    child.parent = null;
    child.prev = null;
    child.next = null;
  }
}

export const PAGE_ROOT_ID = 1;

/** Create the page root shadow element with the reserved id=1. */
export function createPageRoot(): ShadowElement {
  return new ShadowElement('page', PAGE_ROOT_ID);
}
