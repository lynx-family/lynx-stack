// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { LifecycleConstant } from './snapshot/lifecycle/constant.js';
import type { GlobalPatchOptions } from './snapshot/lifecycle/patch/commit.js';
import type { SnapshotPatch } from './snapshot/lifecycle/patch/snapshotPatch.js';
import type { BackgroundSnapshotInstance } from './snapshot/snapshot/backgroundSnapshot.js';
import type { RunWorkletCtxData } from './worklet-runtime/bindings/events.js';

/**
 * @public
 */
export interface RootNativeApp {
  callLepusMethod(name: string, data: object, callback?: (ret?: unknown) => void): void;
}

/**
 * @public
 */
export interface RootLynx {
  getNativeApp(): RootNativeApp;
}

/**
 * @public
 */
export interface RootTT {
  OnLifecycleEvent?: (...args: any[]) => void;
  publishEvent?: (handlerName: string, data: any) => void;
  publicComponentEvent?: (componentId: string, handlerName: string, data: any) => void;
  callDestroyLifetimeFun?: () => void;
  updateGlobalProps?: (newData: any) => void;
  updateCardData?: (...args: any[]) => void;
  onAppReload?: (...args: any[]) => void;
  processCardConfig?: (...args: any[]) => void;
}

/**
 * @internal
 */
export class RootContext {
  lynx: RootLynx | undefined;
  tt: RootTT | undefined;

  root: unknown;
  snapshotPatch: SnapshotPatch | undefined;
  commitTaskMap: Map<number, () => void> = new Map();
  nextCommitTaskId = 1;
  patchOptions: GlobalPatchOptions = {};
  bgInstancesToRemove: number[] = [];
  bsiValues: Map<number, BackgroundSnapshotInstance> = new Map();
  delayedEvents: [handlerName: string, data: EventDataType][] | undefined;
  delayedLifecycleEvents: [type: LifecycleConstant, data: unknown][] = [];
  destroyTasks: Set<() => void> = new Set();
  delayedRunOnMainThreadData: RunWorkletCtxData[] = [];
}

/**
 * @internal
 */
export const defaultRootContext: RootContext = /* @__PURE__ */ new RootContext();

let currentRootContext = defaultRootContext;

let boundLynx: RootLynx | undefined;

/**
 * @internal
 */
export function contextLynx(): RootLynx {
  return boundLynx ?? lynx;
}

/**
 * @internal
 */
export function getCurrentRootContext(): RootContext {
  return currentRootContext;
}

const rootAliasRefreshers: (() => void)[] = [];

/**
 * @internal
 */
export function onRootContextSwitch(refresh: () => void): void {
  rootAliasRefreshers.push(refresh);
}

/**
 * @internal
 */
export function switchRootContext(next: RootContext): void {
  if (next === currentRootContext) {
    return;
  }
  boundLynx = next.lynx;
  currentRootContext = next;
  for (const refresh of rootAliasRefreshers) {
    refresh();
  }
}
