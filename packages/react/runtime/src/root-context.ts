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
export interface RootContextProxy {
  addEventListener(type: string, listener: (event: { data: any }) => void): void;
  removeEventListener(type: string, listener: (event: { data: any }) => void): void;
}

/**
 * @public
 */
export interface AppEventHandlers {
  onLifecycleEvent?: (args: any) => void;
  publishEvent?: (handlerName: string, data?: any) => void;
  publicComponentEvent?: (componentId: string, handlerName: string, data: any) => void;
  updateGlobalProps?: (newData: object) => void;
  updateCardData?: (...args: any[]) => void;
  onAppReload?: (...args: any[]) => void;
  onDestroyLifetime?: () => void;
}

export interface RootLynx {
  getNativeApp(): RootNativeApp;
  getCoreContext?(): RootContextProxy;
  /**
   * Registers app-level callbacks with lynx-core. Replaces the historical
   * mutation of the injected `tt`: the engine keeps invoking the app
   * object, which forwards to these handlers.
   */
  registerAppEventHandlers(handlers: AppEventHandlers): void;
  getInitDataParams?(): { initData?: object; updateData?: object };
  getDynamicComponentExports?(componentUrl: string): unknown;
  callBeforePublishEvent?(eventData?: unknown): void;
}

/**
 * @internal
 */
export class RootContext {
  lynx: RootLynx | undefined;
  /** The currently-active publishEvent handler (delayed before hydration). */
  publishEventHandler: ((handlerName: string, data?: any) => void) | undefined;

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
  return boundLynx ?? (lynx as unknown as RootLynx);
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
