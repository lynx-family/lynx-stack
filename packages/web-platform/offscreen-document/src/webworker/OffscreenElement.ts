// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  enableEvent,
  operations,
  type OffscreenDocument,
} from './OffscreenDocument.js';
import { OffscreenCSSStyleDeclaration } from './OffscreenCSSStyleDeclaration.js';
import { OperationType } from '../types/ElementOperation.js';

export const ancestorDocument = Symbol('ancestorDocument');
export const _attributes = Symbol('_attributes');
export const _children = Symbol('_children');
export const innerHTML = Symbol('innerHTML');
export const uniqueId = Symbol('uniqueId');
const _style = Symbol('_style');
export class OffscreenElement extends EventTarget {
  public [innerHTML]: string = '';
  private [_style]?: OffscreenCSSStyleDeclaration;
  private readonly [_attributes] = new Map<string, string>();
  private _parentElement: OffscreenElement | null = null;
  readonly [_children]: OffscreenElement[] = [];
  /**
   * @private
   */
  readonly [uniqueId]: number;

  /**
   * @private
   */
  [ancestorDocument]!: OffscreenDocument;

  public readonly localName: string;

  constructor(
    localName: string,
    elementUniqueId: number,
  ) {
    super();
    this.localName = localName;
    this[uniqueId] = elementUniqueId;
  }

  get tagName(): string {
    return this.localName.toUpperCase();
  }

  get style(): OffscreenCSSStyleDeclaration {
    if (!this[_style]) {
      this[_style] = new OffscreenCSSStyleDeclaration(
        this,
      );
    }
    return this[_style];
  }

  get id(): string {
    return this[_attributes].get('id') ?? '';
  }

  set id(value: string) {
    this[_attributes].set('id', value);
    this.setAttribute('id', value);
  }

  get className(): string {
    return this[_attributes].get('class') ?? '';
  }

  get children(): OffscreenElement[] {
    return this[_children].slice();
  }

  get parentElement(): OffscreenElement | null {
    return this._parentElement;
  }

  get parentNode(): OffscreenElement | null {
    return this._parentElement;
  }

  get firstElementChild(): OffscreenElement | null {
    return this[_children][0] ?? null;
  }

  get lastElementChild(): OffscreenElement | null {
    return this[_children][this[_children].length - 1] ?? null;
  }

  get nextElementSibling(): OffscreenElement | null {
    const parent = this._parentElement;
    if (parent) {
      const nextElementSiblingIndex = parent[_children].indexOf(this);
      if (nextElementSiblingIndex >= 0) {
        return parent[_children][nextElementSiblingIndex + 1] || null;
      }
    }
    return null;
  }

  protected _remove(): void {
    if (this._parentElement) {
      const currentIdx = this._parentElement[_children].indexOf(this);
      this._parentElement[_children].splice(currentIdx, 1);
      this._parentElement = null;
    }
  }

  setAttribute(qualifiedName: string, value: string): void {
    this[_attributes].set(qualifiedName, value);
    this[ancestorDocument][operations].push({
      type: OperationType.SetAttribute,
      uid: this[uniqueId],
      key: qualifiedName,
      value,
    });
  }

  getAttribute(qualifiedName: string): string | null {
    return this[_attributes].get(qualifiedName) ?? null;
  }

  removeAttribute(qualifiedName: string): void {
    this[_attributes].delete(qualifiedName);
    this[ancestorDocument][operations].push({
      type: OperationType.RemoveAttribute,
      uid: this[uniqueId],
      key: qualifiedName,
    });
  }

  append(...nodes: (OffscreenElement)[]): void {
    this[ancestorDocument][operations].push({
      type: OperationType.Append,
      uid: this[uniqueId],
      cid: nodes.map(node => node[uniqueId]),
    });
    for (const node of nodes) {
      node._remove();
      node._parentElement = this;
    }
    this[_children].push(...nodes);
  }

  appendChild(node: OffscreenElement): OffscreenElement {
    this[ancestorDocument][operations].push({
      type: OperationType.Append,
      uid: this[uniqueId],
      cid: [node[uniqueId]],
    });
    node._remove();
    node._parentElement = this;
    this[_children].push(node);
    return node;
  }

  replaceWith(...nodes: (OffscreenElement)[]): void {
    this[ancestorDocument][operations].push({
      type: OperationType.ReplaceWith,
      uid: this[uniqueId],
      nid: nodes.map(node => node[uniqueId]),
    });
    if (this._parentElement) {
      const parent = this._parentElement;
      this._parentElement = null;
      const currentIdx = parent[_children].indexOf(this);
      parent[_children].splice(currentIdx, 1, ...nodes);
      for (const node of nodes) {
        node._parentElement = parent;
      }
    }
  }

  getAttributeNames(): string[] {
    return [...this[_attributes].keys()];
  }

  remove(): void {
    this[ancestorDocument][operations].push({
      type: OperationType.Remove,
      uid: this[uniqueId],
    });
    this._remove();
  }

  insertBefore(
    newNode: OffscreenElement,
    refNode: OffscreenElement | null,
  ): OffscreenElement {
    newNode._remove();
    if (refNode) {
      const refNodeIndex = this[_children].indexOf(refNode);
      if (refNodeIndex >= 0) {
        newNode._parentElement = this;
        this[_children].splice(refNodeIndex, 0, newNode);
      }
    } else {
      newNode._parentElement = this;
      this[_children].push(newNode);
    }

    this[ancestorDocument][operations].push({
      type: OperationType.InsertBefore,
      uid: this[uniqueId],
      cid: newNode[uniqueId],
      ref: refNode?.[uniqueId],
    });
    return newNode;
  }

  removeChild(child: OffscreenElement | null): OffscreenElement {
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
    this[ancestorDocument][operations].push({
      type: OperationType.RemoveChild,
      uid: this[uniqueId],
      cid: child![uniqueId],
    });
    child._remove();
    return child;
  }

  override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    this[ancestorDocument][enableEvent](type, this[uniqueId]);
    super.addEventListener(type, callback, options);
  }

  set innerHTML(text: string) {
    this[ancestorDocument][operations].push({
      type: OperationType.SetInnerHTML,
      text,
      uid: this[uniqueId],
    });
    for (const child of this.children) {
      (child as OffscreenElement).remove();
    }
    this[innerHTML] = text;
  }
}
