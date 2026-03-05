// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Type declarations for Lynx Background Thread globals used by the Vue runtime.
 */

declare global {
  /** Build-time macros replaced by DefinePlugin */
  const __DEV__: boolean;
  const __VUE_OPTIONS_API__: boolean;
  const __VUE_PROD_DEVTOOLS__: boolean;
  const __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: boolean;

  /** Lynx BG Thread global – available in Background Thread only */
  const lynx: {
    getNativeApp(): {
      callLepusMethod(
        name: string,
        data: unknown,
        callback?: () => void,
      ): void;
    };
    getCoreContext(): {
      dispatchEvent(event: { type: string; data: string }): void;
      addEventListener(
        type: string,
        handler: (event: { data?: unknown }) => void,
      ): void;
      removeEventListener(
        type: string,
        handler: (event: { data?: unknown }) => void,
      ): void;
    };
  };

  /** Injected by entry-background.ts; called by Lynx Native on event fire */
  function publishEvent(sign: string, data: unknown): void;
}

export {};
