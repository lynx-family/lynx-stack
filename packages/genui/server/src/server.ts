// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Server } from 'node:http';

import { register } from '../instrumentation';
import { createGenUIServer, listen } from './node-server';

import { handler } from './index';

function readPort(raw: string | undefined): number {
  if (!raw) return 3060;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`invalid PORT value: ${raw}`);
  }
  return port;
}

function installShutdownHandlers(server: Server): void {
  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`[a2ui-server] received ${signal}, shutting down`);
    const timeout = setTimeout(() => server.closeAllConnections(), 5_000);
    timeout.unref();
    server.close((error) => {
      clearTimeout(timeout);
      if (error) {
        console.error('[a2ui-server] shutdown failed', error);
        process.exitCode = 1;
      }
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

async function main(): Promise<void> {
  process.env.NODE_ENV ??= 'production';
  register();
  const host = process.env.HOST ?? '0.0.0.0';
  const port = readPort(process.env.PORT);
  const server = createGenUIServer(handler);
  await listen(server, { host, port });
  installShutdownHandlers(server);
  console.info(`[a2ui-server] listening on http://${host}:${port}`);
}

void main().catch((error) => {
  console.error('[a2ui-server] failed to start', error);
  process.exitCode = 1;
});
