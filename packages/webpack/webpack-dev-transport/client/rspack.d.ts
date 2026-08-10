// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/// <reference types="@rspack/core/module" />

declare module '@rspack/core/hot/emitter.js' {
  export const emitter: {
    emit(eventName: string, ...args: unknown[]): void;
    on(eventName: string, callback: (...args: unknown[]) => void): void;
  };
}

declare module '@rspack/core/hot/log.js' {
  export function log(
    level: 'info' | 'warning' | 'error',
    message: string,
  ): void;
  export function formatError(error: unknown): string;
}

declare module '@rspack/core/hot/log-apply-result.js' {
  export function logApplyResult(
    updatedModules: (string | number)[],
    renewedModules: (string | number)[],
  ): void;
}
