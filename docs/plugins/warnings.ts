// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Application } from 'typedoc';

/**
 * Fails the run when TypeDoc logged a warning or an error, the way
 * `treatWarningsAsErrors` does for the TypeDoc CLI.
 */
export function assertNoWarnings(app: Application, name: string): void {
  if (app.logger.hasErrors() || app.logger.hasWarnings()) {
    throw new Error(
      `TypeDoc reported ${app.logger.errorCount} errors and ${app.logger.warningCount} warnings for ${name}`,
    );
  }
}
