// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export const LAYERS = {
  BACKGROUND: 'react:background',
  MAIN_THREAD: 'react:main-thread',
} as const;

export const initProfileHook = (): void => undefined;
export const profileStart = (): void => undefined;
export const profileEnd = (): void => undefined;
