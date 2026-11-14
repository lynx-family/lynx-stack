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

interface NestedListBridge {
  dispatch?: ListEventDispatch;
  restoreStyle?: (element: ElementNode) => void;
}

declare global {
  // The snapshot runtime and an app's own `worklet-runtime/init` can be
  // separately bundled copies (for example with an external React bundle),
  // so they meet through a global, like the rest of the worklet runtime.
  var __ReactLynxNestedList: NestedListBridge | undefined;
}

export function nestedListBridge(): NestedListBridge {
  return (globalThis.__ReactLynxNestedList ??= {});
}

/** Native and Web resolve the global runner per event, so read both at call time. */
function runListEvent(
  context: Worklet | null | undefined,
  params: ClosureValueType[],
  options?: RunWorkletOptions,
): unknown {
  if (context?._wkltId !== LIST_EVENT_ID) return undefined;
  return nestedListBridge().dispatch!(context, params, options, globalThis.runWorklet);
}

export function setListEventDispatch(dispatch: ListEventDispatch): void {
  nestedListBridge().dispatch = dispatch;
  // Background-only apps do not load the authored-worklet runtime. Leave its
  // globals untouched so a later main-thread bundle can initialize normally.
  if (typeof globalThis.runWorklet !== 'function') {
    globalThis.runWorklet = runListEvent;
  }
}
