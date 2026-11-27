// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The Node.js globals that bundled packages use: `process`, `Buffer`,
// `global` and `setImmediate`. Installed once, before any of them is loaded.

import { Buffer } from './buffer.js';
import process from './process.js';

/**
 * Installs the globals and sets the working directory to `cwd`. Call it only
 * after @rspack/browser has started (see ./process.ts).
 */
export function installGlobals(cwd: string): typeof process {
  // The globals have Node.js types, which the stand-ins do not match.
  const g = globalThis as unknown as Record<string, unknown>;
  g['global'] ??= g;
  g['Buffer'] ??= Buffer;
  g['setImmediate'] ??= (
    fn: (...args: unknown[]) => void,
    ...args: unknown[]
  ) => setTimeout(fn, 0, ...args);
  g['clearImmediate'] ??= (id: ReturnType<typeof setTimeout>) =>
    clearTimeout(id);
  g['process'] = process;
  process.chdir(cwd);
  return process;
}
