// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { BackgroundFunctionExecMap } from './core/background-function/exec-map.js';
import type { IndexMap } from './shared/index-map.js';
import type { LifecycleConstant } from './snapshot/lifecycle/constant.js';
import type { GlobalPatchOptions } from './snapshot/lifecycle/patch/commit.js';
import type { SnapshotPatch } from './snapshot/lifecycle/patch/snapshotPatch.js';
import type { BackgroundSnapshotInstance } from './snapshot/snapshot/backgroundSnapshot.js';
import type { RunWorkletCtxData } from './worklet-runtime/bindings/events.js';
import type { MainThreadRefInitValuePatch } from './worklet-runtime/bindings/types.js';

export interface RootContext {
  lynx: typeof lynx | undefined;
  root: unknown;
  snapshotPatch: SnapshotPatch | undefined;
  commitTaskMap: Map<number, () => void>;
  nextCommitTaskId: number;
  patchOptions: GlobalPatchOptions;
  bgInstancesToRemove: number[];
  bsiValues: Map<number, BackgroundSnapshotInstance>;
  delayedEvents: [handlerName: string, data: EventDataType][] | undefined;
  delayedLifecycleEvents: [type: LifecycleConstant, data: unknown][];
  delayedRunOnMainThreadData: RunWorkletCtxData[];
  reloadVersion?: number;
  shouldDelayUiOps?: boolean;
  delayedUiOps?: (() => void)[];
  flushOptions?: FlushOptions;
  destroyTasks?: Set<() => void>;
  mainThreadRefInitValuePatch?: MainThreadRefInitValuePatch;
  lazyBundleCache?: Map<string, unknown>;
  pendingPortalInsertBefore?: unknown[];
  functionCallReturn?: [
    resolveMap: IndexMap<(value: any) => void> | undefined,
    cleanup: (() => void) | undefined,
    unregisterCleanup: (() => void) | undefined,
  ];
  backgroundFunction?: [
    execIdMap: BackgroundFunctionExecMap | undefined,
    cleanup: (() => void) | undefined,
    unregisterCleanup: (() => void) | undefined,
  ];
  ctxNotFoundEventListener?: ((e: RuntimeProxy.Event) => void) | null;
  timing?: [
    timingFlag: string | undefined,
    shouldMarkDiffVdomStart: boolean,
    shouldMarkDiffVdomEnd: boolean,
    pipelineOptions: PipelineOptions | undefined,
  ];
}

export function createRootContext(pageLynx?: typeof lynx): RootContext {
  return {
    lynx: pageLynx,
    root: undefined,
    snapshotPatch: undefined,
    commitTaskMap: new Map(),
    nextCommitTaskId: 1,
    patchOptions: {},
    bgInstancesToRemove: [],
    bsiValues: new Map(),
    delayedEvents: undefined,
    delayedLifecycleEvents: [],
    delayedRunOnMainThreadData: [],
  };
}

export const defaultRootContext: RootContext = /* @__PURE__ */ createRootContext();

let currentRootContext = defaultRootContext;

export function getCurrentRootContext(): RootContext {
  return currentRootContext;
}

const switchers: [save: (ctx: RootContext) => void, load: (ctx: RootContext) => void][] = [];

export function onRootContextSwitch(save: (ctx: RootContext) => void, load: (ctx: RootContext) => void): void {
  switchers.push([save, load]);
}

export function switchRootContext(next: RootContext): void {
  if (next === currentRootContext) {
    return;
  }
  for (const [save] of switchers) {
    save(currentRootContext);
  }
  currentRootContext = next;
  for (const [, load] of switchers) {
    load(next);
  }
}

export function runInRootContext<R>(ctx: RootContext, fn: () => R): R {
  const prev = currentRootContext;
  switchRootContext(ctx);
  try {
    return fn();
  } finally {
    switchRootContext(prev);
  }
}

export function bindRootContext<T extends unknown[], R>(fn: (...args: T) => R): (...args: T) => R {
  if (typeof __LYNX_GROUP_MODULE_SHARING__ === 'undefined' || !__LYNX_GROUP_MODULE_SHARING__) {
    return fn;
  }
  const ctx = currentRootContext;
  return (...args: T) => runInRootContext(ctx, () => fn(...args));
}
