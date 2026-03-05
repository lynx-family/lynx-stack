// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Worklet type definitions for cross-thread function dispatch.
 * Mirrors the types used by @lynx-js/react/worklet-runtime.
 */

export interface Worklet {
  _wkltId: string;
  _workletType?: string;
  _c?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RunWorkletCtxData {
  resolveId: number;
  worklet: Worklet;
  params: unknown[];
}

export interface RunWorkletCtxRetData {
  resolveId: number;
  returnValue: unknown;
}
