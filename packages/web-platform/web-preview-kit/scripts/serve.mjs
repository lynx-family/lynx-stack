// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Serves the built kit (`dist/kit`) with the headers of "Deployment
 * requirements" in ARCHITECTURE.md: `Cross-Origin-Embedder-Policy` and
 * `Cross-Origin-Resource-Policy` on every response, and
 * `Document-Isolation-Policy` on the page.
 *
 * Usage: node scripts/serve.mjs [port]
 */

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const root = path.join(import.meta.dirname, '../dist/kit');
const port = Number(process.argv[2] ?? 4210);

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
};

http.createServer(async (request, response) => {
  let { pathname } = new URL(request.url, 'http://localhost');
  if (pathname.endsWith('/')) {
    pathname += 'index.html';
  }
  const file = path.join(root, decodeURIComponent(pathname));
  const info = await stat(file).catch(() => undefined);
  if (!file.startsWith(root) || !info?.isFile()) {
    response.writeHead(404).end();
    return;
  }
  const extension = path.extname(file);
  response.writeHead(200, {
    'Content-Type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    ...(extension === '.html'
      ? { 'Document-Isolation-Policy': 'isolate-and-require-corp' }
      : {}),
  });
  createReadStream(file).pipe(response);
}).listen(port, () => {
  console.log(`http://localhost:${port}/`);
});
