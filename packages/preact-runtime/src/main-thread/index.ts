// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The fixed main-thread runtime. It is identical for every app (no per-app
 * compilation): it registers the `renderPage`/`updatePage` entry points and
 * applies the op stream sent by the background thread through the Element
 * PAPI. It also hosts the transform-free MTS support (worklet registry) and
 * the `<list>` protocol.
 */

import * as Ops from '../ops.js';

interface FiberElement {
  readonly __fiberElementBrand?: never;
}

declare function __CreatePage(componentId: string, cssId: number): FiberElement;
declare function __CreateElement(
  tag: string,
  parentComponentUniqueId: number,
): FiberElement;
declare function __CreateList(
  parentComponentUniqueId: number,
  componentAtIndex: (
    list: FiberElement,
    listID: number,
    cellIndex: number,
    operationID: number,
    enableReuseNotification: boolean,
  ) => number | undefined,
  enqueueComponent: (list: FiberElement, listID: number, sign: number) => void,
  info: Record<string, unknown>,
): FiberElement;
declare function __CreateRawText(text: string): FiberElement;
declare function __GetElementUniqueID(e: FiberElement): number;
declare function __AppendElement(
  parent: FiberElement,
  child: FiberElement,
): FiberElement;
declare function __InsertElementBefore(
  parent: FiberElement,
  child: FiberElement,
  ref: FiberElement,
): FiberElement;
declare function __RemoveElement(
  parent: FiberElement,
  child: FiberElement,
): FiberElement;
declare function __SetAttribute(
  e: FiberElement,
  key: string,
  value: unknown,
): void;
declare function __GetAttributeByName(e: FiberElement, key: string): unknown;
declare function __AddInlineStyle(
  e: FiberElement,
  key: string | number,
  value: unknown,
): void;
declare function __SetClasses(e: FiberElement, classes: string): void;
declare function __SetInlineStyles(
  e: FiberElement,
  styles: string | Record<string, string>,
): void;
declare function __SetID(e: FiberElement, id: string | null): void;
declare function __SetDataset(e: FiberElement, dataset: unknown): void;
declare function __AddEvent(
  e: FiberElement,
  eventType: string,
  eventName: string,
  event: string | Record<string, unknown> | undefined,
): void;
declare function __ElementAnimate(e: FiberElement, args: unknown[]): void;
declare function __FlushElementTree(
  element?: FiberElement,
  options?: Record<string, unknown>,
): void;

const elements = new Map<number, FiberElement>();
let page: FiberElement | undefined;
let pageId = 0;

// ---------------------------------------------------------------------------
// <list> support: items are created detached; `update-list-info` announces
// positional changes and native/web pulls content back via componentAtIndex.
// ---------------------------------------------------------------------------

interface ListState {
  list: FiberElement;
  items: number[];
  renderedCount: number;
  dirty: boolean;
}

const listStates = new Map<number, ListState>();
const dirtyLists: ListState[] = [];

function componentAtIndexOf(
  state: ListState,
): (
  list: FiberElement,
  listID: number,
  cellIndex: number,
  operationID: number,
  enableReuseNotification: boolean,
) => number | undefined {
  return (_list, _listID, cellIndex) => {
    const itemId = state.items[cellIndex];
    const item = itemId === undefined ? undefined : elements.get(itemId);
    return item ? __GetElementUniqueID(item) : undefined;
  };
}

function markListDirty(state: ListState): void {
  if (!state.dirty) {
    state.dirty = true;
    dirtyLists.push(state);
  }
}

function flushListUpdates(): void {
  for (const state of dirtyLists) {
    state.dirty = false;
    // Full refresh: remove every rendered row, insert every current row.
    // Correct (if not minimal) and enough for the recycling-free first cut.
    const removeAction = Array.from(
      { length: state.renderedCount },
      (_, i) => i,
    );
    const insertAction = state.items.map((_, position) => ({ position }));
    state.renderedCount = state.items.length;
    __SetAttribute(state.list, 'update-list-info', {
      insertAction,
      removeAction,
      updateAction: [],
    });
  }
  dirtyLists.length = 0;
}

