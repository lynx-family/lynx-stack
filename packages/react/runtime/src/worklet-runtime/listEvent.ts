// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ClosureValueType, RunWorkletOptions, Worklet } from './bindings/types.js';

export const LIST_EVENT_ID = '__ReactLynxSnapshotListState';
export type ListEventDispatch = (
  context: Worklet,
  params: ClosureValueType[],
  options: RunWorkletOptions | undefined,
  run: (context: Worklet, params: ClosureValueType[], options?: RunWorkletOptions) => unknown,
) => unknown;
export let dispatchListEvent: ListEventDispatch | undefined;
export function setListEventDispatch(dispatch: ListEventDispatch): void {
  dispatchListEvent = dispatch;
}
