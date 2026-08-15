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

export type MainThreadCallableId = number;

/**
 * The serialized form of a `MainThreadCallable` handle. Capturing it in a main
 * thread function resolves it to the realized main-thread function.
 */
export interface MainThreadCallableImpl {
  _wcid: MainThreadCallableId;
}

/**
 * A patch of callable ctx updates sent from the background thread.
 * A `null` ctx releases the callable.
 */
export type MainThreadCallableCtxPatch = [id: MainThreadCallableId, ctx: Worklet | null][];

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
  | (((...args: unknown[]) => unknown) & {
    ctxRef?: WeakRef<object>;
  })
  | ClosureValueType_
  | ClosureValueType[];

export interface Worklet {
  _wkltId: string;
  _workletType?: string;
  _c?: Record<string, ClosureValueType>;
  _execId?: number;
  _jsFn?: Record<string, string>;
  _unmount?: () => void;
  [key: string]: ClosureValueType;

  // for pre-0.99 compatibility
  _lepusWorkletHash?: string;
}

/**
 * @public
 */
export interface JsFnHandle {
  _jsFnId?: number;
  _fn?: (...args: unknown[]) => unknown;
  _execId?: number;
  _error?: string;
  _isFirstScreen?: boolean;
  /**
   * Stores an array of indexes of runOnBackground tasks that should be processed with a delay.
   * This is used before hydration.
   */
  _delayIndices?: number[];
}

export interface EventCtx {
  _eventReturnResult?: number;
}

export enum RunWorkletSource {
  NONE = 0,
  EVENT = 1,
  GESTURE = 2,
}

export interface RunWorkletOptions {
  source: RunWorkletSource;
}