// ---------------------------------------------------------------------------
// Transform-free MTS: worklet registry + a minimal main-thread Element API.
// ---------------------------------------------------------------------------

const workletMap = new Map<number, (...args: unknown[]) => unknown>();
let animationCount = 0;

class MainThreadElement {
  element: FiberElement;
  dataset: unknown;
  id: unknown;

  constructor(element: FiberElement) {
    this.element = element;
  }

  setAttribute(name: string, value: unknown): void {
    __SetAttribute(this.element, name, value);
    scheduleWorkletFlush();
  }

  getAttribute(name: string): unknown {
    return __GetAttributeByName(this.element, name);
  }

  setStyleProperty(name: string, value: string): void {
    __AddInlineStyle(this.element, name, value);
    scheduleWorkletFlush();
  }

  setStyleProperties(styles: Record<string, string>): void {
    for (const key in styles) {
      __AddInlineStyle(this.element, key, styles[key]);
    }
    scheduleWorkletFlush();
  }

  animate(
    keyframes: Record<string, unknown>[],
    options?: number | Record<string, unknown>,
  ): { cancel(): void; pause(): void; play(): void } {
    const id = `__preact-runtime-animation-${animationCount++}`;
    const normalized = typeof options === 'number'
      ? { duration: options }
      : options ?? {};
    const element = this.element;
    __ElementAnimate(element, [0, id, keyframes, normalized]);
    scheduleWorkletFlush();
    const operate = (op: number) => {
      __ElementAnimate(element, [op, id]);
      scheduleWorkletFlush();
    };
    return {
      play: () => operate(1),
      pause: () => operate(2),
      cancel: () => operate(3),
    };
  }
}

let workletFlushScheduled = false;
function scheduleWorkletFlush(): void {
  if (!workletFlushScheduled) {
    workletFlushScheduled = true;
    queueMicrotask(() => {
      workletFlushScheduled = false;
      __FlushElementTree();
    });
  }
}

function wrapEventForWorklet(event: unknown): void {
  if (!event || typeof event !== 'object') {
    return;
  }
  const record = event as Record<string, unknown>;
  for (const key of ['target', 'currentTarget']) {
    const value = record[key] as
      | { elementRefptr?: FiberElement; dataset?: unknown; id?: unknown }
      | undefined;
    if (value?.elementRefptr) {
      const wrapped = new MainThreadElement(value.elementRefptr);
      wrapped.dataset = value.dataset;
      wrapped.id = value.id;
      record[key] = wrapped;
    }
  }
}

function runWorklet(
  ctx: { _wkltId?: number } | undefined,
  params: unknown[] | undefined,
): void {
  const fn = ctx?._wkltId === undefined
    ? undefined
    : workletMap.get(ctx._wkltId);
  if (!fn) {
    return;
  }
  const args = params ?? [];
  wrapEventForWorklet(args[0]);
  fn(...args);
}

// ---------------------------------------------------------------------------
// Op application
// ---------------------------------------------------------------------------

function ensurePage(): FiberElement {
  if (!page) {
    page = __CreatePage('0', 0);
    pageId = __GetElementUniqueID(page);
    elements.set(Ops.PAGE_ID, page);
  }
  return page;
}

