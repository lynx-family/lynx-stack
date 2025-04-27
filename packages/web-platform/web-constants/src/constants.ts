// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const lynxUniqueIdAttribute = 'lynx-unique-id' as const;

export const cssIdAttribute = 'lynx-css-id' as const;

export const componentIdAttribute = 'lynx-component-id' as const;

export const lynxTagAttribute = 'lynx-tag' as const;

export const lynxDefaultDisplayLinearAttribute =
  'lynx-default-display-linear' as const;

export const lynxDefaultOverflowVisibleAttribute =
  'lynx-default-overflow-visible' as const;

export const __lynx_timing_flag = '__lynx_timing_flag' as const;

export const globalMuteableVars = [
  'registerDataProcessor',
  'registerWorkletInternal',
  'lynxWorkletImpl',
  'runWorklet',
] as const;

export const systemInfo = {
  platform: 'web',
  lynxSdkVersion: '3.0',
} as Record<string, string | number>;
