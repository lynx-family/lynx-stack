// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createServer } from 'node:http';

import { handler } from '../dist/index.js';

const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_PORT = 3060;

function parsePort(value) {
  if (value === undefined) return DEFAULT_PORT;

  const port = Number(value);
  if (
    value.trim() === '' || !Number.isInteger(port) || port < 0 || port > 65535
  ) {
    throw new TypeError(
      `PORT must be an integer between 0 and 65535; received "${value}"`,
    );
  }
  return port;
}

function printableHost(host) {
  if (host === '0.0.0.0' || host === '::') return 'localhost';
  return host.includes(':') ? `[${host}]` : host;
}

const host = process.env.HOST?.trim() || DEFAULT_HOST;
const port = parsePort(process.env.PORT);
const server = createServer(handler);

server.once('error', (error) => {
  console.error('Failed to start the GenUI server:', error);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  const address = server.address();
  if (address === null || typeof address === 'string') return;

  console.info(
    `GenUI server listening on http://${
      printableHost(address.address)
    }:${address.port}`,
  );
});

let isShuttingDown = false;
function shutDown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.info(`Received ${signal}; closing the GenUI server.`);
  server.close((error) => {
    if (error) {
      console.error('Failed to close the GenUI server:', error);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', () => shutDown('SIGINT'));
process.once('SIGTERM', () => shutDown('SIGTERM'));
