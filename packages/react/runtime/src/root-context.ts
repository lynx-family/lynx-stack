// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @internal
 */
export interface RootContextSlot<T = unknown> {
  id: string;
  init(): T;
  save(): T;
  load(value: T): void;
}

const slots: RootContextSlot[] = [];

/**
 * @internal
 */
export function registerContextSlot<T>(slot: RootContextSlot<T>): void {
  slots.push(slot as RootContextSlot);
}

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
  slotValues: Record<string, unknown> = {};
  lynx: RootLynx | undefined;
  tt: RootTT | undefined;
}

/**
 * @internal
 */
export const defaultRootContext: RootContext = /* @__PURE__ */ new RootContext();

let currentRootContext = defaultRootContext;

/**
 * @internal
 */
export let contextLynx: RootLynx = lynx;

/**
 * @internal
 */
export function getCurrentRootContext(): RootContext {
  return currentRootContext;
}

/**
 * @internal
 */
export function switchRootContext(next: RootContext): void {
  if (next === currentRootContext) {
    return;
  }
  const oldValues = currentRootContext.slotValues;
  for (const slot of slots) {
    oldValues[slot.id] = slot.save();
  }
  const newValues = next.slotValues;
  for (const slot of slots) {
    if (!(slot.id in newValues)) {
      newValues[slot.id] = slot.init();
    }
    slot.load(newValues[slot.id]);
  }
  contextLynx = next.lynx ?? lynx;
  currentRootContext = next;
}
