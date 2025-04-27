// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export const uniqueId = Symbol('uniqueId');
export const ancestorDocument = Symbol('ancestorDocument');
export class OffscreenNode extends EventTarget {
  private _parentElement: OffscreenNode | null = null;
  private readonly _children: OffscreenNode[] = [];

  /**
   * @private
   */
  readonly [uniqueId]: number;

  constructor(
    elementUniqueId: number,
    private _enableEvent: (eventName: string, uid: number) => void,
  ) {
    super();
    this[uniqueId] = elementUniqueId;
  }

  get children(): OffscreenNode[] {
    return this._children.slice();
  }

  get parentElement(): OffscreenNode | null {
    return this._parentElement;
  }

  get parentNode(): OffscreenNode | null {
    return this._parentElement;
  }

  get firstElementChild(): OffscreenNode | null {
    return this._children[0] ?? null;
  }

  get lastElementChild(): OffscreenNode | null {
    return this._children[this._children.length - 1] ?? null;
  }

  get nextElementSibling(): OffscreenNode | null {
    const parent = this._parentElement;
    if (parent) {
      const nextElementSiblingIndex = parent._children.indexOf(this);
      if (nextElementSiblingIndex >= 0) {
        return parent._children[nextElementSiblingIndex + 1] || null;
      }
    }
    return null;
  }

  append(...nodes: (OffscreenNode)[]): void {
    for (const node of nodes) {
      node._remove();
      node._parentElement = this;
    }
    this._children.push(...nodes);
  }

  replaceWith(...nodes: (OffscreenNode)[]): void {
    if (this._parentElement) {
      const parent = this._parentElement;
      this._parentElement = null;
      const currentIdx = parent._children.indexOf(this);
      parent._children.splice(currentIdx, 1, ...nodes);
      for (const node of nodes) {
        node._parentElement = parent;
      }
    }
  }

  protected _remove(): void {
    if (this._parentElement) {
      const currentIdx = this._parentElement._children.indexOf(this);
      this._parentElement._children.splice(currentIdx, 1);
      this._parentElement = null;
    }
  }

  insertBefore(
    newNode: OffscreenNode,
    refNode: OffscreenNode | null,
  ): OffscreenNode {
    newNode._remove();
    if (refNode) {
      const refNodeIndex = this._children.indexOf(refNode);
      if (refNodeIndex >= 0) {
        newNode._parentElement = this;
        this._children.splice(refNodeIndex, 0, newNode);
      }
    } else {
      newNode._parentElement = this;
      this._children.push(newNode);
    }

    return newNode;
  }

  removeChild(child: OffscreenNode | null): OffscreenNode {
    if (!child) {
      throw new DOMException(
        'The node to be removed is not a child of this node.',
        'NotFoundError',
      );
    }
    if (child._parentElement !== this) {
      throw new DOMException(
        'The node to be removed is not a child of this node.',
        'NotFoundError',
      );
    }
    child._remove();
    return child;
  }

  override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    this._enableEvent(type, this[uniqueId]);
    super.addEventListener(type, callback, options);
  }
}
