// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Cloneable } from './Cloneable.js';
import type { WebFiberElementImpl } from './Element.js';

export type LynxEventType =
  | 'bindEvent'
  | 'catchEvent'
  | 'capture-bind'
  | 'capture-catch';

export interface LynxCrossThreadEventTarget {
  dataset: {
    [key: string]: Cloneable;
  };
  id: string | null;
  uniqueId: number;
}

export interface LynxCrossThreadEvent<
  T = {
    [key: string]: string | number | undefined | null;
  },
> {
  type: string;
  timestamp: number;
  target: LynxCrossThreadEventTarget;
  currentTarget: LynxCrossThreadEventTarget | null;
  detail: T;
  [key: string]: string | number | undefined | null | {};
}

export interface MainThreadScriptEvent<
  T = {
    [key: string]: string | number | undefined | null;
  },
> extends LynxCrossThreadEvent<T> {
  target: LynxCrossThreadEventTarget & { elementRefptr: unknown };
  currentTarget:
    | (LynxCrossThreadEventTarget & { elementRefptr: unknown })
    | null;
}

export type ExposureEventDetail = {
  'exposure-id': string;
  'exposure-scene': string;
  exposureID: string;
  exposureScene: string;
  'unique-id': number;
};
export type ExposureEvent = {
  detail: ExposureEventDetail;
};

export type ExposureWorkerEvent =
  & LynxCrossThreadEvent<ExposureEventDetail>
  & ExposureEventDetail;

export type MinimalRawEventObject = {
  type: string;
  target: Pick<WebFiberElementImpl, 'getAttribute'> | null;
  currentTarget: Pick<WebFiberElementImpl, 'getAttribute'> | null;
  detail?: Cloneable;
  isTrusted: boolean;
  timeStamp: number;
  propertyName?: string; // For transition events
  animationName?: string; // For animation events
  touches?: unknown[]; // For touch events
  targetTouches?: unknown[]; // For touch events
  changedTouches?: unknown[]; // For touch events
};