function applyOps(ops: Ops.Op[]): void {
  ensurePage();
  for (const op of ops) {
    const opcode = op[0] as number;
    switch (opcode) {
      case Ops.CreateElement: {
        const id = op[1] as number;
        const tag = op[2] as string;
        if (tag === 'list') {
          const state: ListState = {
            list: undefined as unknown as FiberElement,
            items: [],
            renderedCount: 0,
            dirty: false,
          };
          state.list = __CreateList(
            pageId,
            componentAtIndexOf(state),
            () => {
              // Detach bookkeeping is driven by `update-list-info`.
            },
            {},
          );
          listStates.set(id, state);
          elements.set(id, state.list);
        } else {
          elements.set(id, __CreateElement(tag, pageId));
        }
        break;
      }
      case Ops.CreateText: {
        elements.set(op[1] as number, __CreateRawText(op[2] as string));
        break;
      }
      case Ops.SetText: {
        __SetAttribute(elements.get(op[1] as number)!, 'text', op[2]);
        break;
      }
      case Ops.InsertBefore: {
        const parentId = op[1] as number;
        const childId = op[2] as number;
        const refId = op[3] as number;
        const listState = listStates.get(parentId);
        if (listState) {
          const index = refId ? listState.items.indexOf(refId) : -1;
          if (index >= 0) {
            listState.items.splice(index, 0, childId);
          } else {
            listState.items.push(childId);
          }
          markListDirty(listState);
          break;
        }
        const parent = elements.get(parentId)!;
        const child = elements.get(childId)!;
        const ref = refId ? elements.get(refId) : undefined;
        if (ref) {
          __InsertElementBefore(parent, child, ref);
        } else {
          __AppendElement(parent, child);
        }
        break;
      }
      case Ops.Remove: {
        const parentId = op[1] as number;
        const childId = op[2] as number;
        const listState = listStates.get(parentId);
        if (listState) {
          const index = listState.items.indexOf(childId);
          if (index >= 0) {
            listState.items.splice(index, 1);
            markListDirty(listState);
          }
          break;
        }
        __RemoveElement(
          elements.get(parentId)!,
          elements.get(childId)!,
        );
        break;
      }
      case Ops.SetAttribute: {
        __SetAttribute(elements.get(op[1] as number)!, op[2] as string, op[3]);
        break;
      }
      case Ops.SetClasses: {
        __SetClasses(elements.get(op[1] as number)!, op[2] as string);
        break;
      }
      case Ops.SetStyle: {
        __SetInlineStyles(elements.get(op[1] as number)!, op[2] as string);
        break;
      }
      case Ops.SetId: {
        __SetID(elements.get(op[1] as number)!, op[2] as string | null);
        break;
      }
      case Ops.SetDataset: {
        __SetDataset(elements.get(op[1] as number)!, op[2]);
        break;
      }
      case Ops.SetEvent: {
        const id = op[1] as number;
        const eventType = op[2] as string;
        const eventName = op[3] as string;
        __AddEvent(
          elements.get(id)!,
          eventType,
          eventName,
          op[4] ? `${id}:${eventType}:${eventName}` : undefined,
        );
        break;
      }
      case Ops.RegisterWorklet: {
        const hash = op[1] as number;
        const source = op[2] as string;
        // The main-thread realm evaluates the shipped source once. This is
        // the transform-free trade-off; see the package README.
        // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call
        const fn = new Function(`return (${source});`)() as (
          ...args: unknown[]
        ) => unknown;
        workletMap.set(hash, fn);
        break;
      }
      case Ops.SetWorkletEvent: {
        const id = op[1] as number;
        const eventType = op[2] as string;
        const eventName = op[3] as string;
        const hash = op[4] as number;
        __AddEvent(
          elements.get(id)!,
          eventType,
          eventName,
          hash ? { type: 'worklet', value: { _wkltId: hash } } : undefined,
        );
        break;
      }
      case Ops.AddInlineStyle: {
        __AddInlineStyle(
          elements.get(op[1] as number)!,
          op[2] as string,
          op[3],
        );
        break;
      }
      case Ops.ElementAnimate: {
        __ElementAnimate(
          elements.get(op[1] as number)!,
          op[2] as unknown[],
        );
        break;
      }
      case Ops.ReportError: {
        console.error('[preact-runtime BTS]', op[1]);
        break;
      }
      case Ops.RunWorklet: {
        runWorklet({ _wkltId: op[1] as number }, op[2] as unknown[]);
        break;
      }
      default:
        break;
    }
  }
  flushListUpdates();
  __FlushElementTree(page, {});
}

Object.assign(globalThis, {
  renderPage(_data: unknown): void {
    ensurePage();
  },
  updatePage(): void {/* noop */},
  updateGlobalProps(): void {/* noop */},
  getPageData(): unknown {
    return undefined;
  },
  removeComponents(): void {/* noop */},
  runWorklet,
  [Ops.PATCH_METHOD](obj: { data: string }): void {
    applyOps(JSON.parse(obj.data) as Ops.Op[]);
  },
});
