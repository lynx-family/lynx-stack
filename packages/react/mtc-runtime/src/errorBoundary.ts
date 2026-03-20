// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * MTC Error Boundary — catches errors in individual MTC islands
 * so that one broken island doesn't crash the entire page.
 *
 * Uses Preact's options._catchError hook rather than a class component
 * to stay lightweight. In production, errors are reported via lynx.reportError.
 * In development, additional diagnostics are logged.
 */

export function wrapWithErrorHandling(
  componentHash: string,
  fn: () => void,
): void {
  try {
    fn();
  } catch (error) {
    if (__DEV__) {
      console.error(
        `[MTC] Error in component ${componentHash}:`,
        error,
      );
    }
    // Report to Lynx error system if available
    if (typeof lynx !== 'undefined' && lynx.reportError) {
      lynx.reportError(error as Error);
    }
  }
}
