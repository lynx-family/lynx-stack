// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export const enum LifecycleConstant {
  firstScreen = 'rLynxFirstScreen',
  updateFromRoot = 'updateFromRoot',
  globalEventFromLepus = 'globalEventFromLepus',
  jsReady = 'rLynxJSReady',
  patchUpdate = 'rLynxChange',
  publishEvent = 'rLynxPublishEvent',
  updateMTRefInitValue = 'rLynxChangeRefInitValue',
}

export interface FirstScreenData {
  root: string;
  jsReadyEventIdSwap: Record<string | number, number>;
}

export const enum NativeUpdateDataType {
  UPDATE = 0,
  RESET = 1,
}
