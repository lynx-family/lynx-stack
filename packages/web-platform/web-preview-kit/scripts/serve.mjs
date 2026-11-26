// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Serves the built kit (`dist/kit`) and the demo host (`dist/demo`) on two
 * ports, so that they are on different origins, with the headers of
 * "Deployment requirements" in ARCHITECTURE.md:
 *
 * - every kit response: `Cross-Origin-Embedder-Policy: require-corp` and
 *   `Cross-Origin-Resource-Policy: cross-origin`;
 * - kit HTML: `Document-Isolation-Policy: isolate-and-require-corp`, unless
 *   the URL has `dip=0`;
 * - demo HTML with `isolated=1`: `Cross-Origin-Opener-Policy: same-origin`
 *   and `Cross-Origin-Embedder-Policy: require-corp`, which makes the demo
 *   cross-origin isolated.
 *
 * Usage: node scripts/serve.mjs [--kit-port 4210] [--demo-port 4211]
 */

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.bundle': 'application/octet-stream',
};

/**
 * @typedef {(request: http.IncomingMessage, response: http.ServerResponse, url: URL) => boolean | Promise<boolean>} Route
 *   handles a request and returns true, or returns false to pass it on
 */

/**
 * @param {string} root
 * @param {(url: URL, isHtml: boolean) => Record<string, string>} headersFor
 * @param {Record<string, string>} overrides URL path to file
 * @param {Route[]} routes
 */
function createStaticServer(root, headersFor, overrides, routes) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    try {
      for (const route of routes) {
        if (await route(request, response, url)) {
          return;
        }
      }
      let file = overrides[url.pathname]
        ?? path.join(root, decodeURIComponent(url.pathname));
      if (!file.startsWith(root) && !overrides[url.pathname]) {
        response.writeHead(403).end();
        return;
      }
      let info = await stat(file).catch(() => undefined);
      if (info?.isDirectory()) {
        file = path.join(file, 'index.html');
        info = await stat(file).catch(() => undefined);
      }
      const extension = path.extname(file);
      const headers = {
        'Cache-Control': 'no-store',
        ...headersFor(url, extension === '.html'),
      };
      if (!info?.isFile()) {
        response.writeHead(404, { ...headers, 'Content-Type': 'text/plain' })
          .end('Not found');
        return;
      }
      response.writeHead(200, {
        ...headers,
        'Content-Type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
        'Content-Length': info.size,
      });
      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      createReadStream(file).pipe(response);
    } catch (error) {
      response.writeHead(500).end(String(error));
    }
  });
}

/** The headers of a kit response. */
export function kitHeaders(url, isHtml) {
  return {
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    ...(isHtml && url.searchParams.get('dip') !== '0'
      ? { 'Document-Isolation-Policy': 'isolate-and-require-corp' }
      : {}),
  };
}

/** The headers of a demo response. */
export function demoHeaders(url, isHtml) {
  return {
    'Cross-Origin-Resource-Policy': 'cross-origin',
    ...(isHtml && url.searchParams.get('isolated') === '1'
      ? {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      }
      : {}),
  };
}

function listen(server, port, host) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server.address().port));
  });
}

/**
 * Starts both servers.
 *
 * @param {object} [options]
 * @param {number} [options.kitPort] defaults to 4210; 0 picks a free port
 * @param {number} [options.demoPort] defaults to 4211; 0 picks a free port
 * @param {string} [options.host] defaults to `localhost`
 * @param {string} [options.kitRoot] defaults to `dist/kit`
 * @param {string} [options.demoRoot] defaults to `dist/demo`
 * @param {Record<string, string>} [options.kitOverrides] URL path to a file
 *   served instead, for example a substitute `/bundler-worker.js`
 * @param {Route[]} [options.kitRoutes] extra handlers on the kit origin
 */
export async function startServers(options = {}) {
  const host = options.host ?? 'localhost';
  const kit = createStaticServer(
    path.resolve(options.kitRoot ?? path.join(packageDir, 'dist/kit')),
    kitHeaders,
    options.kitOverrides ?? {},
    options.kitRoutes ?? [],
  );
  const demo = createStaticServer(
    path.resolve(options.demoRoot ?? path.join(packageDir, 'dist/demo')),
    demoHeaders,
    {},
    [],
  );
  const kitPort = await listen(kit, options.kitPort ?? 4210, host);
  const demoPort = await listen(demo, options.demoPort ?? 4211, host);
  return {
    kitOrigin: `http://${host}:${kitPort}`,
    demoOrigin: `http://${host}:${demoPort}`,
    async close() {
      kit.closeAllConnections();
      demo.closeAllConnections();
      await Promise.all([
        new Promise(resolve => kit.close(resolve)),
        new Promise(resolve => demo.close(resolve)),
      ]);
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argument = (name) => {
    const index = process.argv.indexOf(name);
    return index === -1 ? undefined : Number(process.argv[index + 1]);
  };
  const { kitOrigin, demoOrigin } = await startServers({
    kitPort: argument('--kit-port'),
    demoPort: argument('--demo-port'),
  });
  console.log(`kit:  ${kitOrigin}/index.html`);
  console.log(
    `demo: ${demoOrigin}/index.html?kit=${
      encodeURIComponent(`${kitOrigin}/index.html`)
    }`,
  );
  console.log(
    `      add &isolated=1 for an isolated host, &dip=0 to drop Document-Isolation-Policy`,
  );
}
