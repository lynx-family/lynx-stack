// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export const LifecycleConstant = {
  firstScreen: 'rLynxFirstScreen',
  updateFromRoot: 'updateFromRoot',
  globalEventFromLepus: 'globalEventFromLepus',
  // Signals the main thread to sync the first screen, sent by the background thread
  // (automatically in `jsReady` mode, or via `markFirstScreenSyncReady()` in `manual`).
  firstScreenSyncReady: 'rLynxFirstScreenSyncReady',
  patchUpdate: 'rLynxChange',
  publishEvent: 'rLynxPublishEvent',
  updateMTRefInitValue: 'rLynxChangeRefInitValue',
  prepareLazyBundleMTS: 'rLynxPrepareLazyBundleMTS',
} as const;

export type LifecycleConstant = (typeof LifecycleConstant)[keyof typeof LifecycleConstant];

export const ctxNotFoundType = 'Lynx.Error.CtxNotFound';

export interface CtxNotFoundOptions {
  operation: string;
  commitId: number;
  isHydration: boolean;
  parent?: number;
  child?: number;
  /** Missing main-thread contexts: 1 for parent, 2 for child, 3 for both. */
  missingNode?: 1 | 2 | 3;
}

export interface CtxNotFoundData {
  id: number;
  options: CtxNotFoundOptions;
}

export interface FirstScreenData {
  root: string;
  firstScreenEventIdSwap: Record<string | number, number>;
}

export const NativeUpdateDataType = {
  UPDATE: 0,
  RESET: 1,
} as const;

export type NativeUpdateDataType = (typeof NativeUpdateDataType)[keyof typeof NativeUpdateDataType];
