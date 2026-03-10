// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Type declarations for Lynx Background Thread globals used by the Vue runtime.
 *
 * Global `lynx` variable and NodesRef/SelectorQuery types are provided by
 * @lynx-js/types (devDependency). Files that need `lynx.getNativeApp()` (not
 * part of the public @lynx-js/types surface) declare a local `var lynx` to
 * shadow the global — see flush.ts for the pattern.
 */

declare global {
  /** Build-time macros replaced by DefinePlugin */
  const __DEV__: boolean;
  const __VUE_OPTIONS_API__: boolean;
  const __VUE_PROD_DEVTOOLS__: boolean;
  const __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: boolean;

  /** Injected by entry-background.ts; called by Lynx Native on event fire */
  function publishEvent(sign: string, data: unknown): void;
}

export {};
