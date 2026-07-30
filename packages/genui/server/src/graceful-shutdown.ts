// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Socket } from 'node:net';
import type { Duplex } from 'node:stream';

import type { ServerType } from '@hono/node-server';

const DEFAULT_GRACE_PERIOD_MS = 10_000;

type TrackedConnection = Duplex | Socket;

interface ShutdownLogger {
  info(message: string): void;
  warn(message: string): void;
}

interface GracefulShutdownOptions {
  gracePeriodMs?: number;
  logger?: ShutdownLogger;
}

export function createGracefulShutdown(
  server: ServerType,
  {
    gracePeriodMs = DEFAULT_GRACE_PERIOD_MS,
    logger = console,
  }: GracefulShutdownOptions = {},
): (signal: NodeJS.Signals) => void {
  const connections = new Set<TrackedConnection>();
  server.on('connection', (connection: TrackedConnection) => {
    connections.add(connection);
    connection.once('close', () => {
      connections.delete(connection);
    });
  });

  let shuttingDown = false;
  return (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}; shutting down GenUI server`);

    let completed = false;
    const forceCloseTimer = setTimeout(() => {
      logger.warn('Graceful shutdown timed out; forcing connection close');
      for (const connection of connections) {
        connection.destroy();
      }
    }, gracePeriodMs);
    forceCloseTimer.unref();

    server.close(() => {
      if (completed) return;
      completed = true;
      clearTimeout(forceCloseTimer);
      logger.info('GenUI server stopped');
    });
  };
}
