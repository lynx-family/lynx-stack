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

  /**
   * Override @lynx-js/type-element-api's __SetCSSId to accept an array.
   *
   * The native PAPI accepts a single element, but the web PAPI
   * (`@lynx-js/web-mainthread-apis`) iterates with `for..of`, requiring
   * an array. Passing `[el]` works on both platforms.
   *
   * TODO(huxpro): Fix upstream — @lynx-js/type-element-api should declare
   * `__SetCSSId(node: ElementRef | ElementRef[], ...)` to match the web
   * PAPI and React's types (`FiberElement | FiberElement[]`).
   */
  function __SetCSSId(
    nodes: ElementRef[],
    cssId: number,
    entryName?: string,
  ): void;

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
