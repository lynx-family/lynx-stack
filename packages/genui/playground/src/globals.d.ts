// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
declare global {
  const __REACT_LYNX_MOCK__: string | undefined;

  interface Window {
    __A2UI_MOCK__?: string;
  }
}

export {};

declare module '*.css' {}
