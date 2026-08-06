// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createServer as createHttp2Server } from 'node:http2';

import { serve } from '@hono/node-server';

import app from './app.js';
import { createGracefulShutdown } from './graceful-shutdown.js';
import { resolveListenOptions } from './listen-options.js';

const HTTP2_ENABLED = process.env.GENUI_HTTP2 === '1';
const { hostname, port } = resolveListenOptions(process.env);

const server = serve(
  {
    fetch: app.fetch,
    hostname,
    port,
    ...(HTTP2_ENABLED ? { createServer: createHttp2Server } : {}),
  },
  ({ address, port }) => {
    const protocol = HTTP2_ENABLED ? 'HTTP/2' : 'HTTP/1';
    const formattedAddress = address.includes(':') ? `[${address}]` : address;
    console.info(
      `GenUI ${protocol} server listening on http://${formattedAddress}:${port}`,
    );
  },
);

const shutdown = createGracefulShutdown(server);

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
