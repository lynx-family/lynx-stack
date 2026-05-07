// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { networkInterfaces } from 'node:os';

import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

import { createAgentRunner } from './tools/agent/runner.js';

const PORT = Number(process.env.PORT ?? 3000);
const agentRunner = createAgentRunner();

function findLocalIp(): string {
  const ifaces = networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    const list = ifaces[name] ?? [];
    for (
      const net of list as Array<{
        address: string;
        family: string | number;
        internal: boolean;
      }>
    ) {
      const family = typeof net.family === 'string'
        ? net.family
        : `IPv${net.family}`;
      if (family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

function buildRspeedyBundleUrl(port: number): string {
  const ip = findLocalIp();
  return `http://${ip}:${port}/main.lynx.js`;
}

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      index: './src/entry.tsx',
      render: './src/render.tsx',
    },
  },
  server: {
    port: PORT,
    host: '0.0.0.0',
    cors: {
      origin: '*',
    },
    publicDir: [
      {
        name: 'www',
        copyOnBuild: false,
        watch: true,
      },
    ],
  },
  dev: {
    setupMiddlewares: [
      (middlewares) => {
        middlewares.unshift((req, res, next) => {
          void agentRunner.handleRequest(req, res, () => {
            if (req.url?.startsWith('/__rspeedy_url')) {
              const url = buildRspeedyBundleUrl(req.socket.localPort ?? PORT);
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Cache-Control', 'no-store');
              res.end(JSON.stringify({ url }));
              return;
            }
            next();
          });
        });
      },
    ],
  },
});
