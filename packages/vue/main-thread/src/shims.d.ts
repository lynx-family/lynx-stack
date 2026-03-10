// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Lynx Main Thread (Lepus) PAPI declarations for the Vue ops executor.
 *
 * All PAPI function types (__CreateElement, __SetAttribute, etc.) and the
 * ElementRef opaque handle are provided by @lynx-js/type-element-api.
 */

import type { ElementRef } from '@lynx-js/type-element-api';

declare global {
  /** Build-time macros */
  const __DEV__: boolean;

  /** Alias for ElementRef — keeps ops-apply.ts changes minimal. */
  type LynxElement = ElementRef;

  /** Lynx runtime — cross-thread communication */
  const lynx: {
    getJSContext(): {
      dispatchEvent(event: { type: string; data: string }): void;
      addEventListener(
        type: string,
        handler: (event: { data?: unknown }) => void,
      ): void;
    };
    SystemInfo?: Record<string, unknown>;
    [key: string]: unknown;
  };
}
