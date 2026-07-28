// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createServer as createHttp2Server } from 'node:http2';

import { serve } from '@hono/node-server';

import app from './app.js';

const DEFAULT_PORT = 3_000;
const DEFAULT_HOST = '0.0.0.0';
const HTTP2_ENABLED = process.env.GENUI_HTTP2 === '1';

function readPort(value: string | undefined): number {
  if (value === undefined) return DEFAULT_PORT;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`Invalid PORT value: ${value}`);
  }
  return port;
}

const server = serve(
  {
    fetch: app.fetch,
    hostname: process.env.HOST ?? DEFAULT_HOST,
    port: readPort(process.env.PORT),
    ...(HTTP2_ENABLED ? { createServer: createHttp2Server } : {}),
  },
  ({ address, port }) => {
    const protocol = HTTP2_ENABLED ? 'HTTP/2' : 'HTTP/1';
    console.info(
      `GenUI ${protocol} server listening on http://${address}:${port}`,
    );
  },
);

function shutdown(signal: NodeJS.Signals): void {
  console.info(`Received ${signal}; shutting down GenUI server`);
  server.close(() => {
    console.info('GenUI server stopped');
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
