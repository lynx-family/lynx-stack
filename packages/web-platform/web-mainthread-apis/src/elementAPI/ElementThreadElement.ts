// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  componentIdAttribute,
  cssIdAttribute,
  OperationType,
} from '@lynx-js/web-constants';
import type {
  ElementOperation,
  LynxCrossThreadEvent,
  LynxEventType,
  PageConfig,
  CssInJsInfo,
} from '@lynx-js/web-constants';

function getParentIdx(
  element: ElementThreadElement,
  parent?: ElementThreadElement,
): number {
  parent = parent ?? element.parent;
  const idx = parent!.children.findIndex((e) => e === element);
  if (idx === -1) {
    console.error(`[lynx-web]`, element, ` is not a child of`, parent);
    throw new Error(`[lynx-web] ${element} is not a child of ${parent}`);
  }
  return idx;
}

export enum RefCountType {
  Element,
}

export class ElementThreadElement {
  static uniqueIdToElement: (WeakRef<ElementThreadElement> | undefined)[] = [];
  static receiveEvent(event: LynxCrossThreadEvent) {
    const currentTargetUniqueId = event.currentTarget.uniqueId;
    const target = this.uniqueIdToElement[currentTargetUniqueId]?.deref();
    if (target) {
      const handler = target.eventHandlerMap[event.type]?.handler;
      if (typeof handler === 'function') {
        queueMicrotask(() => {
          handler(event);
        });
      }
    } else {
      this.uniqueIdToElement[currentTargetUniqueId] = undefined;
    }
  }
  static getElementByUniqueId(
    uniqueId: number,
  ): ElementThreadElement | undefined {
    return ElementThreadElement.uniqueIdToElement[uniqueId]?.deref();
  }
  public type: RefCountType = RefCountType.Element;
  public eventHandlerMap: Record<
    string,
    {
      type: LynxEventType;
      handler: ((ev: LynxCrossThreadEvent) => void) | string;
    } | undefined
  > = {};
  public attributes: {
    id?: string;
    [componentIdAttribute]?: string;
    style: string | null;
    class: string | null;
    [cssIdAttribute]: string | null;
    [key: string]: string | undefined | null;
  };
  public property: {
    parent?: ElementThreadElement;
    componentConfig: Record<string, unknown>;
    dataset: Record<string, unknown>;
    [key: string]: unknown;
  } = {
    componentConfig: {},
    dataset: {},
  };
  public children: ElementThreadElement[] = [];
  public parent?: ElementThreadElement;
  // public parentComponentUniqueId!: number;
  constructor(
    public tag: string,
    public uniqueId: number,
    public readonly pageConfig: PageConfig,
    private operationsRef: {
      operations: ElementOperation[];
    },
    public styleInfo: CssInJsInfo,
  ) {
    this.attributes = {
      style: null,
      class: '',
      [cssIdAttribute]: null,
    };
    ElementThreadElement.uniqueIdToElement[this.uniqueId] = new WeakRef(this);
    operationsRef.operations.push({
      type: OperationType.Create,
      uid: uniqueId,
      tag: tag,
    });
  }
  setProperty(key: string, value: any) {
    this.property[key] = value;
    if (key === 'dataset') {
      this.operationsRef.operations.push({
        uid: this.uniqueId,
        type: OperationType.SetProperty,
        key: key,
        value: value,
      });
    }
  }

  setDatasetProperty(key: string, value: any) {
    this.property.dataset[key] = value;
    this.operationsRef.operations.push({
      uid: this.uniqueId,
      type: OperationType.SetDatasetProperty,
      key,
      value,
    });
  }

  setAttribute(key: string, value: string | null) {
    this.attributes[key] = value;
    this.operationsRef.operations.push({
      uid: this.uniqueId,
      type: OperationType.SetAttribute,
      key,
      value,
    });
  }

  getAttribute<T extends keyof ElementThreadElement['attributes']>(
    key: T,
  ): ElementThreadElement['attributes'][T] {
    return this.attributes[key];
  }

  appendChild(children: ElementThreadElement[]) {
    this.children.push(...children);
    for (const kid of children) {
      if (kid.parent) {
        // note that Node.appendChild() will do `move node` Implicitly.
        const idx = getParentIdx(kid);
        kid.parent.children.splice(idx, 1);
      }
      kid.parent = this;
    }
    this.operationsRef.operations.push({
      uid: this.uniqueId,
      type: OperationType.Append,
      cid: children.map(e => e.uniqueId),
    });
  }

  removeChild(child: ElementThreadElement) {
    const idx = getParentIdx(child, this);
    this.children.splice(idx, 1);
    child.parent = undefined;
    this.operationsRef.operations.push({
      type: OperationType.Remove,
      uid: this.uniqueId,
      cid: [child.uniqueId],
    });
    return child;
  }

