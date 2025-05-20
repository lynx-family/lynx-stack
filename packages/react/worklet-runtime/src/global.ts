// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ClosureValueType, Worklet } from './bindings/types.js';
import type { RunOnBackgroundDelayImpl } from './delayRunOnBackground.js';
import type { JsFunctionLifecycleManager } from './jsFunctionLifecycle.js';
import type { RefImpl } from './workletRef.js';

declare global {
  // eslint-disable-next-line no-var
  var lynxWorkletImpl: {
    _workletMap: Record<string, (...args: any[]) => any>;
    _jsFunctionLifecycleManager?: JsFunctionLifecycleManager;
    _refImpl: RefImpl;
    _runOnBackgroundDelayImpl: RunOnBackgroundDelayImpl;
    _hydrateCtx: (worklet: Worklet, firstScreenWorklet: Worklet) => void;
  };

  function runWorklet(ctx: Worklet, params: ClosureValueType[]): unknown;

  function registerWorklet(type: string, id: string, worklet: (...args: any[]) => any): void;
  function registerWorkletInternal(type: string, id: string, worklet: (...args: any[]) => any): void;
}
