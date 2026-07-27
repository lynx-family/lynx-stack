// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The fixed main-thread runtime. It is identical for every app (no per-app
 * compilation): it registers the `renderPage`/`updatePage` entry points and
 * applies the op stream sent by the background thread through the Element
 * PAPI.
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
declare function __FlushElementTree(
  element?: FiberElement,
  options?: Record<string, unknown>,
): void;

const elements = new Map<number, FiberElement>();
let page: FiberElement | undefined;
let pageId = 0;

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
        elements.set(op[1] as number, __CreateElement(op[2] as string, pageId));
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
        const parent = elements.get(op[1] as number)!;
        const child = elements.get(op[2] as number)!;
        const ref = op[3] ? elements.get(op[3] as number) : undefined;
        if (ref) {
          __InsertElementBefore(parent, child, ref);
        } else {
          __AppendElement(parent, child);
        }
        break;
      }
      case Ops.Remove: {
        __RemoveElement(
          elements.get(op[1] as number)!,
          elements.get(op[2] as number)!,
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
        __SetInlineStyles(
          elements.get(op[1] as number)!,
          op[2] as string,
        );
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
      default:
        break;
    }
  }
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
  [Ops.PATCH_METHOD](obj: { data: string }): void {
    applyOps(JSON.parse(obj.data) as Ops.Op[]);
  },
});
