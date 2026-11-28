// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const port = Number(process.env['REPORT_PORT'] ?? 4175);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error('REPORT_PORT must be an integer between 0 and 65535');
}
const routes = new Map([
  ['/', ['performance.html', 'text/html; charset=utf-8']],
  ['/performance.html', ['performance.html', 'text/html; charset=utf-8']],
  ['/PERFORMANCE.md', ['PERFORMANCE.md', 'text/plain; charset=utf-8']],
]);
const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const route = routes.get((request.url ?? '/').split('?')[0]);
  if (!route) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const [filename, contentType] = route;
    const content = await readFile(new URL(`../${filename}`, import.meta.url));
    response.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': content.byteLength,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    console.error(error);
    response.writeHead(500).end('Unable to read report');
  }
});
server.on('error', error => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  const address = server.address();
  console.info(
    `Performance report: http://127.0.0.1:${address.port}/performance.html`,
  );
});
const stop = () => {
  server.close();
  server.closeAllConnections();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
