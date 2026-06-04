// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module';

export function readValue(
  args: string[],
  index: number,
  option: string,
): string {
  const value = args[index];
  if (!value || value.startsWith('-')) {
    throw new Error(`Missing value for ${option}.`);
  }
  return value;
}

export function printPackageVersion(): void {
  const require = createRequire(import.meta.url);
  const packageJson = require('../package.json') as Record<string, unknown>;
  console.info(packageJson['version']);
}
