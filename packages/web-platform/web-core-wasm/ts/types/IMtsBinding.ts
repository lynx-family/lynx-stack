/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CloneableObject } from './Cloneable.js';
import type { LynxCrossThreadEvent } from './EventType.js';

/**
 * The JS binding for the WASM main thread context instance.
 */
export interface RustMainthreadContextBinding {
  runWorklet(
    handler: unknown,
    eventObject: LynxCrossThreadEvent,
    targetUniqueId: number,
    targetDataset: CloneableObject,
    currentTargetUniqueId: number,
    currentTargetDataset: CloneableObject,
  ): void;

  publishEvent(
    handlerName: string,
    parentComponentId: string | undefined,
    eventObject: LynxCrossThreadEvent,
    targetUniqueId: number,
    targetDataset: CloneableObject,
    currentTargetUniqueId: number,
    currentTargetDataset: CloneableObject,
  ): void;

  addEventListener(event_name: string): void;

  markExposureRelatedElementByUniqueId(
    uniqueId: number,
    toEnable: boolean,
  ): void;
}
