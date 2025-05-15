// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Element } from '../api/element.js';

export type { Element };

export type WorkletRefId = number;

export interface WorkletRefImpl<T> {
  _wvid: WorkletRefId;
  _initValue: T;
  _type: string;
  _lifecycleObserver?: unknown;
  current?: T;
}

export interface WorkletRef<T> {
  _wvid: WorkletRefId;
  current: T;

  [key: string]: unknown;
}

interface ClosureValueType_ extends Record<string, ClosureValueType> {}

export type ClosureValueType =
  | null
  | undefined
  | string
  | boolean
  | number
  | Worklet
  | WorkletRef<unknown>
  | Element
  | (((...args: unknown[]) => unknown) & { ctx?: ClosureValueType })
  | ClosureValueType_
  | ClosureValueType[];

export interface Worklet {
  _wkltId: string;
  _workletType?: string;
  _c?: Record<string, ClosureValueType>;
  _lepusWorkletHash?: string;
  _execId?: number;
  _jsFn?: Record<string, string>;
  _unmount?: () => void;
  [key: string]: ClosureValueType;
}

/**
 * @public
 */
export interface JsFnHandle {
  _jsFnId: number;
  _fn?: (...args: unknown[]) => unknown;
  _execId?: number;
  _error?: string;
}
