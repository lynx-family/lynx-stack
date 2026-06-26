// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import createDebug from 'debug';

const debug = createDebug('devtool-mcp-server:takeover');

const DEBUG_ROUTER_DIR = path.join(os.homedir(), '.DebugRouterConnector');
const DEBUG_ROUTER_LOCK_DIR = path.join(DEBUG_ROUTER_DIR, 'lockfile');
const DEBUG_ROUTER_LATEST_FILE = path.join(
  DEBUG_ROUTER_DIR,
  'LatestDriverProcess',
);

export async function takeoverDebugRouterLock(): Promise<void> {
  try {
    await fs.mkdir(DEBUG_ROUTER_DIR, { recursive: true });

    await fs.rm(DEBUG_ROUTER_LOCK_DIR, { recursive: true, force: true });

    await fs.mkdir(DEBUG_ROUTER_LOCK_DIR, { recursive: true });

    await fs.writeFile(DEBUG_ROUTER_LATEST_FILE, `${process.pid}`, 'utf-8');
    debug(`wrote PID=${process.pid}`);
  } catch (err) {
    debug('skipped due to filesystem error %O', err);
  } finally {
    try {
      await fs.rm(DEBUG_ROUTER_LOCK_DIR, { recursive: true, force: true });
    } catch (_cleanupError) {
      debug('failed to remove lock directory %O', _cleanupError);
    }
  }
}
