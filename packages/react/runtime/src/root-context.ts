// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @internal
 */
export interface RootContextSlot {
  id: string;
  init(): unknown;
  save(bag: Record<string, unknown>): void;
  load(bag: Record<string, unknown>): void;
}

const slots: RootContextSlot[] = [];

/**
 * @internal
 */
export function registerContextSlot(slot: RootContextSlot): void {
  slots.push(slot);
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
  bag: Record<string, unknown> = {};
  lynx: RootLynx | undefined;
  tt: RootTT | undefined;
}

/**
 * @internal
 */
export const defaultRootContext: RootContext = new RootContext();

let currentRootContext = defaultRootContext;

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
  const oldBag = currentRootContext.bag;
  for (const slot of slots) {
    slot.save(oldBag);
  }
  const newBag = next.bag;
  for (const slot of slots) {
    if (!(slot.id in newBag)) {
      newBag[slot.id] = slot.init();
    }
    slot.load(newBag);
  }
  currentRootContext = next;
}
