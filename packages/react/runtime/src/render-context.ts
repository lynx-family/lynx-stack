// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { LifecycleConstant } from './snapshot/lifecycle/constant.js';
import type { GlobalPatchOptions } from './snapshot/lifecycle/patch/commit.js';
import type { SnapshotPatch } from './snapshot/lifecycle/patch/snapshotPatch.js';
import type { BackgroundSnapshotInstance } from './snapshot/snapshot/backgroundSnapshot.js';
import type { RunWorkletCtxData } from './worklet-runtime/bindings/events.js';

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
