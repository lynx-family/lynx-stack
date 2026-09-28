// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { LifecycleConstant } from './snapshot/lifecycle/constant.js';
import type { GlobalPatchOptions } from './snapshot/lifecycle/patch/commit.js';
import type { SnapshotPatch } from './snapshot/lifecycle/patch/snapshotPatch.js';
import type { BackgroundSnapshotInstance } from './snapshot/snapshot/backgroundSnapshot.js';
import type { RunWorkletCtxData } from './worklet-runtime/bindings/events.js';

export class RootContext {
  lynx: typeof lynx | undefined;

  root: unknown;
  snapshotPatch: SnapshotPatch | undefined;
  commitTaskMap: Map<number, () => void> = new Map();
  nextCommitTaskId = 1;
  patchOptions: GlobalPatchOptions = {};
  bgInstancesToRemove: number[] = [];
  bsiValues: Map<number, BackgroundSnapshotInstance> = new Map();
  delayedEvents: [handlerName: string, data: EventDataType][] = [];
  delayedLifecycleEvents: [type: LifecycleConstant, data: unknown][] = [];
  delayedRunOnMainThreadData: RunWorkletCtxData[] = [];
}

export const defaultRootContext: RootContext = /* @__PURE__ */ new RootContext();

let currentRootContext = defaultRootContext;

export function getCurrentRootContext(): RootContext {
  return currentRootContext;
}

const rootAliasRefreshers: (() => void)[] = [];

export function onRootContextSwitch(refresh: () => void): void {
  rootAliasRefreshers.push(refresh);
}

export function switchRootContext(next: RootContext): void {
  if (next === currentRootContext) {
    return;
  }
  currentRootContext = next;
  for (const refresh of rootAliasRefreshers) {
    refresh();
  }
}
