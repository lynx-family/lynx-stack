/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CloneableObject } from './Cloneable.js';
import type { DecoratedHTMLElement } from './Element.js';
import type { LynxCrossThreadEvent } from './EventType.js';

/**
 * The JS binding for the WASM main thread context instance.
 */
export interface RustMainthreadContextBinding {
  runWorklet(
    handler: unknown,
    eventObject: LynxCrossThreadEvent,
    targetElement: DecoratedHTMLElement,
    targetDataset: CloneableObject,
    currentTargetElement: DecoratedHTMLElement,
    currentTargetDataset: CloneableObject,
  ): void;

  publishEvent(
    handlerName: string,
    parentComponentId: string | undefined,
    eventObject: LynxCrossThreadEvent,
    targetElement: DecoratedHTMLElement,
    targetDataset: CloneableObject,
    currentTargetElement: DecoratedHTMLElement,
    currentTargetDataset: CloneableObject,
  ): void;

  deferReportError(error: unknown): void;

  addEventListener(event_name: string): void;

  markExposureRelatedElementByUniqueId(
    element: HTMLElement,
    toEnable: boolean,
  ): void;

  enableElementEvent(element: WeakRef<HTMLElement>, eventName: string): void;

  disableElementEvent(element: WeakRef<HTMLElement>, eventName: string): void;

  getClassList(element: WeakRef<HTMLElement>): string[];

  setAttribute(
    element: WeakRef<HTMLElement>,
    name: string,
    value: string,
  ): void;

  removeAttribute(element: WeakRef<HTMLElement>, name: string): void;
}
