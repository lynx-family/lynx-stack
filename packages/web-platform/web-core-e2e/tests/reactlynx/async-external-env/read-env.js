// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// This ordinary dependency must run without waiting for async ReactLynx.
export const platform = SystemInfo?.platform;
const hasNativeBridge = __MAIN_THREAD__
  ? NativeModules?.hybridMonitor !== undefined
  : false;

if (__MAIN_THREAD__) {
  console.log('async-external-env:ready', platform, hasNativeBridge);
}
