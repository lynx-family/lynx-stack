// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Cloneable } from './Cloneable.js';

export type LynxEventType =
  | 'bindEvent'
  | 'catchEvent'
  | 'capture-bind'
  | 'capture-catch';

export interface LynxCrossThreadEventTarget {
  dataset: {
    [key: string]: Cloneable;
  };
  id?: string;
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
