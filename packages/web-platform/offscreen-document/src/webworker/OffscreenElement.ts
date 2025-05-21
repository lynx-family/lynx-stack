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
import { OffscreenNode, uniqueId } from './OffscreenNode.js';

export const ancestorDocument = Symbol('ancestorDocument');
export const _attributes = Symbol('_attributes');
export const innerHTML = Symbol('innerHTML');
const _style = Symbol('_style');
export class OffscreenElement extends OffscreenNode {
  private [_style]?: OffscreenCSSStyleDeclaration;
  private readonly [_attributes]: Record<string, string> = {};
  public [innerHTML]: string = '';

  /**
   * @private
   */
  readonly [ancestorDocument]: OffscreenDocument;

  public readonly tagName: string;

  constructor(
    tagName: string,
    parentDocument: OffscreenDocument,
    elementUniqueId: number,
  ) {
    super(elementUniqueId, parentDocument[enableEvent]);
    this.tagName = tagName.toUpperCase();
    this[ancestorDocument] = parentDocument;
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
    return this[_attributes]['id'] ?? '';
  }

  set id(value: string) {
    this[_attributes]['id'] = value;
    this.setAttribute('id', value);
  }

  get className(): string {
    return this[_attributes]['class'] ?? '';
  }

  setAttribute(qualifiedName: string, value: string): void {
    this[_attributes][qualifiedName] = value;
    this[ancestorDocument][operations].push({
      type: OperationType.SetAttribute,
      uid: this[uniqueId],
      key: qualifiedName,
      value,
    });
  }

  getAttribute(qualifiedName: string): string | null {
    return this[_attributes][qualifiedName] ?? null;
  }

  removeAttribute(qualifiedName: string): void {
    delete this[_attributes][qualifiedName];
    this[ancestorDocument][operations].push({
      type: OperationType.RemoveAttribute,
      uid: this[uniqueId],
      key: qualifiedName,
    });
  }

  override append(...nodes: (OffscreenElement)[]): void {
    this[ancestorDocument][operations].push({
      type: OperationType.Append,
      uid: this[uniqueId],
      cid: nodes.map(node => node[uniqueId]),
    });
    super.append(...nodes);
  }

  override replaceWith(...nodes: (OffscreenElement)[]): void {
    this[ancestorDocument][operations].push({
      type: OperationType.ReplaceWith,
      uid: this[uniqueId],
      nid: nodes.map(node => node[uniqueId]),
    });
    return super.replaceWith(...nodes);
  }

  getAttributeNames(): string[] {
    return Object.keys(this[_attributes]);
  }

  remove(): void {
    if (this.parentElement) {
      this[ancestorDocument][operations].push({
        type: OperationType.Remove,
        uid: this[uniqueId],
      });
      super._remove();
    }
  }

  override insertBefore(
    newNode: OffscreenElement,
    refNode: OffscreenElement | null,
  ): OffscreenElement {
    const ret = super.insertBefore(newNode, refNode);
    this[ancestorDocument][operations].push({
      type: OperationType.InsertBefore,
      uid: this[uniqueId],
      cid: newNode[uniqueId],
      ref: refNode?.[uniqueId],
    });
    return ret as OffscreenElement;
  }

  override removeChild(child: OffscreenElement | null): OffscreenElement {
    const ret = super.removeChild(child);
    this[ancestorDocument][operations].push({
      type: OperationType.RemoveChild,
      uid: this[uniqueId],
      cid: child![uniqueId],
    });
    return ret as OffscreenElement;
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
  // The toJSON method intentionally returns an empty string because
  // serialization is not applicable for OffscreenElement instances.
  toJSON(): string {
    return '';
  }
}