  replaceWithElements(newElements: ElementThreadElement[]) {
    for (const kid of newElements) {
      if (this.parent === kid) {
        console.error(
          `[lynx-web] cannot replace the element`,
          this,
          `by its parent`,
          kid,
        );
        throw new Error(`[lynx-web] cannot replace `);
      }
    }
    const parent = this.parent;
    if (parent) {
      const currentPosition = getParentIdx(this);
      parent.children.splice(currentPosition, 1);
      this.parent = undefined;
      for (const kid of newElements) {
        if (kid.parent) {
          const idx = getParentIdx(kid);
          kid.parent.children.splice(idx, 1);
        }
        kid.parent = parent;
      }
      parent.children.splice(currentPosition, 0, ...newElements);
      this.operationsRef.operations.push({
        type: OperationType.Replace,
        uid: this.uniqueId,
        nid: newElements.map(e => e.uniqueId),
      });
    }
  }

  swapWith(elementB: ElementThreadElement) {
    const parentA = this.parent!;
    const parentB = elementB.parent!;
    const idxA = getParentIdx(this);
    const idxB = getParentIdx(elementB);
    parentA.children[idxA] = elementB;
    elementB.parent = parentA;
    parentB.children[idxB] = this;
    this.parent = parentB;
    this.operationsRef.operations.push({
      type: OperationType.SwapElement,
      uid: this.uniqueId,
      tid: elementB.uniqueId,
    });
  }

  insertBefore(child: ElementThreadElement, ref?: ElementThreadElement | null) {
    if (ref) {
      const idx = getParentIdx(ref, this);
      this.children.splice(idx, 0, child);
      child.parent = this;
      this.operationsRef.operations.push({
        type: OperationType.InsertBefore,
        uid: this.uniqueId,
        cid: child.uniqueId,
        ref: ref.uniqueId,
      });
    } else {
      this.children.push(child);
      child.parent = this;
      this.operationsRef.operations.push({
        type: OperationType.Append,
        uid: this.uniqueId,
        cid: [child.uniqueId],
      });
    }
    return child;
  }

  updateCssInJsGeneratedStyle(classStyleStr: string) {
    this.operationsRef.operations.push({
      type: OperationType.UpdateCssInJs,
      uid: this.uniqueId,
      classStyleStr,
    });
  }

  setStyleProperty(key: string, value: string | null, important?: boolean) {
    this.attributes.style = (this.attributes.style ?? '')
      + `${key}:${value ?? ''}${important ? '!important' : ''};`;
    this.operationsRef.operations.push({
      type: OperationType.SetStyleProperty,
      uid: this.uniqueId,
      key,
      value,
      im: important,
    });
  }

  setEventHandler(
    ename: string,
    handler: ((ev: LynxCrossThreadEvent) => void) | string | undefined,
    eventType: LynxEventType,
  ) {
    let hname: string | undefined | null;
    if (handler) {
      this.eventHandlerMap[ename] = { type: eventType, handler };
      if (typeof handler === 'function') {
        hname = null;
      } else {
        hname = handler;
      }
    } else {
      this.eventHandlerMap[ename] = undefined;
    }

    this.operationsRef.operations.push({
      type: OperationType.RegisterEventHandler,
      uid: this.uniqueId,
      eventType,
      hname,
      ename,
    });
  }

  get firstElementChild() {
    return this.children[0];
  }
  get lastElementChild(): ElementThreadElement | undefined {
    const childLength = this.children.length;
    return childLength > 0 ? this.children[childLength - 1] : undefined;
  }
  get nextElementSibling(): ElementThreadElement | undefined {
    if (this.parent) {
      const idx = getParentIdx(this);
      return this.parent.children[idx + 1];
    }
    return;
  }
}

export type ComponentAtIndexCallback = (
  list: ListElement,
  listID: number,
  cellIndex: number,
  operationID: number,
  enableReuseNotification: boolean,
) => void;

export type EnqueueComponentCallback = (
  list: ListElement,
  listID: number,
  sign: number,
) => void;

type UpdateListInfoAttributeValue = {
  insertAction: {
    position: number;
  }[];
  removeAction: {
    position: number;
  }[];
};

export class ListElement extends ElementThreadElement {
  componentAtIndex!: ComponentAtIndexCallback;
  enqueueComponent!: EnqueueComponentCallback;
  // _positionFiredComponentAtIndex = new Set<number>();
  override setAttribute(
    key: 'update-list-info',
    value: UpdateListInfoAttributeValue,
  ): void;
  override setAttribute(
    key: Exclude<string, 'update-list-info'>,
    value: string | null,
  ): void;
  override setAttribute(
    key: string,
    value: string | null | UpdateListInfoAttributeValue,
  ): void {
    if (key === 'update-list-info' && value) {
      const listInfo = value as UpdateListInfoAttributeValue;
      const { insertAction, removeAction } = listInfo;
      queueMicrotask(() => {
        for (const action of insertAction) {
          this.componentAtIndex(this, this.uniqueId, action.position, 0, false);
        }
        for (const action of removeAction) {
          this.enqueueComponent(this, this.uniqueId, action.position);
        }
      });
      value = value.toString();
    }
    super.setAttribute(key, value as string | null);
  }
}
