import {
  enableEvent,
  operations,
  type OffscreenDocument,
} from './OffscreenDocument.js';
import { OffscreenCSSStyleDeclaration } from './OffscreenCSSStyleDeclaration.js';
import { OperationType } from '../types/ElementOperation.js';

export const prevSibling = Symbol('prevSibling');
export const nextSibling = Symbol('nextSibling');
export const uniqueId = Symbol('uniqueId');
export const ancestorDocument = Symbol('ancestorDocument');
const _parent = Symbol('_parent');
const _firstChild = Symbol('_firstChild');
const _lastchild = Symbol('_lastchild');
const _style = Symbol('_style');
const _attributes = Symbol('_attributes');
export class OffscreenElement extends EventTarget {
  private [_style]?: OffscreenCSSStyleDeclaration;
  private [_parent]: OffscreenElement | null = null;
  private [_firstChild]: OffscreenElement | null = null;
  private [_lastchild]: OffscreenElement | null = null;
  [prevSibling]: OffscreenElement | null = null;
  [nextSibling]: OffscreenElement | null = null;

  private readonly [_attributes]: Record<string, string> = {};

  /**
   * @private
   */
  readonly [uniqueId]: number;

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
    super();
    this.tagName = tagName.toUpperCase();
    this[ancestorDocument] = parentDocument;
    this[uniqueId] = elementUniqueId;
  }

  get style(): OffscreenCSSStyleDeclaration {
    if (!this[_style]) {
      this[_style] = new OffscreenCSSStyleDeclaration(
        this,
      );
    }
    return this[_style];
  }

  get children(): OffscreenElement[] {
    const kids: OffscreenElement[] = [];
    let child = this[_firstChild];
    while (child) {
      kids.push(child);
      child = child[nextSibling];
    }
    return kids;
  }

  get parentElement(): OffscreenElement | null {
    return this[_parent];
  }

  get firstElementChild(): OffscreenElement | null {
    return this[_firstChild];
  }

  get lastElementChild(): OffscreenElement | null {
    return this[_lastchild];
  }

  get nextElementSibling(): OffscreenElement | null {
    return this[nextSibling];
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

  append(...nodes: (OffscreenElement)[]): void {
    this[ancestorDocument][operations].push({
      type: OperationType.Append,
      uid: this[uniqueId],
      cid: nodes.map(node => node[uniqueId]),
    });
    for (const node of nodes) {
      node.remove();
      node[prevSibling] = this[_lastchild];
      if (this[_lastchild]) {
        this[_lastchild][nextSibling] = node;
      }
      node[_parent] = this;
      if (!this[_firstChild]) {
        this[_firstChild] = node;
      }
      if (!this[_lastchild]) {
        this[_lastchild] = node;
      }
    }
  }

  replaceWith(...nodes: (OffscreenElement)[]): void {
    this[ancestorDocument][operations].push({
      type: OperationType.ReplaceWith,
      uid: this[uniqueId],
      nid: nodes.map(node => node[uniqueId]),
    });
  }

  getAttributeNames(): string[] {
    return Object.keys(this[_attributes]);
  }

  remove(): void {
    if (this[_parent]) {
      this[ancestorDocument][operations].push({
        type: OperationType.Remove,
        uid: this[uniqueId],
      });
      if (this[_parent][_firstChild] === this) {
        this[_parent][_firstChild] = this[nextSibling];
      }
      if (this[_parent][_lastchild] === this) {
        this[_parent][_lastchild] = null;
      }
      if (this[prevSibling]) {
        this[prevSibling][nextSibling] = this[nextSibling];
      }
      if (this[nextSibling]) {
        this[nextSibling][prevSibling] = this[prevSibling];
      }
      this[prevSibling] = null;
      this[nextSibling] = null;
      this[_parent] = null;
    }
  }

  insertBefore(
    newNode: OffscreenElement,
    refNode: OffscreenElement | null,
  ): OffscreenElement {
    this[ancestorDocument][operations].push({
      type: OperationType.InsertBefore,
      uid: this[uniqueId],
      cid: newNode[uniqueId],
      ref: refNode?.[uniqueId],
    });
    newNode.remove();
    if (refNode) {
      newNode[prevSibling] = refNode[prevSibling];
      if (refNode[prevSibling]) {
        refNode[prevSibling][nextSibling] = newNode;
      }
      newNode[nextSibling] = refNode;
      refNode[prevSibling] = newNode;
    } else {
      this.append(newNode);
    }
    return newNode;
  }

  removeChild(child: OffscreenElement | null): OffscreenElement {
    if (!child) {
      throw new DOMException(
        'The node to be removed is not a child of this node.',
        'NotFoundError',
      );
    }
    this[ancestorDocument][operations].push({
      type: OperationType.RemoveChild,
      uid: this[uniqueId],
      cid: child[uniqueId],
    });
    if (child[_parent] !== this) {
      throw new DOMException(
        'The node to be removed is not a child of this node.',
        'NotFoundError',
      );
    }
    child.remove();
    return child;
  }

  set innerHTML(text: string) {
    this[ancestorDocument][operations].push({
      type: OperationType.SetInnerHTML,
      text,
      uid: this[uniqueId],
    });
  }

  // #captureListeners:Record<string, Set<EventListener> | undefined> = {};
  // #normalListeners:Record<string, Set<EventListener> | undefined> = {};

  override addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    this[ancestorDocument][enableEvent](type);
    super.addEventListener(type, callback, options);
  }
}
